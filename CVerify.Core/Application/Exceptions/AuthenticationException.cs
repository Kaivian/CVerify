using System;
using CVerify.API.Application.Exceptions.Catalogs;

namespace CVerify.API.Application.Exceptions;

/// <summary>
/// Thrown when identity credentials, session verification, or JWT validations fail.
/// </summary>
public class AuthenticationException : CVerifyBaseException
{
    public AuthenticationException(string errorCode, string? customMessage = null, Exception? innerException = null)
        : base(
            errorCode, 
            ErrorCategory.AUTHENTICATION, 
            ErrorRegistryCompiler.Get(errorCode).MessageKey, 
            customMessage ?? ErrorRegistryCompiler.Get(errorCode).DefaultMessage, 
            innerException)
    {
        Severity = ErrorRegistryCompiler.Get(errorCode).DefaultSeverity;
        Retryable = ErrorRegistryCompiler.Get(errorCode).DefaultRetryable;
        DisplayMode = "Toast";
    }
}
