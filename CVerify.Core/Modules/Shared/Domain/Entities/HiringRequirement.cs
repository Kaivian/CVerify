using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using CVerify.API.Modules.Shared.Domain.Enums;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("hiring_requirements")]
public class HiringRequirement
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid OrganizationId { get; set; }

    [ForeignKey(nameof(OrganizationId))]
    public virtual Organization Organization { get; set; } = null!;

    [Required]
    public Guid WorkspaceId { get; set; }

    [ForeignKey(nameof(WorkspaceId))]
    public virtual Workspace Workspace { get; set; } = null!;

    [Required]
    [MaxLength(255)]
    public string Title { get; set; } = null!;

    [Required]
    [MaxLength(100)]
    public string Department { get; set; } = null!;

    [Required]
    [MaxLength(50)]
    public string Seniority { get; set; } = null!; // Junior, Middle, Senior, Staff, Principal

    [Required]
    [MaxLength(50)]
    public string WorkplaceType { get; set; } = null!; // Hybrid, Remote, On-site

    [MaxLength(100)]
    public string? City { get; set; }

    [Required]
    [MaxLength(50)]
    public string EmploymentType { get; set; } = null!; // Full-Time, Contract, Part-Time, Internship

    public decimal? SalaryMin { get; set; }

    public decimal? SalaryMax { get; set; }

    [MaxLength(10)]
    public string? Currency { get; set; } // USD, VND, EUR

    [MaxLength(100)]
    public string? TimezoneRange { get; set; }

    [MaxLength(100)]
    public string? DegreeRequirement { get; set; }

    public List<string> Benefits { get; set; } = new();

    public List<string> LanguageRequirements { get; set; } = new();

    public int Headcount { get; set; } = 1;

    [Required]
    [MaxLength(20)]
    public string Status { get; set; } = "Draft"; // Draft, Published, Archived

    public int Version { get; set; } = 1;

    [MaxLength(100)]
    public string? HiringReason { get; set; }

    [MaxLength(2000)]
    public string? BusinessProblem { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public virtual ICollection<BusinessOutcome> BusinessOutcomes { get; set; } = new List<BusinessOutcome>();
    public virtual ICollection<Responsibility> Responsibilities { get; set; } = new List<Responsibility>();
    public virtual ICollection<RequirementCapability> Capabilities { get; set; } = new List<RequirementCapability>();
    public virtual ICollection<TechnologyRequirement> TechnologyRequirements { get; set; } = new List<TechnologyRequirement>();
    public virtual ICollection<EvaluationRubric> EvaluationRubrics { get; set; } = new List<EvaluationRubric>();
    public virtual ICollection<InterviewBlueprint> InterviewBlueprints { get; set; } = new List<InterviewBlueprint>();
    public virtual ICollection<RequirementArtifact> RequirementArtifacts { get; set; } = new List<RequirementArtifact>();
    public virtual ICollection<RequirementSnapshot> Snapshots { get; set; } = new List<RequirementSnapshot>();
}
