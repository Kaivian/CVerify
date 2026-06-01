namespace CVerify.API.Modules.Shared.Exceptions;

/// <summary>
/// Immutable metadata definition representing a registered platform exception configuration.
/// </summary>
public record ErrorDefinition(
    string Code,
    ErrorCategory Category,
    string MessageKey,
    string DefaultMessage,
    bool DefaultRetryable = false,
    string DefaultSeverity = "Error"
);
