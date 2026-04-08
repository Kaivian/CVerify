using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Core.Entities;

public class CareerPreference
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid UserId { get; set; }

    [ForeignKey(nameof(UserId))]
    public virtual User User { get; set; } = null!;

    public bool AvailableForHire { get; set; } = true;

    [Required]
    [MaxLength(10)]
    public string PreferredLanguage { get; set; } = "en";

    [MaxLength(255)]
    public string? JobTitlePreferences { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal? SalaryExpectations { get; set; }

    [MaxLength(20)]
    public string? RemotePreference { get; set; }

    [MaxLength(20)]
    public string? OpenToWorkStatus { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset? DeletedAt { get; set; }

    [ConcurrencyCheck]
    public uint Version { get; set; } // Map PostgreSQL xmin system column
}
