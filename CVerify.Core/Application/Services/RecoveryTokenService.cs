using System;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Core.Entities;
using CVerify.API.Application.Interfaces;
using CVerify.API.Infrastructure.Persistence;

namespace CVerify.API.Application.Services;

public class RecoveryTokenService : IRecoveryTokenService
{
    private readonly ApplicationDbContext _context;
    private readonly TimeProvider _timeProvider;

    public RecoveryTokenService(ApplicationDbContext context, TimeProvider timeProvider)
    {
        _context = context;
        _timeProvider = timeProvider;
    }

    public async Task<(RecoveryToken Token, string PlainToken)> IssueTokenAsync(
        Guid? userId,
        Guid? organizationId,
        RecoveryTokenType tokenType,
        string purpose,
        TimeSpan expiryDuration,
        string? metadataJson = null,
        CancellationToken cancellationToken = default)
    {
        // 1. Generate cryptographically secure plain token
        var plainToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();

        // 2. Hash plain token using SHA-256 for secure storage
        var tokenHash = HashToken(plainToken);

        // 3. Create recovery token entity
        var recoveryToken = new RecoveryToken
        {
            UserId = userId,
            OrganizationId = organizationId,
            TokenHash = tokenHash,
            TokenType = tokenType,
            Purpose = purpose,
            MetadataJson = metadataJson,
            ExpiresAt = _timeProvider.GetUtcNow().Add(expiryDuration),
            CreatedAt = _timeProvider.GetUtcNow()
        };

        _context.RecoveryTokens.Add(recoveryToken);
        await _context.SaveChangesAsync(cancellationToken);

        return (recoveryToken, plainToken);
    }

    public async Task<RecoveryToken?> ValidateTokenAsync(
        string plainToken,
        RecoveryTokenType expectedType,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(plainToken)) return null;

        var tokenHash = HashToken(plainToken);

        var token = await _context.RecoveryTokens
            .Include(t => t.User)
            .Include(t => t.Organization)
            .FirstOrDefaultAsync(t => t.TokenHash == tokenHash, cancellationToken);

        if (token == null) return null;

        // Perform strict validity checks (active, type matches, expired, consumed, revoked)
        if (token.TokenType != expectedType || !token.IsActive)
        {
            return null;
        }

        return token;
    }

    public async Task<bool> ConsumeTokenAsync(
        Guid tokenId,
        CancellationToken cancellationToken = default)
    {
        var token = await _context.RecoveryTokens.FindAsync(new object[] { tokenId }, cancellationToken);
        if (token == null || token.ConsumedAt != null) return false;

        token.ConsumedAt = _timeProvider.GetUtcNow();
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<bool> RevokeActiveTokensAsync(
        Guid? userId,
        Guid? organizationId,
        RecoveryTokenType tokenType,
        CancellationToken cancellationToken = default)
    {
        var query = _context.RecoveryTokens
            .Where(t => t.TokenType == tokenType && t.ConsumedAt == null && t.RevokedAt == null && t.ExpiresAt > _timeProvider.GetUtcNow());

        if (userId.HasValue)
        {
            query = query.Where(t => t.UserId == userId.Value);
        }

        if (organizationId.HasValue)
        {
            query = query.Where(t => t.OrganizationId == organizationId.Value);
        }

        var activeTokens = await query.ToListAsync(cancellationToken);
        if (!activeTokens.Any()) return false;

        foreach (var token in activeTokens)
        {
            token.RevokedAt = _timeProvider.GetUtcNow();
        }

        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }

    private string HashToken(string plainToken)
    {
        using var sha256 = SHA256.Create();
        var hashBytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(plainToken));
        return Convert.ToHexString(hashBytes).ToLowerInvariant();
    }
}
