using System.Collections.Generic;
using CVerify.API.Modules.Shared.Exceptions;

namespace CVerify.API.Modules.Shared.Exceptions.Catalogs;

public static class SystemErrorCatalog
{
    public const string UnexpectedError = "SYSTEM_UNEXPECTED_ERROR";
    public const string DatabaseOutage = "SYSTEM_DATABASE_OUTAGE";
    public const string AiServiceUnavailable = "SYSTEM_AI_SERVICE_UNAVAILABLE";
    public const string AiServiceTimeout = "SYSTEM_AI_SERVICE_TIMEOUT";
    public const string SmtpOutage = "SYSTEM_SMTP_OUTAGE";
    public const string ValidationError = "VALIDATION_ERROR";
    public const string RateLimitExceeded = "RATE_LIMIT_EXCEEDED";
    public const string NetworkTimeout = "SYSTEM_NETWORK_TIMEOUT";
    public const string StorageServiceError = "STORAGE_SERVICE_ERROR";
    public const string StorageValidationError = "STORAGE_VALIDATION_ERROR";

    public static readonly Dictionary<string, ErrorDefinition> Definitions = new()
    {
        {
            UnexpectedError,
            new(UnexpectedError, ErrorCategory.UNKNOWN, "system.toast.error.unexpected", "Something went wrong on our side. Please try again later.")
        },
        {
            DatabaseOutage,
            new(DatabaseOutage, ErrorCategory.INFRASTRUCTURE, "system.toast.error.db_outage", "Database engine connection timed out. Please retry shortly.", true)
        },
        {
            AiServiceUnavailable,
            new(AiServiceUnavailable, ErrorCategory.EXTERNAL_SERVICE, "system.toast.error.ai_unavailable", "The audit AI model engine is currently offline. Please retry.", true)
        },
        {
            AiServiceTimeout,
            new(AiServiceTimeout, ErrorCategory.EXTERNAL_SERVICE, "system.toast.error.ai_timeout", "AI service took too long to complete. Attempting reconnection...", true)
        },
        {
            SmtpOutage,
            new(SmtpOutage, ErrorCategory.EXTERNAL_SERVICE, "system.toast.error.smtp_outage", "Email server validation failed. Resending queued email...", true)
        },
        {
            ValidationError,
            new(ValidationError, ErrorCategory.VALIDATION, "system.toast.error.validation", "Please check the form fields for errors.")
        },
        {
            RateLimitExceeded,
            new(RateLimitExceeded, ErrorCategory.INFRASTRUCTURE, "system.toast.error.rate_limited", "Too many requests. Cooldown is active. Please slow down.", true, "Warning")
        },
        {
            NetworkTimeout,
            new(NetworkTimeout, ErrorCategory.NETWORK, "system.toast.error.network_timeout", "Request timed out. Please check your network connection.", true)
        },
        {
            StorageServiceError,
            new(StorageServiceError, ErrorCategory.EXTERNAL_SERVICE, "system.toast.error.storage_service", "Cloud storage interface error. Retrying command shortly...", true)
        },
        {
            StorageValidationError,
            new(StorageValidationError, ErrorCategory.VALIDATION, "system.toast.error.storage_validation", "The uploaded file does not meet security or size constraints.")
        }
    };
}
