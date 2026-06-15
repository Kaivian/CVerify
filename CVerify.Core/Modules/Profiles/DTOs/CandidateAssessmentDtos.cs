using System;
using System.Collections.Generic;

namespace CVerify.API.Modules.Profiles.DTOs;

public record CandidateReadinessDto(
    bool IsReady,
    List<string> MissingFields,
    double CompletenessScore,
    bool RequiresReassessment,
    DateTimeOffset? LastAssessmentAt,
    DateTimeOffset LastProfileUpdateAt,
    DateTimeOffset LastRepositoryAnalysisAt
);

public record CandidateAssessmentResponse(
    Guid Id,
    Guid UserId,
    string Status,
    double OverallScore,
    string? CareerLevel,
    string? CareerLevelLabel,
    string? PrimaryTendency,
    string? PrimaryWorkingStyle,
    string? SummaryHeadline,
    string? SummaryParagraph,
    string PipelineVersion,
    string AssessmentSchemaVersion,
    Guid? CvId,
    string? PromptVersion,
    string? ModelVersion,
    DateTimeOffset LastProfileUpdateAt,
    DateTimeOffset LastRepositoryAnalysisAt,
    DateTimeOffset? LastAssessmentAt,
    string? FailedStage,
    string? FailureReason,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset? CompletedAtUtc
);

public record CandidateAssessmentArtifactDto(
    Guid Id,
    string ArtifactType,
    string JsonData,
    DateTimeOffset CreatedAtUtc
);

public record CandidateAssessmentDetailResponse(
    CandidateAssessmentResponse Assessment,
    List<CandidateAssessmentArtifactDto> Artifacts
);
