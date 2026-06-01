using System;
using System.Collections.Generic;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using CVerify.API.Modules.Shared.Storage.DTOs;
using CVerify.API.Modules.Shared.Storage.Enums;

namespace CVerify.API.Modules.Shared.Storage.Interfaces;

/// <summary>
/// Service contract governing object storage operations against Cloudflare R2.
/// </summary>
public interface IStorageService
{
    /// <summary>
    /// Validates file size, declared MIME type, extension safeness, and matches against module rules.
    /// </summary>
    /// <param name="fileStream">The readable input file stream.</param>
    /// <param name="fileName">The original name of the file (for extension validation).</param>
    /// <param name="contentType">The declared content type of the file.</param>
    /// <param name="module">The storage module determining limits and folder destinations.</param>
    /// <exception cref="FileValidationException">Thrown if validation fails.</exception>
    void ValidateFile(Stream fileStream, string fileName, string contentType, StorageModule module);

    /// <summary>
    /// Securely uploads an input file stream directly to R2 object storage.
    /// </summary>
    /// <param name="fileStream">The stream payload to transmit.</param>
    /// <param name="originalFileName">The original filename to derive extension and sanitize.</param>
    /// <param name="contentType">The declared file content type.</param>
    /// <param name="module">The storage module targeting specific key formats and metadata.</param>
    /// <param name="customMetadata">Optional key-value metadata to attach to the object.</param>
    /// <param name="cancellationToken">Propagates request cancellation commands.</param>
    /// <returns>Metadata of the uploaded file.</returns>
    /// <exception cref="StorageException">Thrown if the Cloudflare R2 request fails.</exception>
    /// <exception cref="FileValidationException">Thrown if validation parameters fail.</exception>
    Task<StorageFileDto> UploadFileAsync(
        Stream fileStream,
        string originalFileName,
        string contentType,
        StorageModule module,
        Dictionary<string, string>? customMetadata = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Deletes an object from Cloudflare R2 using its unique object key.
    /// </summary>
    /// <param name="key">The unique storage object key.</param>
    /// <param name="cancellationToken">Propagates request cancellation commands.</param>
    /// <exception cref="StorageException">Thrown if R2 server connection or deletion fails.</exception>
    Task DeleteFileAsync(string key, CancellationToken cancellationToken = default);

    /// <summary>
    /// Generates a secure, temporary pre-signed URL to retrieve private objects.
    /// </summary>
    /// <param name="key">The unique object key.</param>
    /// <param name="expiration">The duration the signed URL remains active.</param>
    /// <param name="cancellationToken">Propagates request cancellation commands.</param>
    /// <returns>The secure dynamic retrieval URL.</returns>
    /// <exception cref="StorageException">Thrown if signing fails.</exception>
    Task<string> GetSignedUrlAsync(string key, TimeSpan expiration, CancellationToken cancellationToken = default);

    /// <summary>
    /// Future-ready direct upload capability. Generates a secure pre-signed PUT URL 
    /// letting clients upload payloads directly to Cloudflare R2.
    /// </summary>
    /// <param name="key">The destination object key.</param>
    /// <param name="contentType">The expected Content-Type header of the client upload payload.</param>
    /// <param name="expiration">Duration for which the signature remains valid.</param>
    /// <param name="cancellationToken">Propagates request cancellation commands.</param>
    /// <returns>A secure pre-signed PUT upload URL.</returns>
    /// <exception cref="StorageException">Thrown if signing fails.</exception>
    Task<string> GetPresignedUploadUrlAsync(
        string key,
        string contentType,
        TimeSpan expiration,
        CancellationToken cancellationToken = default);
}
