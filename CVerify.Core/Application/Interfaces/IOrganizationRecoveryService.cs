using System.Threading;
using System.Threading.Tasks;
using CVerify.API.Application.DTOs;

namespace CVerify.API.Application.Interfaces;

public interface IOrganizationRecoveryService
{
    Task<OrganizationForgotResponse> ForgotPasswordAsync(OrganizationForgotRequest request, CancellationToken cancellationToken = default);
    Task<VerifyOrganizationOtpResponse> VerifyRecoveryOtpAsync(VerifyOrganizationOtpRequest request, CancellationToken cancellationToken = default);
    Task<AuthResponse?> ResetPasswordAsync(ResetOrganizationPasswordRequest request, CancellationToken cancellationToken = default);
}
