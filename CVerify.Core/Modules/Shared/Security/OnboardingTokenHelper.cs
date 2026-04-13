using System;
using System.Collections.Generic;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace CVerify.API.Modules.Shared.Security;

/// <summary>
/// Cryptographically signs and verifies short-lived multi-step onboarding tokens using HMAC-SHA256.
/// This prevents tampering and state bypassing between Step 1, 2, and 3.
/// </summary>
public static class OnboardingTokenHelper
{
    public static string GenerateStep1Token(string taxCode, string companyName, string secretKey)
    {
        var payload = new Dictionary<string, string>
        {
            { "step", "1" },
            { "taxCode", taxCode },
            { "companyName", companyName },
            { "exp", DateTimeOffset.UtcNow.AddMinutes(30).ToUnixTimeSeconds().ToString() }
        };
        return SignPayload(payload, secretKey);
    }

    public static string GenerateStep2Token(string taxCode, string companyName, string email, bool isGoogleLinked, string secretKey)
    {
        var payload = new Dictionary<string, string>
        {
            { "step", "2" },
            { "taxCode", taxCode },
            { "companyName", companyName },
            { "email", email },
            { "isGoogleLinked", isGoogleLinked.ToString().ToLowerInvariant() },
            { "exp", DateTimeOffset.UtcNow.AddMinutes(30).ToUnixTimeSeconds().ToString() }
        };
        return SignPayload(payload, secretKey);
    }

    public static Dictionary<string, string>? VerifyToken(string token, string secretKey)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(token)) return null;

            var parts = token.Split('.');
            if (parts.Length != 2) return null;

            var base64Payload = parts[0];
            var base64Signature = parts[1];

            var expectedSignature = ComputeSignature(base64Payload, secretKey);
            if (!ConstantTimeEquals(base64Signature, base64Signature)) // Check correctly
            {
                // To avoid timing attacks, always run FixedTimeEquals
            }
            if (!ConstantTimeEquals(base64Signature, expectedSignature)) return null;

            var jsonBytes = Convert.FromBase64String(base64Payload);
            var json = Encoding.UTF8.GetString(jsonBytes);
            var payload = JsonSerializer.Deserialize<Dictionary<string, string>>(json);

            if (payload == null || !payload.ContainsKey("exp")) return null;

            if (long.TryParse(payload["exp"], out var exp))
            {
                if (DateTimeOffset.UtcNow.ToUnixTimeSeconds() > exp)
                {
                    return null; // Token has expired
                }
            }
            else
            {
                return null;
            }

            return payload;
        }
        catch
        {
            return null;
        }
    }

    private static string SignPayload(Dictionary<string, string> payload, string secretKey)
    {
        var json = JsonSerializer.Serialize(payload);
        var base64Payload = Convert.ToBase64String(Encoding.UTF8.GetBytes(json));
        var signature = ComputeSignature(base64Payload, secretKey);
        return $"{base64Payload}.{signature}";
    }

    private static string ComputeSignature(string data, string secretKey)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secretKey));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(data));
        return Convert.ToBase64String(hash);
    }

    private static bool ConstantTimeEquals(string a, string b)
    {
        var aBytes = Encoding.UTF8.GetBytes(a);
        var bBytes = Encoding.UTF8.GetBytes(b);
        return CryptographicOperations.FixedTimeEquals(aBytes, bBytes);
    }
}
