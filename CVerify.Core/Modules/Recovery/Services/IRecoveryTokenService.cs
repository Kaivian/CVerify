using System;
using System.Threading;
using System.Threading.Tasks;
using CVerify.API.Modules.Recovery.Entities;

namespace CVerify.API.Modules.Recovery.Services;

public interface IRecoveryTokenService
{
    Task<(RecoveryToken Token, string PlainToken)> IssueTokenAsync(
        Guid? userId,
        Guid? organizationId,
        RecoveryTokenType tokenType,
        string purpose,
        TimeSpan expiryDuration,
        string? metadataJson = null,
        CancellationToken cancellationToken = default);

    Task<RecoveryToken?> ValidateTokenAsync(
        string plainToken,
        RecoveryTokenType expectedType,
        CancellationToken cancellationToken = default);

    Task<bool> ConsumeTokenAsync(
        Guid tokenId,
        CancellationToken cancellationToken = default);

    Task<bool> RevokeActiveTokensAsync(
        Guid? userId,
        Guid? organizationId,
        RecoveryTokenType tokenType,
        CancellationToken cancellationToken = default);
}
