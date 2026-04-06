using System.Threading;
using System.Threading.Tasks;
using CVerify.API.Application.DTOs;

namespace CVerify.API.Application.Interfaces;

public interface ICandidateRecoveryService
{
    Task<bool> ForgotPasswordAsync(ForgotPasswordRequest request, CancellationToken cancellationToken = default);
    Task<AuthResponse?> ResetPasswordAsync(ResetPasswordRequest request, CancellationToken cancellationToken = default);
}
