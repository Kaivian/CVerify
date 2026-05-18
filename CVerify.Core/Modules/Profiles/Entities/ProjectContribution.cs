using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Profiles.Entities;

public class ProjectContribution
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid ProjectEntryId { get; set; }

    [ForeignKey(nameof(ProjectEntryId))]
    public virtual ProjectEntry ProjectEntry { get; set; } = null!;

    [Required]
    [MaxLength(1000)]
    public string Content { get; set; } = null!;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
