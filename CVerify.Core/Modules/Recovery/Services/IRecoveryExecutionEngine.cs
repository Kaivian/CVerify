using System;
using System.Threading;
using System.Threading.Tasks;
using CVerify.API.Modules.Auth.DTOs;

namespace CVerify.API.Modules.Recovery.Services;

public interface IRecoveryExecutionEngine
{
    Task<AuthResponse> ExecuteOptionAAsync(Guid approvedSessionId, string displayName, string slug, string password, string userAgent, string ipAddress, CancellationToken cancellationToken = default);
    Task<AuthResponse> ExecuteOptionBAsync(Guid approvedSessionId, string displayName, string slug, string password, string userAgent, string ipAddress, CancellationToken cancellationToken = default);
}
