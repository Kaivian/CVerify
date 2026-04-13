using System.Collections.Frozen;
using System.Collections.Generic;
using CVerify.API.Modules.Shared.Storage.Enums;

namespace CVerify.API.Modules.Shared.Storage.Constants;

public static class StorageConstants
{
    // 1. Max File Sizes in Bytes
    public const long MaxProfileSize = 2 * 1024 * 1024;       // 2 MB
    public const long MaxCertificateSize = 10 * 1024 * 1024;  // 10 MB
    public const long MaxEvidenceSize = 20 * 1024 * 1024;     // 20 MB
    public const long MaxTemporarySize = 5 * 1024 * 1024;     // 5 MB
    public const long MaxDefaultSize = 5 * 1024 * 1024;       // 5 MB

    // 2. Allowed Content/MIME Types
    public static readonly FrozenSet<string> AllowedImageTypes = new[]
    {
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif"
    }.ToFrozenSet();

    public static readonly FrozenSet<string> AllowedDocumentTypes = new[]
    {
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    }.ToFrozenSet();

    // 3. Dangerous File Extensions Blocklist (Case-Insensitive checks)
    public static readonly FrozenSet<string> UnsafeExtensions = new[]
    {
        ".exe",
        ".bat",
        ".cmd",
        ".sh",
        ".js",
        ".vbs",
        ".scr",
        ".com",
        ".msi"
    }.ToFrozenSet(global::System.StringComparer.OrdinalIgnoreCase);

    // 4. Strong-typed Module Prefix Mapping
    public static readonly FrozenDictionary<StorageModule, string> ModulePrefixes = new Dictionary<StorageModule, string>
    {
        { StorageModule.Profile, "profiles" },
        { StorageModule.Achievement, "achievements" },
        { StorageModule.Certificate, "certificates" },
        { StorageModule.Evidence, "evidence" },
        { StorageModule.Temporary, "temp" }
    }.ToFrozenDictionary();
}
