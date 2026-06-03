using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using CVerify.API.Modules.Shared.Domain.Entities;

namespace CVerify.API.Modules.Recovery.Entities;

public class OrganizationRecoveryClaim
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid OrganizationId { get; set; }

    [ForeignKey(nameof(OrganizationId))]
    public virtual Organization Organization { get; set; } = null!;

    [Required]
    [MaxLength(255)]
    public string RepresentativeFullName { get; set; } = null!;

    [Required]
    [MaxLength(255)]
    public string RepresentativePosition { get; set; } = null!;

    [Required]
    [MaxLength(50)]
    public string PhoneNumber { get; set; } = null!;

    [Required]
    [MaxLength(255)]
    public string RecoveryEmail { get; set; } = null!;

    public int RiskScore { get; set; }

    [Required]
    [MaxLength(50)]
    public string RiskLevel { get; set; } = "Low"; // "Low", "Medium", "High"

    [Required]
    [MaxLength(50)]
    public string SuggestedRecoveryStrategy { get; set; } = "OptionB"; // "OptionA", "OptionB"

    [Required]
    [MaxLength(50)]
    public string Status { get; set; } = "Pending"; // "Pending", "UnderAnalysis", "Approved", "Rejected"

    public string? RejectionReason { get; set; }

    [MaxLength(100)]
    public string? ReviewedBy { get; set; }

    [MaxLength(100)]
    public string? SecondReviewerBy { get; set; } // For dual approval workflow

    public DateTimeOffset? ReviewedAt { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    // Fraud Signal Flags JSON
    public string? DocumentOcrMetadata { get; set; }
    public string? DocumentSuspiciousMetadata { get; set; }
    public string? WorkspaceActivityFlags { get; set; }
    public string? IpDeviceFlags { get; set; }
    public string? HistoricalClaimFlags { get; set; }

    public virtual ICollection<RecoveryClaimDocument> Documents { get; set; } = new List<RecoveryClaimDocument>();
}
