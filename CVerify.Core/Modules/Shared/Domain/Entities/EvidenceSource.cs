using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("evidence_sources")]
public class EvidenceSource
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    [MaxLength(150)]
    public string Name { get; set; } = null!; // e.g. "GitHub API Gateway"

    [Required]
    [MaxLength(50)]
    public string ProviderType { get; set; } = null!; // GitHub, LinkedIn, Sumsub, Credly

    [Required]
    public bool IsActive { get; set; } = true;

    [Column(TypeName = "jsonb")]
    public string? ConnectionConfig { get; set; }

    [Required]
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public virtual ICollection<EvidenceArtifact> Artifacts { get; set; } = new List<EvidenceArtifact>();
}
