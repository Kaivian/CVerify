using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Xunit;
using FluentAssertions;
using CVerify.API.Modules.Intelligence.Services;
using CVerify.API.Modules.Shared.Domain.Enums;

namespace CVerify.API.UnitTests.Services;

public class UnifiedMatchingEngineTests
{
    private readonly UnifiedMatchingEngine _engine;

    public UnifiedMatchingEngineTests()
    {
        _engine = new UnifiedMatchingEngine();
    }

    [Fact]
    public async Task EvaluateMatchAsync_ShouldCalculateCorrectScores()
    {
        // Arrange
        var candidate = new CandidateCapabilityIntelligence
        {
            CandidateId = Guid.NewGuid(),
            CareerLevel = "L3",
            CareerLevelLabel = "Senior",
            IdentityTrustScore = 80.0,
            EvidenceTrustScore = 90.0,
            ExpectedSalaryMin = 50000,
            ExpectedSalaryMax = 70000,
            TargetWorkplaceType = "Hybrid",
            Capabilities = new List<CapabilityItem>
            {
                new()
                {
                    Slug = "fe.react-dev",
                    Name = "React.js Development",
                    Category = "Frontend Engineering",
                    Score = 90.0,
                    Maturity = "Advanced", // level 3
                    SourceType = "Verified",
                    Confidence = 0.95
                },
                new()
                {
                    Slug = "api.rest-design",
                    Name = "REST API Architecture",
                    Category = "Backend Engineering",
                    Score = 70.0,
                    Maturity = "Intermediate", // level 2
                    SourceType = "Verified",
                    Confidence = 0.85
                },
                new()
                {
                    Slug = "db.query-tuning",
                    Name = "Database Query Tuning",
                    Category = "Backend Engineering",
                    SourceType = "SelfDeclared"
                }
            }
        };

        var requirement = new UnifiedJobRequirement
        {
            JobOrRequirementId = Guid.NewGuid(),
            Seniority = "Senior", // Level 3 -> Matches candidate level 3 (Senior)
            RequiresLeadership = false,
            WorkplaceType = "Hybrid", // Matches Hybrid (1.0)
            SalaryMax = 80000, // Desired 70000 <= 80000 -> Matches (1.0)
            Capabilities = new List<RequiredCapabilityDto>
            {
                new() { CapabilityId = "fe.react-dev", Name = "React.js Development", ExpectedProficiency = 3, Weight = 1.0f }, // level 3 >= expected 3 -> score 1.0
                new() { CapabilityId = "api.rest-design", Name = "REST API Architecture", ExpectedProficiency = 3, Weight = 1.0f }, // level 2 < expected 3 -> score 0.4 + 0.6*(2/3) = 0.8
                new() { CapabilityId = "db.query-tuning", Name = "Database Query Tuning", ExpectedProficiency = 2, Weight = 1.0f }, // Self declared -> score 0.4
                new() { CapabilityId = "infra.docker-deploy", Name = "Microservice Containerization", ExpectedProficiency = 2, Weight = 1.0f } // Missing -> score 0.0
            }
        };

        // Act
        var result = await _engine.EvaluateMatchAsync(candidate, requirement);

        // Assert
        // 1. Capability Fit: (1.0 + 0.8 + 0.4 + 0.0) / 4 * 100 = 55.0%
        result.CapabilityFitScore.Should().Be(55.0);

        // 2. Role Fit: Senior candidate matches Senior job -> 1.0 -> 100.0%
        result.RoleFitScore.Should().Be(100.0);

        // 3. Trust Score: 0.40 * 80 + 0.60 * 90 = 32 + 54 = 86.0
        result.TrustScore.Should().Be(86.0);

        // 4. Preference Fit: Salary matches (1.0), Workplace matches (1.0) -> 100.0%
        result.PreferenceFitScore.Should().Be(100.0);

        // 5. Aggregate: (55.0 * 0.40) + (100 * 0.30) + (86.0 * 0.20) + (100 * 0.10)
        // = 22 + 30 + 17.2 + 10 = 79.2
        result.MatchScore.Should().Be(79.2);

        result.ConfidenceLevel.Should().Be("Medium"); // 79.2 is >= 50 and < 80
        result.EvidenceTraces.Should().HaveCount(4);
        result.Factors.Should().HaveCount(4);
        result.Explanations.Should().HaveCount(4);
    }
}
