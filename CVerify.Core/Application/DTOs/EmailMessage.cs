using CVerify.API.Infrastructure.Configuration;

namespace CVerify.API.Application.DTOs;

/// <summary>
/// Represents an immutable thread-safe payload for the email transport subsystem.
/// </summary>
/// <param name="ToEmail">The destination recipient email address.</param>
/// <param name="ToName">The friendly display name of the recipient.</param>
/// <param name="Subject">The subject header of the email.</param>
/// <param name="HtmlContent">The parsed responsive HTML body rendered via Scriban.</param>
/// <param name="PlainTextContent">Optional plain-text alternative description.</param>
/// <param name="CorrelationId">Unique tracking trace identifier mapping this lifecycle.</param>
/// <param name="Category">The operational category of the communication.</param>
/// <param name="IdempotencyKey">Optional key preventing duplicate deliveries.</param>
public sealed record EmailMessage(
    string ToEmail,
    string ToName,
    string Subject,
    string HtmlContent,
    string? PlainTextContent,
    string CorrelationId,
    EmailCategory Category,
    string? IdempotencyKey = null
);
