using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Core.Entities;

public class EducationEntry
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid UserId { get; set; }

    [ForeignKey(nameof(UserId))]
    public virtual User User { get; set; } = null!;

    [Required]
    [MaxLength(255)]
    public string Label { get; set; } = null!;

    [Required]
    [MaxLength(255)]
    public string SchoolName { get; set; } = null!;

    [MaxLength(255)]
    public string? Degree { get; set; }

    [MaxLength(255)]
    public string? Major { get; set; }

    [Column(TypeName = "decimal(4,2)")]
    public decimal? GPA { get; set; }

    [Column(TypeName = "decimal(4,2)")]
    public decimal? GPAScale { get; set; }

    public string? Description { get; set; }

    public DateTimeOffset? StartDate { get; set; }

    public DateTimeOffset? EndDate { get; set; }

    public bool IsCurrentlyStudying { get; set; } = false;

    public int DisplayOrder { get; set; } = 0;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset? DeletedAt { get; set; }
}
