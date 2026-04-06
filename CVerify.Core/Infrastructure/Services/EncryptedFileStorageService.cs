using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using CVerify.API.Application.Interfaces;
using CVerify.API.Infrastructure.Configuration;

namespace CVerify.API.Infrastructure.Services;

public class EncryptedFileStorageService : IEncryptedFileStorageService
{
    private readonly EnvConfiguration _envConfig;
    private readonly byte[] _key;
    private readonly string _storageDir;

    public EncryptedFileStorageService(EnvConfiguration envConfig)
    {
        _envConfig = envConfig;
        
        // Derive 32-byte key for AES-256 using SHA-256 hash of the configuration JWT key
        using var sha = SHA256.Create();
        _key = sha.ComputeHash(Encoding.UTF8.GetBytes(_envConfig.Jwt.Key));

        // Setup base directory for claim files
        _storageDir = Path.Combine(Directory.GetCurrentDirectory(), "storage", "claims");
        if (!Directory.Exists(_storageDir))
        {
            Directory.CreateDirectory(_storageDir);
        }
    }

    public async Task<(string storagePath, string encryptionIv)> EncryptAndSaveFileAsync(Stream fileStream, string fileName)
    {
        // 1. Generate unique file name and path
        var fileId = Guid.CreateVersion7().ToString("N");
        var fileExt = Path.GetExtension(fileName);
        var targetFileName = $"{fileId}{fileExt}.enc";
        var storagePath = Path.Combine(_storageDir, targetFileName);

        // 2. Generate random 16-byte IV for AES-CBC
        using var aes = Aes.Create();
        aes.Key = _key;
        aes.GenerateIV();
        var ivBytes = aes.IV;
        var encryptionIv = Convert.ToHexString(ivBytes);

        // 3. Encrypt data and write to file
        using var targetStream = new FileStream(storagePath, FileMode.Create, FileAccess.Write, FileShare.None);
        using var encryptor = aes.CreateEncryptor(aes.Key, aes.IV);
        using var cryptoStream = new CryptoStream(targetStream, encryptor, CryptoStreamMode.Write);

        await fileStream.CopyToAsync(cryptoStream);
        await cryptoStream.FlushFinalBlockAsync();

        return (storagePath, encryptionIv);
    }

    public Task<Stream> ReadAndDecryptFileAsync(string storagePath, string encryptionIv)
    {
        if (!File.Exists(storagePath))
        {
            throw new FileNotFoundException("The requested encrypted file was not found.", storagePath);
        }

        var ivBytes = Convert.FromHexString(encryptionIv);
        var aes = Aes.Create();
        aes.Key = _key;
        aes.IV = ivBytes;

        var fileStream = new FileStream(storagePath, FileMode.Open, FileAccess.Read, FileShare.Read);
        var decryptor = aes.CreateDecryptor(aes.Key, aes.IV);
        var cryptoStream = new CryptoStream(fileStream, decryptor, CryptoStreamMode.Read);

        return Task.FromResult<Stream>(cryptoStream);
    }

    public Task DeleteFileAsync(string storagePath)
    {
        if (File.Exists(storagePath))
        {
            File.Delete(storagePath);
        }
        return Task.CompletedTask;
    }
}
