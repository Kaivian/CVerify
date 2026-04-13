using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Core.Entities;

public class AuditLog
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    public Guid? UserId { get; set; }
    
    [ForeignKey(nameof(UserId))]
    public virtual User? User { get; set; }

    [Required]
    [MaxLength(100)]
    public string EventType { get; set; } = null!;

    [Required]
    public string Description { get; set; } = null!;

    [MaxLength(45)]
    public string? IpAddress { get; set; }

    [MaxLength(64)]
    public string? AnonymizedActorHash { get; set; }

    [MaxLength(500)]
    public string? UserAgent { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
