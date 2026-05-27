using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using CVerify.API.Modules.Shared.System.DTOs;

namespace CVerify.API.Modules.Intelligence.Services;

public class UnifiedMatchingEngine : IUnifiedMatchingEngine
{
    public Task<UnifiedMatchResult> EvaluateMatchAsync(
        CandidateCapabilityIntelligence candidateIntelligence,
        UnifiedJobRequirement jobRequirement,
        CancellationToken cancellationToken = default)
    {
        // 1. Capability Fit (40%)
        double capFitScore = 100.0;
        var evidenceTraces = new List<EvidenceTraceDto>();
        var explanations = new List<MatchExplanationDto>();

        if (jobRequirement.Capabilities.Any())
        {
            double sumCapScores = 0.0;
            double sumWeights = 0.0;

            foreach (var reqCap in jobRequirement.Capabilities)
            {
                var matched = candidateIntelligence.Capabilities.FirstOrDefault(c =>
                    c.Slug.Equals(reqCap.CapabilityId, StringComparison.OrdinalIgnoreCase) ||
                    c.Name.Equals(reqCap.Name, StringComparison.OrdinalIgnoreCase) ||
                    c.Slug.Equals(reqCap.Name, StringComparison.OrdinalIgnoreCase));

                double scoreCap = 0.0;
                string status = "Missing";
                string metric = "No verified repo data";
                string rationale = $"Candidate lacks repository verification for {reqCap.Name}.";
                string targetFile = "";
                double confidence = 0.0;

                if (matched != null)
                {
                    if (matched.SourceType == "Verified")
                    {
                        int candidateLevel = MapMaturityToLevel(matched.Maturity);
                        int expectedLevel = reqCap.ExpectedProficiency;

                        if (candidateLevel >= expectedLevel)
                        {
                            scoreCap = 1.0;
                            status = "Verified";
                            confidence = matched.Confidence;
                            metric = $"Verified Level {candidateLevel} >= Expected Level {expectedLevel}";
                            rationale = string.IsNullOrEmpty(matched.Rationale)
                                ? $"Candidate has verified repository data matching {reqCap.Name} at level {matched.Maturity}."
                                : matched.Rationale;
                        }
                        else
                        {
                            scoreCap = 0.40 + 0.60 * ((double)candidateLevel / expectedLevel);
                            status = "Verified (Needs Growth)";
                            confidence = matched.Confidence;
                            metric = $"Verified Level {candidateLevel} < Expected Level {expectedLevel}";
                            rationale = string.IsNullOrEmpty(matched.Rationale)
                                ? $"Candidate has verified repository data matching {reqCap.Name} at level {matched.Maturity}, which is below the expected level {reqCap.ExpectedProficiency}."
                                : matched.Rationale;
                        }
                        targetFile = matched.TargetFilePath;
                    }
                    else // SelfDeclared
                    {
                        scoreCap = 0.40;
                        status = "Self-Declared";
                        confidence = 0.20;
                        metric = "Self-declared skill in profile";
                        rationale = "Candidate listed this capability in their resume or preferences but no repository code evidence was found.";
                    }
                }

                sumCapScores += scoreCap * reqCap.Weight;
                sumWeights += reqCap.Weight;

                evidenceTraces.Add(new EvidenceTraceDto(
                    reqCap.CapabilityId,
                    reqCap.Name,
                    confidence,
                    status,
                    metric,
                    targetFile,
                    rationale
                ));

                // Explanations (Strengths and Gaps)
                if (status == "Verified" || status == "Verified (Needs Growth)")
                {
                    explanations.Add(new MatchExplanationDto
                    {
                        ExplanationType = "Strength",
                        AssertionText = $"Candidate has verified {matched.Maturity}-level experience in {reqCap.Name}."
                    });
                }
                else
                {
                    explanations.Add(new MatchExplanationDto
                    {
                        ExplanationType = "Gap",
                        AssertionText = $"Missing verified capability: {reqCap.Name}."
                    });
                }
            }

            capFitScore = sumWeights > 0 ? (sumCapScores / sumWeights) * 100.0 : 100.0;
        }

        // 2. Role Fit (30%)
        double roleFitScore = 100.0;
        int jobLevel = MapSeniorityToLevel(jobRequirement.Seniority);
        int candidateLevelVal = MapSeniorityToLevel(candidateIntelligence.CareerLevel);

        double seniorityScore = 1.0;
        if (candidateLevelVal >= jobLevel)
        {
            seniorityScore = 1.0;
        }
        else if (candidateLevelVal == jobLevel - 1)
        {
            seniorityScore = 0.70;
        }
        else
        {
            seniorityScore = 0.30;
        }

        double leadershipScore = 1.0;
        if (jobRequirement.RequiresLeadership)
        {
            bool hasLeadership = candidateLevelVal >= 4 || // Lead/Principal
                                (candidateIntelligence.CareerLevelLabel != null &&
                                 (candidateIntelligence.CareerLevelLabel.Equals("Staff", StringComparison.OrdinalIgnoreCase) ||
                                  candidateIntelligence.CareerLevelLabel.Equals("Principal", StringComparison.OrdinalIgnoreCase) ||
                                  candidateIntelligence.CareerLevelLabel.Equals("Lead", StringComparison.OrdinalIgnoreCase)));
            leadershipScore = hasLeadership ? 1.0 : 0.50;
        }

        roleFitScore = seniorityScore * leadershipScore * 100.0;

        // 3. Trust Score (20%)
        double trustScore = (0.40 * candidateIntelligence.IdentityTrustScore) + (0.60 * candidateIntelligence.EvidenceTrustScore);

        // 4. Preference Fit (10%)
        double preferenceScore = 100.0;
        double salaryScore = 1.0;

        if (jobRequirement.SalaryMax.HasValue && jobRequirement.SalaryMax.Value > 0)
        {
            double jdMax = (double)jobRequirement.SalaryMax.Value;
            double desired = candidateIntelligence.ExpectedSalaryMax.HasValue ? (double)candidateIntelligence.ExpectedSalaryMax.Value : 0.0;
            double minAcceptable = candidateIntelligence.ExpectedSalaryMin.HasValue ? (double)candidateIntelligence.ExpectedSalaryMin.Value : 0.0;

            if (desired > 0)
            {
                if (desired <= jdMax)
                {
                    salaryScore = 1.0;
                }
                else if (minAcceptable <= jdMax && minAcceptable > 0)
                {
                    salaryScore = 0.6;
                }
                else
                {
                    salaryScore = 0.0;
                }
            }
        }

        double workplaceScore = 1.0;
        if (!string.IsNullOrEmpty(jobRequirement.WorkplaceType) && !jobRequirement.WorkplaceType.Equals("Any", StringComparison.OrdinalIgnoreCase))
        {
            if (candidateIntelligence.TargetWorkplaceType != null)
            {
                if (candidateIntelligence.TargetWorkplaceType.Equals(jobRequirement.WorkplaceType, StringComparison.OrdinalIgnoreCase))
                {
                    workplaceScore = 1.0;
                }
                else if (candidateIntelligence.TargetWorkplaceType.Equals("Remote", StringComparison.OrdinalIgnoreCase) ||
                         candidateIntelligence.TargetWorkplaceType.Equals("Any", StringComparison.OrdinalIgnoreCase))
                {
                    workplaceScore = 0.80;
                }
                else
                {
                    workplaceScore = 0.0;
                }
            }
        }

        preferenceScore = (0.60 * salaryScore + 0.40 * workplaceScore) * 100.0;

        // 5. Aggregate Match Score
        double aggregate = (capFitScore * 0.40) + (roleFitScore * 0.30) + (trustScore * 0.20) + (preferenceScore * 0.10);
        double finalScore = Math.Round(Math.Clamp(aggregate, 0.0, 100.0), 2);

        string confidenceLevel = finalScore switch
        {
            >= 80 => "High",
            >= 50 => "Medium",
            _ => "Low"
        };

        var factors = new List<MatchFactorDto>
        {
            new() { FactorName = "CapabilityMatch", FactorScore = Math.Round(capFitScore, 2), Weight = 0.40 },
            new() { FactorName = "RoleMatch", FactorScore = Math.Round(roleFitScore, 2), Weight = 0.30 },
            new() { FactorName = "TrustFactor", FactorScore = Math.Round(trustScore, 2), Weight = 0.20 },
            new() { FactorName = "PreferenceMatch", FactorScore = Math.Round(preferenceScore, 2), Weight = 0.10 }
        };

        var result = new UnifiedMatchResult
        {
            MatchScore = finalScore,
            ConfidenceLevel = confidenceLevel,
            CapabilityFitScore = Math.Round(capFitScore, 2),
            RoleFitScore = Math.Round(roleFitScore, 2),
            TrustScore = Math.Round(trustScore, 2),
            PreferenceFitScore = Math.Round(preferenceScore, 2),
            EvidenceTraces = evidenceTraces,
            Factors = factors,
            Explanations = explanations
        };

        return Task.FromResult(result);
    }

    private int MapMaturityToLevel(string maturity)
    {
        if (string.IsNullOrEmpty(maturity)) return 1;
        return maturity.ToLowerInvariant() switch
        {
            "basic" or "awareness" => 1,
            "intermediate" or "working" or "contributor" => 2,
            "advanced" or "practitioner" or "owner" => 3,
            "enterprise" or "expert" or "principal" or "leader" => 4,
            _ => 2
        };
    }

    private int MapSeniorityToLevel(string seniority)
    {
        if (string.IsNullOrEmpty(seniority)) return 2;
        return seniority.ToLowerInvariant() switch
        {
            "junior" or "l1" => 1,
            "mid" or "middle" or "l2" => 2,
            "senior" or "l3" => 3,
            "lead" or "staff" or "l4" => 4,
            "principal" or "l5" => 5,
            _ => 2
        };
    }
}
