using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("ai_streaming_logs")]
public class AiStreamingLog
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid SessionId { get; set; }

    [ForeignKey(nameof(SessionId))]
    public virtual AiStreamingSession Session { get; set; } = null!;

    [MaxLength(100)]
    public string? StageId { get; set; }

    [Required]
    [MaxLength(20)]
    public string LogLevel { get; set; } = "Info"; // Info, Success, Warning, Error, Debug

    [MaxLength(100)]
    public string? Component { get; set; }

    [Required]
    public string Message { get; set; } = null!;

    [Required]
    public DateTimeOffset Timestamp { get; set; } = DateTimeOffset.UtcNow;
}
