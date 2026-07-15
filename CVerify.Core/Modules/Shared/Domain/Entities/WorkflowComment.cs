using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("workflow_comments")]
public class WorkflowComment
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid WorkflowRequestId { get; set; }

    [ForeignKey(nameof(WorkflowRequestId))]
    public virtual EnterpriseWorkflowRequest WorkflowRequest { get; set; } = null!;

    [Required]
    public Guid AuthorUserId { get; set; }

    [ForeignKey(nameof(AuthorUserId))]
    public virtual User AuthorUser { get; set; } = null!;

    [Required]
    public string Content { get; set; } = null!;

    public bool IsInternalOnly { get; set; } = true;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
