using System;
using System.Collections.Generic;
using CVerify.API.Modules.AiChat.Entities;

namespace CVerify.API.Modules.Shared.System.DTOs;

/// <summary>
/// Machine-readable UX semantics payload directing the frontend on representation modes.
/// </summary>
public record UxSemantics(
    string DisplayMode,          // Toast, Banner, Inline, Silent
    string ResolutionStrategy,    // Retry, Redirect, VerifyEmail, ResetPassword, None
    string UserAction,
    string TargetPath
);

/// <summary>
/// Enterprise-grade versioned API error contract wrapping ProblemDetails with advanced UX context.
/// </summary>
public class ApiErrorResponse
{
    public string ContractVersion { get; set; } = "1.0.0";
    public int Status { get; set; }
    public string Code { get; set; } = null!;
    public string Category { get; set; } = null!;
    public string Severity { get; set; } = "Error";
    public string MessageKey { get; set; } = null!;
    public string Message { get; set; } = null!;
    public bool Retryable { get; set; }
    public Dictionary<string, string[]>? Errors { get; set; }
    public string? CorrelationId { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;

    public UxSemantics UxSemantics { get; set; } = null!;
    public Dictionary<string, object> Details { get; set; } = new();
}
