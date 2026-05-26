using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("capability_nodes")]
public class CapabilityNode
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    [MaxLength(150)]
    public string Name { get; set; } = null!;

    [Required]
    [MaxLength(150)]
    public string Slug { get; set; } = null!;

    [MaxLength(1000)]
    public string? Description { get; set; }

    [Required]
    [MaxLength(50)]
    public string Category { get; set; } = null!; // e.g. Language, Database, Framework

    public float[]? VectorEmbedding { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public virtual ICollection<CapabilityEdge> OutgoingEdges { get; set; } = new List<CapabilityEdge>();
    public virtual ICollection<CapabilityEdge> IncomingEdges { get; set; } = new List<CapabilityEdge>();
}
