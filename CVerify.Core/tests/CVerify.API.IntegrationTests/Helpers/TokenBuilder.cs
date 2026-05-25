using System;
using System.Security.Cryptography;
using System.Text;
using CVerify.API.Core.Entities;

namespace CVerify.API.IntegrationTests.Helpers;

public class TokenBuilder
{
    private Guid _userId;
    private string _tokenValue = "token_123";
    private DateTimeOffset _expiresAt = DateTimeOffset.UtcNow.AddHours(1);

    public TokenBuilder ForUser(Guid userId)
    {
        _userId = userId;
        return this;
    }

    public TokenBuilder WithToken(string token)
    {
        _tokenValue = token;
        return this;
    }

    public TokenBuilder WithExpiration(DateTimeOffset expiresAt)
    {
        _expiresAt = expiresAt;
        return this;
    }

    private string HashToken(string token)
    {
        using var sha256 = SHA256.Create();
        return Convert.ToHexString(sha256.ComputeHash(Encoding.UTF8.GetBytes(token))).ToLowerInvariant();
    }

    public VerificationToken BuildVerificationToken()
    {
        return new VerificationToken
        {
            UserId = _userId,
            TokenHash = HashToken(_tokenValue),
            ExpiresAt = _expiresAt,
            CreatedAt = DateTimeOffset.UtcNow
        };
    }

    public ResetPasswordToken BuildResetPasswordToken()
    {
        return new ResetPasswordToken
        {
            UserId = _userId,
            TokenHash = HashToken(_tokenValue),
            ExpiresAt = _expiresAt,
            CreatedAt = DateTimeOffset.UtcNow
        };
    }
}
