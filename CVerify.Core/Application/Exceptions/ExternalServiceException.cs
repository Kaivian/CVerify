using System;
using CVerify.API.Application.Exceptions.Catalogs;

namespace CVerify.API.Application.Exceptions;

/// <summary>
/// Thrown when external API integrations (FastAPI, Google SSO, SMTP) timeout or fail. Maps to EXTERNAL_SERVICE.
/// </summary>
public class ExternalServiceException : CVerifyBaseException
{
    public ExternalServiceException(string errorCode, string? customMessage = null, Exception? innerException = null)
        : base(
            errorCode, 
            ErrorCategory.EXTERNAL_SERVICE, 
            ErrorRegistryCompiler.Get(errorCode).MessageKey, 
            customMessage ?? ErrorRegistryCompiler.Get(errorCode).DefaultMessage, 
            innerException)
    {
        Severity = ErrorRegistryCompiler.Get(errorCode).DefaultSeverity;
        Retryable = ErrorRegistryCompiler.Get(errorCode).DefaultRetryable;
        DisplayMode = "Toast";
    }
}
