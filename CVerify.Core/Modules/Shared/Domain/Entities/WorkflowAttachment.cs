using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("workflow_attachments")]
public class WorkflowAttachment
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid WorkflowRequestId { get; set; }

    [ForeignKey(nameof(WorkflowRequestId))]
    public virtual EnterpriseWorkflowRequest WorkflowRequest { get; set; } = null!;

    [Required]
    [MaxLength(2048)]
    public string StoragePath { get; set; } = null!;

    [Required]
    [MaxLength(255)]
    public string FileName { get; set; } = null!;

    [Required]
    [MaxLength(100)]
    public string ContentType { get; set; } = null!;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
