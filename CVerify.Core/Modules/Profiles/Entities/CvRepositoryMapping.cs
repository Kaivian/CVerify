using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using CVerify.API.Modules.SourceCode.Entities;

namespace CVerify.API.Modules.Profiles.Entities;

public class CvRepositoryMapping
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid UserId { get; set; }

    [Required]
    public Guid SourceCodeRepositoryId { get; set; }

    [ForeignKey(nameof(SourceCodeRepositoryId))]
    public virtual SourceCodeRepository SourceCodeRepository { get; set; } = null!;

    [Required]
    [MaxLength(50)]
    public string ReferenceSource { get; set; } = null!; // "Bio", "Headline", "SocialLink", "WorkExperience", "Project", "ProjectRepositoryLink"

    public Guid? ReferenceEntityId { get; set; }

    [Required]
    public DateTimeOffset IndexedAtUtc { get; set; } = DateTimeOffset.UtcNow;
}
