using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;
using FluentAssertions;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.System.DTOs;
using CVerify.API.Modules.Intelligence.Services;

namespace CVerify.API.UnitTests.Services;

public class ExplainableMatchServiceTests : IDisposable
{
    private readonly ApplicationDbContext _context;
    private readonly Mock<ICandidateEvaluationService> _mockEvaluationService;
    private readonly Mock<IUnifiedMatchingEngine> _mockMatchingEngine;

    private readonly Guid _organizationId = Guid.NewGuid();
    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Guid _candidateId = Guid.NewGuid();
    private readonly Guid _jobVacancyId = Guid.NewGuid();

    public ExplainableMatchServiceTests()
    {
        var dbOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        _context = new ApplicationDbContext(dbOptions);

        _mockEvaluationService = new Mock<ICandidateEvaluationService>();
        _mockMatchingEngine = new Mock<IUnifiedMatchingEngine>();
    }

    public void Dispose()
    {
        _context.Dispose();
    }

    [Fact]
    public async Task EvaluateMatchAsync_ShouldThrowArgumentException_WhenJobVacancyDoesNotExist()
    {
        // Arrange
        var service = new ExplainableMatchService(
            _context,
            _mockEvaluationService.Object,
            _mockMatchingEngine.Object
        );

        // Act & Assert
        await Assert.ThrowsAsync<ArgumentException>(() => service.EvaluateMatchAsync(Guid.NewGuid(), _candidateId));
    }

    [Fact]
    public async Task EvaluateMatchAsync_ShouldFallBackToVacancySkills_WhenSnapshotIsNull()
    {
        // Arrange
        var job = new JobVacancy
        {
            Id = _jobVacancyId,
            OrganizationId = _organizationId,
            Title = "Backend Developer",
            Department = "Engineering",
            City = "Remote",
            Experience = "Senior",
            WorkplaceType = "Remote",
            Type = "Full-Time",
            Salary = "Negotiable",
            SalaryMinMax = "0 - 0",
            Gender = "No requirement",
            Degree = "Bachelor",
            Category = "Software Development",
            CoverUrl = "https://example.com/cover.png",
            Status = "Published",
            Skills = new List<string> { "C#", "SQL" },
            Requirements = new List<string> { "3+ years of experience" }
        };
        _context.JobVacancies.Add(job);
        await _context.SaveChangesAsync();

        _mockEvaluationService.Setup(e => e.GetCapabilityIntelligenceAsync(_candidateId, false, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CandidateCapabilityIntelligence
            {
                CandidateId = _candidateId,
                Capabilities = new List<CapabilityItem>()
            });

        UnifiedJobRequirement capturedReq = null!;
        _mockMatchingEngine.Setup(m => m.EvaluateMatchAsync(It.IsAny<CandidateCapabilityIntelligence>(), It.IsAny<UnifiedJobRequirement>(), It.IsAny<CancellationToken>()))
            .Callback<CandidateCapabilityIntelligence, UnifiedJobRequirement, CancellationToken>((intel, req, ct) => capturedReq = req)
            .ReturnsAsync(new UnifiedMatchResult
            {
                MatchScore = 75.0,
                ConfidenceLevel = "Medium",
                CapabilityFitScore = 80,
                RoleFitScore = 70,
                TrustScore = 80,
                PreferenceFitScore = 90
            });

        var service = new ExplainableMatchService(
            _context,
            _mockEvaluationService.Object,
            _mockMatchingEngine.Object
        );

        // Act
        var result = await service.EvaluateMatchAsync(_jobVacancyId, _candidateId);

        // Assert
        result.Should().NotBeNull();
        result.AggregateScore.Should().Be(75);
        result.ConfidenceLevel.Should().Be("Medium");

        capturedReq.Should().NotBeNull();
        capturedReq.Seniority.Should().Be("Senior");
        capturedReq.Skills.Should().ContainInOrder("C#", "SQL");
        capturedReq.Capabilities.Should().HaveCount(2);
        capturedReq.Capabilities.Should().Contain(c => c.CapabilityId == "c#");
        capturedReq.Capabilities.Should().Contain(c => c.CapabilityId == "sql");
    }
}
