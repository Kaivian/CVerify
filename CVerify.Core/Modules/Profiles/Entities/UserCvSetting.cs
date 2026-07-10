using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using CVerify.API.Modules.Shared.Domain.Entities;

namespace CVerify.API.Modules.Profiles.Entities;

[Table("user_cv_settings")]
public class UserCvSetting
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    [Column("user_id")]
    public Guid UserId { get; set; }

    [ForeignKey(nameof(UserId))]
    public virtual User User { get; set; } = null!;

    [Required]
    [MaxLength(50)]
    [Column("cv_template_id")]
    public string CvTemplateId { get; set; } = "professional";

    [MaxLength(50)]
    [Column("cv_theme_color")]
    public string? CvThemeColor { get; set; }

    [Required]
    [Column("is_cv_published")]
    public bool IsCvPublished { get; set; } = true;

    [Column("cv_layout_config_json")]
    public string? CvLayoutConfigJson { get; set; }

    [Required]
    [Column("created_at")]
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    [Required]
    [Column("updated_at")]
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
