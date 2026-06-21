using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("candidate_capabilities")]
public class CandidateCapability
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid CandidateId { get; set; }

    [ForeignKey(nameof(CandidateId))]
    public virtual User Candidate { get; set; } = null!;

    [Required]
    public Guid CapabilityNodeId { get; set; }

    [ForeignKey(nameof(CapabilityNodeId))]
    public virtual CapabilityNode CapabilityNode { get; set; } = null!;

    [Required]
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    [Required]
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public virtual CandidateCapabilityScore? Score { get; set; }
    public virtual ICollection<CandidateCapabilityHistory> Histories { get; set; } = new List<CandidateCapabilityHistory>();
    public virtual ICollection<CandidateCapabilityEvidence> EvidenceLinks { get; set; } = new List<CandidateCapabilityEvidence>();
}
