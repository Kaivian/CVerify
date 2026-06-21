using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;
using CVerify.API.Modules.Shared.Domain.Enums;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("requirement_snapshots")]
public class RequirementSnapshot
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid HiringRequirementId { get; set; }

    [JsonIgnore]
    [ForeignKey(nameof(HiringRequirementId))]
    public virtual HiringRequirement HiringRequirement { get; set; } = null!;

    [Required]
    public int Version { get; set; }

    public DateTimeOffset SnapshottedAt { get; set; } = DateTimeOffset.UtcNow;

    [Required]
    [MaxLength(255)]
    public string Title { get; set; } = null!;

    [Required]
    [MaxLength(100)]
    public string Department { get; set; } = null!;

    [Required]
    [MaxLength(50)]
    public string Seniority { get; set; } = null!;

    [Required]
    [MaxLength(50)]
    public string WorkplaceType { get; set; } = null!;

    [MaxLength(100)]
    public string? City { get; set; }

    [Required]
    [MaxLength(50)]
    public string EmploymentType { get; set; } = null!;

    public decimal? SalaryMin { get; set; }

    public decimal? SalaryMax { get; set; }

    [MaxLength(10)]
    public string? Currency { get; set; }

    public SalaryPeriod SalaryPeriod { get; set; } = SalaryPeriod.Monthly;

    public bool IsSalaryNegotiable { get; set; } = false;

    [MaxLength(100)]
    public string? TimezoneRange { get; set; }

    [MaxLength(100)]
    public string? DegreeRequirement { get; set; }

    public List<string> Benefits { get; set; } = new();

    public List<string> LanguageRequirements { get; set; } = new();

    public int Headcount { get; set; } = 1;

    public DateTimeOffset? StartDate { get; set; }

    public DateTimeOffset? EndDate { get; set; }

    public AutoCloseRule AutoCloseRule { get; set; } = AutoCloseRule.None;

    public int? CandidatesNeededCount { get; set; }

    public bool IsManuallyClosed { get; set; } = false;

    [NotMapped]
    public string LifecycleStatus
    {
        get
        {
            if (IsManuallyClosed) return "Closed";
            var now = DateTimeOffset.UtcNow;
            if (StartDate.HasValue && StartDate.Value > now) return "Scheduled";
            if (EndDate.HasValue && EndDate.Value < now) return "Expired";
            return "Active";
        }
    }

    [MaxLength(100)]
    public string? HiringReason { get; set; }

    [MaxLength(2000)]
    public string? BusinessProblem { get; set; }

    [Column(TypeName = "jsonb")]
    public string? BusinessOutcomesJson { get; set; }

    [Column(TypeName = "jsonb")]
    public string? ResponsibilitiesJson { get; set; }

    [Column(TypeName = "jsonb")]
    public string? CapabilitiesJson { get; set; }

    [Column(TypeName = "jsonb")]
    public string? TechnologyRequirementsJson { get; set; }

    public virtual EvaluationRubricSnapshot? EvaluationRubricSnapshot { get; set; }
    public virtual InterviewBlueprintSnapshot? InterviewBlueprintSnapshot { get; set; }
    public virtual ICollection<RequirementArtifactSnapshot> ArtifactSnapshots { get; set; } = new List<RequirementArtifactSnapshot>();
    public virtual RequirementVectorSnapshot? RequirementVectorSnapshot { get; set; }
}
