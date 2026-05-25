using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Core.Entities;

public class RecoveryClaimDocument
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid RecoveryClaimId { get; set; }

    [Required]
    [MaxLength(500)]
    public string StoragePath { get; set; } = null!;

    [Required]
    [MaxLength(255)]
    public string FileName { get; set; } = null!;

    [Required]
    [MaxLength(100)]
    public string ContentType { get; set; } = null!;

    [Required]
    [MaxLength(100)]
    public string EncryptionIv { get; set; } = null!;

    public string? OcrResultText { get; set; }

    [Required]
    [MaxLength(50)]
    public string VirusScanStatus { get; set; } = "Pending"; // "Pending", "Clean", "Infected"

    public DateTimeOffset RetentionExpiryDate { get; set; } = DateTimeOffset.UtcNow.AddYears(5); // Default 5 years standard legal retention

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
