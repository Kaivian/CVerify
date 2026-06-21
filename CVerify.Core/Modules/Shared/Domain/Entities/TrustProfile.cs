using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("trust_profiles")]
public class TrustProfile
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid TargetEntityId { get; set; }

    [Required]
    [MaxLength(30)]
    public string TargetType { get; set; } = null!; // Candidate, Recruiter, Organization

    [Required]
    public DateTimeOffset RecalculatedAt { get; set; } = DateTimeOffset.UtcNow;

    public virtual ICollection<TrustComponent> Components { get; set; } = new List<TrustComponent>();
    public virtual ICollection<TrustCalculation> Calculations { get; set; } = new List<TrustCalculation>();
}
