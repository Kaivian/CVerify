using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("candidate_ranking_projections")]
public class CandidateRankingProjection
{
    [Key]
    [ForeignKey(nameof(Candidate))]
    public Guid CandidateId { get; set; }

    public virtual User Candidate { get; set; } = null!;

    [Required]
    [MaxLength(255)]
    public string FullName { get; set; } = null!;

    [MaxLength(32)]
    public string? Username { get; set; }

    [MaxLength(500)]
    public string? Bio { get; set; }

    [MaxLength(255)]
    public string? Headline { get; set; }

    [MaxLength(100)]
    public string? Location { get; set; }

    [MaxLength(1000)]
    public string? AvatarUrl { get; set; }

    // Scoring signals
    public double CompositeScore { get; set; } = 0.0;
    public double AiScore { get; set; } = 0.0;
    public double TrustScore { get; set; } = 0.0;
    public double ProfileCompleteness { get; set; } = 0.0;
    public double EvidenceTrustScore { get; set; } = 0.0;

    // Engineering and activity signals
    public int VerifiedRepoCount { get; set; } = 0;
    public int TotalStarsCount { get; set; } = 0;
    public int TotalForksCount { get; set; } = 0;
    public int VerifiedContributionCount { get; set; } = 0;

    [Column(TypeName = "jsonb")]
    public string? TopCapabilitiesJson { get; set; } // flat capabilities list: [{"name":"C#", "score":95}]

    [MaxLength(100)]
    public string? PrimaryDomain { get; set; } // backend, frontend, etc

    [MaxLength(50)]
    public string? CareerLevelLabel { get; set; } // Senior, Lead, etc

    // Social signals
    public int FollowersCount { get; set; } = 0;
    public int FollowingCount { get; set; } = 0;

    // Availability
    public bool AvailableForHire { get; set; } = true;

    [MaxLength(20)]
    public string OpenToWorkStatus { get; set; } = "casual";

    // Rank metrics
    public int GlobalRankPosition { get; set; } = 0;
    public int PreviousGlobalRankPosition { get; set; } = 0;

    [Required]
    public DateTimeOffset LastUpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
