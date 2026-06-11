using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("admin_members")]
public class AdminMember
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid UserId { get; set; }

    [ForeignKey(nameof(UserId))]
    public virtual User User { get; set; } = null!;

    [Required]
    [MaxLength(50)]
    public string Status { get; set; } = "Active"; // Active, Suspended, PendingOnboarding

    [Required]
    public int SessionVersion { get; set; } = 1;

    [Required]
    public DateTimeOffset JoinedAt { get; set; } = DateTimeOffset.UtcNow;

    [Required]
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public Guid? AssignedByUserId { get; set; }

    [ForeignKey(nameof(AssignedByUserId))]
    public virtual User? AssignedByUser { get; set; }

}
