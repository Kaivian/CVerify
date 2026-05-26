using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

public class JobVacancy
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid OrganizationId { get; set; }

    [ForeignKey(nameof(OrganizationId))]
    public virtual Organization Organization { get; set; } = null!;

    [Required]
    [MaxLength(255)]
    public string Title { get; set; } = null!;

    [Required]
    [MaxLength(100)]
    public string Department { get; set; } = null!;

    [Required]
    [MaxLength(50)]
    public string WorkplaceType { get; set; } = null!; // e.g. Hybrid, Remote, On-site

    [Required]
    [MaxLength(100)]
    public string City { get; set; } = null!;

    [Required]
    [MaxLength(50)]
    public string Type { get; set; } = null!; // e.g. Full-Time, Contract, Part-Time

    [Required]
    [MaxLength(100)]
    public string Salary { get; set; } = null!;

    [Required]
    [MaxLength(100)]
    public string SalaryMinMax { get; set; } = null!;

    public int Headcount { get; set; } = 1;

    [Required]
    [MaxLength(50)]
    public string Gender { get; set; } = "KhÃ´ng yÃªu cáº§u";

    [Required]
    [MaxLength(100)]
    public string Experience { get; set; } = null!;

    [Required]
    [MaxLength(100)]
    public string Degree { get; set; } = null!;

    [Required]
    [MaxLength(200)]
    public string Category { get; set; } = null!;

    public List<string> Description { get; set; } = new();

    public List<string> Requirements { get; set; } = new();

    public List<string> Benefits { get; set; } = new();

    public List<string> Tags { get; set; } = new();

    public List<string> Skills { get; set; } = new();

    [Required]
    [MaxLength(2048)]
    public string CoverUrl { get; set; } = null!;

    public List<string> Images { get; set; } = new();

    public bool IsActive { get; set; } = true;

    [Required]
    [MaxLength(50)]
    public string Status { get; set; } = "Draft"; // Draft, Published, Archived

    [Required]
    [MaxLength(50)]
    public string AcquisitionStrategy { get; set; } = "Hybrid"; // ManualOnly, AiMatchingOnly, Hybrid

    [Column(TypeName = "jsonb")]
    public string? DiscoveryProfileJson { get; set; }

    public Guid? RequirementSnapshotId { get; set; }

    [ForeignKey(nameof(RequirementSnapshotId))]
    public virtual RequirementSnapshot? RequirementSnapshot { get; set; }

    public string? Metadata { get; set; }

    public Guid? HiringRequirementId { get; set; }

    [ForeignKey(nameof(HiringRequirementId))]
    public virtual HiringRequirement? HiringRequirement { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
