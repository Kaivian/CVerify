using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;

namespace CVerify.API.Modules.Profiles.Entities;

public class WorkExperienceEntry
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid UserId { get; set; }

    [ForeignKey(nameof(UserId))]
    public virtual User User { get; set; } = null!;

    [Required]
    [MaxLength(255)]
    public string JobTitle { get; set; } = null!;

    [Required]
    [MaxLength(255)]
    public string Company { get; set; } = null!;

    [Required]
    public ExperienceCategory ExperienceCategory { get; set; }

    [Required]
    public EmploymentType EmploymentType { get; set; }

    [MaxLength(255)]
    public string? Location { get; set; }

    [Required]
    public DateTimeOffset StartDate { get; set; }

    public DateTimeOffset? EndDate { get; set; }

    public bool IsCurrentlyWorking { get; set; } = false;

    public bool IsLeadership { get; set; } = false;

    [Required]
    [MaxLength(2000)]
    public string Description { get; set; } = null!;

    public int DisplayOrder { get; set; } = 0;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset? DeletedAt { get; set; }

    // Navigation properties for normalized child tables
    public virtual ICollection<WorkExperienceAchievement> Achievements { get; set; } = new List<WorkExperienceAchievement>();
    public virtual ICollection<WorkExperienceTechnology> Technologies { get; set; } = new List<WorkExperienceTechnology>();
    public virtual ICollection<WorkExperienceLink> Links { get; set; } = new List<WorkExperienceLink>();
}
