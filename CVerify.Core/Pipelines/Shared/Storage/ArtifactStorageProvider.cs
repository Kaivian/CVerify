using System;
using System.IO;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Amazon.S3;
using Amazon.S3.Model;
using CVerify.API.Modules.Shared.Configuration;

namespace CVerify.API.Pipelines.Shared.Storage;

public class ArtifactStorageProvider : IArtifactStorageProvider
{
    private readonly IAmazonS3 _s3Client;
    private readonly EnvConfiguration _envConfig;
    private readonly ILogger<ArtifactStorageProvider> _logger;
    private readonly string _localFallbackDir;

    public ArtifactStorageProvider(
        IAmazonS3 s3Client,
        EnvConfiguration envConfig,
        ILogger<ArtifactStorageProvider> logger)
    {
        _s3Client = s3Client ?? throw new ArgumentNullException(nameof(s3Client));
        _envConfig = envConfig ?? throw new ArgumentNullException(nameof(envConfig));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _localFallbackDir = Path.Combine(AppContext.BaseDirectory, "storage", "pipeline_artifacts");
    }

    private bool UseLocalFallback()
    {
        return string.IsNullOrWhiteSpace(_envConfig.R2.BucketName) || 
               _envConfig.R2.BucketName == "your_bucket_name_here" || 
               _envConfig.R2.AccessKeyId == "your_access_key_here";
    }

    public async Task SaveArtifactAsync(string path, Stream data, CancellationToken cancellationToken = default)
    {
        if (UseLocalFallback())
        {
            var fullPath = Path.Combine(_localFallbackDir, path.Replace('/', Path.DirectorySeparatorChar));
            var dir = Path.GetDirectoryName(fullPath);
            if (!string.IsNullOrEmpty(dir))
            {
                Directory.CreateDirectory(dir);
            }
            using var fileStream = new FileStream(fullPath, FileMode.Create, FileAccess.Write, FileShare.None);
            await data.CopyToAsync(fileStream, cancellationToken);
            _logger.LogInformation("Saved artifact locally: {FullPath}", fullPath);
            return;
        }

        var bucket = _envConfig.R2.BucketName;
        try
        {
            var request = new PutObjectRequest
            {
                BucketName = bucket,
                Key = path,
                InputStream = data,
                DisablePayloadSigning = true
            };
            await _s3Client.PutObjectAsync(request, cancellationToken);
            _logger.LogInformation("Saved artifact to Cloudflare R2: {Path} in bucket {Bucket}", path, bucket);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to upload artifact {Path} to Cloudflare R2.", path);
            throw new InvalidOperationException($"Failed to save artifact {path} to object storage.", ex);
        }
    }

    public async Task SaveArtifactTextAsync(string path, string content, CancellationToken cancellationToken = default)
    {
        using var ms = new MemoryStream(Encoding.UTF8.GetBytes(content));
        await SaveArtifactAsync(path, ms, cancellationToken);
    }

    public async Task<Stream> ReadArtifactAsync(string path, CancellationToken cancellationToken = default)
    {
        if (UseLocalFallback())
        {
            var fullPath = Path.Combine(_localFallbackDir, path.Replace('/', Path.DirectorySeparatorChar));
            if (!File.Exists(fullPath))
            {
                throw new FileNotFoundException($"Local artifact file not found: {fullPath}");
            }
            return new FileStream(fullPath, FileMode.Open, FileAccess.Read, FileShare.Read);
        }

        var bucket = _envConfig.R2.BucketName;
        try
        {
            var request = new GetObjectRequest
            {
                BucketName = bucket,
                Key = path
            };
            var response = await _s3Client.GetObjectAsync(request, cancellationToken);
            return response.ResponseStream;
        }
        catch (AmazonS3Exception ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            throw new FileNotFoundException($"R2 artifact file not found: {path} in bucket {bucket}", ex);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to read artifact {Path} from Cloudflare R2.", path);
            throw new InvalidOperationException($"Failed to read artifact {path} from object storage.", ex);
        }
    }

    public async Task<string> ReadArtifactTextAsync(string path, CancellationToken cancellationToken = default)
    {
        using var stream = await ReadArtifactAsync(path, cancellationToken);
        using var reader = new StreamReader(stream, Encoding.UTF8);
        return await reader.ReadToEndAsync(cancellationToken);
    }

    public async Task DeleteArtifactAsync(string path, CancellationToken cancellationToken = default)
    {
        if (UseLocalFallback())
        {
            var fullPath = Path.Combine(_localFallbackDir, path.Replace('/', Path.DirectorySeparatorChar));
            if (File.Exists(fullPath))
            {
                File.Delete(fullPath);
                _logger.LogInformation("Deleted local artifact: {FullPath}", fullPath);
            }
            return;
        }

        var bucket = _envConfig.R2.BucketName;
        try
        {
            var request = new DeleteObjectRequest
            {
                BucketName = bucket,
                Key = path
            };
            await _s3Client.DeleteObjectAsync(request, cancellationToken);
            _logger.LogInformation("Deleted artifact from Cloudflare R2: {Path} in bucket {Bucket}", path, bucket);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to delete artifact {Path} from Cloudflare R2.", path);
            throw new InvalidOperationException($"Failed to delete artifact {path} from object storage.", ex);
        }
    }
}
