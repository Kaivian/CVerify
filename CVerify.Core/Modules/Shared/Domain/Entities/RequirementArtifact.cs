using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("requirement_artifacts")]
public class RequirementArtifact
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid HiringRequirementId { get; set; }

    [JsonIgnore]
    [ForeignKey(nameof(HiringRequirementId))]
    public virtual HiringRequirement HiringRequirement { get; set; } = null!;

    [Required]
    [MaxLength(100)]
    public string ArtifactType { get; set; } = null!; // "JobDescription", "RecruiterBrief", etc.

    [Required]
    public string MarkdownContent { get; set; } = null!;

    [Column(TypeName = "jsonb")]
    public string? StructuredContentJson { get; set; }

    [Required]
    [MaxLength(50)]
    public string Status { get; set; } = "Not Generated"; // "Not Generated", "Generating", "Generated", "Failed", "Cancelled", "Regenerating"

    [MaxLength(100)]
    public string? ModelInfo { get; set; }

    [MaxLength(100)]
    public string? PromptTemplateId { get; set; }

    [MaxLength(50)]
    public string? PromptVersion { get; set; }

    [MaxLength(100)]
    public string? PromptHash { get; set; }

    [Column(TypeName = "jsonb")]
    public string? GenerationMetadataJson { get; set; }

    [Column(TypeName = "jsonb")]
    public string? RegenerationHistoryJson { get; set; }

    public DateTimeOffset? GenerationTimestamp { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
