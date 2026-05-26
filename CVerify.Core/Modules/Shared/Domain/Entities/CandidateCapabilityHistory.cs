using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("candidate_capability_histories")]
public class CandidateCapabilityHistory
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid CandidateCapabilityId { get; set; }

    [ForeignKey(nameof(CandidateCapabilityId))]
    public virtual CandidateCapability CandidateCapability { get; set; } = null!;

    [Required]
    public double ProficiencyScore { get; set; }

    [Required]
    public DateTimeOffset RecordedAt { get; set; } = DateTimeOffset.UtcNow;
}
