using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Core.Entities;

public class RepresentativeAuthorityHistory
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid OrganizationId { get; set; }

    [ForeignKey(nameof(OrganizationId))]
    public virtual Organization Organization { get; set; } = null!;

    [MaxLength(255)]
    public string? PreviousRepresentative { get; set; }

    [Required]
    [MaxLength(255)]
    public string NewRepresentative { get; set; } = null!;

    [Required]
    [MaxLength(255)]
    public string RotatedBy { get; set; } = null!;

    [Required]
    [MaxLength(255)]
    public string SupportReviewer { get; set; } = null!;

    public DateTimeOffset EffectiveAt { get; set; } = DateTimeOffset.UtcNow;
}
