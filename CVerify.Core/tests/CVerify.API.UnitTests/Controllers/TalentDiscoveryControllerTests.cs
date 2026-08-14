using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;
using FluentAssertions;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Intelligence.Controllers;
using CVerify.API.Modules.Intelligence.Services;
using CVerify.API.Modules.Shared.System.DTOs;

namespace CVerify.API.UnitTests.Controllers;

public class TalentDiscoveryControllerTests : IDisposable
{
    private readonly ApplicationDbContext _context;
    private readonly Mock<ICapabilityGraphService> _mockCapabilityGraph;
    private readonly Mock<IExplainableMatchService> _mockMatchService;
    private readonly TalentDiscoveryController _controller;

    public TalentDiscoveryControllerTests()
    {
        var dbOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        _context = new ApplicationDbContext(dbOptions);

        _mockCapabilityGraph = new Mock<ICapabilityGraphService>();
        _mockMatchService = new Mock<IExplainableMatchService>();

        _controller = new TalentDiscoveryController(
            _context,
            _mockCapabilityGraph.Object,
            _mockMatchService.Object
        );
    }

    public void Dispose()
    {
        _context.Dispose();
    }

    [Fact]
    public async Task Search_ShouldFilterByLocationAndTrustScore()
    {
        // Arrange
        var p1 = new CandidateSearchProfile
        {
            CandidateId = Guid.NewGuid(),
            FullName = "John Doe",
            Location = "New York",
            TrustScore = 80,
            TrustTier = "Verified",
            CapabilitiesJson = "[\"c#\"]",
            LastProjectedAt = DateTimeOffset.UtcNow,
            SearchEmbedding = new float[1536]
        };
        var p2 = new CandidateSearchProfile
        {
            CandidateId = Guid.NewGuid(),
            FullName = "Jane Smith",
            Location = "San Francisco",
            TrustScore = 50,
            TrustTier = "Unverified",
            CapabilitiesJson = "[\"react\"]",
            LastProjectedAt = DateTimeOffset.UtcNow,
            SearchEmbedding = new float[1536]
        };
        _context.CandidateSearchProfiles.AddRange(p1, p2);
        await _context.SaveChangesAsync();

        // Act
        var result = await _controller.Search(query: null, location: "Francisco", minTrustScore: 40);

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        var okResult = result as OkObjectResult;
        okResult.Should().NotBeNull();

        var paginated = okResult!.Value as CVerify.API.Modules.Shared.System.DTOs.PaginatedResultDto<object>;
        paginated.Should().NotBeNull();
        var list = paginated!.Items.Cast<dynamic>().ToList();
        list.Should().ContainSingle();
        var item = list.First();
        ((string)item.FullName).Should().Be("Jane Smith");
    }

    [Fact]
    public async Task GetCandidateProfile_ShouldReturnNotFound_WhenProfileDoesNotExist()
    {
        // Act
        var result = await _controller.GetCandidateProfile(Guid.NewGuid(), CancellationToken.None);

        // Assert
        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task EvaluateMatch_ShouldReturnOkWithExplanations_WhenSuccessful()
    {
        // Arrange
        var jobVacancyId = Guid.NewGuid();
        var candidateId = Guid.NewGuid();
        var evaluation = new MatchingEvaluation
        {
            Id = Guid.NewGuid(),
            JobVacancyId = jobVacancyId,
            CandidateId = candidateId,
            AggregateScore = 88,
            ConfidenceLevel = "High",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        _mockMatchService.Setup(m => m.EvaluateMatchAsync(jobVacancyId, candidateId))
            .ReturnsAsync(evaluation);

        var factor = new MatchingFactor
        {
            Id = Guid.NewGuid(),
            MatchingEvaluationId = evaluation.Id,
            FactorName = "SkillsMatch",
            FactorScore = 90,
            Weight = 0.5
        };
        _context.MatchingFactors.Add(factor);

        var explanation = new MatchingExplanation
        {
            Id = Guid.NewGuid(),
            MatchingEvaluationId = evaluation.Id,
            ExplanationType = "Strength",
            AssertionText = "Has C# skills"
        };
        _context.MatchingExplanations.Add(explanation);
        await _context.SaveChangesAsync();

        // Act
        var result = await _controller.EvaluateMatch(jobVacancyId, candidateId);

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        var okResult = result as OkObjectResult;
        okResult.Should().NotBeNull();

        dynamic val = okResult!.Value!;
        ((Guid)val.Id).Should().Be(evaluation.Id);
        ((int)val.AggregateScore).Should().Be(88);
        ((string)val.ConfidenceLevel).Should().Be("High");
    }
}
