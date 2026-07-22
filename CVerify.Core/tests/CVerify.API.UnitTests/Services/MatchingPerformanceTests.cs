using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Xunit;
using FluentAssertions;
using CVerify.API.Modules.Shared.System.DTOs;
using CVerify.API.Modules.Intelligence.Services;

namespace CVerify.API.UnitTests.Services;

public class MatchingPerformanceTests
{
    [Fact]
    public async Task Benchmark_1000Candidates_ShouldCompleteWithinPerformanceBounds()
    {
        // Arrange
        var engine = new UnifiedMatchingEngine();

        var jobRequirement = new UnifiedJobRequirement
        {
            JobOrRequirementId = Guid.NewGuid(),
            Seniority = "Senior",
            RequiresLeadership = true,
            SalaryMin = 8000,
            SalaryMax = 12000,
            WorkplaceType = "Remote",
            Skills = new List<string> { "C#", "Docker", "Kubernetes", "React" },
            Capabilities = new List<RequiredCapabilityDto>
            {
                new() { CapabilityId = "c#", Name = "C# Programming", Weight = 1.5f, ExpectedProficiency = 3 },
                new() { CapabilityId = "docker", Name = "Docker", Weight = 1.0f, ExpectedProficiency = 2 },
                new() { CapabilityId = "kubernetes", Name = "Kubernetes", Weight = 1.2f, ExpectedProficiency = 3 },
                new() { CapabilityId = "react", Name = "React.js", Weight = 1.0f, ExpectedProficiency = 2 }
            }
        };

        var candidateIntelligenceList = new List<CandidateCapabilityIntelligence>();
        for (int i = 0; i < 1000; i++)
        {
            var intel = new CandidateCapabilityIntelligence
            {
                CandidateId = Guid.NewGuid(),
                Capabilities = new List<CapabilityItem>
                {
                    new()
                    {
                        Slug = "c#",
                        Name = "C# Programming",
                        SourceType = "Verified",
                        Maturity = "Practitioner"
                    },
                    new()
                    {
                        Slug = "docker",
                        Name = "Docker",
                        SourceType = "Verified",
                        Maturity = "Competent"
                    },
                    new()
                    {
                        Slug = "kubernetes",
                        Name = "Kubernetes",
                        SourceType = "Unverified",
                        Maturity = "None"
                    }
                }
            };
            candidateIntelligenceList.Add(intel);
        }

        // Act
        var stopwatch = Stopwatch.StartNew();
        foreach (var candidate in candidateIntelligenceList)
        {
            var result = await engine.EvaluateMatchAsync(candidate, jobRequirement, CancellationToken.None);
            result.Should().NotBeNull();
        }
        stopwatch.Stop();

        long totalMs = stopwatch.ElapsedMilliseconds;
        Console.WriteLine($"Evaluated 1000 candidates in {totalMs}ms.");

        // Assert: Sequential evaluation of 1,000 candidates should complete in less than 1000ms (typically < 10ms in Release, up to ~300ms in cold/unoptimized environments)
        totalMs.Should().BeLessThan(1000, "1,000 candidate evaluations must run within fast real-time interactive thresholds.");
    }
}
