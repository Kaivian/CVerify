
using System;
using System.Security.Cryptography;
using System.Text;
using CVerify.API.Modules.Shared.Configuration;

namespace CVerify.API.Modules.Shared.System.Services;

public class HmacSignatureService : IHmacSignatureService
{
    private readonly EnvConfiguration _config;

    public HmacSignatureService(EnvConfiguration config)
    {
        _config = config;
    }

    public string ComputeSignature(string method, string url, string body, string timestamp, string nonce)
    {
        // Formula: HMAC_SHA256(HTTP_METHOD + URL + BODY + TIMESTAMP + NONCE, SHARED_SECRET)
        var rawMessage = $"{method.ToUpperInvariant()}{url}{body}{timestamp}{nonce}";
        
        var keyBytes = Encoding.UTF8.GetBytes(_config.Ai.SharedSecret);
        var messageBytes = Encoding.UTF8.GetBytes(rawMessage);

        using var hmac = new HMACSHA256(keyBytes);
        var hashBytes = hmac.ComputeHash(messageBytes);
        
        return Convert.ToHexString(hashBytes).ToLowerInvariant();
    }

    public (string Signature, string Timestamp, string Nonce) CreateSignatureHeaders(string method, string url, string body)
    {
        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString();
        
        // Generate secure cryptographically strong nonce
        var nonceBytes = new byte[16];
        RandomNumberGenerator.Fill(nonceBytes);
        var nonce = Convert.ToHexString(nonceBytes).ToLowerInvariant();

        var signature = ComputeSignature(method, url, body, timestamp, nonce);
        
        return (signature, timestamp, nonce);
    }
}
