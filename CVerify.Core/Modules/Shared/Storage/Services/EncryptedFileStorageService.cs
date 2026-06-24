using System;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Amazon.S3;
using Amazon.S3.Model;
using Polly;
using Polly.Retry;
using CVerify.API.Modules.Shared.Configuration;
using CVerify.API.Modules.Shared.Storage.Exceptions;
using CVerify.API.Modules.Shared.Storage.Interfaces;

namespace CVerify.API.Modules.Shared.Storage.Services;

public class EncryptedFileStorageService : IEncryptedFileStorageService
{
    private readonly IAmazonS3 _s3Client;
    private readonly EnvConfiguration _envConfig;
    private readonly byte[] _key;
    private readonly ResiliencePipeline _resiliencePipeline;

    public EncryptedFileStorageService(IAmazonS3 s3Client, EnvConfiguration envConfig)
    {
        _s3Client = s3Client ?? throw new ArgumentNullException(nameof(s3Client));
        _envConfig = envConfig ?? throw new ArgumentNullException(nameof(envConfig));

        // Derive 32-byte key for AES-256 using SHA-256 hash of the configuration JWT key
        using var sha = SHA256.Create();
        _key = sha.ComputeHash(Encoding.UTF8.GetBytes(_envConfig.Jwt.Key));

        // Configure a robust Polly v8 retry strategy for Cloudflare R2 operations
        _resiliencePipeline = new ResiliencePipelineBuilder()
            .AddRetry(new RetryStrategyOptions
            {
                MaxRetryAttempts = 3,
                BackoffType = DelayBackoffType.Exponential,
                UseJitter = true,
                Delay = TimeSpan.FromSeconds(1),
                ShouldHandle = new PredicateBuilder()
                    .Handle<AmazonS3Exception>(ex =>
                        ex.StatusCode == HttpStatusCode.InternalServerError ||
                        ex.StatusCode == HttpStatusCode.BadGateway ||
                        ex.StatusCode == HttpStatusCode.ServiceUnavailable ||
                        ex.StatusCode == HttpStatusCode.GatewayTimeout ||
                        ex.ErrorType == Amazon.Runtime.ErrorType.Receiver)
                    .Handle<IOException>()
                    .Handle<HttpRequestException>()
                    .Handle<TimeoutException>()
            })
            .Build();
    }

    public async Task<EncryptedUploadResult> EncryptAndUploadFileAsync(
        Guid claimId,
        Stream fileStream,
        string fileName,
        CancellationToken cancellationToken = default)
    {
        // 1. Setup temporary workspace directory for safe block writing
        var tempDir = Path.Combine(Directory.GetCurrentDirectory(), "storage", "temp");
        if (!Directory.Exists(tempDir))
        {
            Directory.CreateDirectory(tempDir);
        }
        var tempFileId = Guid.CreateVersion7().ToString("N");
        var tempFilePath = Path.Combine(tempDir, $"{tempFileId}.tmp");

        // 2. Generate random 12-byte base nonce for AES-GCM
        var baseNonce = new byte[12];
        using (var rng = RandomNumberGenerator.Create())
        {
            rng.GetBytes(baseNonce);
        }

        using var sha256 = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        long originalSize = 0;
        long encryptedSize = 0;

        try
        {
            // 3. Encrypt chunk-by-chunk into the temporary file (preserves memory boundaries)
            using (var targetStream = new FileStream(tempFilePath, FileMode.Create, FileAccess.Write, FileShare.None))
            {
                var buffer = new byte[65536]; // 64KB Chunks
                int bytesRead;
                uint chunkIndex = 0;

                using var aesGcm = new AesGcm(_key, tagSizeInBytes: 16);

                while ((bytesRead = await fileStream.ReadAsync(buffer, 0, buffer.Length, cancellationToken)) > 0)
                {
                    cancellationToken.ThrowIfCancellationRequested();

                    sha256.AppendData(buffer, 0, bytesRead);
                    originalSize += bytesRead;

                    // Derive unique chunk-specific nonce using Big-Endian index counter
                    var chunkNonce = new byte[12];
                    Array.Copy(baseNonce, chunkNonce, 12);
                    var indexBytes = BitConverter.GetBytes(chunkIndex);
                    if (BitConverter.IsLittleEndian)
                    {
                        Array.Reverse(indexBytes);
                    }
                    Array.Copy(indexBytes, 0, chunkNonce, 8, 4);

                    var plaintext = new ReadOnlySpan<byte>(buffer, 0, bytesRead);
                    var ciphertext = new byte[bytesRead];
                    var tag = new byte[16];

                    aesGcm.Encrypt(chunkNonce, plaintext, ciphertext, tag);

                    // Write Block layout: [Length: 4 Bytes] [Tag: 16 Bytes] [Ciphertext: Length Bytes]
                    var lengthBytes = BitConverter.GetBytes(bytesRead);
                    if (BitConverter.IsLittleEndian)
                    {
                        Array.Reverse(lengthBytes);
                    }

                    await targetStream.WriteAsync(lengthBytes, cancellationToken);
                    await targetStream.WriteAsync(tag, cancellationToken);
                    await targetStream.WriteAsync(ciphertext, cancellationToken);

                    encryptedSize += 4 + 16 + bytesRead;
                    chunkIndex++;
                }
            }

            var hashBytes = sha256.GetHashAndReset();
            var sha256Checksum = Convert.ToHexString(hashBytes).ToLowerInvariant();

            // Deterministic Key structure mapping: claims/{claimId}/{sha256}.bin
            var objectKey = $"claims/{claimId}/{sha256Checksum}.bin";
            var bucket = _envConfig.R2.BucketName;

            // 4. Perform direct S3 physical upload of the encrypted payload
            var putRequest = new PutObjectRequest
            {
                BucketName = bucket,
                Key = objectKey,
                FilePath = tempFilePath,
                ContentType = "application/octet-stream",
                DisablePayloadSigning = true
            };

            putRequest.Metadata["sha256"] = sha256Checksum;
            putRequest.Metadata["original-size"] = originalSize.ToString();
            putRequest.Metadata["encrypted-size"] = encryptedSize.ToString();
            putRequest.Metadata["base-nonce"] = Convert.ToHexString(baseNonce);
            putRequest.Metadata["uploaded-at"] = DateTimeOffset.UtcNow.ToString("O");

            await _resiliencePipeline.ExecuteAsync(async ct =>
            {
                await _s3Client.PutObjectAsync(putRequest, ct);
            }, cancellationToken);

            return new EncryptedUploadResult(
                ObjectKey: objectKey,
                BaseNonceHex: Convert.ToHexString(baseNonce),
                Sha256Checksum: sha256Checksum,
                OriginalSize: originalSize,
                EncryptedSize: encryptedSize
            );
        }
        catch (Exception ex)
        {
            throw new StorageException(
                $"Failed to encrypt or upload claim document '{fileName}' to Cloudflare R2.", ex);
        }
        finally
        {
            if (File.Exists(tempFilePath))
            {
                File.Delete(tempFilePath);
            }
        }
    }

