using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using CVerify.API.Modules.Shared.Domain.Enums;

using System.Text.Json.Serialization;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("requirement_capabilities")]
public class RequirementCapability
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid HiringRequirementId { get; set; }

    [JsonIgnore]
    [ForeignKey(nameof(HiringRequirementId))]
    public virtual HiringRequirement HiringRequirement { get; set; } = null!;

    [Required]
    [MaxLength(100)]
    public string CapabilityId { get; set; } = null!; // Canonical ID, e.g. "db.query-tuning"

    [Required]
    [MaxLength(255)]
    public string Name { get; set; } = null!; // Display Name

    [Required]
    [MaxLength(100)]
    public string Category { get; set; } = null!; // Backend Engineering, DevOps, etc.

    [Required]
    public RequirementPriority Priority { get; set; } = RequirementPriority.MustHave;

    [Required]
    public OwnershipLevel OwnershipLevel { get; set; } = OwnershipLevel.Owner;

    [Required]
    public int ExpectedProficiency { get; set; } = 3; // 1-4 scale mapping to taxonomy levels

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public virtual ICollection<EvidenceSignal> EvidenceSignals { get; set; } = new List<EvidenceSignal>();
}
