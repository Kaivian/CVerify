using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

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

    public Guid? ActorUserId { get; set; }

    [ForeignKey(nameof(ActorUserId))]
    public virtual User? ActorUser { get; set; }

    public Guid? TargetUserId { get; set; }

    [ForeignKey(nameof(TargetUserId))]
    public virtual User? TargetUser { get; set; }

    public Guid? OrganizationId { get; set; }

    [ForeignKey(nameof(OrganizationId))]
    public virtual Organization? Organization { get; set; }

    [MaxLength(50)]
    public string? TargetRoleName { get; set; }

    [MaxLength(30)]
    public string? ScopeType { get; set; }

    public Guid? ScopeId { get; set; }

    [Column(TypeName = "jsonb")]
    public string? DetailsJson { get; set; }

    [Column(TypeName = "jsonb")]
    public string? OldStateJson { get; set; }

    [Column(TypeName = "jsonb")]
    public string? NewStateJson { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
