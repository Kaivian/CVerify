using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;

namespace CVerify.API.Application.Interfaces;

public record EncryptedUploadResult(
    string ObjectKey, 
    string BaseNonceHex, 
    string Sha256Checksum, 
    long OriginalSize, 
    long EncryptedSize
);

public interface IEncryptedFileStorageService
{
    Task<EncryptedUploadResult> EncryptAndUploadFileAsync(
        Guid claimId, 
        Stream fileStream, 
        string fileName, 
        CancellationToken cancellationToken = default);

    Task<Stream> ReadAndDecryptFileAsync(
        string objectKey, 
        string baseNonceHex, 
        CancellationToken cancellationToken = default);

    Task DeleteFileAsync(
        string objectKey, 
        CancellationToken cancellationToken = default);
}
