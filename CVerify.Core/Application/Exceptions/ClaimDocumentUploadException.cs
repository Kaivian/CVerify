using System;

namespace CVerify.API.Application.Exceptions;

/// <summary>
/// Thrown when document validation, encryption, or Cloudflare R2 upload fails during the reclaim/recovery submission process.
/// Contains the machine-readable error code "CLAIM_DOCUMENT_UPLOAD_FAILED".
/// </summary>
public class ClaimDocumentUploadException : CVerifyBaseException
{
    public ClaimDocumentUploadException(string defaultMessage, Exception? innerException = null)
        : base(
            "CLAIM_DOCUMENT_UPLOAD_FAILED", 
            ErrorCategory.BUSINESS, 
            "system.toast.error.claim_document_upload_failed", 
            defaultMessage, 
            innerException)
    {
        Retryable = false;
        DisplayMode = "Toast";
    }
}
