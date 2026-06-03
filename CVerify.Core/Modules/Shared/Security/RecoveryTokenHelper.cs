using System;
using System.Collections.Generic;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace CVerify.API.Modules.Shared.Security;

public static class RecoveryTokenHelper
{
    public static string NormalizeEmail(string email)
    {
        if (string.IsNullOrWhiteSpace(email)) return string.Empty;
        return email.Trim().Normalize(NormalizationForm.FormC).ToLowerInvariant();
    }

    public static string NormalizeTaxCode(string taxCode)
    {
        return string.IsNullOrWhiteSpace(taxCode) ? string.Empty : taxCode.Trim().ToLowerInvariant();
    }

    public static string GenerateOtpVerifiedToken(string taxCode, string email, string secretKey)
    {
        var payload = new Dictionary<string, string>
        {
            { "step", "OTP_VERIFIED" },
            { "taxCode", NormalizeTaxCode(taxCode) },
            { "email", NormalizeEmail(email) },
            { "exp", DateTimeOffset.UtcNow.AddMinutes(30).ToUnixTimeSeconds().ToString() }
        };
        return SignPayload(payload, secretKey);
    }

    public static string GenerateBootstrapToken(Guid sessionId, Guid orgId, string email, string strategy, string secretKey)
    {
        var payload = new Dictionary<string, string>
        {
            { "step", "BOOTSTRAP" },
            { "sessionId", sessionId.ToString() },
            { "orgId", orgId.ToString() },
            { "email", email },
            { "strategy", strategy },
            { "exp", DateTimeOffset.UtcNow.AddHours(24).ToUnixTimeSeconds().ToString() }
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

    public static string GenerateLevel2VoteToken(Guid requestId, Guid approverUserId, string approverRole, string secretKey, int expiryHours = 48)
    {
        var payload = new Dictionary<string, string>
        {
            { "step", "LEVEL2_ADMIN_APPROVAL" },
            { "requestId", requestId.ToString() },
            { "approverUserId", approverUserId.ToString() },
            { "approverRole", approverRole },
            { "exp", DateTimeOffset.UtcNow.AddHours(expiryHours).ToUnixTimeSeconds().ToString() }
        };
        return SignPayload(payload, secretKey);
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
