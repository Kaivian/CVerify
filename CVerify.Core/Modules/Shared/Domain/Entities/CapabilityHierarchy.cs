using System;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("capability_hierarchies")]
public class CapabilityHierarchy
{
    public string ParentId { get; set; } = null!;

    [ForeignKey(nameof(ParentId))]
    public virtual CapabilityRegistry Parent { get; set; } = null!;

    public string ChildId { get; set; } = null!;

    [ForeignKey(nameof(ChildId))]
    public virtual CapabilityRegistry Child { get; set; } = null!;
}
