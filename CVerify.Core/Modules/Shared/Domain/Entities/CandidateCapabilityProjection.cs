using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("candidate_capability_projections")]
public class CandidateCapabilityProjection
{
    [Key]
    [ForeignKey(nameof(Candidate))]
    public Guid CandidateId { get; set; }

    public virtual User Candidate { get; set; } = null!;

    [Required]
    [Column(TypeName = "jsonb")]
    public string CapabilitiesJson { get; set; } = null!;

    [Required]
    public DateTimeOffset ProjectedAt { get; set; } = DateTimeOffset.UtcNow;
}
