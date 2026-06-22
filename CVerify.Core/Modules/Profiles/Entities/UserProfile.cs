using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using CVerify.API.Modules.Shared.Domain.Entities;

namespace CVerify.API.Modules.Profiles.Entities;

public class UserProfile
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid UserId { get; set; }

    [ForeignKey(nameof(UserId))]
    public virtual User User { get; set; } = null!;

    [Column(TypeName = "citext")]
    [MaxLength(32)]
    public string? Username { get; set; }

    [MaxLength(160)]
    public string? Bio { get; set; }

    [MaxLength(50)]
    public string? Location { get; set; }

    [MaxLength(15)]
    public string? PhoneNumber { get; set; }

    public DateTimeOffset? BirthDate { get; set; }

    [MaxLength(50)]
    public string? Headline { get; set; }

    [MaxLength(50)]
    public string? Company { get; set; }

    [MaxLength(20)]
    public string? Pronouns { get; set; }

    [MaxLength(30)]
    public string? CustomPronouns { get; set; }

    [MaxLength(255)]
    public string? PublicEmail { get; set; }

    [Required]
    [MaxLength(20)]
    public string ProfileVisibility { get; set; } = "public";

    public bool RecruiterVisibility { get; set; } = true;

    [Required]
    [MaxLength(20)]
    public string AiTalentDiscovery { get; set; } = "disabled";

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset LastProfileUpdateAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset? DeletedAt { get; set; }

    [ConcurrencyCheck]
    public uint Version { get; set; } // Map PostgreSQL xmin system column

    public List<string> SocialLinks { get; set; } = new();
}
