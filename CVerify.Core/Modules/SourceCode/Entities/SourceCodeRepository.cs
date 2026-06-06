using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using CVerify.API.Modules.Auth.Entities;

namespace CVerify.API.Modules.SourceCode.Entities;

public class SourceCodeRepository
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid AuthProviderId { get; set; }

    [ForeignKey(nameof(AuthProviderId))]
    public virtual AuthProvider AuthProvider { get; set; } = null!;

    [Required]
    [MaxLength(255)]
    public string ExternalRepositoryId { get; set; } = null!;

    [Required]
    [MaxLength(255)]
    public string Name { get; set; } = null!;

    [Required]
    [MaxLength(255)]
    public string Owner { get; set; } = null!;

    [MaxLength(1000)]
    public string? Description { get; set; }

    [MaxLength(1000)]
    public string? HtmlUrl { get; set; }

    [MaxLength(100)]
    public string? DefaultBranch { get; set; }

    [Required]
    [MaxLength(255)]
    public string OwnerLogin { get; set; } = null!;

    [Required]
    [MaxLength(50)]
    public string OwnerType { get; set; } = null!;

    [Required]
    public bool IsPrivate { get; set; }

    [MaxLength(100)]
    public string? PrimaryLanguage { get; set; }

    [Required]
    public int StarsCount { get; set; } = 0;

    [Required]
    public int ForksCount { get; set; } = 0;

    [Required]
    public int OpenIssuesCount { get; set; } = 0;

    [Required]
    public int WatchersCount { get; set; } = 0;

    public DateTimeOffset? LastCommitAt { get; set; }

    [Required]
    public DateTimeOffset LastUpdatedUtc { get; set; }

    [Required]
    public DateTimeOffset LastSeenAt { get; set; } = DateTimeOffset.UtcNow;

    [Required]
    public bool IsAccessible { get; set; } = true;

    [Required]
    public bool ArchivedExternally { get; set; } = false;

    // CVerify Intelligence Fields
    [Required]
    public bool IsEnabled { get; set; } = true;

    [Required]
    public bool IsVerified { get; set; } = false;

    [Required]
    public double TrustScore { get; set; } = 0.0;

    public string? CustomSettingsJson { get; set; }

    [MaxLength(255)]
    public string? Classification { get; set; }

    [MaxLength(255)]
    public string? AuthenticityType { get; set; }

    [Required]
    public double LatestRiskScore { get; set; } = 0.0;

    [Required]
    [MaxLength(50)]
    public string LatestRiskLevel { get; set; } = "Low";

    [Required]
    [MaxLength(50)]
    public string LatestAnalysisStatus { get; set; } = "NeverAnalyzed";

    public DateTimeOffset? LatestAnalysisCompletedAtUtc { get; set; }

    [Column(TypeName = "jsonb")]
    public string? LatestRiskFactorsJson { get; set; }

    [Required]
    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;

    [Required]
    public DateTimeOffset LastSyncedAt { get; set; } = DateTimeOffset.UtcNow;
}
