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

    public virtual List<ClaimDocument> Documents { get; set; } = new List<ClaimDocument>();
}

public class ClaimDocument
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public string StoragePath { get; set; } = null!;
    public string FileName { get; set; } = null!;
    public string ContentType { get; set; } = null!;
    public string EncryptionIv { get; set; } = null!;
    public string? OcrResultText { get; set; }
    public string VirusScanStatus { get; set; } = "Pending";
    public DateTimeOffset RetentionExpiryDate { get; set; } = DateTimeOffset.UtcNow.AddYears(5);
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
