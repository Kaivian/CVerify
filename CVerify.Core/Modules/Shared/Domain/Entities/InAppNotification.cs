using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("in_app_notifications")]
public class InAppNotification
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid UserId { get; set; }

    [ForeignKey(nameof(UserId))]
    public virtual User User { get; set; } = null!;

    public Guid? ActivityEventId { get; set; }

    [ForeignKey(nameof(ActivityEventId))]
    public virtual ActivityEvent? ActivityEvent { get; set; }

    [Required]
    [MaxLength(100)]
    public string NotificationType { get; set; } = null!;

    [Required]
    [MaxLength(50)]
    public string ResourceType { get; set; } = null!;

    public Guid? ResourceId { get; set; }

    [Column(TypeName = "jsonb")]
    public string? PayloadJson { get; set; }

    [Required]
    public bool IsRead { get; set; } = false;

    [Required]
    public bool IsAggregated { get; set; } = false;

    [MaxLength(255)]
    public string? AggregateKey { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset? ReadAt { get; set; }

    public DateTimeOffset? DeletedAt { get; set; }
}

public class NotificationPayload
{
    public int Count { get; set; }
    public global::System.Collections.Generic.List<ActorInfo> Actors { get; set; } = new();
}

public class ActorInfo
{
    public Guid Id { get; set; }
    public string FullName { get; set; } = null!;
}
