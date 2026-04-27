using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

public class OrganizationMembership
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid OrganizationId { get; set; }

    [ForeignKey(nameof(OrganizationId))]
    public virtual Organization Organization { get; set; } = null!;

    [Required]
    public Guid UserId { get; set; }

    [ForeignKey(nameof(UserId))]
    public virtual User User { get; set; } = null!;

    [Required]
    [MaxLength(50)]
    public string Role { get; set; } = null!; // Maps to OrganizationRole enum strings: "OWNER", "REPRESENTATIVE", "HR", "MEMBER"

    [Required]
    [MaxLength(50)]
    public string Status { get; set; } = "active"; // "active", "invited", "suspended"

    public DateTimeOffset JoinedAt { get; set; } = DateTimeOffset.UtcNow;
}
