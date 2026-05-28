using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Http;
using Microsoft.IdentityModel.Tokens;
using CVerify.API.Modules.Shared.Configuration;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CVerify.API.Modules.Auth.Services;

/// <summary>
/// Service to generate JWT and refresh tokens, and configure security cookies.
/// </summary>
public class TokenService : ITokenService
{
    private readonly EnvConfiguration _config;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly ApplicationDbContext _dbContext;

    public TokenService(EnvConfiguration config, IHttpContextAccessor httpContextAccessor, ApplicationDbContext dbContext)
    {
        _config = config;
        _httpContextAccessor = httpContextAccessor;
        _dbContext = dbContext;
    }

    public string GenerateJwtToken(User user, IEnumerable<string> roles, IEnumerable<string> permissions, Guid? organizationId = null, string? organizationSlug = null, Guid? sessionId = null)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Email, user.Email),
            new(ClaimTypes.Name, user.FullName),
            new("username", user.Username ?? ""),
            new("avatarUrl", user.AvatarUrl ?? ""),
            new("isEmailVerified", (user.EmailVerifiedAt.HasValue || user.Status == UserStatus.ACTIVE).ToString().ToLowerInvariant()),
            new("status", user.Status.ToString()),
            new("session_version", user.SessionVersion.ToString()),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        var adminMember = _dbContext.AdminMembers.AsNoTracking().FirstOrDefault(am => am.UserId == user.Id);
        if (adminMember != null)
        {
            claims.Add(new Claim("admin_session_version", adminMember.SessionVersion.ToString()));
        }

        if (sessionId.HasValue)
        {
            claims.Add(new("sid", sessionId.Value.ToString()));
        }

        if (organizationId.HasValue)
        {
            claims.Add(new("org_id", organizationId.Value.ToString()));
        }
        if (!string.IsNullOrEmpty(organizationSlug))
        {
            claims.Add(new("org_slug", organizationSlug));
        }

        claims.AddRange(roles.Select(role => new Claim(ClaimTypes.Role, role)));

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config.Jwt.Key));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expires = DateTime.UtcNow.AddMinutes(_config.Jwt.DurationInMinutes);

        var token = new JwtSecurityToken(
            _config.Jwt.Issuer,
            _config.Jwt.Audience,
            claims,
            expires: expires,
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public string GenerateCompanyJwtToken(CVerify.API.Modules.Auth.Entities.OrganizationCredential credential, IEnumerable<string> roles, IEnumerable<string> permissions, Guid? sessionId = null)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, credential.OrganizationId.ToString()),
            new(ClaimTypes.Name, credential.Username),
            new("actor_type", "business"),
            new("isEmailVerified", "true"),
            new("status", "ACTIVE"),
            new("session_version", "1"),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        if (sessionId.HasValue)
        {
            claims.Add(new("sid", sessionId.Value.ToString()));
        }

        claims.Add(new("org_id", credential.OrganizationId.ToString()));
        claims.Add(new("org_slug", credential.Username));

        claims.AddRange(roles.Select(role => new Claim(ClaimTypes.Role, role)));

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config.Jwt.Key));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expires = DateTime.UtcNow.AddMinutes(_config.Jwt.DurationInMinutes);

        var token = new JwtSecurityToken(
            _config.Jwt.Issuer,
            _config.Jwt.Audience,
            claims,
            expires: expires,
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public string GenerateRefreshToken()
    {
        var randomNumber = new byte[64];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(randomNumber);
        return Convert.ToBase64String(randomNumber);
    }

    public void SetTokenInsideCookie(string tokenName, string tokenValue, DateTime? expires = null)
    {
        var isDevelopment = string.Equals(Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"), "Development", StringComparison.OrdinalIgnoreCase);
        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = !isDevelopment, // Secure only in production, false in local development HTTP
            SameSite = SameSiteMode.Lax,
            Path = "/",
            Expires = expires ?? DateTime.UtcNow.AddDays(7)
        };

        _httpContextAccessor.HttpContext?.Response.Cookies.Append(tokenName, tokenValue, cookieOptions);
    }

    public void RemoveTokenFromCookie(string tokenName)
    {
        var isDevelopment = string.Equals(Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"), "Development", StringComparison.OrdinalIgnoreCase);
        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = !isDevelopment,
            SameSite = SameSiteMode.Lax,
            Path = "/"
        };

        _httpContextAccessor.HttpContext?.Response.Cookies.Delete(tokenName, cookieOptions);
    }

    public ClaimsPrincipal? GetPrincipalFromExpiredToken(string token)
    {
        var tokenValidationParameters = new TokenValidationParameters
        {
            ValidateAudience = false,
            ValidateIssuer = false,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config.Jwt.Key)),
            ValidateLifetime = false
        };

        var tokenHandler = new JwtSecurityTokenHandler();
        var principal = tokenHandler.ValidateToken(token, tokenValidationParameters, out var securityToken);
        if (securityToken is not JwtSecurityToken jwtSecurityToken || 
             !jwtSecurityToken.Header.Alg.Equals(SecurityAlgorithms.HmacSha256, StringComparison.InvariantCultureIgnoreCase))
        {
            throw new SecurityTokenException("Invalid token");
        }

        return principal;
    }
}
