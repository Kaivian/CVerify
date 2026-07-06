using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("security_events")]
public class SecurityEvent
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    [MaxLength(100)]
    public string EventType { get; set; } = null!; // e.g., AUTH_LOGIN_BRUTE_FORCE, SESSION_IMPOSSIBLE_TRAVEL

    [Required]
    [MaxLength(50)]
    public string Category { get; set; } = null!; // e.g., Authentication, API, Infrastructure

    [Required]
    [MaxLength(20)]
    public string Severity { get; set; } = "Low"; // Low, Medium, High, Critical, Informational

    [Required]
    [MaxLength(30)]
    public string Status { get; set; } = "New"; // New, Acknowledged, Investigating, Contained, Resolved, Closed, FalsePositive

    [Required]
    public int RiskScore { get; set; } // 0 to 100

    [Required]
    public int ConfidenceScore { get; set; } // 0 to 100

    [Required]
    public string Description { get; set; } = null!;

    public Guid? ActorUserId { get; set; }
    [ForeignKey(nameof(ActorUserId))]
    public virtual User? ActorUser { get; set; }

    public Guid? TargetUserId { get; set; }
    [ForeignKey(nameof(TargetUserId))]
    public virtual User? TargetUser { get; set; }

    public Guid? OrganizationId { get; set; }
    [ForeignKey(nameof(OrganizationId))]
    public virtual Organization? Organization { get; set; }

    [MaxLength(45)]
    public string? IpAddress { get; set; }

    [MaxLength(10)]
    public string? CountryCode { get; set; }

    [MaxLength(100)]
    public string? Device { get; set; }

    [MaxLength(100)]
    public string? Browser { get; set; }

    public Guid? SessionId { get; set; }

    [Column(TypeName = "jsonb")]
    public string? DetailsJson { get; set; }

    [Required]
    public Guid CorrelationId { get; set; }

    public Guid? IncidentId { get; set; }
    [ForeignKey(nameof(IncidentId))]
    public virtual SecurityIncident? Incident { get; set; }

    public Guid? AssignedToUserId { get; set; }
    [ForeignKey(nameof(AssignedToUserId))]
    public virtual User? AssignedToUser { get; set; }

    [Required]
    public int OccurrenceCount { get; set; } = 1; // Used for event deduplication/aggregation

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
