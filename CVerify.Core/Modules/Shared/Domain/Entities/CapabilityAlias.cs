using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("capability_aliases")]
public class CapabilityAlias
{
    [Key]
    [Required]
    [MaxLength(100)]
    public string AliasName { get; set; } = null!; // Synonym / keyword, e.g. "sql-tuning"

    [Required]
    [MaxLength(100)]
    public string CanonicalId { get; set; } = null!; // e.g. "db.query-tuning"

    [ForeignKey(nameof(CanonicalId))]
    public virtual CapabilityRegistry CanonicalCapability { get; set; } = null!;
}