    public async Task<Stream> ReadAndDecryptFileAsync(
        string objectKey,
        string baseNonceHex,
        CancellationToken cancellationToken = default)
    {
        var bucket = _envConfig.R2.BucketName;
        var getRequest = new GetObjectRequest
        {
            BucketName = bucket,
            Key = objectKey
        };

        GetObjectResponse getResponse;
        try
        {
            getResponse = await _resiliencePipeline.ExecuteAsync(async ct =>
            {
                return await _s3Client.GetObjectAsync(getRequest, ct);
            }, cancellationToken);
        }
        catch (Exception ex)
        {
            throw new StorageException(
                $"Failed to download encrypted reclaim document '{objectKey}' from Cloudflare R2.", ex);
        }

        var tempDir = Path.Combine(Directory.GetCurrentDirectory(), "storage", "temp");
        if (!Directory.Exists(tempDir))
        {
            Directory.CreateDirectory(tempDir);
        }
        var tempFileId = Guid.CreateVersion7().ToString("N");
        var tempFilePath = Path.Combine(tempDir, $"{tempFileId}.dec.tmp");

        var baseNonce = Convert.FromHexString(baseNonceHex);

        try
        {
            // Read incoming S3 stream, decrypt, and save to transient decrypted file
            using (var sourceStream = getResponse.ResponseStream)
            using (var targetStream = new FileStream(tempFilePath, FileMode.Create, FileAccess.Write, FileShare.None))
            {
                var aesGcm = new AesGcm(_key, tagSizeInBytes: 16);
                uint chunkIndex = 0;

                var lengthBytes = new byte[4];
                var tagBytes = new byte[16];

                while (true)
                {
                    int read = await ReadExactAsync(sourceStream, lengthBytes, 4, cancellationToken);
                    if (read == 0) break;

                    if (BitConverter.IsLittleEndian)
                    {
                        Array.Reverse(lengthBytes);
                    }
                    int length = BitConverter.ToInt32(lengthBytes, 0);

                    await ReadExactAsync(sourceStream, tagBytes, 16, cancellationToken);

                    var ciphertext = new byte[length];
                    await ReadExactAsync(sourceStream, ciphertext, length, cancellationToken);

                    var chunkNonce = new byte[12];
                    Array.Copy(baseNonce, chunkNonce, 12);
                    var indexBytes = BitConverter.GetBytes(chunkIndex);
                    if (BitConverter.IsLittleEndian)
                    {
                        Array.Reverse(indexBytes);
                    }
                    Array.Copy(indexBytes, 0, chunkNonce, 8, 4);

                    var plaintext = new byte[length];
                    aesGcm.Decrypt(chunkNonce, ciphertext, tagBytes, plaintext);

                    await targetStream.WriteAsync(plaintext, cancellationToken);
                    chunkIndex++;
                }
            }

            // Return file stream with DeleteOnClose to trigger clean disk deletion upon close
            return new FileStream(tempFilePath, FileMode.Open, FileAccess.Read, FileShare.None, 4096, FileOptions.DeleteOnClose);
        }
        catch (Exception ex)
        {
            if (File.Exists(tempFilePath))
            {
                File.Delete(tempFilePath);
            }
            throw new StorageException(
                "Error decrypted stream from Cloudflare R2 object store.", ex);
        }
    }

    public async Task DeleteFileAsync(string objectKey, CancellationToken cancellationToken = default)
    {
        var bucket = _envConfig.R2.BucketName;
        var deleteRequest = new DeleteObjectRequest
        {
            BucketName = bucket,
            Key = objectKey
        };

        try
        {
            await _resiliencePipeline.ExecuteAsync(async ct =>
            {
                await _s3Client.DeleteObjectAsync(deleteRequest, ct);
            }, cancellationToken);
        }
        catch (Exception ex)
        {
            throw new StorageException(
                $"Failed to physically delete object key '{objectKey}' from Cloudflare R2.", ex);
        }
    }

    private static async Task<int> ReadExactAsync(Stream stream, byte[] buffer, int count, CancellationToken cancellationToken)
    {
        int totalRead = 0;
        while (totalRead < count)
        {
            int read = await stream.ReadAsync(buffer, totalRead, count - totalRead, cancellationToken);
            if (read == 0)
            {
                if (totalRead == 0) return 0;
                throw new EndOfStreamException("Unexpected EOF while parsing encrypted document block headers.");
            }
            totalRead += read;
        }
        return totalRead;
    }
}
