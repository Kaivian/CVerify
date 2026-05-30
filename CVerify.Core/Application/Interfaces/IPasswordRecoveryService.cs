using System;
using System.Threading;
using System.Threading.Tasks;
using CVerify.API.Application.DTOs;

namespace CVerify.API.Application.Interfaces;

public interface IPasswordRecoveryService
{
    Task<SendOtpResponse> SendOtpAsync(string email, string userAgent, string ipAddress, CancellationToken cancellationToken);
    Task<VerifyOtpResponse> VerifyOtpAsync(string email, string otp, CancellationToken cancellationToken);
    Task<bool> ChangePasswordAsync(string email, string recoveryToken, string newPassword, string confirmPassword, CancellationToken cancellationToken);
}
