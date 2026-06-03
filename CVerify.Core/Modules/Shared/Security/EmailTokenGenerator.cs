using System;
using System.Security.Cryptography;
using Microsoft.AspNetCore.WebUtilities;

namespace CVerify.API.Modules.Shared.Security;

/// <summary>
/// Provides high-entropy, cryptographically secure token generation for security links.
/// </summary>
public static class EmailTokenGenerator
{
    /// <summary>
    /// Generates a cryptographically strong, URL-safe Base64Url string.
    /// </summary>
    /// <param name="byteLength">The internal byte arrays size (defaults to 32 bytes/256-bit entropy).</param>
    /// <returns>A secure URL-safe token.</returns>
    public static string GenerateSecureToken(int byteLength = 32)
    {
        var randomBytes = new byte[byteLength];
        RandomNumberGenerator.Fill(randomBytes);
        return WebEncoders.Base64UrlEncode(randomBytes);
    }
}
