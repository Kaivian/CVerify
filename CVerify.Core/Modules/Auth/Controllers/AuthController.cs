using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Net.Http;
using System.Security.Claims;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Auth.DTOs;
using CVerify.API.Modules.Auth.Entities;
using CVerify.API.Modules.Auth.Services;
using CVerify.API.Modules.Shared.Configuration;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Exceptions;
using CVerify.API.Modules.Shared.Exceptions.Catalogs;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.Security;
using CVerify.API.Modules.Shared.System.Services;

namespace CVerify.API.Modules.Auth.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private const string ProviderGitHub = "github";
    private const string ProviderGitLab = "gitlab";
    private const string ProviderGoogle = "google";

    private readonly IAuthService _authService;
    private readonly IIdentityStateResolver _identityStateResolver;
    private readonly ILogger<AuthController> _logger;
    private readonly IWorkspaceProvisioningService _workspaceProvisioningService;

    public AuthController(
        IAuthService authService,
        IIdentityStateResolver identityStateResolver,
        ILogger<AuthController> logger,
        IWorkspaceProvisioningService workspaceProvisioningService)
    {
        _authService = authService;
        _identityStateResolver = identityStateResolver;
        _logger = logger;
        _workspaceProvisioningService = workspaceProvisioningService;
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

    [HttpGet("/api/users/me/deletion-requirements")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(DeletionRequirementsDto))]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetDeletionRequirements()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var userId))
        {
            return Unauthorized();
        }
        var requirements = await _authService.GetDeletionRequirementsAsync(userId);
        return Ok(requirements);
    }

    [HttpPost("/api/users/me/delete-request")]
    [Authorize]
    [EnableRateLimiting("ResetPasswordLimit")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(DeletionInitiationResponse))]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> InitiateDeletion([FromBody] InitiateDeletionRequest request)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var userId))
        {
            return Unauthorized();
        }
        var response = await _authService.InitiateDeletionAsync(userId, request);
        if (response.Success)
        {
            return Ok(response);
        }
        return BadRequest(response);
    }

    [HttpPost("/api/users/me/fallback-otp")]
    [Authorize]
    [EnableRateLimiting("ForgotPasswordLimit")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(SendOtpResponse))]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> InitiateFallbackOtp([FromBody] FallbackOtpRequest request)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var userId))
        {
            return Unauthorized();
        }
        var response = await _authService.InitiateFallbackOtpAsync(userId, request, HttpContext.RequestAborted);
        return Ok(response);
    }

    [HttpGet("/api/users/me/connect-reauth/{providerName}")]
    [Authorize]
    [EnableRateLimiting("ForgotPasswordLimit")]
    public async Task<IActionResult> ConnectReauth(string providerName)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var userId))
        {
            return Unauthorized();
        }
        var envConfig = HttpContext.RequestServices.GetRequiredService<EnvConfiguration>();
        var baseUri = string.IsNullOrEmpty(envConfig.Auth.BackendUrl) 
            ? $"{Request.Scheme}://{Request.Host}" 
            : envConfig.Auth.BackendUrl.TrimEnd('/');

        try
        {
            var redirectUrl = await _authService.GetOAuthReauthUrlAsync(userId, providerName, baseUri);
            return Redirect(redirectUrl);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("/api/users/me/callback-reauth/{providerName}")]
    [AllowAnonymous]
    [EnableRateLimiting("ForgotPasswordLimit")]
    public async Task<IActionResult> OAuthReauthCallback(string providerName, [FromQuery] string code, [FromQuery] string state, CancellationToken cancellationToken)
    {
        var envConfig = HttpContext.RequestServices.GetRequiredService<EnvConfiguration>();
        var parts = state.Split(':');
        if (parts.Length != 2 || !Guid.TryParse(parts[0], out var userId))
        {
            return Redirect($"{envConfig.Auth.FrontendUrl}/settings?tab=account&error=state_mismatch");
        }

        try
        {
            var deletionAuthToken = await _authService.ProcessOAuthReauthCallbackAsync(providerName, code, state, cancellationToken);
            return Redirect($"{envConfig.Auth.FrontendUrl}/settings?tab=account&reauth_success=true&deletion_authorize_token={deletionAuthToken}");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "OAuth re-authentication callback failed.");
            return Redirect($"{envConfig.Auth.FrontendUrl}/settings?tab=account&error=reauth_failed&details={Uri.EscapeDataString(ex.Message)}");
        }
    }

    [HttpPost("reactivate")]
    [AllowAnonymous]
    [EnableRateLimiting("ResetPasswordLimit")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(AuthResponse))]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ReactivateAccount([FromBody] ReactivateRequest request)
    {
        if (string.IsNullOrEmpty(request.ReactivationToken))
        {
            return BadRequest(new { message = "Reactivation token is required." });
        }
        var response = await _authService.ReactivateAccountAsync(request.ReactivationToken, HttpContext.RequestAborted);
        if (response != null)
        {
            return Ok(response);
        }
        return BadRequest(new { message = "Failed to reactivate account. Token may be expired or invalid." });
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
    public async Task<IActionResult> ConnectProvider(string providerName)
    {
        var envConfig = HttpContext.RequestServices.GetRequiredService<EnvConfiguration>();
        var dbContext = HttpContext.RequestServices.GetRequiredService<ApplicationDbContext>();
        var canonicalName = providerName.ToLowerInvariant();

        if (canonicalName != ProviderGitHub && canonicalName != ProviderGitLab && canonicalName != ProviderGoogle)
        {
            return BadRequest(new { message = $"Unsupported provider: {providerName}" });
        }

        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var userId))
        {
            return Unauthorized();
        }

        if (canonicalName == ProviderGitHub || canonicalName == ProviderGitLab)
        {
            var activeCount = await dbContext.AuthProviders
                .CountAsync(ap => ap.UserId == userId && ap.ProviderName.ToLower() == canonicalName.ToLower() && ap.DeletedAt == null);
            if (activeCount >= 3)
            {
                return BadRequest(new { message = $"Maximum limit of 3 linked accounts reached for provider {providerName}." });
            }
        }

        var state = Guid.NewGuid().ToString("N");
        var isDevelopment = string.Equals(Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"), "Development", StringComparison.OrdinalIgnoreCase);
        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = !isDevelopment,
            SameSite = SameSiteMode.Lax,
            Expires = DateTimeOffset.UtcNow.AddMinutes(5)
        };
        Response.Cookies.Append($"oauth_state_{canonicalName}", state, cookieOptions);

        var baseUri = string.IsNullOrEmpty(envConfig.Auth.BackendUrl) 
            ? $"{Request.Scheme}://{Request.Host}" 
            : envConfig.Auth.BackendUrl.TrimEnd('/');
        var callbackUri = $"{baseUri}/api/auth/callback/{canonicalName}";

        string redirectUrl;
        if (canonicalName == ProviderGitHub)
        {
            var clientId = envConfig.Auth.GithubClientId;
            if (string.IsNullOrEmpty(clientId))
            {
                return BadRequest(new { message = "GitHub Client ID is not configured." });
            }
            redirectUrl = $"https://github.com/login/oauth/authorize?client_id={clientId}&redirect_uri={Uri.EscapeDataString(callbackUri)}&scope=repo%20read:org&state={state}&prompt=select_account";
        }
        else if (canonicalName == ProviderGitLab)
        {
            var clientId = envConfig.Auth.GitlabClientId;
            if (string.IsNullOrEmpty(clientId))
            {
                return BadRequest(new { message = "GitLab Client ID is not configured." });
            }
            redirectUrl = $"https://gitlab.com/oauth/authorize?client_id={clientId}&redirect_uri={Uri.EscapeDataString(callbackUri)}&response_type=code&state={state}&scope=read_api%20read_repository";
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

        if (canonicalName != ProviderGitHub && canonicalName != ProviderGitLab && canonicalName != ProviderGoogle)
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

        if (canonicalName == ProviderGitHub || canonicalName == ProviderGitLab)
        {
            var activeCount = await dbContext.AuthProviders
                .CountAsync(ap => ap.UserId == userId && ap.ProviderName.ToLower() == canonicalName.ToLower() && ap.DeletedAt == null, cancellationToken);
            if (activeCount >= 3)
            {
                return Redirect($"{envConfig.Auth.FrontendUrl}/settings?tab=account&error=limit_reached");
            }
        }

        var timeProvider = HttpContext.RequestServices.GetRequiredService<TimeProvider>();
        var httpClientFactory = HttpContext.RequestServices.GetRequiredService<IHttpClientFactory>();

        string? accessToken = null;
        string? refreshToken = null;
        int? expiresIn = null;

        var baseUri = string.IsNullOrEmpty(envConfig.Auth.BackendUrl) 
            ? $"{Request.Scheme}://{Request.Host}" 
            : envConfig.Auth.BackendUrl.TrimEnd('/');
        var callbackUri = $"{baseUri}/api/auth/callback/{canonicalName}";
        var httpClient = httpClientFactory.CreateClient();

        string providerKey = "";
        string? providerEmail = null;
        string? providerUsername = null;
        string? providerAvatarUrl = null;
        string? providerDisplayName = null;
        string? providerProfileUrl = null;

        try
        {
            if (canonicalName == ProviderGitHub)
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
                providerAvatarUrl = profileData.ContainsKey("avatar_url") ? profileData["avatar_url"]?.ToString() : null;
                providerDisplayName = profileData.ContainsKey("name") ? profileData["name"]?.ToString() : null;
                providerProfileUrl = profileData.ContainsKey("html_url") ? profileData["html_url"]?.ToString() : $"https://github.com/{providerUsername}";
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
                providerDisplayName = profileData.ContainsKey("name") ? profileData["name"]?.ToString() : null;
                providerProfileUrl = profileData.ContainsKey("web_url") ? profileData["web_url"]?.ToString() : $"https://gitlab.com/{providerUsername}";
                providerAvatarUrl = profileData.ContainsKey("avatar_url") ? profileData["avatar_url"]?.ToString() : null;
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

        if (string.IsNullOrEmpty(accessToken))
        {
            return Redirect($"{envConfig.Auth.FrontendUrl}/settings?tab=account&error=token_exchange_failed");
        }

        // Check if provider accounts are already linked to someone else
        var duplicateProvider = await dbContext.AuthProviders
            .FirstOrDefaultAsync(ap => ap.ProviderName.ToLower() == canonicalName.ToLower() && ap.ProviderKey == providerKey && ap.UserId != userId && ap.DeletedAt == null, cancellationToken);

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

        if (canonicalName == ProviderGitHub || canonicalName == ProviderGitLab)
        {
            var existingPending = await dbContext.PendingAuthProviders
                .Where(pap => pap.UserId == userId && pap.ProviderName.ToLower() == canonicalName.ToLower() && pap.ProviderKey == providerKey)
                .ToListAsync(cancellationToken);
            if (existingPending.Any())
            {
                dbContext.PendingAuthProviders.RemoveRange(existingPending);
            }

            var pendingId = Guid.CreateVersion7();
            var pending = new PendingAuthProvider
            {
                Id = pendingId,
                UserId = userId,
                ProviderName = canonicalName,
                ProviderKey = providerKey,
                ProviderAccountId = providerEmail ?? providerUsername ?? providerKey,
                ProviderUsername = providerUsername,
                ProviderDisplayName = providerDisplayName ?? providerUsername ?? providerKey,
                ProviderAvatarUrl = providerAvatarUrl,
                ProviderProfileUrl = providerProfileUrl,
                EncryptedAccessToken = encryptedAccess,
                EncryptedRefreshToken = encryptedRefresh,
                ExpiresAt = timeProvider.GetUtcNow().AddMinutes(10),
                CreatedAt = timeProvider.GetUtcNow()
            };

            dbContext.PendingAuthProviders.Add(pending);
            await dbContext.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("PROVIDER_LINK_INITIATED: Pending link created for user {UserId}, provider {ProviderName}, pendingId {PendingId}", userId, canonicalName, pendingId);

            return Redirect($"{envConfig.Auth.FrontendUrl}/settings?tab=account&link_pending_id={pendingId}");
        }
        else
        {
            var existingProvider = await dbContext.AuthProviders
                .Include(ap => ap.OAuthCredential)
                .FirstOrDefaultAsync(ap => ap.UserId == userId && ap.ProviderName.ToLower() == canonicalName.ToLower() && ap.DeletedAt == null, cancellationToken);

            if (existingProvider != null)
            {
                existingProvider.ProviderKey = providerKey;
                existingProvider.ProviderAccountId = providerEmail ?? providerUsername ?? providerKey;
                existingProvider.ProviderUsername = providerUsername;
                existingProvider.ProviderAvatarUrl = providerAvatarUrl;
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
                    ProviderUsername = providerUsername,
                    ProviderAvatarUrl = providerAvatarUrl,
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
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "OAuth callback failed for provider {ProviderName}", providerName);
            return Redirect($"{envConfig.Auth.FrontendUrl}/settings?tab=account&error=exception&details={Uri.EscapeDataString(ex.Message)}");
        }
    }

    [HttpGet("github/connection-status")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetGithubConnectionStatus(CancellationToken cancellationToken)
    {
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdStr) || !Guid.TryParse(userIdStr, out var userId))
        {
            return Unauthorized();
        }

        var dbContext = HttpContext.RequestServices.GetRequiredService<ApplicationDbContext>();
        var provider = await dbContext.AuthProviders
            .FirstOrDefaultAsync(ap => ap.UserId == userId && ap.ProviderName == ProviderGitHub && ap.DeletedAt == null, cancellationToken);

        if (provider != null)
        {
            long? githubUserId = null;
            if (long.TryParse(provider.ProviderKey, out var parsedId))
            {
                githubUserId = parsedId;
            }

            return Ok(new
            {
                isConnected = true,
                providerId = provider.Id.ToString(),
                githubUserId = githubUserId,
                githubUsername = provider.ProviderUsername ?? provider.ProviderAccountId ?? string.Empty,
                githubAvatarUrl = provider.ProviderAvatarUrl ?? string.Empty
            });
        }

        return Ok(new
        {
            isConnected = false
        });
    }

    [HttpDelete("github/connection")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DisconnectGithub(CancellationToken cancellationToken)
    {
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdStr) || !Guid.TryParse(userIdStr, out var userId))
        {
            return Unauthorized();
        }

        var dbContext = HttpContext.RequestServices.GetRequiredService<ApplicationDbContext>();

        var activeCount = await dbContext.AuthProviders
            .CountAsync(ap => ap.UserId == userId && ap.ProviderName == ProviderGitHub && ap.DeletedAt == null, cancellationToken);
        if (activeCount > 1)
        {
            return BadRequest(new { message = "Multiple GitHub accounts exist. Please specify a connection ID." });
        }

        var provider = await dbContext.AuthProviders
            .Include(ap => ap.OAuthCredential)
            .FirstOrDefaultAsync(ap => ap.UserId == userId && ap.ProviderName == ProviderGitHub && ap.DeletedAt == null, cancellationToken);

        if (provider == null)
        {
            return NotFound(new { message = "GitHub account is not connected." });
        }

        var timeProvider = HttpContext.RequestServices.GetRequiredService<TimeProvider>();
        provider.DeletedAt = timeProvider.GetUtcNow();
        if (provider.OAuthCredential != null)
        {
            dbContext.OAuthCredentials.Remove(provider.OAuthCredential);
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        var identityStateResolver = HttpContext.RequestServices.GetRequiredService<IIdentityStateResolver>();
        await identityStateResolver.InvalidateCacheAsync(User.FindFirst(ClaimTypes.Email)?.Value ?? "");

        // Logging the audit event
        _logger.LogInformation("PROVIDER_UNLINKED: GitHub account successfully unlinked for user {UserId}", userId);

        return Ok(new { success = true, message = "GitHub account successfully disconnected." });
    }

    [HttpGet("providers/pending/{id:guid}")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(PendingLinkDetailsResponse))]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status410Gone)]
    public async Task<IActionResult> GetPendingLinkDetails(Guid id)
    {
        try
        {
            var result = await _authService.GetPendingLinkDetailsAsync(id);
            return Ok(result);
        }
        catch (ResourceNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (BusinessRuleException ex) when (ex.ErrorCode == "LINK_EXPIRED")
        {
            return StatusCode(StatusCodes.Status410Gone, new { message = ex.Message });
        }
    }

    [HttpPost("providers/confirm/{id:guid}")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status410Gone)]
    public async Task<IActionResult> ConfirmLink(Guid id)
    {
        try
        {
            var result = await _authService.ConfirmLinkAsync(id);
            return Ok(new { success = result, message = "Provider account successfully linked." });
        }
        catch (ResourceNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (BusinessRuleException ex) when (ex.ErrorCode == "LINK_EXPIRED")
        {
            return StatusCode(StatusCodes.Status410Gone, new { message = ex.Message });
        }
        catch (BusinessRuleException ex)
        {
            return BadRequest(new { code = ex.ErrorCode, message = ex.Message });
        }
        catch (AuthException ex)
        {
            return BadRequest(new { code = ex.Code, message = ex.Message });
        }
    }

    [HttpGet("providers/connections")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(IEnumerable<LinkedProviderConnectionDto>))]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetLinkedConnections()
    {
        var result = await _authService.GetLinkedConnectionsAsync();
        return Ok(result);
    }



    [HttpDelete("providers/connections/{id:guid}")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UnlinkProviderConnection(Guid id)
    {
        try
        {
            var result = await _authService.UnlinkProviderConnectionAsync(id);
            return Ok(new { success = result, message = "Connection successfully unlinked." });
        }
        catch (ResourceNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
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
        catch (AuthException ex) when (ex.Code == AuthErrorCodes.ServiceUnavailable)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { code = ex.Code, message = ex.Message });
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
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(SetupWorkspaceResponse))]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> SetupWorkspace([FromBody] SetupWorkspaceRequest request, CancellationToken cancellationToken)
    {
        var userAgent = Request.Headers["User-Agent"].ToString();
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";

        try
        {
            var result = await _workspaceProvisioningService.SetupWorkspaceAsync(request, userAgent, ipAddress, cancellationToken);
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
            var result = await _workspaceProvisioningService.VerifyCompanyOnboardingAsync(request, cancellationToken);
            return Ok(result);
        }
        catch (AuthException ex) when (ex.Code == AuthErrorCodes.ServiceUnavailable)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { code = ex.Code, message = ex.Message });
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
            var result = await _workspaceProvisioningService.VerifyOnboardingOtpAsync(request, step1Token, cancellationToken);
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
            var result = await _workspaceProvisioningService.VerifyOnboardingGoogleAsync(request, cancellationToken);
            return Ok(result);
        }
        catch (AuthException ex)
        {
            return BadRequest(new { code = ex.Code, message = ex.Message });
        }
    }

    [HttpPost("onboarding/complete")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(SetupWorkspaceResponse))]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CompleteOnboarding(
        [FromBody] CompleteOnboardingRequest request,
        CancellationToken cancellationToken)
    {
        var userAgent = Request.Headers["User-Agent"].ToString();
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";

        try
        {
            var result = await _workspaceProvisioningService.CompleteOnboardingAsync(request, userAgent, ipAddress, cancellationToken);
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

    [HttpDelete("sessions")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> RevokeOtherSessions(CancellationToken cancellationToken)
    {
        var result = await _authService.RevokeAllOtherSessionsAsync(cancellationToken);
        if (result)
        {
            return Ok(new { message = "All other sessions revoked successfully" });
        }
        return BadRequest(new { message = "Failed to revoke other sessions" });
    }

    [HttpGet("emails")]
    [Authorize]
    public async Task<IActionResult> GetEmails(CancellationToken cancellationToken)
    {
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdStr) || !Guid.TryParse(userIdStr, out var userId))
        {
            return Unauthorized();
        }

        var dbContext = HttpContext.RequestServices.GetRequiredService<ApplicationDbContext>();
        var user = await dbContext.Users
            .Include(u => u.LinkedEmails)
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

        if (user == null)
        {
            return NotFound(new { message = "User not found." });
        }

        var list = new List<object>
        {
            new { id = Guid.Empty, email = user.Email, isPrimary = true, isVerified = true }
        };

        foreach (var le in user.LinkedEmails.OrderBy(e => e.CreatedAt))
        {
            list.Add(new { id = le.Id, email = le.Email, isPrimary = false, isVerified = le.IsVerified });
        }

        return Ok(list);
    }

    public class SendEmailLinkOtpRequest
    {
        [Required]
        [EmailAddress]
        public string Email { get; set; } = null!;
    }

    [HttpPost("emails/send-otp")]
    [Authorize]
    public async Task<IActionResult> SendLinkEmailOtp([FromBody] SendEmailLinkOtpRequest request, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdStr) || !Guid.TryParse(userIdStr, out var userId))
        {
            return Unauthorized();
        }

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();

        var dbContext = HttpContext.RequestServices.GetRequiredService<ApplicationDbContext>();

        // 1. Global uniqueness validation (Users & UserEmails)
        var emailExists = await dbContext.Users.AnyAsync(u => u.Email == normalizedEmail && u.DeletedAt == null, cancellationToken) ||
                          await dbContext.UserEmails.AnyAsync(ue => ue.Email == normalizedEmail, cancellationToken);

        if (emailExists)
        {
            return BadRequest(new { message = "This email is already associated with another account." });
        }

        // 2. Count limits (Max 3 including primary)
        var secondaryCount = await dbContext.UserEmails.CountAsync(ue => ue.UserId == userId, cancellationToken);
        if (secondaryCount >= 2) // 1 primary + 2 secondary = 3 max
        {
            return BadRequest(new { message = "You have reached the maximum of 3 linked email addresses." });
        }

        // 3. Dispatch challenge OTP using core AuthService
        var userAgent = Request.Headers["User-Agent"].ToString();
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
        
        var otpRequest = new SendOtpRequest(normalizedEmail, "LINK_EMAIL");
        var result = await _authService.SendOtpAsync(otpRequest, userAgent, ipAddress, cancellationToken);

        return Ok(result);
    }

    public class VerifyEmailLinkOtpRequest
    {
        [Required]
        [EmailAddress]
        public string Email { get; set; } = null!;

        [Required]
        public string Code { get; set; } = null!;

        [Required]
        public Guid ChallengeId { get; set; }
    }

    [HttpPost("emails/verify-otp")]
    [Authorize]
    public async Task<IActionResult> VerifyLinkEmailOtp([FromBody] VerifyEmailLinkOtpRequest request, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdStr) || !Guid.TryParse(userIdStr, out var userId))
        {
            return Unauthorized();
        }

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();

        var dbContext = HttpContext.RequestServices.GetRequiredService<ApplicationDbContext>();

        // 1. TOCTOU Protection - re-validate global uniqueness before verification
        var emailExists = await dbContext.Users.AnyAsync(u => u.Email == normalizedEmail && u.DeletedAt == null, cancellationToken) ||
                          await dbContext.UserEmails.AnyAsync(ue => ue.Email == normalizedEmail, cancellationToken);

        if (emailExists)
        {
            return BadRequest(new { message = "This email is already associated with another account." });
        }

        // 2. Count limits validation
        var secondaryCount = await dbContext.UserEmails.CountAsync(ue => ue.UserId == userId, cancellationToken);
        if (secondaryCount >= 2)
        {
            return BadRequest(new { message = "You have reached the maximum of 3 linked email addresses." });
        }

        try
        {
            // 3. Verify OTP code using core AuthService
            var verifyRequest = new VerifyOtpRequest(request.ChallengeId, normalizedEmail, request.Code, "LINK_EMAIL");
            var verifyResult = await _authService.VerifyOtpAsync(verifyRequest, cancellationToken);

            // 4. Create and save verified UserEmail record
            var userEmail = new UserEmail
            {
                Id = Guid.CreateVersion7(),
                UserId = userId,
                Email = normalizedEmail,
                IsVerified = true,
                VerifiedAt = DateTimeOffset.UtcNow,
                CreatedAt = DateTimeOffset.UtcNow
            };

            dbContext.UserEmails.Add(userEmail);
            await dbContext.SaveChangesAsync(cancellationToken);

            // Claim any pending relationships for the newly linked email
            await _authService.ClaimPendingRelationshipsAsync(userId);

            // 5. Invalidate cache
            await _identityStateResolver.InvalidateCacheAsync(normalizedEmail);

            return Ok(new { success = true, message = "Email successfully linked to your account." });
        }
        catch (AuthException ex)
        {
            return BadRequest(new { code = ex.Code, message = ex.Message });
        }
    }

    public class MakePrimaryEmailRequest
    {
        [Required]
        [EmailAddress]
        public string Email { get; set; } = null!;

        [Required]
        public string Password { get; set; } = null!;
    }

    [HttpPost("emails/make-primary")]
    [Authorize]
    public async Task<IActionResult> MakeEmailPrimary([FromBody] MakePrimaryEmailRequest request, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdStr) || !Guid.TryParse(userIdStr, out var userId))
        {
            return Unauthorized();
        }

        var newPrimaryEmail = request.Email.Trim().ToLowerInvariant();

        var dbContext = HttpContext.RequestServices.GetRequiredService<ApplicationDbContext>();

        var user = await dbContext.Users
            .Include(u => u.LinkedEmails)
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

        if (user == null)
        {
            return NotFound(new { message = "User not found." });
        }

        // 1. Password verification for high-impact action re-authentication
        if (!VerifyPassword(user, user.PasswordHash, request.Password))
        {
            return BadRequest(new { message = "Incorrect password confirmation." });
        }

        // 2. Validate that the email to promote exists and is verified in secondary list
        var secondaryEmail = user.LinkedEmails.FirstOrDefault(ue => ue.Email == newPrimaryEmail);
        if (secondaryEmail == null)
        {
            return BadRequest(new { message = "The specified email is not linked to your account." });
        }

        if (!secondaryEmail.IsVerified)
        {
            return BadRequest(new { message = "Secondary email must be verified before it can be promoted to primary." });
        }

        var oldPrimaryEmail = user.Email;

        // 3. Strict transactional boundary for swap promotion
        using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            // Remove the newly promoted secondary email from secondary table
            dbContext.UserEmails.Remove(secondaryEmail);

            // Add the old primary email to secondary emails table as a verified email
            var oldPrimaryAsSecondary = new UserEmail
            {
                Id = Guid.CreateVersion7(),
                UserId = userId,
                Email = oldPrimaryEmail,
                IsVerified = true,
                VerifiedAt = DateTimeOffset.UtcNow,
                CreatedAt = DateTimeOffset.UtcNow
            };
            dbContext.UserEmails.Add(oldPrimaryAsSecondary);

            // Set users.email to the new primary email
            user.Email = newPrimaryEmail;
            user.UpdatedAt = DateTimeOffset.UtcNow.UtcDateTime;

            await dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync(cancellationToken);
            _logger.LogError(ex, "Transaction failed during email promotion to primary for user {UserId}", userId);
            throw;
        }

        // 4. Invalidate cache entries for both email identities
        await _identityStateResolver.InvalidateCacheAsync(oldPrimaryEmail);
        await _identityStateResolver.InvalidateCacheAsync(newPrimaryEmail);

        return Ok(new { success = true, message = $"Email {newPrimaryEmail} is now promoted as your primary email." });
    }

    [HttpDelete("emails/{id:guid}")]
    [Authorize]
    public async Task<IActionResult> DeleteLinkedEmail([FromRoute] Guid id, CancellationToken cancellationToken)
    {
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdStr) || !Guid.TryParse(userIdStr, out var userId))
        {
            return Unauthorized();
        }

        var dbContext = HttpContext.RequestServices.GetRequiredService<ApplicationDbContext>();

        var userEmail = await dbContext.UserEmails
            .FirstOrDefaultAsync(ue => ue.Id == id && ue.UserId == userId, cancellationToken);

        if (userEmail == null)
        {
            return NotFound(new { message = "Linked email not found." });
        }

        var oldEmail = userEmail.Email;

        // Perform removal
        dbContext.UserEmails.Remove(userEmail);
        await dbContext.SaveChangesAsync(cancellationToken);

        // Invalidate identity cache entry
        await _identityStateResolver.InvalidateCacheAsync(oldEmail);

        return Ok(new { success = true, message = "Email address successfully removed from your account." });
    }

    private bool VerifyPassword(User user, string? hash, string inputPassword)
    {
        if (string.IsNullOrEmpty(hash)) return false;

        if (hash.StartsWith("$2a$") || hash.StartsWith("$2b$") || hash.StartsWith("$2y$"))
        {
            return BCrypt.Net.BCrypt.Verify(inputPassword, hash);
        }

        var hasher = new Microsoft.AspNetCore.Identity.PasswordHasher<User>();
        var result = hasher.VerifyHashedPassword(user, hash, inputPassword);
        return result == Microsoft.AspNetCore.Identity.PasswordVerificationResult.Success || 
               result == Microsoft.AspNetCore.Identity.PasswordVerificationResult.SuccessRehashNeeded;
    }
}
