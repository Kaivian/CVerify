using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Core.Entities;

public class OrganizationVerification
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
    public string VerificationType { get; set; } = null!; // "Legal", "Domain", "Dns"

    public bool IsVerified { get; set; } = false;

    [MaxLength(255)]
    public string? VerifiedValue { get; set; } // tax code, domain, DNS TXT record value

    public DateTimeOffset? VerifiedAt { get; set; }

    [MaxLength(100)]
    public string? VerifiedBy { get; set; } // System, Admin User ID

    public string? Metadata { get; set; } // JSON metadata evidence
}
