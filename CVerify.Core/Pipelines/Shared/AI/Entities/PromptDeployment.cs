using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Pipelines.Shared.AI.Entities;

[Table("prompt_deployments")]
public class PromptDeployment
{
    [Key]
    [Required]
    [MaxLength(50)]
    public string PromptId { get; set; } = null!;

    [Required]
    [MaxLength(30)]
    public string ActiveVersion { get; set; } = null!;

    [Required]
    [MaxLength(64)]
    public string Sha256Hash { get; set; } = null!;

    [Required]
    public DateTimeOffset UpdatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
}
