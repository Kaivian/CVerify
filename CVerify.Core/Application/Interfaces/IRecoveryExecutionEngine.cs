using System;
using System.Threading;
using System.Threading.Tasks;
using CVerify.API.Application.DTOs;

namespace CVerify.API.Application.Interfaces;

public interface IRecoveryExecutionEngine
{
    Task<AuthResponse> ExecuteOptionAAsync(Guid approvedSessionId, string displayName, string slug, string password, string userAgent, string ipAddress, CancellationToken cancellationToken = default);
    Task<AuthResponse> ExecuteOptionBAsync(Guid approvedSessionId, string displayName, string slug, string password, string userAgent, string ipAddress, CancellationToken cancellationToken = default);
}
