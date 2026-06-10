using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

public class Organization
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    [MaxLength(255)]
    public string Name { get; set; } = null!;

    [Required]
    [MaxLength(50)]
    public string TaxCode { get; set; } = null!;

    [Required]
    [MaxLength(255)]
    public string Email { get; set; } = null!;

    [Required]
    [MaxLength(100)]
    public string Username { get; set; } = null!;

    [MaxLength(50)]
    public string? RegistrationNumber { get; set; }

    [Required]
    [MaxLength(50)]
    public string Status { get; set; } = "active"; // "active", "disputed", "archived", "superseded", "fraudulent"

    public bool IsVerified { get; set; } = false;

    public int VerificationLevel { get; set; } = 0; // 0 = Unverified/Onboarding, 1 = Legal Verified, 2 = Domain Verified, 3 = Domain Ownership Verified

    public DateTimeOffset? InitialAdminAssignedAt { get; set; }

    [MaxLength(255)]
    public string? RepresentativeName { get; set; }

    [MaxLength(255)]
    public string? RepresentativeEmail { get; set; }

    [MaxLength(50)]
    public string? RepresentativePhone { get; set; }

    [MaxLength(255)]
    public string? RecoveryAuthority { get; set; }

    [MaxLength(255)]
    public string? RepresentativeIdentity { get; set; }

    [MaxLength(2048)]
    public string? BannerUrl { get; set; }

    [MaxLength(2048)]
    public string? LogoUrl { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset? DeletedAt { get; set; }

    public virtual ICollection<OrganizationAuthority> Members { get; set; } = new List<OrganizationAuthority>();
}
