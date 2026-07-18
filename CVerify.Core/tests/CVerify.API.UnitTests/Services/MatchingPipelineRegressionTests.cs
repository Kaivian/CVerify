using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using FluentAssertions;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Profiles.Entities;
using CVerify.API.Modules.Profiles.Services;
using CVerify.API.Modules.Intelligence.Services;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.System.DTOs;
using CVerify.API.Modules.Shared.System.Services;
using StackExchange.Redis;

namespace CVerify.API.UnitTests.Services;

public class MatchingPipelineRegressionTests : IDisposable
{
    private readonly ApplicationDbContext _context;
    private readonly Mock<ICapabilityCatalogService> _mockCatalogService;
    private readonly Mock<IHiringRequirementService> _mockHiringRequirementService;
    private readonly Mock<IConnectionMultiplexer> _mockRedis;
    private readonly Mock<IServiceScopeFactory> _mockScopeFactory;
    private readonly Mock<ICandidateEvaluationService> _mockEvaluationService;
    private readonly Mock<IUnifiedMatchingEngine> _mockMatchingEngine;
    private readonly Mock<IAiCancellationManager> _mockCancellationManager;
    private readonly Mock<IAiStreamingSessionService> _mockStreamingSessionService;
    private readonly Mock<ILogger<CandidateMatchService>> _mockLogger;

    private readonly Guid _organizationId = Guid.NewGuid();
    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Guid _candidateId = Guid.NewGuid();
    private readonly Guid _requirementId = Guid.NewGuid();

    public MatchingPipelineRegressionTests()
    {
        var dbOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        _context = new ApplicationDbContext(dbOptions);

        _mockCatalogService = new Mock<ICapabilityCatalogService>();
        _mockHiringRequirementService = new Mock<IHiringRequirementService>();
        _mockRedis = new Mock<IConnectionMultiplexer>();
        _mockScopeFactory = new Mock<IServiceScopeFactory>();
        _mockEvaluationService = new Mock<ICandidateEvaluationService>();
        _mockMatchingEngine = new Mock<IUnifiedMatchingEngine>();
        _mockCancellationManager = new Mock<IAiCancellationManager>();
        _mockStreamingSessionService = new Mock<IAiStreamingSessionService>();
        _mockLogger = new Mock<ILogger<CandidateMatchService>>();

        var mockDb = new Mock<IDatabase>();
        _mockRedis.Setup(r => r.GetDatabase(It.IsAny<int>(), It.IsAny<object>())).Returns(mockDb.Object);
    }

    public void Dispose()
    {
        _context.Dispose();
    }

