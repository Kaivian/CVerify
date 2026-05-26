using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("capability_edges")]
public class CapabilityEdge
{
    [Required]
    public Guid SourceNodeId { get; set; }

    [ForeignKey(nameof(SourceNodeId))]
    public virtual CapabilityNode SourceNode { get; set; } = null!;

    [Required]
    public Guid TargetNodeId { get; set; }

    [ForeignKey(nameof(TargetNodeId))]
    public virtual CapabilityNode TargetNode { get; set; } = null!;

    [Required]
    [MaxLength(50)]
    public string RelationshipType { get; set; } = null!; // e.g. ParentChild, Prerequisite, Complementary, Specialization

    [Required]
    public double Weight { get; set; } = 1.0;
}
