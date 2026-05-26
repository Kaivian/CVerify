using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("trust_calculations")]
public class TrustCalculation
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid TrustProfileId { get; set; }

    [ForeignKey(nameof(TrustProfileId))]
    public virtual TrustProfile TrustProfile { get; set; } = null!;

    [Required]
    public int AggregateScore { get; set; } // 0 to 100

    [Required]
    [Column(TypeName = "jsonb")]
    public string CalculationDetails { get; set; } = null!; // JSON explanation of weights and components

    [Required]
    public DateTimeOffset CalculatedAt { get; set; } = DateTimeOffset.UtcNow;
}
