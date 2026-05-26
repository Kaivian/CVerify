using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using CVerify.API.Modules.Shared.Domain.Enums;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("candidate_discovery_runs")]
public class CandidateDiscoveryRun
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid HiringRequirementId { get; set; }

    [ForeignKey(nameof(HiringRequirementId))]
    public virtual HiringRequirement HiringRequirement { get; set; } = null!;

    public Guid? TriggeredById { get; set; }

    [ForeignKey(nameof(TriggeredById))]
    public virtual User? TriggeredBy { get; set; }

    public DateTimeOffset StartedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset? CompletedAt { get; set; }

    [Required]
    public DiscoveryStatus Status { get; set; } = DiscoveryStatus.Pending;

    public int CandidatesFoundCount { get; set; }

    [MaxLength(500)]
    public string? MatchQualitySummary { get; set; }

    public string? ErrorMessage { get; set; }

    public string? RawResultsJson { get; set; }
}
