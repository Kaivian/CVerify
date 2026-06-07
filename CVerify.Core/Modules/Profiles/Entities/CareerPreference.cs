using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using CVerify.API.Modules.Shared.Domain.Entities;

namespace CVerify.API.Modules.Profiles.Entities;

public class CareerPreference
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid UserId { get; set; }

    [ForeignKey(nameof(UserId))]
    public virtual User User { get; set; } = null!;

    public bool AvailableForHire { get; set; } = true;

    [Required]
    [MaxLength(10)]
    public string PreferredLanguage { get; set; } = "en";

    [MaxLength(255)]
    public string? JobTitlePreferences { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal? SalaryExpectations { get; set; }

    [MaxLength(20)]
    public string? RemotePreference { get; set; }

    [MaxLength(20)]
    public string OpenToWorkStatus { get; set; } = "casual";

    public bool OpenToRelocation { get; set; } = false;

    public string LeadershipTrack { get; set; } = "undecided";

    public List<string> CompanyStagePreferences { get; set; } = new();

    public List<string> PreferredIndustries { get; set; } = new();

    public List<string> TargetSkills { get; set; } = new();

    public List<string> PreferredWorkEnvironments { get; set; } = new();

    public List<string> WorkStyles { get; set; } = new();

    public List<string> CompanyValues { get; set; } = new();

    [Column(TypeName = "decimal(18,2)")]
    public decimal? ExpectedSalaryMin { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal? ExpectedSalaryMax { get; set; }

    [MaxLength(10)]
    public string? ExpectedSalaryCurrency { get; set; }

    [MaxLength(20)]
    public string? ExpectedSalaryType { get; set; }

    public bool ExpectedSalaryNegotiable { get; set; } = false;

    public bool IsExpectedSalaryVisible { get; set; } = false;

    public string? WorkPreferenceNotes { get; set; }

    public List<string> DesiredJobPositions { get; set; } = new();

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset? DeletedAt { get; set; }

    [ConcurrencyCheck]
    public uint Version { get; set; } // Map PostgreSQL xmin system column
}
