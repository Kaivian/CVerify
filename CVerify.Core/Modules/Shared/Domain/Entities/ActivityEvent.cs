using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("activity_events")]
public class ActivityEvent
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid CorrelationId { get; set; }

    public Guid? CausationId { get; set; }

    public Guid? OrganizationId { get; set; }

    [ForeignKey(nameof(OrganizationId))]
    public virtual Organization? Organization { get; set; }

    public Guid? ActorUserId { get; set; }

    [ForeignKey(nameof(ActorUserId))]
    public virtual User? ActorUser { get; set; }

    [Required]
    [MaxLength(100)]
    public string EventType { get; set; } = null!;

    [Required]
    [MaxLength(50)]
    public string ResourceType { get; set; } = null!;

    public Guid? ResourceId { get; set; }

    [Required]
    [MaxLength(30)]
    public string Visibility { get; set; } = "organization"; // "private", "workspace", "organization", "public"

    [Required]
    public bool IsProjected { get; set; } = false;

    [Column(TypeName = "jsonb")]
    public string? PayloadJson { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
