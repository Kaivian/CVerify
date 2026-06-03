using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using CVerify.API.Modules.Shared.Domain.Entities;

namespace CVerify.API.Modules.Recovery.Entities;

public class RepresentativeRotationRequest
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid OrganizationId { get; set; }

    [ForeignKey(nameof(OrganizationId))]
    public virtual Organization Organization { get; set; } = null!;

    [MaxLength(255)]
    public string? CurrentRepresentative { get; set; }

    [Required]
    [MaxLength(255)]
    public string RequestedRepresentative { get; set; } = null!;

    [Required]
    [MaxLength(255)]
    public string RequestedEmail { get; set; } = null!;

    [Required]
    [MaxLength(50)]
    public string RequestedPhone { get; set; } = null!;

    [Required]
    public string Reason { get; set; } = null!;

    [Required]
    [MaxLength(50)]
    public string SupportApprovalStatus { get; set; } = "pending_review"; // "pending_review", "approved", "rejected"

    [Required]
    [MaxLength(50)]
    public string AdminApprovalStatus { get; set; } = "pending_review"; // "pending_review", "approved", "rejected"

    [Required]
    [MaxLength(50)]
    public string FinalDecision { get; set; } = "pending_review"; // "pending_review", "awaiting_admin_approval", "awaiting_support_approval", "approved", "rejected", "expired"

    [Required]
    [MaxLength(50)]
    public string VerificationCallStatus { get; set; } = "not_started"; // "not_started", "scheduled", "verified", "failed"

    public string? VerificationCallNotes { get; set; }

    public string? OptionalSupportingMessage { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset ExpiresAt { get; set; }

    public virtual ICollection<RepresentativeApprovalVote> Votes { get; set; } = new List<RepresentativeApprovalVote>();
}