    [Fact]
    public async Task Regression_CAD_MATCH_001_DtoMappingCorrectness_ShouldMapScoresToCorrectBreakdownProperties()
    {
        // Arrange
        var user = new User
        {
            Id = _candidateId,
            FullName = "Verify Candidate",
            Email = "candidate@cverify.com",
            Username = "cverify_cand"
        };
        _context.Users.Add(user);

        var assessment = new CandidateAssessment
        {
            Id = Guid.NewGuid(),
            UserId = _candidateId,
            Status = "Completed",
            OverallScore = 85.0,
            CareerLevel = "Senior",
            CareerLevelLabel = "Senior",
            PrimaryTendency = "Backend",
            CreatedAtUtc = DateTimeOffset.UtcNow,
            CompletedAtUtc = DateTimeOffset.UtcNow
        };
        _context.CandidateAssessments.Add(assessment);

        var requirement = new HiringRequirement
        {
            Id = _requirementId,
            OrganizationId = _organizationId,
            WorkspaceId = _workspaceId,
            Title = "Backend Architect",
            Department = "Engineering",
            Seniority = "Senior",
            WorkplaceType = "Remote",
            EmploymentType = "Full-Time",
            SalaryMin = 8000,
            SalaryMax = 12000,
            Currency = "USD",
            Status = "Published"
        };
        _context.HiringRequirements.Add(requirement);

        var snapshot = new RequirementSnapshot
        {
            Id = Guid.NewGuid(),
            HiringRequirementId = _requirementId,
            Version = 1,
            Title = "Backend Architect",
            Department = "Engineering",
            Seniority = "Senior",
            WorkplaceType = "Remote",
            EmploymentType = "Full-Time",
            SalaryMin = 8000,
            SalaryMax = 12000,
            CapabilitiesJson = "[]",
            TechnologyRequirementsJson = "[]",
            ResponsibilitiesJson = "[]"
        };
        _context.RequirementSnapshots.Add(snapshot);
        await _context.SaveChangesAsync();

        var matchResult = new UnifiedMatchResult
        {
            MatchScore = 91.50,
            ConfidenceLevel = "High",
            CapabilityFitScore = 95.0,
            RoleFitScore = 90.0,
            TrustScore = 80.0,
            PreferenceFitScore = 88.0,
            EvidenceTraces = new List<EvidenceTraceDto>(),
            Factors = new List<MatchFactorDto>(),
            Explanations = new List<MatchExplanationDto>()
        };

        _mockEvaluationService.Setup(e => e.GetCapabilityIntelligenceAsync(_candidateId, false, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CandidateCapabilityIntelligence
            {
                CandidateId = _candidateId,
                Capabilities = new List<CapabilityItem>()
            });

        _mockMatchingEngine.Setup(m => m.EvaluateMatchAsync(It.IsAny<CandidateCapabilityIntelligence>(), It.IsAny<UnifiedJobRequirement>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(matchResult);

        var service = new CandidateMatchService(
            _context,
            _mockCatalogService.Object,
            _mockHiringRequirementService.Object,
            _mockRedis.Object,
            _mockScopeFactory.Object,
            _mockEvaluationService.Object,
            _mockMatchingEngine.Object,
            _mockCancellationManager.Object,
            _mockStreamingSessionService.Object,
            _mockLogger.Object
        );

        // Act
        var resultList = await service.GetCandidateMatchesAsync(_requirementId, CancellationToken.None);

        // Assert
        resultList.Should().NotBeNullOrEmpty();
        var match = resultList.First();
        match.Breakdown.Should().NotBeNull();

        // Assert correct mapping
        match.Breakdown.CapabilitiesScore.Should().Be(95.0);
        match.Breakdown.SkillsScore.Should().Be(95.0); // Skills score should map to CapabilityFitScore, not PreferenceFitScore (fixed bug)
        match.Breakdown.ResponsibilitiesScore.Should().Be(90.0);
        match.Breakdown.SalaryScore.Should().Be(88.0);
        match.Breakdown.CosineSimilarity.Should().Be(95.0);
        match.Breakdown.GapScore.Should().Be(95.0);
    }

    [Fact]
    public async Task Regression_CAD_MATCH_002_ExplainableMatchSourceOfTruth_ShouldRespectSnapshotValues()
    {
        // Arrange
        var job = new JobVacancy
        {
            Id = Guid.NewGuid(),
            OrganizationId = _organizationId,
            Title = "DevOps Engineer",
            Department = "Engineering",
            City = "Remote",
            Experience = "Senior",
            WorkplaceType = "Hybrid",
            Type = "Full-Time",
            Salary = "Negotiable",
            SalaryMinMax = "0 - 0",
            Gender = "No requirement",
            Degree = "Bachelor",
            Category = "Software Development",
            CoverUrl = "https://example.com/cover.png",
            Status = "Published",
            Skills = new List<string> { "Docker", "Kubernetes" },
            Requirements = new List<string> { "5+ years experience" }
        };
        _context.JobVacancies.Add(job);

        var snapshot = new RequirementSnapshot
        {
            Id = Guid.NewGuid(),
            HiringRequirementId = Guid.NewGuid(),
            Version = 1,
            Title = "DevOps Engineer",
            Department = "Engineering",
            Seniority = "Senior",
            WorkplaceType = "Remote", // Snapshot overrides JobVacancy's workplace type
            EmploymentType = "Full-Time",
            SalaryMin = 9000, // Snapshot specifies salary min
            SalaryMax = 14000, // Snapshot specifies salary max
            CapabilitiesJson = "[{\"capabilityId\":\"docker\",\"name\":\"Docker Containerization\",\"priority\":1,\"expectedProficiency\":3}]",
            TechnologyRequirementsJson = "[{\"name\":\"Docker\",\"priority\":1}]",
            ResponsibilitiesJson = "[{\"text\":\"Lead Kubernetes migrations\",\"priority\":1,\"ownershipLevel\":4,\"isLeadership\":true}]"
        };
        job.RequirementSnapshot = snapshot;
        _context.RequirementSnapshots.Add(snapshot);
        await _context.SaveChangesAsync();

        _mockEvaluationService.Setup(e => e.GetCapabilityIntelligenceAsync(_candidateId, false, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CandidateCapabilityIntelligence
            {
                CandidateId = _candidateId,
                Capabilities = new List<CapabilityItem>()
            });

        UnifiedJobRequirement capturedRequirement = null!;
        _mockMatchingEngine.Setup(m => m.EvaluateMatchAsync(It.IsAny<CandidateCapabilityIntelligence>(), It.IsAny<UnifiedJobRequirement>(), It.IsAny<CancellationToken>()))
            .Callback<CandidateCapabilityIntelligence, UnifiedJobRequirement, CancellationToken>((intel, req, ct) => capturedRequirement = req)
            .ReturnsAsync(new UnifiedMatchResult());

        var service = new ExplainableMatchService(
            _context,
            _mockEvaluationService.Object,
            _mockMatchingEngine.Object
        );

        // Act
        await service.EvaluateMatchAsync(job.Id, _candidateId);

        // Assert
        capturedRequirement.Should().NotBeNull();
        capturedRequirement.SalaryMin.Should().Be(9000); // Fixed: Should read from snapshot
        capturedRequirement.SalaryMax.Should().Be(14000); // Fixed: Should read from snapshot
        capturedRequirement.WorkplaceType.Should().Be("Remote"); // Fixed: Should read from snapshot
        capturedRequirement.RequiresLeadership.Should().BeTrue(); // Fixed: Derived from snapshot responsibilities
        capturedRequirement.Capabilities.Should().ContainSingle(c => c.CapabilityId == "docker" && c.ExpectedProficiency == 3);
    }

    [Fact]
    public async Task Regression_CAD_MATCH_003_ExplanationCapabilityNodeLinkage_ShouldResolveNodeBySlug()
    {
        // Arrange
        var node = new CapabilityNode
        {
            Id = Guid.NewGuid(),
            Name = "Docker",
            Slug = "docker",
            Category = "DevOps"
        };
        _context.CapabilityNodes.Add(node);

        var job = new JobVacancy
        {
            Id = Guid.NewGuid(),
            OrganizationId = _organizationId,
            Title = "DevOps Specialist",
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
            Status = "Published"
        };
        _context.JobVacancies.Add(job);
        await _context.SaveChangesAsync();

        _mockEvaluationService.Setup(e => e.GetCapabilityIntelligenceAsync(_candidateId, false, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CandidateCapabilityIntelligence
            {
                CandidateId = _candidateId,
                Capabilities = new List<CapabilityItem>()
            });

        var matchResult = new UnifiedMatchResult
        {
            MatchScore = 80.0,
            ConfidenceLevel = "Medium",
            Explanations = new List<MatchExplanationDto>
            {
                new()
                {
                    ExplanationType = "Strength",
                    AssertionText = "Candidate has verified experience in Docker.",
                    CapabilitySlug = "docker" // Populated by fix
                }
            }
        };

        _mockMatchingEngine.Setup(m => m.EvaluateMatchAsync(It.IsAny<CandidateCapabilityIntelligence>(), It.IsAny<UnifiedJobRequirement>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(matchResult);

        var service = new ExplainableMatchService(
            _context,
            _mockEvaluationService.Object,
            _mockMatchingEngine.Object
        );

        // Act
        var evaluation = await service.EvaluateMatchAsync(job.Id, _candidateId);

        // Assert
        var savedExplanation = await _context.MatchingExplanations
            .FirstOrDefaultAsync(e => e.MatchingEvaluationId == evaluation.Id);

        savedExplanation.Should().NotBeNull();
        savedExplanation!.CapabilityNodeId.Should().Be(node.Id); // Fixed: Linkage successfully established via Slug
    }
}
