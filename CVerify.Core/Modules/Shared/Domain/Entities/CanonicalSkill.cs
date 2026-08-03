using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("canonical_skills")]
public class CanonicalSkill
{
    [Required]
    [MaxLength(100)]
    public string SkillId { get; set; } = null!;

    [Required]
    [MaxLength(20)]
    public string TaxonomyVersion { get; set; } = null!;

    [Required]
    [MaxLength(100)]
    public string DisplayName { get; set; } = null!;

    [Required]
    [MaxLength(100)]
    public string SfiaCategory { get; set; } = null!;

    [Required]
    [MaxLength(20)]
    public string OnetCode { get; set; } = null!;

    [Required]
    [MaxLength(20)]
    public string Status { get; set; } = "Active"; // Active, PendingReview, Archived

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
