using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("candidate_search_profiles")]
public class CandidateSearchProfile
{
    [Key]
    [ForeignKey(nameof(Candidate))]
    public Guid CandidateId { get; set; }

    public virtual User Candidate { get; set; } = null!;

    [Required]
    [MaxLength(255)]
    public string FullName { get; set; } = null!;

    [MaxLength(255)]
    public string? Headline { get; set; }

    [MaxLength(100)]
    public string? Location { get; set; }

    [Required]
    public int TrustScore { get; set; } = 0;

    [Required]
    [MaxLength(30)]
    public string TrustTier { get; set; } = null!; // Unverified, BasicVerified, EvidenceVerified, HighTrust

    [Required]
    [Column(TypeName = "jsonb")]
    public string CapabilitiesJson { get; set; } = null!; // Fast flat representation of capability nodes and scores

    [Required]
    public float[] SearchEmbedding { get; set; } = null!; // 1536-dimension profile vector

    [Required]
    public DateTimeOffset LastProjectedAt { get; set; } = DateTimeOffset.UtcNow;
}
