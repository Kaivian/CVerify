using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("job_applications")]
public class JobApplication
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
    [MaxLength(50)]
    public string Status { get; set; } = "Applied"; // Applied, Reviewing, Interviewing, Offered, Rejected, Withdrawn

    [Column(TypeName = "jsonb")]
    public string? GapsSnapshotJson { get; set; } // Stores a snapshot of verified profile gaps at the time of application

    [Column(TypeName = "jsonb")]
    public string? EligibilitySnapshotJson { get; set; } // Holds full checklist results, trust scores, and gaps at apply time

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
