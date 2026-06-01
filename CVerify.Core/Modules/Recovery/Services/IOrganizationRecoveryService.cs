using System.Threading;
using System.Threading.Tasks;
using CVerify.API.Modules.Auth.DTOs;
using CVerify.API.Modules.Recovery.DTOs;

namespace CVerify.API.Modules.Recovery.Services;

public interface IOrganizationRecoveryService
{
    Task<OrganizationForgotResponse> ForgotPasswordAsync(OrganizationForgotRequest request, CancellationToken cancellationToken = default);
    Task<VerifyOrganizationOtpResponse> VerifyRecoveryOtpAsync(VerifyOrganizationOtpRequest request, CancellationToken cancellationToken = default);
    Task<AuthResponse?> ResetPasswordAsync(ResetOrganizationPasswordRequest request, CancellationToken cancellationToken = default);
}
