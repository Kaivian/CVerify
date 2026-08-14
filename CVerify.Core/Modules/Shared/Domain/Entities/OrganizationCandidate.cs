using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("organization_candidates")]
public class OrganizationCandidate
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid OrganizationId { get; set; }

    [ForeignKey(nameof(OrganizationId))]
    public virtual Organization Organization { get; set; } = null!;

    [Required]
    public Guid CandidateId { get; set; }

    [ForeignKey(nameof(CandidateId))]
    public virtual User Candidate { get; set; } = null!;

    public DateTimeOffset SavedAt { get; set; } = DateTimeOffset.UtcNow;

    [Required]
    public Guid SavedById { get; set; }

    [ForeignKey(nameof(SavedById))]
    public virtual User SavedBy { get; set; } = null!;

    public string? Notes { get; set; }

    public List<string> Tags { get; set; } = new();

    [Required]
    [MaxLength(50)]
    public string HiringStage { get; set; } = "Sourced"; // Sourced, Screening, Interviewing, Offer, Hired, Rejected, Archived

    public Guid? RecruiterId { get; set; }

    [ForeignKey(nameof(RecruiterId))]
    public virtual User? Recruiter { get; set; }
}
