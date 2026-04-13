using System;
using System.Security.Cryptography;
using System.Text;

namespace CVerify.API.Modules.Shared.Security;

public static class EncryptionHelper
{
    private const int NonceSize = 12;
    private const int TagSize = 16;

    public static string Encrypt(string plainText, string key)
    {
        if (string.IsNullOrEmpty(plainText)) return plainText;

        byte[] keyBytes = Encoding.UTF8.GetBytes(key);
        if (keyBytes.Length != 32)
        {
            throw new ArgumentException("Encryption key must be exactly 32 bytes (256 bits) long.");
        }

        byte[] plainBytes = Encoding.UTF8.GetBytes(plainText);
        byte[] nonce = new byte[NonceSize];
        RandomNumberGenerator.Fill(nonce);

        byte[] cipherBytes = new byte[plainBytes.Length];
        byte[] tag = new byte[TagSize];

        using (var aesGcm = new AesGcm(keyBytes, TagSize))
        {
            aesGcm.Encrypt(nonce, plainBytes, cipherBytes, tag);
        }

        byte[] resultBytes = new byte[NonceSize + TagSize + cipherBytes.Length];
        Buffer.BlockCopy(nonce, 0, resultBytes, 0, NonceSize);
        Buffer.BlockCopy(tag, 0, resultBytes, NonceSize, TagSize);
        Buffer.BlockCopy(cipherBytes, 0, resultBytes, NonceSize + TagSize, cipherBytes.Length);

        return Convert.ToBase64String(resultBytes);
    }

    public static string Decrypt(string cipherText, string key)
    {
        if (string.IsNullOrEmpty(cipherText)) return cipherText;

        byte[] keyBytes = Encoding.UTF8.GetBytes(key);
        if (keyBytes.Length != 32)
        {
            throw new ArgumentException("Encryption key must be exactly 32 bytes (256 bits) long.");
        }

        byte[] encryptedBytes = Convert.FromBase64String(cipherText);
        if (encryptedBytes.Length < NonceSize + TagSize)
        {
            throw new ArgumentException("Invalid cipher text length.");
        }

        byte[] nonce = new byte[NonceSize];
        byte[] tag = new byte[TagSize];
        byte[] cipherBytes = new byte[encryptedBytes.Length - NonceSize - TagSize];

        Buffer.BlockCopy(encryptedBytes, 0, nonce, 0, NonceSize);
        Buffer.BlockCopy(encryptedBytes, NonceSize, tag, 0, TagSize);
        Buffer.BlockCopy(encryptedBytes, NonceSize + TagSize, cipherBytes, 0, cipherBytes.Length);

        byte[] plainBytes = new byte[cipherBytes.Length];

        using (var aesGcm = new AesGcm(keyBytes, TagSize))
        {
            aesGcm.Decrypt(nonce, cipherBytes, tag, plainBytes);
        }

        return Encoding.UTF8.GetString(plainBytes);
    }
}
