using System;
using System.Collections.Generic;
using CVerify.API.Modules.Shared.System.DTOs;

namespace CVerify.API.Modules.Intelligence.Services;

public class CandidateCapabilityIntelligence
{
    public Guid CandidateId { get; set; }
    public List<CapabilityItem> Capabilities { get; set; } = new();
    public double IdentityTrustScore { get; set; }
    public double EvidenceTrustScore { get; set; }
    public string CareerLevel { get; set; } = "";
    public string CareerLevelLabel { get; set; } = "";

    // Preferences
    public decimal? ExpectedSalaryMin { get; set; }
    public decimal? ExpectedSalaryMax { get; set; }
    public string? TargetWorkplaceType { get; set; }

    public DateTimeOffset CalculatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class CapabilityItem
{
    public string Slug { get; set; } = null!;
    public string Name { get; set; } = null!;
    public string Category { get; set; } = null!;
    public double Score { get; set; }
    public string Maturity { get; set; } = "Basic";
    public double RecencyIndex { get; set; } = 1.0;
    public string SourceType { get; set; } = "SelfDeclared";
    public double Confidence { get; set; }
    public string Rationale { get; set; } = "";
    public string TargetFilePath { get; set; } = "";
}

public class UnifiedJobRequirement
{
    public Guid JobOrRequirementId { get; set; }
    public List<RequiredCapabilityDto> Capabilities { get; set; } = new();
    public List<string> Skills { get; set; } = new();
    public string Seniority { get; set; } = "Mid";
    public bool RequiresLeadership { get; set; }
    public decimal? SalaryMin { get; set; }
    public decimal? SalaryMax { get; set; }
    public string WorkplaceType { get; set; } = "Any";
}

public class RequiredCapabilityDto
{
    public string CapabilityId { get; set; } = null!;
    public string Name { get; set; } = null!;
    public float Weight { get; set; } = 1.0f;
    public int ExpectedProficiency { get; set; } = 2;
}

public class UnifiedMatchResult
{
    public double MatchScore { get; set; }
    public string ConfidenceLevel { get; set; } = "Low";

    public double CapabilityFitScore { get; set; }
    public double RoleFitScore { get; set; }
    public double TrustScore { get; set; }
    public double PreferenceFitScore { get; set; }

    public List<EvidenceTraceDto> EvidenceTraces { get; set; } = new();
    public List<MatchFactorDto> Factors { get; set; } = new();
    public List<MatchExplanationDto> Explanations { get; set; } = new();
}

public class MatchFactorDto
{
    public string FactorName { get; set; } = null!;
    public double FactorScore { get; set; }
    public double Weight { get; set; }
}

public class MatchExplanationDto
{
    public string ExplanationType { get; set; } = null!;
    public string AssertionText { get; set; } = null!;
    public Guid? CapabilityNodeId { get; set; }
    public string? CapabilitySlug { get; set; }
}
