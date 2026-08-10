using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using FluentAssertions;
using StackExchange.Redis;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.System.DTOs;
using CVerify.API.Modules.Shared.System.Services;

namespace CVerify.API.UnitTests.Services;

public class HiringRequirementServiceTests : IDisposable
{
    private readonly ApplicationDbContext _context;
    private readonly Mock<ICapabilityCatalogService> _mockCatalogService;
    private readonly Mock<IHttpClientFactory> _mockHttpClientFactory;
    private readonly Mock<IHmacSignatureService> _mockHmacService;
    private readonly Mock<IConnectionMultiplexer> _mockRedis;
    private readonly Mock<ILogger<HiringRequirementService>> _mockLogger;
    private readonly Mock<IAiStreamingSessionService> _mockStreamingSessionService;
    private readonly Mock<IAiCancellationManager> _mockCancellationManager;
    private readonly Mock<ITechnologyNormalizationService> _mockNormalizationService;
    private readonly HiringRequirementService _service;

    private readonly Guid _orgId = Guid.NewGuid();
    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Guid _userId = Guid.NewGuid();

    public HiringRequirementServiceTests()
    {
        var dbOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        _context = new ApplicationDbContext(dbOptions);

        _mockCatalogService = new Mock<ICapabilityCatalogService>();
        _mockHttpClientFactory = new Mock<IHttpClientFactory>();
        _mockHmacService = new Mock<IHmacSignatureService>();
        _mockRedis = new Mock<IConnectionMultiplexer>();
        _mockLogger = new Mock<ILogger<HiringRequirementService>>();
        _mockStreamingSessionService = new Mock<IAiStreamingSessionService>();
        _mockCancellationManager = new Mock<IAiCancellationManager>();
        _mockNormalizationService = new Mock<ITechnologyNormalizationService>();

        // Setup mock Redis DB
        var mockDb = new Mock<IDatabase>();
        _mockRedis.Setup(r => r.GetDatabase(It.IsAny<int>(), It.IsAny<object>())).Returns(mockDb.Object);
        var mockSubscriber = new Mock<ISubscriber>();
        _mockRedis.Setup(r => r.GetSubscriber(It.IsAny<object>())).Returns(mockSubscriber.Object);

        // Mock Catalog
        _mockCatalogService.Setup(c => c.ValidateCapability(It.IsAny<string>(), It.IsAny<Guid>())).Returns(true);
        _mockCatalogService.Setup(c => c.GetCapability(It.IsAny<string>(), It.IsAny<Guid>()))
            .Returns(new CapabilityCatalogDto("db.query", "Query Tuning", "Database", "Desc", new List<string>(), new List<string> { "AstSignature test" }));

        // Mock normal HMAC headers
        _mockHmacService.Setup(h => h.CreateSignatureHeaders(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
            .Returns(("sig", "timestamp", "nonce"));

        _mockNormalizationService.Setup(n => n.NormalizeAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((string rawName, CancellationToken ct) => new NormalizedSkillResult("skill:" + rawName.ToLower(), rawName, "Category", "Code", true));

        _service = new HiringRequirementService(
            _context,
            _mockCatalogService.Object,
            _mockHttpClientFactory.Object,
            _mockHmacService.Object,
            _mockRedis.Object,
            _mockLogger.Object,
            _mockStreamingSessionService.Object,
            _mockCancellationManager.Object,
            _mockNormalizationService.Object
        );

        SeedDatabase();
    }

    private void SeedDatabase()
    {
        var org = new Organization
        {
            Id = _orgId,
            Name = "Kaivian Corp",
            Username = "kaivian-corp",
            TaxCode = "TAX123",
            Email = "info@kaivian.com"
        };
        var workspace = new Workspace
        {
            Id = _workspaceId,
            OrganizationId = _orgId,
            DisplayName = "Tech Team",
            Slug = "tech-team",
            OwnerId = _userId
        };

        _context.Organizations.Add(org);
        _context.Workspaces.Add(workspace);
        _context.SaveChanges();
    }

    public void Dispose()
    {
        _context.Dispose();
    }

    [Fact]
    public async Task CreateDraftAsync_Should_Create_Draft_Successfully()
    {
        // Arrange
        var request = new CreateHiringRequirementRequestDto(
            OrganizationSlug: "kaivian-corp",
            Title: "Backend Developer",
            Department: "Engineering",
            Seniority: "Senior",
            WorkplaceType: "Remote",
            City: "San Francisco",
            EmploymentType: "Full-Time",
            Headcount: 1
        );

        // Act
        var result = await _service.CreateDraftAsync(request, _userId, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Title.Should().Be("Backend Developer");
        result.Status.Should().Be("Draft");
        result.Version.Should().Be(1);

        var saved = _context.HiringRequirements.FirstOrDefault(r => r.Id == result.Id);
        saved.Should().NotBeNull();
        saved.Title.Should().Be("Backend Developer");
    }

    [Fact]
    public async Task CreateDraftAsync_Should_Throw_KeyNotFoundException_When_OrganizationNotFound()
    {
        // Arrange
        var request = new CreateHiringRequirementRequestDto(
            OrganizationSlug: "non-existent",
            Title: "Backend Developer",
            Department: "Engineering",
            Seniority: "Senior",
            WorkplaceType: "Remote",
            City: "San Francisco",
            EmploymentType: "Full-Time",
            Headcount: 1
        );

        // Act & Assert
        await Assert.ThrowsAsync<KeyNotFoundException>(() => _service.CreateDraftAsync(request, _userId, CancellationToken.None));
    }

    [Fact]
    public async Task UpdateDraftAsync_Should_Update_Fields_Successfully()
    {
        // Arrange
        var req = new HiringRequirement
        {
            Id = Guid.NewGuid(),
            OrganizationId = _orgId,
            WorkspaceId = _workspaceId,
            Title = "Draft",
            Seniority = "Senior",
            Department = "Engineering",
            EmploymentType = "Full-Time",
            WorkplaceType = "Remote",
            Status = "Draft",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        _context.HiringRequirements.Add(req);
        _context.SaveChanges();

        var request = new UpdateHiringRequirementRequestDto(
            HiringReason: "Scaling",
            BusinessProblem: "Speed",
            Outcomes: new List<string> { "Outcome 1" },
            Responsibilities: new List<ResponsibilityDto>
            {
                new("Resp 1", RequirementPriority.MustHave, OwnershipLevel.Owner, false)
            },
            Capabilities: new List<RequirementCapabilityDto>
            {
                new("db.query", "Query Tuning", "Database", RequirementPriority.MustHave, OwnershipLevel.Owner, 4)
            },
            Skills: new List<TechnologyRequirementDto>
            {
                new("C#", RequirementPriority.MustHave, 5)
            },
            SalaryMin: 100000,
            SalaryMax: 150000,
            Currency: "USD",
            TimezoneRange: "UTC-8",
            DegreeRequirement: "CS degree",
            Benefits: new List<string> { "Health" },
            LanguageRequirements: new List<string> { "English" },
            StartDate: null,
            EndDate: null,
            AutoCloseRule: AutoCloseRule.CloseOnHiringTarget,
            CandidatesNeededCount: 3,
            Headcount: 2,
            SalaryPeriod: SalaryPeriod.Monthly,
            IsSalaryNegotiable: true,
            IsManuallyClosed: false
        );

        // Act
        var result = await _service.UpdateDraftAsync(req.Id, request, CancellationToken.None);

        // Assert
        result.HiringReason.Should().Be("Scaling");
        result.BusinessOutcomes.Should().HaveCount(1);
        result.Responsibilities.Should().HaveCount(1);
        result.Capabilities.Should().HaveCount(1);
        result.TechnologyRequirements.Should().HaveCount(1);
    }

    [Fact]
    public async Task UpdateDraftAsync_Should_Throw_InvalidOperationException_When_RequirementAlreadyPublished()
    {
        // Arrange
        var req = new HiringRequirement
        {
            Id = Guid.NewGuid(),
            OrganizationId = _orgId,
            WorkspaceId = _workspaceId,
            Title = "Published",
            Seniority = "Senior",
            Department = "Engineering",
            EmploymentType = "Full-Time",
            WorkplaceType = "Remote",
            Status = "Published",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        _context.HiringRequirements.Add(req);
        _context.SaveChanges();

        var request = new UpdateHiringRequirementRequestDto(
            HiringReason: "Change",
            BusinessProblem: null, Outcomes: null, Responsibilities: null, Capabilities: null, Skills: null,
            SalaryMin: null, SalaryMax: null, Currency: null, TimezoneRange: null, DegreeRequirement: null, Benefits: null, LanguageRequirements: null,
            StartDate: null, EndDate: null, AutoCloseRule: null, CandidatesNeededCount: null, Headcount: null, SalaryPeriod: null, IsSalaryNegotiable: null, IsManuallyClosed: null
        );

        // Act & Assert
        await Assert.ThrowsAsync<InvalidOperationException>(() => _service.UpdateDraftAsync(req.Id, request, CancellationToken.None));
    }

    [Fact]
    public async Task PublishAsync_Should_Generate_Snapshot_And_Set_Status_To_Published()
    {
        // Arrange
        var req = new HiringRequirement
        {
            Id = Guid.NewGuid(),
            OrganizationId = _orgId,
            WorkspaceId = _workspaceId,
            Title = "Backend Engineer",
            Seniority = "Senior",
            Department = "Engineering",
            EmploymentType = "Full-Time",
            WorkplaceType = "Remote",
            Status = "Draft",
            Version = 1,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        _context.HiringRequirements.Add(req);
        _context.SaveChanges();

        // Act
        var snapshot = await _service.PublishAsync(req.Id, CancellationToken.None);

        // Assert
        snapshot.Should().NotBeNull();
        snapshot.HiringRequirementId.Should().Be(req.Id);
        snapshot.Version.Should().Be(1);

        var updatedReq = _context.HiringRequirements.Find(req.Id);
        updatedReq.Status.Should().Be("Published");
    }

    [Fact]
    public void CalculateWeights_Should_Normalize_Weights_Correctly()
    {
        // Arrange
        var req = new HiringRequirement
        {
            Seniority = "Senior",
            Department = "Engineering",
            EmploymentType = "Full-Time",
            WorkplaceType = "Remote",
            Capabilities = new List<RequirementCapability>
            {
                new() { CapabilityId = "db.query", Name = "Query Tuning", Category = "Database", Priority = RequirementPriority.MustHave, OwnershipLevel = OwnershipLevel.Owner },
                new() { CapabilityId = "arch.security", Name = "Security Architecture", Category = "Solution Architecture", Priority = RequirementPriority.ShouldHave, OwnershipLevel = OwnershipLevel.Contributor }
            },
            BusinessOutcomes = new List<BusinessOutcome>
            {
                new() { Text = "Scale DB" }
            }
        };

        // Act
        var weights = _service.CalculateWeights(req);

        // Assert
        weights.Should().NotBeEmpty();
        weights.Values.Sum().Should().BeApproximately(1f, 0.001f);
        weights["db.query"].Should().BeGreaterThan(weights["arch.security"]);
    }

    [Fact]
    public void CalculateRequirementVector_Should_Build_Correct_Float_Vector()
    {
        // Arrange
        var catalogItems = new List<CapabilityCatalogDto>
        {
            new("db.query", "Query", "Database", "Desc", new List<string>(), new List<string>()),
            new("fe.react", "React", "Frontend", "Desc", new List<string>(), new List<string>())
        };
        _mockCatalogService.Setup(c => c.GetCatalog(_workspaceId)).Returns(catalogItems);

        var req = new HiringRequirement
        {
            WorkspaceId = _workspaceId,
            Department = "Engineering",
            EmploymentType = "Full-Time",
            WorkplaceType = "Remote",
            Capabilities = new List<RequirementCapability>
            {
                new() { CapabilityId = "db.query", ExpectedProficiency = 4 }
            }
        };

        var weights = new Dictionary<string, float> { { "db.query", 0.7f } };

        // Act
        var vector = _service.CalculateRequirementVector(req, weights);

        // Assert
        vector.Should().HaveCount(2);
        vector[0].Should().Be(0.7f * 4); // db.query
        vector[1].Should().Be(0f); // fe.react
    }

    [Fact]
    public async Task CancelGenerationAsync_Should_Set_Redis_And_Trigger_Cancellation()
    {
        // Arrange
        var req = new HiringRequirement
        {
            Id = Guid.NewGuid(),
            OrganizationId = _orgId,
            WorkspaceId = _workspaceId,
            Title = "Backend Developer",
            Seniority = "Senior",
            Department = "Engineering",
            EmploymentType = "Full-Time",
            WorkplaceType = "Remote",
            Status = "Generating",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        var art = new RequirementArtifact
        {
            Id = Guid.NewGuid(),
            HiringRequirementId = req.Id,
            ArtifactType = "JobDescription",
            MarkdownContent = "",
            Status = "Generating"
        };
        _context.HiringRequirements.Add(req);
        _context.RequirementArtifacts.Add(art);
        _context.SaveChanges();

        // Act
        await _service.CancelGenerationAsync(req.Id, "JobDescription");

        // Assert
        _mockCancellationManager.Verify(c => c.Cancel(req.Id), Times.Once);
        var updatedArt = _context.RequirementArtifacts.Find(art.Id);
        updatedArt.Status.Should().Be("Cancelled");
    }
}
