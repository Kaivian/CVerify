using System;
using System.Threading;
using System.Threading.Tasks;
using CVerify.API.Modules.Auth.DTOs;

namespace CVerify.API.Modules.Recovery.Services;

public interface IPasswordRecoveryService
{
    Task<SendOtpResponse> SendOtpAsync(string email, string userAgent, string ipAddress, CancellationToken cancellationToken);
    Task<VerifyOtpResponse> VerifyOtpAsync(string email, string otp, CancellationToken cancellationToken);
    Task<bool> ChangePasswordAsync(string email, string recoveryToken, string newPassword, string confirmPassword, CancellationToken cancellationToken);
}
