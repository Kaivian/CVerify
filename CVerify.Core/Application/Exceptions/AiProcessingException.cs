using System;
using CVerify.API.Application.Exceptions.Catalogs;

namespace CVerify.API.Application.Exceptions;

/// <summary>
/// Thrown when internal AI model executions or processing pipelines crash or time out. Maps to BUSINESS.
/// </summary>
public class AiProcessingException : CVerifyBaseException
{
    public AiProcessingException(string errorCode, string? customMessage = null, Exception? innerException = null)
        : base(
            errorCode, 
            ErrorCategory.BUSINESS, 
            ErrorRegistryCompiler.Get(errorCode).MessageKey, 
            customMessage ?? ErrorRegistryCompiler.Get(errorCode).DefaultMessage, 
            innerException)
    {
        Severity = "Error";
        Retryable = true; // AI tasks are usually retryable with exponential backoff
        DisplayMode = "Toast";
    }
}
