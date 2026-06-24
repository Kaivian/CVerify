using System;
using CVerify.API.Modules.Shared.Exceptions.Catalogs;

namespace CVerify.API.Modules.Shared.Exceptions;

/// <summary>
/// Thrown when API call thresholds are breached. Maps to INFRASTRUCTURE.
/// </summary>
public class RateLimitExceededException : CVerifyBaseException
{
    public RateLimitExceededException(string? customMessage = null, int? cooldownSeconds = null, Exception? innerException = null)
        : base(
            SystemErrorCatalog.RateLimitExceeded,
            ErrorCategory.INFRASTRUCTURE,
            SystemErrorCatalog.Definitions[SystemErrorCatalog.RateLimitExceeded].MessageKey,
            customMessage ?? SystemErrorCatalog.Definitions[SystemErrorCatalog.RateLimitExceeded].DefaultMessage,
            innerException)
    {
        Severity = "Warning";
        Retryable = true;
        DisplayMode = "Toast";

        if (cooldownSeconds.HasValue)
        {
            Details.Add("cooldownSeconds", cooldownSeconds.Value);
        }
    }
}
