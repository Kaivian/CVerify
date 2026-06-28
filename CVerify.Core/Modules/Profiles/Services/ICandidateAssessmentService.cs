using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using CVerify.API.Modules.Profiles.DTOs;

namespace CVerify.API.Modules.Profiles.Services;

public interface ICandidateAssessmentService
{
    Task<CandidateReadinessDto> GetReadinessStatusAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<CandidateAssessmentResponse> TriggerAssessmentAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<CandidateAssessmentResponse?> GetLatestAssessmentAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<List<CandidateAssessmentResponse>> GetAssessmentHistoryAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<CandidateAssessmentDetailResponse?> GetAssessmentDetailsAsync(Guid userId, Guid assessmentId, CancellationToken cancellationToken = default);
    Task<CandidateAssessmentDetailResponse?> GetLatestPublicAssessmentAsync(string username, CancellationToken cancellationToken = default);
    Task<List<CandidateSkillTreeNodeResponse>?> GetSkillTreeAsync(Guid userId, Guid assessmentId, CancellationToken cancellationToken = default);
    Task<List<CandidateSkillTreeNodeResponse>?> GetPublicSkillTreeAsync(string username, CancellationToken cancellationToken = default);
    Task ProcessAssessmentJobAsync(Guid assessmentId, CancellationToken cancellationToken = default);
    Task<bool> CancelAssessmentAsync(Guid userId, Guid assessmentId);
}
