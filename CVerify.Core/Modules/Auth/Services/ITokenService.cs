using System.Security.Claims;
using CVerify.API.Modules.Shared.Domain.Entities;

namespace CVerify.API.Modules.Auth.Services;

public interface ITokenService
{
    string GenerateJwtToken(User user, IEnumerable<string> roles, IEnumerable<string> permissions, Guid? organizationId = null, string? organizationSlug = null, Guid? sessionId = null);
    string GenerateOrganizationJwtToken(CVerify.API.Modules.Auth.Entities.OrganizationCredential credential, IEnumerable<string> roles, IEnumerable<string> permissions, Guid? sessionId = null);
    [Obsolete("Use GenerateOrganizationJwtToken instead")]
    string GenerateCompanyJwtToken(CVerify.API.Modules.Auth.Entities.OrganizationCredential credential, IEnumerable<string> roles, IEnumerable<string> permissions, Guid? sessionId = null);
    string GenerateRefreshToken();
    void SetTokenInsideCookie(string tokenName, string tokenValue, DateTime? expires = null);
    void RemoveTokenFromCookie(string tokenName);
    ClaimsPrincipal? GetPrincipalFromExpiredToken(string token);
}
