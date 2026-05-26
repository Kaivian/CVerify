using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("evidence_artifacts")]
public class EvidenceArtifact
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid SourceId { get; set; }

    [ForeignKey(nameof(SourceId))]
    public virtual EvidenceSource Source { get; set; } = null!;

    [Required]
    [MaxLength(500)]
    public string ExternalIdentifier { get; set; } = null!; // e.g. commit hash, repo URL

    [Required]
    [MaxLength(50)]
    public string ArtifactType { get; set; } = null!; // CodeRepository, GitCommit, AcademicCredential, etc.

    [Required]
    [Column(TypeName = "jsonb")]
    public string Payload { get; set; } = null!; // Metadata specific to type

    [MaxLength(512)]
    public string? CryptographicSignature { get; set; } // GPG signature info

    [Required]
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
