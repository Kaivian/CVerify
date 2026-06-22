using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using CVerify.API.Modules.Shared.Domain.Enums;

using System.Text.Json.Serialization;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("responsibilities")]
public class Responsibility
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
    [MaxLength(1000)]
    public string Text { get; set; } = null!;

    [Required]
    public RequirementPriority Priority { get; set; } = RequirementPriority.MustHave;

    [Required]
    public OwnershipLevel OwnershipLevel { get; set; } = OwnershipLevel.Owner;

    public bool IsLeadership { get; set; } = false;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
