using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("capability_registries")]
public class CapabilityRegistry
{
    [Key]
    [Required]
    [MaxLength(100)]
    public string CapabilityId { get; set; } = null!; // Canonical ID, e.g. "db.query-tuning"

    [Required]
    [MaxLength(255)]
    public string DisplayName { get; set; } = null!; // Recruiter-friendly name

    [Required]
    [MaxLength(100)]
    public string Category { get; set; } = null!; // e.g. "Backend Engineering"

    [Required]
    [MaxLength(1000)]
    public string Description { get; set; } = null!;

    [Required]
    [MaxLength(50)]
    public string TaxonomyVersion { get; set; } = "1.0.0";

    [Required]
    [MaxLength(20)]
    public string CapabilityVersion { get; set; } = "1.0.0";

    [Required]
    [MaxLength(30)]
    public string Status { get; set; } = "Active"; // Active, Deprecated, Retired

    [MaxLength(100)]
    public string? DeprecatedById { get; set; }

    [ForeignKey(nameof(DeprecatedById))]
    public virtual CapabilityRegistry? DeprecatedBy { get; set; }

    [Required]
    public DateTimeOffset EffectiveDate { get; set; } = DateTimeOffset.UtcNow;

    [Column(TypeName = "jsonb")]
    public string? MigrationMappings { get; set; } // JSON list of redirected or rolled up capabilities

    [Required]
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    [Required]
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
