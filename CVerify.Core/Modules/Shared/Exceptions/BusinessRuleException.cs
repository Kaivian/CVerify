using System;
using CVerify.API.Modules.Shared.Exceptions.Catalogs;

namespace CVerify.API.Modules.Shared.Exceptions;

/// <summary>
/// Thrown when state machine logic, invariants, or domain boundaries are violated.
/// </summary>
public class BusinessRuleException : CVerifyBaseException
{
    public BusinessRuleException(string errorCode, string? customMessage = null, Exception? innerException = null)
        : base(
            errorCode,
            ErrorCategory.BUSINESS,
            ErrorRegistryCompiler.Get(errorCode).MessageKey,
            customMessage ?? ErrorRegistryCompiler.Get(errorCode).DefaultMessage,
            innerException)
    {
        Severity = ErrorRegistryCompiler.Get(errorCode).DefaultSeverity;
        Retryable = ErrorRegistryCompiler.Get(errorCode).DefaultRetryable;
        DisplayMode = "Toast";
    }
}
