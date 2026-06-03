using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using CVerify.API.Modules.Shared.Domain.Enums;

namespace CVerify.API.Modules.Profiles.Entities;

public class WorkExperienceLink
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid WorkExperienceId { get; set; }

    [ForeignKey(nameof(WorkExperienceId))]
    public virtual WorkExperienceEntry WorkExperienceEntry { get; set; } = null!;

    [Required]
    public WorkLinkType LinkType { get; set; }

    [Required]
    [MaxLength(500)]
    public string Url { get; set; } = null!;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
