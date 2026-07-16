using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("canonical_skill_aliases")]
public class CanonicalSkillAlias
{
    [Key]
    [Required]
    [MaxLength(100)]
    public string AliasName { get; set; } = null!; // Lowercase alias, e.g. "mongo"

    [Required]
    [MaxLength(100)]
    public string SkillId { get; set; } = null!;

    [Required]
    [MaxLength(20)]
    public string TaxonomyVersion { get; set; } = "2026.07";
}
