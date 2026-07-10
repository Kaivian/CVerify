using System;
using CVerify.API.Modules.Shared.Exceptions.Catalogs;

namespace CVerify.API.Modules.Shared.Exceptions;

/// <summary>
/// Thrown when role membership checks, access-control lists, or organization boundaries are violated.
/// </summary>
public class AuthorizationException : CVerifyBaseException
{
    public AuthorizationException(string errorCode, string? customMessage = null, Exception? innerException = null)
        : base(
            errorCode,
            ErrorCategory.AUTHORIZATION,
            ErrorRegistryCompiler.Get(errorCode).MessageKey,
            customMessage ?? ErrorRegistryCompiler.Get(errorCode).DefaultMessage,
            innerException)
    {
        Severity = ErrorRegistryCompiler.Get(errorCode).DefaultSeverity;
        Retryable = ErrorRegistryCompiler.Get(errorCode).DefaultRetryable;
        DisplayMode = "Banner"; // Banners represent calm but persistent authorization issues
    }
}
