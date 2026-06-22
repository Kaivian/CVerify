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

    public string? Description { get; set; }
    public string? CompanyType { get; set; }
    public string? CompanySize { get; set; }
    public int BranchCount { get; set; } = 0;
    public int FollowerCount { get; set; } = 0;
    public List<string> IndustryTags { get; set; } = new();
    public List<string> BenefitTags { get; set; } = new();
    public List<string> GalleryUrls { get; set; } = new();
    public string? ContactName { get; set; }
    public string? ContactPhone { get; set; }
    public string? ContactEmail { get; set; }
    public string? City { get; set; }
    public string? DetailAddress { get; set; }
    public string? GoogleMapsEmbedUrl { get; set; }
    public string? LinkedinUrl { get; set; }
    public string? FacebookUrl { get; set; }
    public string? TwitterUrl { get; set; }
    public string? Website { get; set; }
    public string? Mission { get; set; }
    public string? Vision { get; set; }
    public string? CoreValues { get; set; }
    public string? Founded { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset? DeletedAt { get; set; }

    public virtual ICollection<OrganizationAuthority> Members { get; set; } = new List<OrganizationAuthority>();
}
