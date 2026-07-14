using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("security_event_comments")]
public class SecurityEventComment
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    public Guid? SecurityEventId { get; set; }
    [ForeignKey(nameof(SecurityEventId))]
    public virtual SecurityEvent? SecurityEvent { get; set; }

    public Guid? SecurityIncidentId { get; set; }
    [ForeignKey(nameof(SecurityIncidentId))]
    public virtual SecurityIncident? SecurityIncident { get; set; }

    [Required]
    public Guid AuthorUserId { get; set; }
    [ForeignKey(nameof(AuthorUserId))]
    public virtual User AuthorUser { get; set; } = null!;

    [Required]
    public string CommentText { get; set; } = null!;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
