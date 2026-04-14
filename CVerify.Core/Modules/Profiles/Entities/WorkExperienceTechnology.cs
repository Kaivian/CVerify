using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Profiles.Entities;

public class WorkExperienceTechnology
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid WorkExperienceId { get; set; }

    [ForeignKey(nameof(WorkExperienceId))]
    public virtual WorkExperienceEntry WorkExperienceEntry { get; set; } = null!;

    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = null!;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
