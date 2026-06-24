using System;
using CVerify.API.Modules.Shared.Exceptions.Catalogs;

namespace CVerify.API.Modules.Shared.Exceptions;

/// <summary>
/// Thrown when a queried entity or document cannot be resolved. Maps to BUSINESS.
/// </summary>
public class ResourceNotFoundException : CVerifyBaseException
{
    public ResourceNotFoundException(string errorCode, string? customMessage = null, Exception? innerException = null)
        : base(
            errorCode,
            ErrorCategory.BUSINESS,
            ErrorRegistryCompiler.Get(errorCode).MessageKey,
            customMessage ?? ErrorRegistryCompiler.Get(errorCode).DefaultMessage,
            innerException)
    {
        Severity = "Warning";
        Retryable = false;
        DisplayMode = "Toast";
    }
}
