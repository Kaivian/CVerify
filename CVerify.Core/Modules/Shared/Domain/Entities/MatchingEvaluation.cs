using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("matching_evaluations")]
public class MatchingEvaluation
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid JobVacancyId { get; set; }

    [ForeignKey(nameof(JobVacancyId))]
    public virtual JobVacancy JobVacancy { get; set; } = null!;

    [Required]
    public Guid CandidateId { get; set; }

    [ForeignKey(nameof(CandidateId))]
    public virtual User Candidate { get; set; } = null!;

    [Required]
    public int AggregateScore { get; set; } // 0 to 100

    [Required]
    [MaxLength(30)]
    public string ConfidenceLevel { get; set; } = null!; // High, Medium, Low

    [Required]
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    [Required]
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public virtual ICollection<MatchingFactor> Factors { get; set; } = new List<MatchingFactor>();
    public virtual ICollection<MatchingExplanation> Explanations { get; set; } = new List<MatchingExplanation>();
}
