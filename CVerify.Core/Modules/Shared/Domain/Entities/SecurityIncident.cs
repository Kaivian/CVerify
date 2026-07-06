using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("security_incidents")]
public class SecurityIncident
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    [MaxLength(255)]
    public string Title { get; set; } = null!;

    [Required]
    public string Description { get; set; } = null!;

    [Required]
    [MaxLength(30)]
    public string Status { get; set; } = "Open"; // Open, Investigating, Escalated, Resolved, Closed

    [Required]
    [MaxLength(20)]
    public string Severity { get; set; } = "Low"; // Low, Medium, High, Critical

    public Guid? AssignedToUserId { get; set; }
    [ForeignKey(nameof(AssignedToUserId))]
    public virtual User? AssignedToUser { get; set; }

    public virtual ICollection<SecurityEvent> CorrelatedEvents { get; set; } = new List<SecurityEvent>();
    public virtual ICollection<SecurityEventComment> Comments { get; set; } = new List<SecurityEventComment>();

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
