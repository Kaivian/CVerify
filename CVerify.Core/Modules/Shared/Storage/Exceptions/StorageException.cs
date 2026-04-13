using System;
using CVerify.API.Modules.Shared.Exceptions;
using CVerify.API.Modules.Shared.Exceptions.Catalogs;

namespace CVerify.API.Modules.Shared.Storage.Exceptions;

/// <summary>
/// Domain exception thrown when operations against the Cloudflare R2 server encounter transient or terminal errors.
/// </summary>
public class StorageException : CVerifyBaseException
{
    public StorageException(string defaultMessage, Exception? innerException = null)
        : base(
            SystemErrorCatalog.StorageServiceError, 
            ErrorCategory.EXTERNAL_SERVICE, 
            "system.toast.error.storage_service", 
            defaultMessage, 
            innerException)
    {
        // Mark as potentially retryable since S3/R2 actions are network-bound and transient
        Retryable = true;
    }
}
