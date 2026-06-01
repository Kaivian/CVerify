using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using CVerify.API.Modules.Shared.Domain.Entities;

namespace CVerify.API.Modules.Recovery.Entities;

public class RepresentativeApprovalVote
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid RequestId { get; set; }

    [ForeignKey(nameof(RequestId))]
    public virtual RepresentativeRotationRequest Request { get; set; } = null!;

    [Required]
    public Guid ApproverUserId { get; set; }

    [ForeignKey(nameof(ApproverUserId))]
    public virtual User ApproverUser { get; set; } = null!;

    [Required]
    [MaxLength(50)]
    public string ApproverRole { get; set; } = null!; // "organization_owner", "security_admin"

    [Required]
    [MaxLength(50)]
    public string Decision { get; set; } = null!; // "approve", "reject"

    public DateTimeOffset Timestamp { get; set; } = DateTimeOffset.UtcNow;
}
