using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;

namespace CVerify.API.Modules.Profiles.Entities;

public class ProjectEntry
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
    public string Name { get; set; } = null!;

    [MaxLength(255)]
    public string? Role { get; set; }

    [Required]
    [MaxLength(2000)]
    public string Description { get; set; } = null!;

    public DateTimeOffset? StartDate { get; set; }

    public DateTimeOffset? EndDate { get; set; }

    public bool IsCurrentlyWorking { get; set; } = false;

    [Required]
    public ProjectVerificationLevel VerificationLevel { get; set; }

    [Required]
    public ProjectVerificationStatus VerificationStatus { get; set; }

    public DateTimeOffset? VerifiedAt { get; set; }

    [Column(TypeName = "jsonb")]
    public string? VerificationMetadataJson { get; set; }

    public int DisplayOrder { get; set; } = 0;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset? DeletedAt { get; set; }

    // Navigation properties
    public virtual ICollection<ProjectRepositoryLink> RepositoryLinks { get; set; } = new List<ProjectRepositoryLink>();
    public virtual ICollection<ProjectTechnology> Technologies { get; set; } = new List<ProjectTechnology>();
    public virtual ICollection<ProjectContribution> Contributions { get; set; } = new List<ProjectContribution>();
}
