using System;
using System.Collections.Generic;

namespace CVerify.API.Modules.Admin.DTOs;

public record SecurityEventListItemDto(
    Guid Id,
    string EventType,
    string Category,
    string Severity,
    string Status,
    int RiskScore,
    int ConfidenceScore,
    string Description,
    string? ActorUserEmail,
    string? TargetUserEmail,
    string? IpAddress,
    string? CountryCode,
    int OccurrenceCount,
    DateTimeOffset CreatedAt
);

public record SecurityEventDetailDto(
    Guid Id,
    string EventType,
    string Category,
    string Severity,
    string Status,
    int RiskScore,
    int ConfidenceScore,
    string Description,
    Guid? ActorUserId,
    string? ActorUserEmail,
    Guid? TargetUserId,
    string? TargetUserEmail,
    Guid? OrganizationId,
    string? OrganizationName,
    string? IpAddress,
    string? CountryCode,
    string? Device,
    string? Browser,
    Guid? SessionId,
    string? DetailsJson,
    Guid CorrelationId,
    Guid? IncidentId,
    string? IncidentTitle,
    Guid? AssignedToUserId,
    string? AssignedToUserEmail,
    int OccurrenceCount,
    List<SecurityEventCommentDto> Comments,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt
);

public record SecurityEventCommentDto(
    Guid Id,
    Guid? SecurityEventId,
    Guid? SecurityIncidentId,
    Guid AuthorUserId,
    string AuthorUserEmail,
    string CommentText,
    DateTimeOffset CreatedAt
);

public record SecurityRuleDto(
    Guid Id,
    string Code,
    string Name,
    string Description,
    bool IsEnabled,
    string Severity,
    string ConfigurationJson,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt
);

public record SecurityDashboardStatsDto(
    int ActiveThreats,
    int UnresolvedCritical,
    int HighRiskEvents,
    int FailedLoginsToday,
    int BlockedRequestsToday,
    int OpenInvestigations,
    int ResolvedToday,
    double AvgMttrHours,
    double AvgMttdMinutes
);

public record SecurityIncidentDetailDto(
    Guid Id,
    string Title,
    string Description,
    string Status,
    string Severity,
    Guid? AssignedToUserId,
    string? AssignedToUserEmail,
    List<SecurityEventListItemDto> CorrelatedEvents,
    List<SecurityEventCommentDto> Comments,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt
);

public record UpdateSecurityEventStatusDto(
    string Status,
    string? CommentText
);

public record AssignSecurityEventDto(
    Guid? AssignedToUserId
);

public record AddSecurityEventCommentDto(
    string CommentText
);

public record UpdateSecurityRuleDto(
    bool IsEnabled,
    string Severity,
    string ConfigurationJson
);

public record SecurityTrendItemDto(
    string TimeLabel, // e.g. "12:00", "Mon"
    int EventCount,
    int CriticalCount,
    int HighCount
);

public record SecurityDashboardDataDto(
    SecurityDashboardStatsDto Stats,
    List<SecurityEventListItemDto> RecentEvents,
    List<SecurityTrendItemDto> DailyTrends,
    List<KeyValuePair<string, int>> TopAttackingIps,
    List<KeyValuePair<string, int>> TopCountries,
    List<KeyValuePair<string, int>> CategoryBreakdown
);
