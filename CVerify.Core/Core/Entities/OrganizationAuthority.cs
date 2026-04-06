using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Core.Entities;

public class OrganizationAuthority
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
    public string Role { get; set; } = null!; // "organization_owner", "security_admin", "billing_admin"

    public DateTimeOffset JoinedAt { get; set; } = DateTimeOffset.UtcNow;
}
