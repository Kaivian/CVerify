using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("capability_catalog_items")]
public class CapabilityCatalogItem
{
    [Key]
    [Required]
    [MaxLength(100)]
    public string CapabilityId { get; set; } = null!; // Canonical ID, e.g. "api.rest-design", "custom.api-tuning"

    [Required]
    [MaxLength(255)]
    public string DisplayName { get; set; } = null!; // Recruiter-friendly name

    [Required]
    [MaxLength(100)]
    public string Category { get; set; } = null!; // e.g. "Backend Engineering", "Frontend Engineering"

    [Required]
    [MaxLength(1000)]
    public string Description { get; set; } = null!;

    public List<string> Skills { get; set; } = new(); // Recommended skills tags

    public List<string> ExpectedEvidence { get; set; } = new(); // AST signatures, blame authorship metrics

    public Guid? WorkspaceId { get; set; } // Null for global, non-null for custom workspace capabilities

    [JsonIgnore]
    [ForeignKey(nameof(WorkspaceId))]
    public virtual Workspace? Workspace { get; set; }

    [Required]
    [MaxLength(20)]
    public string Status { get; set; } = "Active"; // Active, Archived

    [Required]
    public bool IsCustom { get; set; } = false;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
