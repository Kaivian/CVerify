using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using CVerify.API.Modules.AiChat.Entities;
using CVerify.API.Modules.Shared.Diagnostics;
using CVerify.API.Modules.Shared.Exceptions.Catalogs;
using CVerify.API.Modules.Shared.System.DTOs;

namespace CVerify.API.Modules.Shared.Exceptions;

/// <summary>
/// Intercepts all system and domain exceptions, sanitizes sensitive diagnostics, and serializes versioned ApiErrorResponse contracts.
/// </summary>
public class GlobalExceptionHandler : IExceptionHandler
{
    private readonly IAppLogger _logger;

    public GlobalExceptionHandler(IAppLogger logger)
    {
        _logger = logger;
    }

    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        // 1. Establish the correlation context ID
        var correlationId = AsyncLocalCorrelationScope.CurrentCorrelationId ?? httpContext.TraceIdentifier;

        var responsePayload = new ApiErrorResponse
        {
            CorrelationId = correlationId,
            Timestamp = DateTime.UtcNow
        };

        bool isHandledDomainException = false;

        // 2. Map domain-driven custom exceptions
        if (exception is CVerifyBaseException domainEx)
        {
            isHandledDomainException = true;
            responsePayload.Status = domainEx.Category switch
            {
                ErrorCategory.VALIDATION => StatusCodes.Status400BadRequest,
                ErrorCategory.AUTHENTICATION => StatusCodes.Status401Unauthorized,
                ErrorCategory.AUTHORIZATION => StatusCodes.Status403Forbidden,
                ErrorCategory.BUSINESS => StatusCodes.Status409Conflict,
                ErrorCategory.INFRASTRUCTURE => StatusCodes.Status500InternalServerError,
                ErrorCategory.NETWORK => StatusCodes.Status503ServiceUnavailable,
                ErrorCategory.EXTERNAL_SERVICE => StatusCodes.Status502BadGateway,
                _ => StatusCodes.Status500InternalServerError
            };

            // Respect specific HTTP status codes if already configured in details
            if (domainEx is RateLimitExceededException)
            {
                responsePayload.Status = StatusCodes.Status429TooManyRequests;
            }
            else if (domainEx is ResourceNotFoundException)
            {
                responsePayload.Status = StatusCodes.Status404NotFound;
            }
            else if (domainEx.ErrorCode == AuthErrorCodes.EmailAlreadyExists)
            {
                responsePayload.Status = StatusCodes.Status409Conflict;
            }
            else if (domainEx.ErrorCode == AuthErrorCodes.ExpiredToken ||
                     domainEx.ErrorCode == AuthErrorCodes.InvalidToken ||
                     domainEx.ErrorCode == AuthErrorCodes.TokenAlreadyConsumed ||
                     domainEx.ErrorCode == AuthErrorCodes.CooldownActive)
            {
                responsePayload.Status = StatusCodes.Status400BadRequest;
            }

            responsePayload.Code = domainEx.ErrorCode;
            responsePayload.Category = domainEx.Category.ToString();
            responsePayload.Severity = domainEx.Severity;
            responsePayload.MessageKey = domainEx.MessageKey;
            responsePayload.Message = domainEx.Message; // Safe default, frontend will prioritize messageKey
            responsePayload.Retryable = domainEx.Retryable;
            responsePayload.Errors = domainEx.ValidationErrors;
            responsePayload.UxSemantics = new UxSemantics(
                domainEx.DisplayMode,
                domainEx.ResolutionStrategy,
                domainEx.UserAction,
                domainEx.TargetPath
            );

            // Copy dynamic safe attributes (cooldowns, attempts)
            foreach (var (key, value) in domainEx.Details)
            {
                responsePayload.Details.Add(key, value);
            }
        }
        // 3. Map standard C# exceptions
        else if (exception is UnauthorizedAccessException unauthEx)
        {
            isHandledDomainException = true;
            var def = ErrorRegistryCompiler.Get(AuthErrorCodes.Unauthorized);
            responsePayload.Status = StatusCodes.Status403Forbidden;
            responsePayload.Code = def.Code;
            responsePayload.Category = ErrorCategory.AUTHORIZATION.ToString();
            responsePayload.Severity = def.DefaultSeverity;
            responsePayload.MessageKey = def.MessageKey;
            responsePayload.Message = unauthEx.Message;
            responsePayload.Retryable = def.DefaultRetryable;
            responsePayload.UxSemantics = new UxSemantics("Banner", "Redirect", "auth.actions.login", "/login?session_expired=true");
        }
        else if (exception is TimeoutException timeoutEx)
        {
            var def = ErrorRegistryCompiler.Get(SystemErrorCatalog.NetworkTimeout);
            responsePayload.Status = StatusCodes.Status408RequestTimeout;
            responsePayload.Code = def.Code;
            responsePayload.Category = ErrorCategory.NETWORK.ToString();
            responsePayload.Severity = def.DefaultSeverity;
            responsePayload.MessageKey = def.MessageKey;
            responsePayload.Message = "Fallback: Connection timed out.";
            responsePayload.Retryable = true;
            responsePayload.UxSemantics = new UxSemantics("Toast", "Retry", string.Empty, string.Empty);
        }
        // 4. Default: Sanitized UNKNOWN fallback (Anti-leakage barrier)
        else
        {
            var def = ErrorRegistryCompiler.Get(SystemErrorCatalog.UnexpectedError);
            responsePayload.Status = StatusCodes.Status500InternalServerError;
            responsePayload.Code = def.Code;
            responsePayload.Category = ErrorCategory.UNKNOWN.ToString();
            responsePayload.Severity = def.DefaultSeverity;
            responsePayload.MessageKey = def.MessageKey;
            responsePayload.Message = "An unexpected error occurred. Developer context has been logged securely.";
            responsePayload.Retryable = false;
            responsePayload.UxSemantics = new UxSemantics("Toast", "None", string.Empty, string.Empty);
        }

        // 5. Centralized log routing
        var logCategory = isHandledDomainException ? "DOMAIN" : "CRITICAL_SYSTEM";
        if (isHandledDomainException)
        {
            _logger.Log(
                LogLevel.Warning,
                logCategory,
                $"Handled request error code: {responsePayload.Code} - {exception.Message} [Ref: {correlationId}]",
                null,
                new Dictionary<string, object> { { "correlationId", correlationId } }
            );
        }
        else
        {
            // Log full exception object (stack traces are preserved only in developer logs)
            _logger.Log(
                LogLevel.Error,
                logCategory,
                $"Unhandled System Exception intercepted: {exception.Message} [Ref: {correlationId}]",
                exception,
                new Dictionary<string, object> { { "correlationId", correlationId } }
            );
        }

        // 6. Write sanitized response if connection is active
        if (!cancellationToken.IsCancellationRequested && !httpContext.RequestAborted.IsCancellationRequested)
        {
            try
            {
                httpContext.Response.StatusCode = responsePayload.Status;
                httpContext.Response.ContentType = "application/json";
                await httpContext.Response.WriteAsJsonAsync(responsePayload, cancellationToken);
            }
            catch (Exception ex) when (ex is OperationCanceledException || ex is global::System.IO.IOException)
            {
                // Client aborted connection during response serialization; suppress exception to prevent error handler crash
            }
        }

        return true;
    }
}
