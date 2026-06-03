using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Recovery.Entities;

public class RecoveryExecutionLock
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid RecoverySessionId { get; set; }

    [Required]
    [MaxLength(50)]
    public string Status { get; set; } = "Locked"; // "Locked", "InProgress", "Succeeded", "Failed"

    public DateTimeOffset AcquiredAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset? CompletedAt { get; set; }
}
