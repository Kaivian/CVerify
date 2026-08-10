using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Xunit;
using FluentAssertions;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.System.DTOs;
using CVerify.API.Modules.Shared.System.Services;

namespace CVerify.API.UnitTests.Services;

public class HiringRequirementPerformanceTests
{
    [Fact]
    public void Benchmark_PromptWeightCalculations_ShouldBeExtremelyFast()
    {
        // Arrange
        var req = new HiringRequirement
        {
            Seniority = "Senior",
            Capabilities = new List<RequirementCapability>
            {
                new() { CapabilityId = "db.query", Name = "Query Tuning", Category = "Database", Priority = RequirementPriority.MustHave, OwnershipLevel = OwnershipLevel.Owner },
                new() { CapabilityId = "arch.security", Name = "Security Architecture", Category = "Solution Architecture", Priority = RequirementPriority.ShouldHave, OwnershipLevel = OwnershipLevel.Contributor }
            },
            BusinessOutcomes = new List<BusinessOutcome>
            {
                new() { Text = "Outcome 1" }
            }
        };

        var service = new HiringRequirementService(
            null!, null!, null!, null!, null!, null!, null!, null!, null!
        );

        // Warmup
        service.CalculateWeights(req);

        // Act
        var stopwatch = Stopwatch.StartNew();
        for (int i = 0; i < 10000; i++)
        {
            service.CalculateWeights(req);
        }
        stopwatch.Stop();

        long elapsedMs = stopwatch.ElapsedMilliseconds;
        Console.WriteLine($"Executed 10,000 weight calculations in {elapsedMs}ms.");

        // Assert: 10,000 calculations should complete in less than 50ms
        elapsedMs.Should().BeLessThan(50, "Mathematical formula evaluation must be highly performant.");
    }

    [Fact]
    public void Benchmark_ArtifactDeserialization_ShouldPerformWithinSubMillisecondBounds()
    {
        // Arrange
        var jsonPayload = @"{
            ""schemaVersion"": ""1.0.0"",
            ""metadata"": {
                ""modelIdentifier"": ""claude-3-5-sonnet"",
                ""promptVersion"": ""2.0"",
                ""generatedAtUtc"": ""2026-07-18T09:24:00Z""
            },
            ""jobDescription"": {
                ""markdownContent"": ""# Title\n\n- Resp"",
                ""title"": ""Senior Developer"",
                ""department"": ""Engineering"",
                ""summary"": ""Great role"",
                ""responsibilities"": [""Resp""],
                ""skills"": [""C#""]
            },
            ""assessmentRubric"": {
                ""scoringRules"": {
                    ""minimumMaturityThreshold"": ""Practitioner"",
                    ""selfDeclaredMatchCeiling"": 0.40,
                    ""additionalRules"": []
                },
                ""evidenceRequirements"": []
            },
            ""interviewBlueprint"": {
                ""questions"": [],
                ""dimensions"": [""Quality""]
            },
            ""jobPostMetadata"": {
                ""experienceRange"": ""3-5 years"",
                ""degreeRequirement"": ""Bachelor's""
            },
            ""candidateDiscoveryProfile"": {
                ""keyKeywords"": [""C#""],
                ""minimumYearsOfExperience"": 3,
                ""priorityWeights"": {},
                ""trustRequirements"": {}
            }
        }";

        // Warmup
        var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
        JsonSerializer.Deserialize<JsonElement>(jsonPayload, options);

        // Act
        var stopwatch = Stopwatch.StartNew();
        for (int i = 0; i < 5000; i++)
        {
            JsonSerializer.Deserialize<JsonElement>(jsonPayload, options);
        }
        stopwatch.Stop();

        long elapsedMs = stopwatch.ElapsedMilliseconds;
        Console.WriteLine($"Deserialized 5,000 payloads in {elapsedMs}ms.");

        // Assert: 5,000 JSON payload parses should complete in less than 300ms
        elapsedMs.Should().BeLessThan(300, "JSON parsing and schema deserialization must run under high-performance bounds.");
    }
}
