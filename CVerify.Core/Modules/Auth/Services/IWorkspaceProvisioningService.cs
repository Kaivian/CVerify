using System.Threading;
using System.Threading.Tasks;
using CVerify.API.Modules.Auth.DTOs;

namespace CVerify.API.Modules.Auth.Services;

public interface IWorkspaceProvisioningService
{
    Task<VerifyOrganizationOnboardingResponse> VerifyOrganizationOnboardingAsync(VerifyOrganizationOnboardingRequest request, CancellationToken cancellationToken = default);
    Task<VerifyOtpResponse> VerifyOnboardingOtpAsync(VerifyOtpRequest request, string step1Token, CancellationToken cancellationToken = default);
    Task<VerifyOtpResponse> VerifyOnboardingGoogleAsync(GoogleOnboardingLinkRequest request, CancellationToken cancellationToken = default);
    Task<SetupWorkspaceResponse> CompleteOnboardingAsync(CompleteOnboardingRequest request, string userAgent, string ipAddress, CancellationToken cancellationToken = default);
    Task<SetupWorkspaceResponse> SetupWorkspaceAsync(SetupWorkspaceRequest request, string userAgent, string ipAddress, CancellationToken cancellationToken = default);
}
