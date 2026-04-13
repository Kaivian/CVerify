using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using CVerify.API.Modules.Auth.DTOs;

namespace CVerify.API.Modules.Auth.Services;

public interface IAuthService
{
    Task<AuthResponse?> LoginAsync(LoginRequest request);
    Task<AuthResponse?> LoginWithGoogleAsync(GoogleLoginRequest request);
    Task LogoutAsync();
    Task<AuthResponse?> RefreshTokenAsync();
    Task<UserProfileResponse?> GetMeAsync();

    // New recovery, verification, and registration contracts
    Task<RegisterResponse> RegisterAsync(RegisterRequest request, string userAgent, string ipAddress, CancellationToken cancellationToken = default);
    Task<AuthResponse?> VerifyEmailAsync(VerifyEmailRequest request, CancellationToken cancellationToken = default);
    Task<bool> ResendVerificationEmailAsync(ResendVerificationRequest request, CancellationToken cancellationToken = default);
    Task<bool> ForgotPasswordAsync(ForgotPasswordRequest request, CancellationToken cancellationToken = default);
    Task<AuthResponse?> ResetPasswordAsync(ResetPasswordRequest request, CancellationToken cancellationToken = default);
    Task<bool> DeleteMeAsync();
    Task<DeletionRequirementsDto> GetDeletionRequirementsAsync(Guid userId);
    Task<DeletionInitiationResponse> InitiateDeletionAsync(Guid userId, InitiateDeletionRequest request);
    Task<AuthResponse?> ReactivateAccountAsync(string reactivationToken, CancellationToken cancellationToken = default);
    Task<string> GetOAuthReauthUrlAsync(Guid userId, string providerName, string baseUri);
    Task<string> ProcessOAuthReauthCallbackAsync(string providerName, string code, string state, CancellationToken cancellationToken);
    Task<SendOtpResponse> InitiateFallbackOtpAsync(Guid userId, FallbackOtpRequest request, CancellationToken cancellationToken);

    // Challenge-based OTP contracts
    Task<SendOtpResponse> SendOtpAsync(SendOtpRequest request, string userAgent, string ipAddress, CancellationToken cancellationToken = default);
    Task<VerifyOtpResponse> VerifyOtpAsync(VerifyOtpRequest request, CancellationToken cancellationToken = default);
    Task<OtpSessionResponse> GetActiveOtpSessionAsync(string email, string purpose, Guid challengeId, CancellationToken cancellationToken = default);
    Task<AuthResponse> CreatePasswordAsync(CreatePasswordRequest request, CancellationToken cancellationToken = default);

    // Company verification & workspace contracts
    Task<bool> RegisterCompanyAsync(RegisterCompanyRequest request, string userAgent, string ipAddress, CancellationToken cancellationToken = default);
    Task<VerifyCompanyLinkResponse> VerifyCompanyLinkAsync(VerifyCompanyLinkRequest request, string userAgent, string ipAddress, CancellationToken cancellationToken = default);
    Task<AuthResponse> SetupWorkspaceAsync(SetupWorkspaceRequest request, string userAgent, string ipAddress, CancellationToken cancellationToken = default);
    Task<AuthResponse?> CompanyLoginAsync(OrganizationLoginRequest request, string userAgent, string ipAddress);

    // Unified 3-step onboarding flow contracts
    Task<VerifyCompanyOnboardingResponse> VerifyCompanyOnboardingAsync(VerifyCompanyOnboardingRequest request, CancellationToken cancellationToken = default);
    Task<VerifyOtpResponse> VerifyOnboardingOtpAsync(VerifyOtpRequest request, string step1Token, CancellationToken cancellationToken = default);
    Task<VerifyOtpResponse> VerifyOnboardingGoogleAsync(GoogleOnboardingLinkRequest request, CancellationToken cancellationToken = default);
    Task<AuthResponse> CompleteOnboardingAsync(CompleteOnboardingRequest request, string userAgent, string ipAddress, CancellationToken cancellationToken = default);

    // Active session and revocation contracts
    Task<IEnumerable<SessionInfo>> GetActiveSessionsAsync();
    Task<bool> RevokeSessionAsync(Guid sessionId);
    Task<bool> RevokeAllOtherSessionsAsync(CancellationToken cancellationToken = default);

    // Linked provider integration contracts
    Task<IEnumerable<LinkedProviderDto>> GetLinkedProvidersAsync();
    Task<bool> UnlinkProviderAsync(string providerName);
    Task<bool> ValidateProviderScopesAsync(string providerName);

    // Multi-account OAuth contracts
    Task<IEnumerable<LinkedProviderConnectionDto>> GetLinkedConnectionsAsync();
    Task<PendingLinkDetailsResponse> GetPendingLinkDetailsAsync(Guid id);
    Task<bool> ConfirmLinkAsync(Guid id);
    Task<bool> UnlinkProviderConnectionAsync(Guid connectionId);

    // Password change contract
    Task<bool> ChangePasswordAsync(ChangePasswordRequest request, CancellationToken cancellationToken = default);

    // Google linking contract
    Task<bool> LinkGoogleAccountAsync(LinkGoogleRequest request, CancellationToken cancellationToken = default);
}


