using System;
using CVerify.API.Modules.Shared.Exceptions;
using CVerify.API.Modules.Shared.Exceptions.Catalogs;

namespace CVerify.API.Modules.Shared.Storage.Exceptions;

/// <summary>
/// Domain exception thrown when an uploaded file violates size, MIME type, or safety extension policies.
/// </summary>
public class FileValidationException : CVerifyBaseException
{
    public FileValidationException(string defaultMessage, Exception? innerException = null)
        : base(
            SystemErrorCatalog.StorageValidationError, 
            ErrorCategory.VALIDATION, 
            "system.toast.error.storage_validation", 
            defaultMessage, 
            innerException)
    {
        Severity = "Warning";
        DisplayMode = "Toast";
    }
}
