using System;
using System.IO;
using System.Text.RegularExpressions;
using CVerify.API.Application.Storage.Constants;
using CVerify.API.Application.Storage.Enums;

namespace CVerify.API.Application.Storage.Utilities;

/// <summary>
/// Utility class responsible for filename sanitization and structured, ULID-based object key generation.
/// </summary>
public static class StorageKeyGenerator
{
    private static readonly Regex InvalidCharRegex = new(@"[^a-zA-Z0-9_\-\.]", RegexOptions.Compiled);

    /// <summary>
    /// Generates a highly organized, collision-resistant storage key based on a ULID identifier.
    /// Format: {module_prefix}/{yyyy}/{MM}/{dd}/{ulid}{sanitized_extension}
    /// </summary>
    /// <param name="originalFileName">The original name of the file.</param>
    /// <param name="module">The storage module determining the folder prefix.</param>
    /// <returns>A fully qualified, sanitized storage object key.</returns>
    public static string GenerateKey(string originalFileName, StorageModule module)
    {
        // 1. Resolve folder prefix
        if (!StorageConstants.ModulePrefixes.TryGetValue(module, out var prefix))
        {
            prefix = "temp";
        }

        // 2. Extract and sanitize file extension
        var extension = Path.GetExtension(originalFileName)?.ToLowerInvariant() ?? string.Empty;
        extension = InvalidCharRegex.Replace(extension, "");

        // 3. Generate high-speed ULID
        var ulid = Ulid.NewUlid().ToString();

        // 4. Resolve current timestamp boundaries
        var now = DateTime.UtcNow;
        var year = now.ToString("yyyy");
        var month = now.ToString("MM");
        var day = now.ToString("dd");

        // 5. Assemble structured key
        return $"{prefix}/{year}/{month}/{day}/{ulid}{extension}";
    }

    /// <summary>
    /// Sanitizes an input filename to strip out unsafe characters or directory traversal sequences.
    /// </summary>
    /// <param name="fileName">The filename to clean up.</param>
    /// <returns>A safe version of the filename.</returns>
    public static string SanitizeFileName(string fileName)
    {
        if (string.IsNullOrWhiteSpace(fileName))
        {
            return "unnamed_file";
        }

        var nameWithoutPath = Path.GetFileName(fileName);
        var extension = Path.GetExtension(nameWithoutPath);
        var baseName = Path.GetFileNameWithoutExtension(nameWithoutPath);

        // Strip non-alphanumeric, dots, dashes, underscores
        baseName = InvalidCharRegex.Replace(baseName, "_");

        // Clean extension
        extension = InvalidCharRegex.Replace(extension, "");

        // Prevent empty names
        if (string.IsNullOrWhiteSpace(baseName))
        {
            baseName = "file";
        }

        return $"{baseName}{extension}";
    }
}
