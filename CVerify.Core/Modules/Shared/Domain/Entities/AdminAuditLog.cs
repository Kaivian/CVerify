using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("admin_audit_logs")]
public class AdminAuditLog
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    public Guid? ActorUserId { get; set; }

    [ForeignKey(nameof(ActorUserId))]
    public virtual User? ActorUser { get; set; }

    [Required]
    [MaxLength(50)]
    public string Action { get; set; } = null!; // "ROLE_CREATED", "ROLE_UPDATED", "ROLE_DELETED", "ROLE_ASSIGNED", "ROLE_REVOKED", "MEMBER_INVITED", "MEMBER_SUSPENDED"

    [MaxLength(50)]
    public string? TargetRoleName { get; set; }

    public Guid? TargetUserId { get; set; }

    [ForeignKey(nameof(TargetUserId))]
    public virtual User? TargetUser { get; set; }

    [Column(TypeName = "jsonb")]
    public string? DetailsJson { get; set; }

    public DateTimeOffset Timestamp { get; set; } = DateTimeOffset.UtcNow;
}
