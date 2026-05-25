using System.Security.Claims;
using CVerify.API.Core.Entities;

namespace CVerify.API.Application.Interfaces;

public interface ITokenService
{
    string GenerateJwtToken(User user, IEnumerable<string> roles, IEnumerable<string> permissions, Guid? organizationId = null, string? organizationSlug = null);
    string GenerateRefreshToken();
    void SetTokenInsideCookie(string tokenName, string tokenValue, DateTime? expires = null);
    void RemoveTokenFromCookie(string tokenName);
    ClaimsPrincipal? GetPrincipalFromExpiredToken(string token);
}
