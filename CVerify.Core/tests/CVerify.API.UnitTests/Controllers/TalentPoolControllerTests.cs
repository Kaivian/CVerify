using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;
using FluentAssertions;
using CVerify.API.Modules.Auth.Services;
using CVerify.API.Modules.Intelligence.Controllers;
using CVerify.API.Modules.Intelligence.DTOs;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.System.Services;

namespace CVerify.API.UnitTests.Controllers;

public class TalentPoolControllerTests : IDisposable
{
    private readonly ApplicationDbContext _context;
    private readonly Mock<IOrganizationAuthorizationService> _mockAuthService;
    private readonly Mock<ICacheService> _mockCacheService;
    private readonly TalentPoolController _controller;

    public TalentPoolControllerTests()
    {
        var dbOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        _context = new ApplicationDbContext(dbOptions);

        _mockAuthService = new Mock<IOrganizationAuthorizationService>();
        _mockCacheService = new Mock<ICacheService>();

        _controller = new TalentPoolController(
            _context,
            _mockAuthService.Object,
            _mockCacheService.Object
        );
    }

    public void Dispose()
    {
        _context.Dispose();
    }

    private void SetupUserContext(Guid userId)
    {
        var user = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, userId.ToString())
        }, "TestAuth"));

        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = user }
        };
    }

    [Fact]
    public async Task GetTalentPool_ShouldReturnPaginatedResults_WhenUserIsMember()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var orgId = Guid.NewGuid();
        SetupUserContext(userId);

        var org = new Organization { Id = orgId, Name = "Test Org", Username = "test-org", Email = "info@testorg.com", TaxCode = "123456789" };
        var candidate = new User { Id = Guid.NewGuid(), FullName = "John Developer", Email = "john@dev.com" };
        var savedCandidate = new OrganizationCandidate
        {
            Id = Guid.NewGuid(),
            OrganizationId = orgId,
            CandidateId = candidate.Id,
            SavedById = userId,
            HiringStage = "Sourced"
        };

        _context.Organizations.Add(org);
        _context.Users.Add(candidate);
        _context.OrganizationCandidates.Add(savedCandidate);
        await _context.SaveChangesAsync();

        _mockAuthService.Setup(a => a.IsMemberAsync(userId, orgId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        // Act
        var result = await _controller.GetTalentPool("test-org");

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        var okResult = result as OkObjectResult;
        okResult.Should().NotBeNull();

        dynamic data = okResult!.Value!;
        ((int)data.TotalCount).Should().Be(1);
    }

    [Fact]
    public async Task SaveCandidate_ShouldSaveCandidateAndCreateAuditLog_WhenUserIsRecruiter()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var orgId = Guid.NewGuid();
        var candidateId = Guid.NewGuid();
        SetupUserContext(userId);

        var org = new Organization { Id = orgId, Name = "Test Org", Username = "test-org", Email = "info@testorg.com", TaxCode = "123456789" };
        var candidate = new User { Id = candidateId, FullName = "Sophia AI", Email = "sophia@ai.com" };
        var membership = new OrganizationMembership
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            OrganizationId = orgId,
            Role = "HR",
            Status = "active"
        };

        _context.Organizations.Add(org);
        _context.Users.Add(candidate);
        _context.OrganizationMemberships.Add(membership);
        await _context.SaveChangesAsync();

        var dto = new SaveCandidateDto(candidateId);

        // Act
        var result = await _controller.SaveCandidate("test-org", dto);

        // Assert
        result.Should().BeOfType<ObjectResult>();
        var createdResult = result as ObjectResult;
        createdResult!.StatusCode.Should().Be(StatusCodes.Status201Created);

        var saved = await _context.OrganizationCandidates.FirstOrDefaultAsync(oc => oc.CandidateId == candidateId);
        saved.Should().NotBeNull();
        saved!.HiringStage.Should().Be("Sourced");

        // Verify Audit Log was generated
        var audit = await _context.AuditLogs.FirstOrDefaultAsync(a => a.EventType == "ORGANIZATION_CANDIDATE_SAVED");
        audit.Should().NotBeNull();
        audit!.OrganizationId.Should().Be(orgId);
    }

    [Fact]
    public async Task UpdateCandidateMeta_ShouldUpdateNotesAndHiringStage()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var orgId = Guid.NewGuid();
        var candidateId = Guid.NewGuid();
        SetupUserContext(userId);

        var org = new Organization { Id = orgId, Name = "Test Org", Username = "test-org", Email = "info@testorg.com", TaxCode = "123456789" };
        var candidate = new User { Id = candidateId, FullName = "Alex Rivera", Email = "alex@rust.com" };
        var membership = new OrganizationMembership
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            OrganizationId = orgId,
            Role = "OWNER",
            Status = "active"
        };
        var savedCandidate = new OrganizationCandidate
        {
            Id = Guid.NewGuid(),
            OrganizationId = orgId,
            CandidateId = candidateId,
            SavedById = userId,
            HiringStage = "Sourced"
        };

        _context.Organizations.Add(org);
        _context.Users.Add(candidate);
        _context.OrganizationMemberships.Add(membership);
        _context.OrganizationCandidates.Add(savedCandidate);
        await _context.SaveChangesAsync();

        var dto = new UpdateCandidateMetaDto("Good fit.", new List<string> { "Rust", "Go" }, "Interviewing", null);

        // Act
        var result = await _controller.UpdateCandidateMeta("test-org", candidateId, dto);

        // Assert
        result.Should().BeOfType<OkObjectResult>();

        var updated = await _context.OrganizationCandidates.FirstAsync(oc => oc.CandidateId == candidateId);
        updated.Notes.Should().Be("Good fit.");
        updated.HiringStage.Should().Be("Interviewing");
        updated.Tags.Should().ContainInOrder("Rust", "Go");
    }
}
