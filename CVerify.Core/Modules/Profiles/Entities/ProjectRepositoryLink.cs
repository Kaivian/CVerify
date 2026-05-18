using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using CVerify.API.Modules.SourceCode.Entities;

namespace CVerify.API.Modules.Profiles.Entities;

public class ProjectRepositoryLink
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid ProjectEntryId { get; set; }

    [ForeignKey(nameof(ProjectEntryId))]
    public virtual ProjectEntry ProjectEntry { get; set; } = null!;

    [Required]
    public Guid SourceCodeRepositoryId { get; set; }

    [ForeignKey(nameof(SourceCodeRepositoryId))]
    public virtual SourceCodeRepository SourceCodeRepository { get; set; } = null!;

    [Required]
    public DateTimeOffset LinkedAt { get; set; } = DateTimeOffset.UtcNow;
}
