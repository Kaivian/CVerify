using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using CVerify.API.Application.DTOs;
using CVerify.API.Application.Exceptions;
using CVerify.API.Application.Interfaces;
using Microsoft.Extensions.DependencyInjection;
using CVerify.API.Infrastructure.Persistence;
using CVerify.API.Core.Entities;
using CVerify.API.Core.Enums;
using CVerify.API.Infrastructure.Configuration;
using CVerify.API.Infrastructure.Security;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using System.Net.Http;
using System.Text.Json;

namespace CVerify.API.API.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly IIdentityStateResolver _identityStateResolver;

    public AuthController(IAuthService authService, IIdentityStateResolver identityStateResolver)
    {
        _authService = authService;
        _identityStateResolver = identityStateResolver;
    }

    [HttpPost("login")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(AuthResponse))]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var response = await _authService.LoginAsync(request);
        if (response == null)
        {
            throw new AuthenticationException(AuthErrorCodes.InvalidCredentials);
        }

        return Ok(response);
    }

    [HttpPost("google")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(AuthResponse))]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> LoginWithGoogle([FromBody] GoogleLoginRequest request)
    {
        var response = await _authService.LoginWithGoogleAsync(request);
        if (response == null)
        {
            throw new AuthenticationException(AuthErrorCodes.InvalidCredentials, "Google authentication failed");
        }

        return Ok(response);
    }

    [HttpPost("logout")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> Logout()
    {
        await _authService.LogoutAsync();
        return Ok(new { message = "Logged out successfully" });
    }

    [HttpPost("refresh-token")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(AuthResponse))]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> RefreshToken()
    {
        var response = await _authService.RefreshTokenAsync();
        if (response == null)
        {
            throw new AuthenticationException(AuthErrorCodes.Unauthorized, "Invalid refresh token");
        }

        return Ok(response);
    }

    [HttpGet("me")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(UserProfileResponse))]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetMe()
    {
        var response = await _authService.GetMeAsync();
        if (response == null)
        {
            throw new ResourceNotFoundException("USER_NOT_FOUND", "User not found");
        }

        return Ok(response);
    }

    [HttpPost("register")]
    [AllowAnonymous]
    [EnableRateLimiting("RegisterLimit")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(RegisterResponse))]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request, CancellationToken cancellationToken)
    {
        var userAgent = Request.Headers["User-Agent"].ToString();
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";

        var result = await _authService.RegisterAsync(request, userAgent, ipAddress, cancellationToken);
        return Ok(result);
    }

    [HttpPost("verify-email")]
    [AllowAnonymous]
    [EnableRateLimiting("VerifyEmailLimit")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(AuthResponse))]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> VerifyEmail([FromBody] VerifyEmailRequest request, CancellationToken cancellationToken)
    {
        var result = await _authService.VerifyEmailAsync(request, cancellationToken);
        if (result != null)
        {
            return Ok(result);
        }

        throw new AuthenticationException(AuthErrorCodes.InvalidToken, "Email verification failed.");
    }

    [HttpPost("resend-verification")]
    [AllowAnonymous]
    [EnableRateLimiting("ResendVerificationLimit")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ResendVerification([FromBody] ResendVerificationRequest request, CancellationToken cancellationToken)
    {
        var result = await _authService.ResendVerificationEmailAsync(request, cancellationToken);
        if (result)
        {
            return Ok(new { message = "If the email is eligible, a new verification link has been sent." });
        }

        throw new BusinessRuleException("EMAIL_RESEND_FAILED", "Failed to resend verification email.");
    }

    [HttpPost("forgot-password")]
    [AllowAnonymous]
    [EnableRateLimiting("ForgotPasswordLimit")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request, CancellationToken cancellationToken)
    {
        var result = await _authService.ForgotPasswordAsync(request, cancellationToken);
        if (result)
        {
            return Ok(new { message = "If the email is registered, a password reset link has been sent." });
        }

        throw new BusinessRuleException("FORGOT_PASSWORD_FAILED", "Forgot password request failed.");
    }

    [HttpPost("reset-password")]
    [AllowAnonymous]
    [EnableRateLimiting("ResetPasswordLimit")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(AuthResponse))]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request, CancellationToken cancellationToken)
    {
        var result = await _authService.ResetPasswordAsync(request, cancellationToken);
        if (result != null)
        {
            return Ok(result);
        }

        throw new AuthenticationException(AuthErrorCodes.InvalidToken, "Password reset failed.");
    }

    [HttpDelete("/api/users/me")]
    [HttpDelete("me")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> DeleteMe()
    {
        var result = await _authService.DeleteMeAsync();
        if (result)
        {
            return Ok(new { message = "Account successfully deleted." });
        }
        throw new BusinessRuleException("ACCOUNT_DELETION_FAILED", "Account deletion failed.");
    }

    [HttpGet("providers")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(IEnumerable<LinkedProviderDto>))]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetLinkedProviders()
    {
        var result = await _authService.GetLinkedProvidersAsync();
        return Ok(result);
    }

    [HttpDelete("providers/{providerName}")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> UnlinkProvider(string providerName)
    {
        try
        {
            var result = await _authService.UnlinkProviderAsync(providerName);
            return Ok(new { success = result, message = "Provider successfully unlinked." });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (ResourceNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpPost("providers/{providerName}/validate-scopes")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ValidateProviderScopes(string providerName)
    {
        try
        {
            var result = await _authService.ValidateProviderScopesAsync(providerName);
            return Ok(new { valid = result });
        }
        catch (ResourceNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpPost("providers/google")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> LinkGoogleAccount([FromBody] LinkGoogleRequest request, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        try
        {
            var result = await _authService.LinkGoogleAccountAsync(request, cancellationToken);
            return Ok(new { success = result, message = "Google account successfully linked." });
        }
        catch (AuthException ex)
        {
            return BadRequest(new { code = ex.Code, message = ex.Message });
        }
        catch (ResourceNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpPost("change-password")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        try
        {
            var result = await _authService.ChangePasswordAsync(request, cancellationToken);
            return Ok(new { success = result, message = "Password successfully changed." });
        }
        catch (AuthException ex)
        {
            return BadRequest(new { code = ex.Code, message = ex.Message });
        }
        catch (ResourceNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpGet("connect/{providerName}")]
    [Authorize]
    public IActionResult ConnectProvider(string providerName)
    {
        var envConfig = HttpContext.RequestServices.GetRequiredService<EnvConfiguration>();
        var canonicalName = providerName.ToLowerInvariant();

        if (canonicalName != "github" && canonicalName != "gitlab" && canonicalName != "google")
        {
            return BadRequest(new { message = $"Unsupported provider: {providerName}" });
        }

        var state = Guid.NewGuid().ToString("N");
        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = HttpContext.Request.IsHttps || HttpContext.Request.Headers["X-Forwarded-Proto"] == "https",
            SameSite = SameSiteMode.Lax,
            Expires = DateTimeOffset.UtcNow.AddMinutes(5)
        };
        Response.Cookies.Append($"oauth_state_{canonicalName}", state, cookieOptions);

        var callbackUri = $"{Request.Scheme}://{Request.Host}/api/auth/callback/{canonicalName}";

        string redirectUrl;
        if (canonicalName == "github")
        {
            var clientId = envConfig.Auth.GithubClientId;
            if (string.IsNullOrEmpty(clientId))
            {
                return BadRequest(new { message = "GitHub Client ID is not configured." });
            }
            redirectUrl = $"https://github.com/login/oauth/authorize?client_id={clientId}&redirect_uri={Uri.EscapeDataString(callbackUri)}&scope=repo,read:user,user:email,read:org&state={state}";
        }
        else if (canonicalName == "gitlab")
        {
            var clientId = envConfig.Auth.GitlabClientId;
            if (string.IsNullOrEmpty(clientId))
            {
                return BadRequest(new { message = "GitLab Client ID is not configured." });
            }
            redirectUrl = $"https://gitlab.com/oauth/authorize?client_id={clientId}&redirect_uri={Uri.EscapeDataString(callbackUri)}&response_type=code&state={state}&scope=read_repository+read_api";
        }
        else // google
        {
            var clientId = envConfig.Auth.GoogleClientId;
            if (string.IsNullOrEmpty(clientId))
            {
                return BadRequest(new { message = "Google Client ID is not configured." });
            }
            redirectUrl = $"https://accounts.google.com/o/oauth2/v2/auth?client_id={clientId}&redirect_uri={Uri.EscapeDataString(callbackUri)}&response_type=code&scope=openid%20email%20profile&state={state}";
        }

        return Redirect(redirectUrl);
    }

    [HttpGet("callback/{providerName}")]
    [AllowAnonymous]
    public async Task<IActionResult> OAuthCallback(string providerName, [FromQuery] string code, [FromQuery] string state, CancellationToken cancellationToken)
    {
        var envConfig = HttpContext.RequestServices.GetRequiredService<EnvConfiguration>();
        var canonicalName = providerName.ToLowerInvariant();

        if (canonicalName != "github" && canonicalName != "gitlab" && canonicalName != "google")
        {
            return Redirect($"{envConfig.Auth.FrontendUrl}/settings?tab=account&error=unsupported_provider");
        }

        var savedState = Request.Cookies[$"oauth_state_{canonicalName}"];
        if (string.IsNullOrEmpty(savedState) || savedState != state)
        {
            return Redirect($"{envConfig.Auth.FrontendUrl}/settings?tab=account&error=state_mismatch");
        }

        Response.Cookies.Delete($"oauth_state_{canonicalName}");

        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdStr) || !Guid.TryParse(userIdStr, out var userId))
        {
            return Redirect($"{envConfig.Auth.FrontendUrl}/settings?tab=account&error=unauthenticated");
        }

        var dbContext = HttpContext.RequestServices.GetRequiredService<ApplicationDbContext>();
        var timeProvider = HttpContext.RequestServices.GetRequiredService<TimeProvider>();
        var httpClientFactory = HttpContext.RequestServices.GetRequiredService<IHttpClientFactory>();

        string? accessToken = null;
        string? refreshToken = null;
        int? expiresIn = null;

        var callbackUri = $"{Request.Scheme}://{Request.Host}/api/auth/callback/{canonicalName}";
        var httpClient = httpClientFactory.CreateClient();

        string providerKey = "";
        string? providerEmail = null;
        string? providerUsername = null;

        try
        {
            if (canonicalName == "github")
            {
                var content = new FormUrlEncodedContent(new Dictionary<string, string>
                {
                    { "client_id", envConfig.Auth.GithubClientId ?? "" },
                    { "client_secret", envConfig.Auth.GithubClientSecret ?? "" },
                    { "code", code },
                    { "redirect_uri", callbackUri }
                });

                var tokenRequest = new HttpRequestMessage(HttpMethod.Post, "https://github.com/login/oauth/access_token")
                {
                    Content = content
                };
                tokenRequest.Headers.Accept.ParseAdd("application/json");

                var tokenResponse = await httpClient.SendAsync(tokenRequest, cancellationToken);
                if (!tokenResponse.IsSuccessStatusCode)
                {
                    return Redirect($"{envConfig.Auth.FrontendUrl}/settings?tab=account&error=token_exchange_failed");
                }

                var jsonStr = await tokenResponse.Content.ReadAsStringAsync(cancellationToken);
                var tokenData = JsonSerializer.Deserialize<Dictionary<string, object>>(jsonStr);
                if (tokenData == null || !tokenData.ContainsKey("access_token"))
                {
                    return Redirect($"{envConfig.Auth.FrontendUrl}/settings?tab=account&error=token_exchange_failed");
                }

                accessToken = tokenData["access_token"].ToString();

                // Fetch User Details
                var profileRequest = new HttpRequestMessage(HttpMethod.Get, "https://api.github.com/user");
                profileRequest.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);
                profileRequest.Headers.UserAgent.ParseAdd("CVerify-Core");

                var profileResponse = await httpClient.SendAsync(profileRequest, cancellationToken);
                if (!profileResponse.IsSuccessStatusCode)
                {
                    return Redirect($"{envConfig.Auth.FrontendUrl}/settings?tab=account&error=profile_fetch_failed");
                }

                var profileJson = await profileResponse.Content.ReadAsStringAsync(cancellationToken);
                var profileData = JsonSerializer.Deserialize<Dictionary<string, object>>(profileJson);
                if (profileData == null || !profileData.ContainsKey("id"))
                {
                    return Redirect($"{envConfig.Auth.FrontendUrl}/settings?tab=account&error=profile_fetch_failed");
                }

                providerKey = profileData["id"].ToString() ?? "";
                providerUsername = profileData.ContainsKey("login") ? profileData["login"]?.ToString() : null;
                providerEmail = profileData.ContainsKey("email") ? profileData["email"]?.ToString() : null;
            }
            else if (canonicalName == "gitlab")
            {
                var content = new FormUrlEncodedContent(new Dictionary<string, string>
                {
                    { "client_id", envConfig.Auth.GitlabClientId ?? "" },
                    { "client_secret", envConfig.Auth.GitlabClientSecret ?? "" },
                    { "code", code },
                    { "grant_type", "authorization_code" },
                    { "redirect_uri", callbackUri }
                });

                var tokenResponse = await httpClient.PostAsync("https://gitlab.com/oauth/token", content, cancellationToken);
                if (!tokenResponse.IsSuccessStatusCode)
                {
                    return Redirect($"{envConfig.Auth.FrontendUrl}/settings?tab=account&error=token_exchange_failed");
                }

                var jsonStr = await tokenResponse.Content.ReadAsStringAsync(cancellationToken);
                var tokenData = JsonSerializer.Deserialize<Dictionary<string, object>>(jsonStr);
                if (tokenData == null || !tokenData.ContainsKey("access_token"))
                {
                    return Redirect($"{envConfig.Auth.FrontendUrl}/settings?tab=account&error=token_exchange_failed");
                }

                accessToken = tokenData["access_token"].ToString();
                refreshToken = tokenData.ContainsKey("refresh_token") ? tokenData["refresh_token"]?.ToString() : null;
                if (tokenData.ContainsKey("expires_in") && int.TryParse(tokenData["expires_in"]?.ToString(), out var parsedExpires))
                {
                    expiresIn = parsedExpires;
                }

                // Fetch User Details
                var profileRequest = new HttpRequestMessage(HttpMethod.Get, "https://gitlab.com/api/v4/user");
                profileRequest.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);

                var profileResponse = await httpClient.SendAsync(profileRequest, cancellationToken);
                if (!profileResponse.IsSuccessStatusCode)
                {
                    return Redirect($"{envConfig.Auth.FrontendUrl}/settings?tab=account&error=profile_fetch_failed");
                }

                var profileJson = await profileResponse.Content.ReadAsStringAsync(cancellationToken);
                var profileData = JsonSerializer.Deserialize<Dictionary<string, object>>(profileJson);
                if (profileData == null || !profileData.ContainsKey("id"))
                {
                    return Redirect($"{envConfig.Auth.FrontendUrl}/settings?tab=account&error=profile_fetch_failed");
                }

                providerKey = profileData["id"].ToString() ?? "";
                providerUsername = profileData.ContainsKey("username") ? profileData["username"]?.ToString() : null;
                providerEmail = profileData.ContainsKey("email") ? profileData["email"]?.ToString() : null;
            }
            else // google
            {
                var content = new FormUrlEncodedContent(new Dictionary<string, string>
                {
                    { "client_id", envConfig.Auth.GoogleClientId ?? "" },
                    { "client_secret", envConfig.Auth.GoogleClientSecret ?? "" },
                    { "code", code },
                    { "grant_type", "authorization_code" },
                    { "redirect_uri", callbackUri }
                });

                var tokenResponse = await httpClient.PostAsync("https://oauth2.googleapis.com/token", content, cancellationToken);
                if (!tokenResponse.IsSuccessStatusCode)
                {
                    return Redirect($"{envConfig.Auth.FrontendUrl}/settings?tab=account&error=token_exchange_failed");
                }

                var jsonStr = await tokenResponse.Content.ReadAsStringAsync(cancellationToken);
                var tokenData = JsonSerializer.Deserialize<Dictionary<string, object>>(jsonStr);
                if (tokenData == null || !tokenData.ContainsKey("access_token"))
                {
                    return Redirect($"{envConfig.Auth.FrontendUrl}/settings?tab=account&error=token_exchange_failed");
                }

                accessToken = tokenData["access_token"].ToString();
                if (tokenData.ContainsKey("expires_in") && int.TryParse(tokenData["expires_in"]?.ToString(), out var parsedExpires))
                {
                    expiresIn = parsedExpires;
                }

                // Fetch User Details
                var profileResponse = await httpClient.GetAsync($"https://www.googleapis.com/oauth2/v3/userinfo?access_token={accessToken}", cancellationToken);
                if (!profileResponse.IsSuccessStatusCode)
                {
                    return Redirect($"{envConfig.Auth.FrontendUrl}/settings?tab=account&error=profile_fetch_failed");
                }

                var profileJson = await profileResponse.Content.ReadAsStringAsync(cancellationToken);
                var profileData = JsonSerializer.Deserialize<Dictionary<string, object>>(profileJson);
                if (profileData == null || !profileData.ContainsKey("sub"))
                {
                    return Redirect($"{envConfig.Auth.FrontendUrl}/settings?tab=account&error=profile_fetch_failed");
                }

                providerKey = profileData["sub"].ToString() ?? "";
                providerEmail = profileData.ContainsKey("email") ? profileData["email"]?.ToString() : null;
                providerUsername = providerEmail; // Google doesn't have usernames, fallback to email
            }
        }
        catch (Exception ex)
        {
            return Redirect($"{envConfig.Auth.FrontendUrl}/settings?tab=account&error=exception&details={Uri.EscapeDataString(ex.Message)}");
        }

        if (string.IsNullOrEmpty(accessToken))
        {
            return Redirect($"{envConfig.Auth.FrontendUrl}/settings?tab=account&error=token_exchange_failed");
        }

        // Check if provider accounts are already linked to someone else
        var duplicateProvider = await dbContext.AuthProviders
            .FirstOrDefaultAsync(ap => ap.ProviderName == canonicalName && ap.ProviderKey == providerKey && ap.UserId != userId && ap.DeletedAt == null, cancellationToken);

        if (duplicateProvider != null)
        {
            return Redirect($"{envConfig.Auth.FrontendUrl}/settings?tab=account&error=provider_already_linked");
        }

        // Encrypt credentials
        if (string.IsNullOrEmpty(envConfig.Security.TokenEncryptionKey))
        {
            return Redirect($"{envConfig.Auth.FrontendUrl}/settings?tab=account&error=encryption_key_missing");
        }

        var encryptedAccess = EncryptionHelper.Encrypt(accessToken, envConfig.Security.TokenEncryptionKey);
        var encryptedRefresh = !string.IsNullOrEmpty(refreshToken) ? EncryptionHelper.Encrypt(refreshToken, envConfig.Security.TokenEncryptionKey) : null;
        var expiryTime = expiresIn.HasValue ? timeProvider.GetUtcNow().AddSeconds(expiresIn.Value) : (DateTimeOffset?)null;

        var existingProvider = await dbContext.AuthProviders
            .Include(ap => ap.OAuthCredential)
            .FirstOrDefaultAsync(ap => ap.UserId == userId && ap.ProviderName == canonicalName && ap.DeletedAt == null, cancellationToken);

        if (existingProvider != null)
        {
            existingProvider.ProviderKey = providerKey;
            existingProvider.ProviderAccountId = providerEmail ?? providerUsername ?? providerKey;
            existingProvider.ScopeValidationStatus = ProviderScopeStatus.Valid;
            existingProvider.LastScopeValidationAt = timeProvider.GetUtcNow();
            existingProvider.LastProviderSyncAt = timeProvider.GetUtcNow();
            existingProvider.LastSuccessfulRefreshAt = timeProvider.GetUtcNow();
            existingProvider.RefreshFailureCount = 0;

            if (existingProvider.OAuthCredential != null)
            {
                existingProvider.OAuthCredential.EncryptedAccessToken = encryptedAccess;
                existingProvider.OAuthCredential.EncryptedRefreshToken = encryptedRefresh;
                existingProvider.OAuthCredential.ExpiresAt = expiryTime;
                existingProvider.OAuthCredential.UpdatedAt = timeProvider.GetUtcNow();
            }
            else
            {
                existingProvider.OAuthCredential = new OAuthCredential
                {
                    AuthProviderId = existingProvider.Id,
                    EncryptedAccessToken = encryptedAccess,
                    EncryptedRefreshToken = encryptedRefresh,
                    ExpiresAt = expiryTime,
                    UpdatedAt = timeProvider.GetUtcNow()
                };
            }
        }
        else
        {
            var newProvider = new AuthProvider
            {
                Id = Guid.CreateVersion7(),
                UserId = userId,
                ProviderName = canonicalName,
                ProviderKey = providerKey,
                ProviderAccountId = providerEmail ?? providerUsername ?? providerKey,
                ScopeValidationStatus = ProviderScopeStatus.Valid,
                LastScopeValidationAt = timeProvider.GetUtcNow(),
                LastProviderSyncAt = timeProvider.GetUtcNow(),
                LastSuccessfulRefreshAt = timeProvider.GetUtcNow(),
                CreatedAt = timeProvider.GetUtcNow()
            };

            var credential = new OAuthCredential
            {
                AuthProviderId = newProvider.Id,
                EncryptedAccessToken = encryptedAccess,
                EncryptedRefreshToken = encryptedRefresh,
                ExpiresAt = expiryTime,
                UpdatedAt = timeProvider.GetUtcNow()
            };

            newProvider.OAuthCredential = credential;
            dbContext.AuthProviders.Add(newProvider);
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        await _identityStateResolver.InvalidateCacheAsync(User.FindFirst(ClaimTypes.Email)?.Value ?? "");

        return Redirect($"{envConfig.Auth.FrontendUrl}/settings?tab=account&link_success=true&provider={canonicalName}");
    }

    [HttpPost("send-otp")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(SendOtpResponse))]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> SendOtp([FromBody] SendOtpRequest request, CancellationToken cancellationToken)
    {
        var userAgent = Request.Headers["User-Agent"].ToString();
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";

        try
        {
            var result = await _authService.SendOtpAsync(request, userAgent, ipAddress, cancellationToken);
            return Ok(result);
        }
        catch (AuthException ex)
        {
            return BadRequest(new { code = ex.Code, message = ex.Message });
        }
    }

    [HttpPost("resolve-email-auth-state")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(ResolveEmailAuthStateResponse))]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ResolveEmailAuthState(
        [FromBody] ResolveEmailAuthStateRequest request,
        CancellationToken cancellationToken)
    {
        var state = await _identityStateResolver.ResolveAsync(request.Email, cancellationToken);
        return Ok(new ResolveEmailAuthStateResponse(state));
    }

    [HttpPost("verify-otp")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(VerifyOtpResponse))]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> VerifyOtp([FromBody] VerifyOtpRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _authService.VerifyOtpAsync(request, cancellationToken);
            return Ok(result);
        }
        catch (AuthException ex)
        {
            return BadRequest(new { code = ex.Code, message = ex.Message });
        }
    }

    [HttpGet("otp/session")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(OtpSessionResponse))]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetOtpSession([FromQuery] string email, [FromQuery] string purpose, [FromQuery] Guid challengeId, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(email) || challengeId == Guid.Empty)
        {
            return BadRequest(new { message = "Invalid query parameters." });
        }

        try
        {
            var response = await _authService.GetActiveOtpSessionAsync(email, purpose, challengeId, cancellationToken);
            return Ok(response);
        }
        catch (AuthException)
        {
            // Safe, generic response to mask presence of actual account structure
            return Ok(new OtpSessionResponse(false, null, purpose, null, null, string.Empty, "INVALIDATED"));
        }
    }

    [HttpPost("create-password")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(AuthResponse))]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreatePassword([FromBody] CreatePasswordRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _authService.CreatePasswordAsync(request, cancellationToken);
            return Ok(result);
        }
        catch (AuthException ex)
        {
            return BadRequest(new { code = ex.Code, message = ex.Message });
        }
    }

    [HttpPost("register-company")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> RegisterCompany([FromBody] RegisterCompanyRequest request, CancellationToken cancellationToken)
    {
        var userAgent = Request.Headers["User-Agent"].ToString();
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";

        try
        {
            var result = await _authService.RegisterCompanyAsync(request, userAgent, ipAddress, cancellationToken);
            return Ok(new { success = result });
        }
        catch (AuthException ex)
        {
            return BadRequest(new { code = ex.Code, message = ex.Message });
        }
    }

    [HttpPost("verify-company-link")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(VerifyCompanyLinkResponse))]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> VerifyCompanyLink([FromBody] VerifyCompanyLinkRequest request, CancellationToken cancellationToken)
    {
        var userAgent = Request.Headers["User-Agent"].ToString();
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";

        try
        {
            var result = await _authService.VerifyCompanyLinkAsync(request, userAgent, ipAddress, cancellationToken);
            return Ok(result);
        }
        catch (AuthException ex)
        {
            return BadRequest(new { code = ex.Code, message = ex.Message });
        }
    }

    [HttpPost("setup-workspace")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(AuthResponse))]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> SetupWorkspace([FromBody] SetupWorkspaceRequest request, CancellationToken cancellationToken)
    {
        var userAgent = Request.Headers["User-Agent"].ToString();
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";

        try
        {
            var result = await _authService.SetupWorkspaceAsync(request, userAgent, ipAddress, cancellationToken);
            return Ok(result);
        }
        catch (AuthException ex)
        {
            return BadRequest(new { code = ex.Code, message = ex.Message });
        }
    }

    [HttpPost("company-login")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(AuthResponse))]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> CompanyLogin([FromBody] OrganizationLoginRequest request)
    {
        var userAgent = Request.Headers["User-Agent"].ToString();
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";

        var response = await _authService.CompanyLoginAsync(request, userAgent, ipAddress);
        if (response == null)
        {
            return Unauthorized(new { code = AuthErrorCodes.InvalidCredentials, message = "Invalid workspace username or password" });
        }

        return Ok(response);
    }

    [HttpPost("onboarding/verify-company")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(VerifyCompanyOnboardingResponse))]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> VerifyCompanyOnboarding(
        [FromBody] VerifyCompanyOnboardingRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await _authService.VerifyCompanyOnboardingAsync(request, cancellationToken);
            return Ok(result);
        }
        catch (AuthException ex)
        {
            return BadRequest(new { code = ex.Code, message = ex.Message });
        }
    }

    [HttpPost("onboarding/verify-otp")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(VerifyOtpResponse))]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> VerifyOnboardingOtp(
        [FromBody] VerifyOtpRequest request,
        [FromHeader(Name = "X-Step1-Token")] string step1Token,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await _authService.VerifyOnboardingOtpAsync(request, step1Token, cancellationToken);
            return Ok(result);
        }
        catch (AuthException ex)
        {
            return BadRequest(new { code = ex.Code, message = ex.Message });
        }
    }

    [HttpPost("onboarding/verify-google")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(VerifyOtpResponse))]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> VerifyOnboardingGoogle(
        [FromBody] GoogleOnboardingLinkRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await _authService.VerifyOnboardingGoogleAsync(request, cancellationToken);
            return Ok(result);
        }
        catch (AuthException ex)
        {
            return BadRequest(new { code = ex.Code, message = ex.Message });
        }
    }

    [HttpPost("onboarding/complete")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(AuthResponse))]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CompleteOnboarding(
        [FromBody] CompleteOnboardingRequest request,
        CancellationToken cancellationToken)
    {
        var userAgent = Request.Headers["User-Agent"].ToString();
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";

        try
        {
            var result = await _authService.CompleteOnboardingAsync(request, userAgent, ipAddress, cancellationToken);
            return Ok(result);
        }
        catch (AuthException ex)
        {
            return BadRequest(new { code = ex.Code, message = ex.Message });
        }
    }

    [HttpGet("sessions")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(IEnumerable<SessionInfo>))]
    public async Task<IActionResult> GetActiveSessions()
    {
        var sessions = await _authService.GetActiveSessionsAsync();
        return Ok(sessions);
    }

    [HttpDelete("sessions/{sessionId:guid}")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> RevokeSession([FromRoute] Guid sessionId)
    {
        var result = await _authService.RevokeSessionAsync(sessionId);
        if (result)
        {
            return Ok(new { message = "Session revoked successfully" });
        }
        return BadRequest(new { message = "Failed to revoke session" });
    }
}
