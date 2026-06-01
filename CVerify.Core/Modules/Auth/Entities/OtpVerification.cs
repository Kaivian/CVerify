using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using CVerify.API.Modules.Auth.Enums;

namespace CVerify.API.Modules.Auth.Entities;

public class OtpVerification
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid ChallengeId { get; set; } = Guid.CreateVersion7();

    [Required]
    [MaxLength(255)]
    public string Email { get; set; } = null!;

    [Required]
    [MaxLength(255)]
    public string OtpHash { get; set; } = null!;

    [Required]
    [MaxLength(100)]
    public string Purpose { get; set; } = null!;

    public DateTimeOffset ExpiresAt { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset? ConsumedAt { get; set; }

    public int Attempts { get; set; } = 0;

    public DateTimeOffset? LastAttemptAt { get; set; }

    public int ResendCount { get; set; } = 0;

    public DateTimeOffset? LastSentAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset? LastResentAt { get; set; }

    [Required]
    public OtpSessionStatus Status { get; set; } = OtpSessionStatus.ACTIVE;

    public DateTimeOffset? CooldownUntil { get; set; }

    public DateTimeOffset? InvalidatedAt { get; set; }
}
