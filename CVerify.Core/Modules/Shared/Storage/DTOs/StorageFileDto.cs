namespace CVerify.API.Modules.Shared.Storage.DTOs;

/// <summary>
/// Data transfer object holding standard metadata of an uploaded object in R2.
/// </summary>
public class StorageFileDto
{
    /// <summary>
    /// Gets or sets the target Cloudflare R2 bucket name where the file resides.
    /// </summary>
    public string Bucket { get; set; } = null!;

    /// <summary>
    /// Gets or sets the unique, structured object key generated for the file.
    /// </summary>
    public string ObjectKey { get; set; } = null!;

    /// <summary>
    /// Gets or sets the content type / MIME type of the file.
    /// </summary>
    public string MimeType { get; set; } = null!;

    /// <summary>
    /// Gets or sets the size of the file in bytes.
    /// </summary>
    public long Size { get; set; }
}
