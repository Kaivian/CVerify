using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

public class WorkspaceArchiveSnapshot
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid WorkspaceId { get; set; }

    [Required]
    public Guid OrganizationId { get; set; }

    [Required]
    public string SnapshotDataJson { get; set; } = null!; // Encrypted JSON backup containing files, members list, setting nodes

    [Required]
    [MaxLength(100)]
    public string ArchivedBy { get; set; } = null!;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
