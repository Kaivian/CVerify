using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("enterprise_workflow_requests")]
public class EnterpriseWorkflowRequest
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid OrganizationId { get; set; }

    [ForeignKey(nameof(OrganizationId))]
    public virtual Organization Organization { get; set; } = null!;

    [Required]
    [MaxLength(50)]
    public string RequestType { get; set; } = null!; // "Registration", "Verification", "Recovery", "Report", "Appeal", "OwnershipTransfer"

    [Required]
    [MaxLength(50)]
    public string Status { get; set; } = "Pending"; // "Pending", "UnderReview", "Approved", "Rejected", "Escalated", "Resolved", "Dismissed"

    [Required]
    [MaxLength(50)]
    public string Priority { get; set; } = "Low"; // "Low", "Medium", "High", "Critical"

    [Required]
    public string MetadataJson { get; set; } = "{}"; // JSON payload specific to the request type

    public Guid? AssignedReviewerId { get; set; }

    [ForeignKey(nameof(AssignedReviewerId))]
    public virtual User? AssignedReviewer { get; set; }

    public DateTimeOffset? AssignedAt { get; set; }

    public DateTimeOffset? ClaimedAt { get; set; }

    public DateTimeOffset? DueAt { get; set; } // SLA deadline

    public Guid? EscalatedToUserId { get; set; }

    [ForeignKey(nameof(EscalatedToUserId))]
    public virtual User? EscalatedToUser { get; set; }

    public string? ReviewState { get; set; } // JSON or text showing reviewer notes/checklists

    [Timestamp]
    public byte[] RowVersion { get; set; } = null!; // Concurrency token for optimistic locking

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset? ResolvedAt { get; set; }

    [NotMapped]
    public bool SlaBreached => Status != "Approved" && Status != "Rejected" && Status != "Resolved" && Status != "Dismissed" && DueAt.HasValue && DueAt.Value < DateTimeOffset.UtcNow;

    public virtual ICollection<WorkflowAttachment> Attachments { get; set; } = new List<WorkflowAttachment>();

    public virtual ICollection<WorkflowComment> Comments { get; set; } = new List<WorkflowComment>();
}
