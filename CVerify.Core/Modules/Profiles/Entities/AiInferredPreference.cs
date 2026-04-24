using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using CVerify.API.Modules.Shared.Domain.Entities;

namespace CVerify.API.Modules.Profiles.Entities;

public class AiInferredPreference
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid UserId { get; set; }

    [ForeignKey(nameof(UserId))]
    public virtual User User { get; set; } = null!;

    [MaxLength(100)]
    public string? InferredPrimaryRole { get; set; }

    [MaxLength(50)]
    public string? InferredSeniority { get; set; }

    public List<string> InferredSkills { get; set; } = new();

    [Column(TypeName = "decimal(18,2)")]
    public decimal? InferredSalaryMin { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal? InferredSalaryMax { get; set; }

    [MaxLength(10)]
    public string? InferredSalaryCurrency { get; set; }

    public List<string> InferredIndustries { get; set; } = new();

    [Column(TypeName = "decimal(5,2)")]
    public decimal ConfidenceScore { get; set; } = 0;

    public string? SynthesisRationale { get; set; }

    public DateTimeOffset LastAnalyzedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset? DeletedAt { get; set; }

    [ConcurrencyCheck]
    public uint Version { get; set; } // Map PostgreSQL xmin system column
}
