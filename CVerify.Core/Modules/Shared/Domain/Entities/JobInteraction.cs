using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("job_interactions")]
public class JobInteraction
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid UserId { get; set; }

    [ForeignKey(nameof(UserId))]
    public virtual User User { get; set; } = null!;

    [Required]
    public Guid JobVacancyId { get; set; }

    [ForeignKey(nameof(JobVacancyId))]
    public virtual JobVacancy JobVacancy { get; set; } = null!;

    [Required]
    [MaxLength(30)]
    public string InteractionType { get; set; } = null!; // Viewed, Saved, Dismissed, Applied, Shared

    public DateTimeOffset InteractionAt { get; set; } = DateTimeOffset.UtcNow;
}
