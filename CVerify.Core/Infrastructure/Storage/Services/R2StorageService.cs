using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Amazon.S3;
using Amazon.S3.Model;
using CVerify.API.Application.Storage.Constants;
using CVerify.API.Application.Storage.DTOs;
using CVerify.API.Application.Storage.Enums;
using CVerify.API.Application.Storage.Exceptions;
using CVerify.API.Application.Storage.Interfaces;
using CVerify.API.Application.Storage.Utilities;
using CVerify.API.Infrastructure.Configuration;
using CVerify.API.Infrastructure.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Polly;
using Polly.Retry;

namespace CVerify.API.Infrastructure.Storage.Services;

/// <summary>
/// Infrastructure-level implementation of IStorageService utilizing the official AWS S3 SDK for Cloudflare R2 compatibility.
/// Includes advanced transient retry pipelines, observability logs, extensions validation, and metadata auditing.
/// </summary>
public class R2StorageService : IStorageService
{
    private readonly IAmazonS3 _s3Client;
    private readonly EnvConfiguration _envConfig;
    private readonly IAppLogger _appLogger;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly ResiliencePipeline _resiliencePipeline;

    public R2StorageService(
        IAmazonS3 s3Client,
        EnvConfiguration envConfig,
        IAppLogger appLogger,
        IHttpContextAccessor httpContextAccessor)
    {
        _s3Client = s3Client ?? throw new ArgumentNullException(nameof(s3Client));
        _envConfig = envConfig ?? throw new ArgumentNullException(nameof(envConfig));
        _appLogger = appLogger ?? throw new ArgumentNullException(nameof(appLogger));
        _httpContextAccessor = httpContextAccessor ?? throw new ArgumentNullException(nameof(httpContextAccessor));

        // Configure a robust Polly v8 retry strategy for S3/R2 actions
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
                    .Handle<TimeoutException>(),
                OnRetry = args =>
                {
                    _appLogger.Log(
                        LogLevel.Warning,
                        "Storage",
                        $"Cloudflare R2 operation transient failure detected. Retrying attempt {args.AttemptNumber + 1}... Error: {args.Outcome.Exception?.Message}",
                        args.Outcome.Exception);
                    return default;
                }
            })
            .Build();
    }

    /// <inheritdoc />
    public void ValidateFile(Stream fileStream, string fileName, string contentType, StorageModule module)
    {
        // 1. Verify stream accessibility
        if (fileStream == null || !fileStream.CanRead)
        {
            throw new FileValidationException("Cannot upload a closed, null, or unreadable file stream.");
        }

        // 2. Reject executable and highly dangerous scripts
        var extension = Path.GetExtension(fileName);
        if (string.IsNullOrWhiteSpace(extension) || StorageConstants.UnsafeExtensions.Contains(extension))
        {
            throw new FileValidationException($"Executable or dangerous extension '{extension}' is strictly blocked for security reasons.");
        }

        // 3. Validate size constraints dynamically
        long maxSize = module switch
        {
            StorageModule.Profile => StorageConstants.MaxProfileSize,
            StorageModule.Certificate => StorageConstants.MaxCertificateSize,
            StorageModule.Evidence => StorageConstants.MaxEvidenceSize,
            StorageModule.Temporary => StorageConstants.MaxTemporarySize,
            StorageModule.Achievement => StorageConstants.MaxDefaultSize,
            _ => StorageConstants.MaxDefaultSize
        };

        if (fileStream.CanSeek && fileStream.Length > maxSize)
        {
            throw new FileValidationException($"The file size ({fileStream.Length} bytes) exceeds the maximum allowed limit for the {module} module ({maxSize} bytes).");
        }

        // 4. Validate MIME Type categories
        var isImage = StorageConstants.AllowedImageTypes.Contains(contentType);
        var isDoc = StorageConstants.AllowedDocumentTypes.Contains(contentType);

        if (module == StorageModule.Profile)
        {
            if (!isImage)
            {
                throw new FileValidationException($"Profile pictures must be standard image types. Content-Type '{contentType}' is not supported.");
            }
        }
        else
        {
            if (!isImage && !isDoc)
            {
                throw new FileValidationException($"MIME type '{contentType}' is rejected. Supported types include standard images and documents (PDF, Doc, Docx).");
            }
        }
    }

    /// <inheritdoc />
    public async Task<StorageFileDto> UploadFileAsync(
        Stream fileStream,
        string originalFileName,
        string contentType,
        StorageModule module,
        Dictionary<string, string>? customMetadata = null,
        CancellationToken cancellationToken = default)
    {
        // Validate inputs
        ValidateFile(fileStream, originalFileName, contentType, module);

        var key = StorageKeyGenerator.GenerateKey(originalFileName, module);
        var bucket = _envConfig.R2.BucketName;

        // Automatically resolve current user context for tracking
        var userId = "system";
        var httpContext = _httpContextAccessor.HttpContext;
        if (httpContext?.User != null)
        {
            var claim = httpContext.User.FindFirst(ClaimTypes.NameIdentifier) ?? httpContext.User.FindFirst("sub");
            if (claim != null && !string.IsNullOrWhiteSpace(claim.Value))
            {
                userId = claim.Value;
            }
        }

        // Initialize structured audit metadata
        var metadata = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            { "userId", userId },
            { "module", module.ToString() },
            { "uploadedAt", DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ") }
        };

        if (customMetadata != null)
        {
            foreach (var item in customMetadata)
            {
                if (!metadata.ContainsKey(item.Key))
                {
                    metadata[item.Key] = item.Value;
                }
            }
        }

        var logMeta = new Dictionary<string, object>
        {
            { "Bucket", bucket },
            { "ObjectKey", key },
            { "MimeType", contentType },
            { "Module", module.ToString() },
            { "UserId", userId }
        };

        // Observability - UploadStarted
        _appLogger.Log(LogLevel.Information, "Storage", $"UploadStarted: Initiating R2 upload for '{originalFileName}' to bucket '{bucket}' with key '{key}'.", null, logMeta);

        try
        {
            // Copy incoming non-seekable or disposable stream to local MemoryStream for safe Polly retries
            using var seekableStream = new MemoryStream();
            await fileStream.CopyToAsync(seekableStream, cancellationToken);
            seekableStream.Position = 0;
            var size = seekableStream.Length; // Get size BEFORE stream is disposed by AWS S3 client

            await _resiliencePipeline.ExecuteAsync(async ct =>
            {
                var request = new PutObjectRequest
                {
                    BucketName = bucket,
                    Key = key,
                    InputStream = seekableStream,
                    ContentType = contentType,
                    DisablePayloadSigning = true
                };

                foreach (var item in metadata)
                {
                    request.Metadata[item.Key] = item.Value;
                }

                await _s3Client.PutObjectAsync(request, ct);
            }, cancellationToken);

            logMeta["Size"] = size;

            // Observability - UploadCompleted
            _appLogger.Log(LogLevel.Information, "Storage", $"UploadCompleted: Successfully saved file '{key}' in bucket '{bucket}'. Size: {size} bytes.", null, logMeta);

            return new StorageFileDto
            {
                Bucket = bucket,
                ObjectKey = key,
                MimeType = contentType,
                Size = size
            };
        }
        catch (Exception ex)
        {
            // Observability - UploadFailed
            _appLogger.Log(LogLevel.Error, "Storage", $"UploadFailed: Stream upload terminated abruptly for key '{key}'. Error: {ex.Message}", ex, logMeta);
            throw new StorageException($"Failed to upload file '{originalFileName}' to Cloudflare R2 object storage.", ex);
        }
    }

    /// <inheritdoc />
    public async Task DeleteFileAsync(string key, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(key))
        {
            throw new ArgumentException("Object key cannot be null or empty.", nameof(key));
        }

        var bucket = _envConfig.R2.BucketName;
        var logMeta = new Dictionary<string, object>
        {
            { "Bucket", bucket },
            { "ObjectKey", key }
        };

        try
        {
            await _resiliencePipeline.ExecuteAsync(async ct =>
            {
                var request = new DeleteObjectRequest
                {
                    BucketName = bucket,
                    Key = key
                };
                await _s3Client.DeleteObjectAsync(request, ct);
            }, cancellationToken);

            // Observability - FileDeleted
            _appLogger.Log(LogLevel.Information, "Storage", $"FileDeleted: Cleanly removed object key '{key}' from bucket '{bucket}'.", null, logMeta);
        }
        catch (Exception ex)
        {
            _appLogger.Log(LogLevel.Error, "Storage", $"FileDeleteFailed: Could not delete object key '{key}' from bucket '{bucket}'. Error: {ex.Message}", ex, logMeta);
            throw new StorageException($"Failed to delete object key '{key}' from Cloudflare R2 storage.", ex);
        }
    }

    /// <inheritdoc />
    public Task<string> GetSignedUrlAsync(string key, TimeSpan expiration, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(key))
        {
            throw new ArgumentException("Object key cannot be null or empty.", nameof(key));
        }

        var bucket = _envConfig.R2.BucketName;
        var logMeta = new Dictionary<string, object>
        {
            { "Bucket", bucket },
            { "ObjectKey", key },
            { "ExpirationSeconds", expiration.TotalSeconds }
        };

        try
        {
            var request = new GetPreSignedUrlRequest
            {
                BucketName = bucket,
                Key = key,
                Expires = DateTime.UtcNow.Add(expiration),
                Verb = HttpVerb.GET
            };

            var url = _s3Client.GetPreSignedURL(request);

            // Observability - SignedUrlGenerated
            _appLogger.Log(LogLevel.Debug, "Storage", $"SignedUrlGenerated: Created retrieval link for key '{key}'. Valid for {expiration.TotalMinutes} minutes.", null, logMeta);

            return Task.FromResult(url);
        }
        catch (Exception ex)
        {
            _appLogger.Log(LogLevel.Error, "Storage", $"SignedUrlGenerationFailed: Failed to sign retrieval link for key '{key}'. Error: {ex.Message}", ex, logMeta);
            throw new StorageException($"Failed to generate pre-signed retrieval URL for object '{key}'.", ex);
        }
    }

    /// <inheritdoc />
    public Task<string> GetPresignedUploadUrlAsync(
        string key,
        string contentType,
        TimeSpan expiration,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(key))
        {
            throw new ArgumentException("Object key cannot be null or empty.", nameof(key));
        }

        var bucket = _envConfig.R2.BucketName;
        var logMeta = new Dictionary<string, object>
        {
            { "Bucket", bucket },
            { "ObjectKey", key },
            { "ContentType", contentType },
            { "ExpirationSeconds", expiration.TotalSeconds }
        };

        try
        {
            var request = new GetPreSignedUrlRequest
            {
                BucketName = bucket,
                Key = key,
                ContentType = contentType,
                Verb = HttpVerb.PUT,
                Expires = DateTime.UtcNow.Add(expiration)
            };

            var url = _s3Client.GetPreSignedURL(request);

            // Observability - SignedUploadUrlGenerated (Future-Ready event)
            _appLogger.Log(LogLevel.Debug, "Storage", $"SignedUploadUrlGenerated: Created direct PUT link for key '{key}'. Content-Type: '{contentType}'. Valid for {expiration.TotalMinutes} minutes.", null, logMeta);

            return Task.FromResult(url);
        }
        catch (Exception ex)
        {
            _appLogger.Log(LogLevel.Error, "Storage", $"SignedUploadUrlGenerationFailed: Failed to sign PUT upload link for key '{key}'. Error: {ex.Message}", ex, logMeta);
            throw new StorageException($"Failed to generate pre-signed PUT upload URL for object '{key}'.", ex);
        }
    }
}
