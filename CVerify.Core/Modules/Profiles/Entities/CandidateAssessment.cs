using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using CVerify.API.Modules.Shared.Domain.Entities;

namespace CVerify.API.Modules.Profiles.Entities;

public class CandidateAssessment
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid UserId { get; set; }

    [ForeignKey(nameof(UserId))]
    public virtual User User { get; set; } = null!;

    [Required]
    [MaxLength(50)]
    public string Status { get; set; } = "Queued"; // Queued, Running, Completed, Failed

    public double OverallScore { get; set; } = 0.0;

    [MaxLength(20)]
    public string? CareerLevel { get; set; } // L1, L2, L3, L4, L5

    [MaxLength(50)]
    public string? CareerLevelLabel { get; set; } // Junior, Middle, Senior, Staff, Principal

    [MaxLength(50)]
    public string? PrimaryTendency { get; set; } // Backend, Frontend, Fullstack, DevOps, etc.

    [MaxLength(50)]
    public string? PrimaryWorkingStyle { get; set; } // Feature Builder, System Designer, etc.

    [MaxLength(500)]
    public string? SummaryHeadline { get; set; }

    [MaxLength(2000)]
    public string? SummaryParagraph { get; set; }

    [Required]
    [MaxLength(20)]
    public string PipelineVersion { get; set; } = "2.0.0";

    [Required]
    [MaxLength(20)]
    public string AssessmentSchemaVersion { get; set; } = "1.0.0";

    public Guid? CvId { get; set; }

    [MaxLength(50)]
    public string? PromptVersion { get; set; }

    [MaxLength(100)]
    public string? ModelVersion { get; set; }

    [Required]
    public DateTimeOffset LastProfileUpdateAt { get; set; }

    [Required]
    public DateTimeOffset LastRepositoryAnalysisAt { get; set; }

    public DateTimeOffset? LastAssessmentAt { get; set; }

    [MaxLength(100)]
    public string? FailedStage { get; set; }

    public string? FailureReason { get; set; }

    public int Version { get; set; } = 1;

    [Required]
    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset? CompletedAtUtc { get; set; }

    // Indexing Ranking Metadata
    public double TechnicalDepth { get; set; } = 0.0;
    public double TechnicalBreadth { get; set; } = 0.0;
    public double LeadershipPotential { get; set; } = 0.0;
    public double ExecutionStrength { get; set; } = 0.0;
    public double TrustLevel { get; set; } = 0.0;

    public virtual ICollection<CandidateAssessmentArtifact> Artifacts { get; set; } = new List<CandidateAssessmentArtifact>();
    public virtual ICollection<CandidateSkill> Skills { get; set; } = new List<CandidateSkill>();
    public virtual ICollection<CandidateDomainProfile> DomainProfiles { get; set; } = new List<CandidateDomainProfile>();
    public virtual ICollection<CandidateIntelligenceSignal> IntelligenceSignals { get; set; } = new List<CandidateIntelligenceSignal>();
    public virtual ICollection<CandidateBestFitRole> BestFitRoles { get; set; } = new List<CandidateBestFitRole>();
    public virtual ICollection<CandidateStrengthWeakness> StrengthsWeaknesses { get; set; } = new List<CandidateStrengthWeakness>();
    public virtual ICollection<CandidateSkillTreeNode> SkillTreeNodes { get; set; } = new List<CandidateSkillTreeNode>();
}
