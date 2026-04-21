using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using CVerify.API.Modules.Shared.Domain.Entities;

namespace CVerify.API.Modules.SourceCode.Entities;

public class AnalysisJob
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid RepositoryId { get; set; }

    [ForeignKey(nameof(RepositoryId))]
    public virtual SourceCodeRepository Repository { get; set; } = null!;

    [Required]
    public Guid UserId { get; set; }

    [ForeignKey(nameof(UserId))]
    public virtual User User { get; set; } = null!;

    [Required]
    [MaxLength(50)]
    public string Status { get; set; } = "Queued";

    [Required]
    public double Progress { get; set; } = 0.0;

    [MaxLength(100)]
    public string? CurrentStep { get; set; }

    [MaxLength(100)]
    public string? CommitSha { get; set; }

    public DateTimeOffset? StartedAt { get; set; }

    public DateTimeOffset? CompletedAt { get; set; }

    [MaxLength(2000)]
    public string? ErrorMessage { get; set; }

    [Required]
    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;

    [Required]
    public DateTimeOffset LastUpdatedUtc { get; set; } = DateTimeOffset.UtcNow;
}
