using System;
using System.Collections.Generic;

namespace CVerify.API.Modules.Shared.Exceptions;

/// <summary>
/// Root domain exception holding versioned UX semantics, stable categories, and telemetry boundaries.
/// </summary>
public abstract class CVerifyBaseException : Exception
{
    public string ErrorCode { get; }
    public ErrorCategory Category { get; }
    public string Severity { get; set; } = "Error"; // Info, Warning, Error
    public string MessageKey { get; }
    public bool Retryable { get; set; } = false;
    public Dictionary<string, string[]>? ValidationErrors { get; set; }
    public Dictionary<string, object> Details { get; } = new();

    // UX Semantics to fully guide the frontend engine
    public string DisplayMode { get; set; } = "Toast"; // Toast, Banner, Inline, Silent
    public string ResolutionStrategy { get; set; } = "None"; // Retry, Redirect, VerifyEmail, ResetPassword, None
    public string UserAction { get; set; } = string.Empty;
    public string TargetPath { get; set; } = string.Empty;

    protected CVerifyBaseException(
        string errorCode,
        ErrorCategory category,
        string messageKey,
        string defaultMessage,
        Exception? innerException = null) : base(defaultMessage, innerException)
    {
        ErrorCode = errorCode;
        Category = category;
        MessageKey = messageKey;
    }
}
