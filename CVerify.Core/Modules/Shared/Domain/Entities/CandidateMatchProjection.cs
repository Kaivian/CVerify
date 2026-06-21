using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("candidate_match_projections")]
public class CandidateMatchProjection
{
    [Key]
    [ForeignKey(nameof(Candidate))]
    public Guid CandidateId { get; set; }

    public virtual User Candidate { get; set; } = null!;

    [MaxLength(1000)]
    public string? ProfileSummary { get; set; }

    [Required]
    public Guid[] NormalizedCapabilities { get; set; } = Array.Empty<Guid>(); // Pre-calculated capability UUID arrays

    [Required]
    public DateTimeOffset LastProjectedAt { get; set; } = DateTimeOffset.UtcNow;
}
