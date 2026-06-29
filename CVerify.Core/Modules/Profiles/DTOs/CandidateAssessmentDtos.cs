using System;
using System.Collections.Generic;

namespace CVerify.API.Modules.Profiles.DTOs;

public record MissingFieldDto(
    string FieldKey,
    string DisplayLabel,
    string RecommendationMessage,
    bool IsRequired
);

public record CandidateReadinessDto(
    bool IsReady,
    List<MissingFieldDto> MissingFields,
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
    double TrustLevel,
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
    DateTimeOffset? CompletedAtUtc,
    string? CalculationMode,
    string? InputFeatureSetHash,
    string? EvidenceCompleteness,
    string? CloneRiskClassification
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

public class CandidateSkillTreeNodeResponse
{
    public Guid Id { get; set; }
    public Guid? ParentId { get; set; }
    public string DisplayName { get; set; } = null!;
    public string Category { get; set; } = null!;
    public string ProficiencyLevel { get; set; } = null!;
    public double ConfidenceScore { get; set; }
    public double EstimatedExperienceMonths { get; set; }
    public string? SupportingEvidence { get; set; }
    public List<CandidateSkillTreeNodeResponse> Children { get; set; } = new();
}
