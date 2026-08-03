using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using FluentAssertions;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Profiles.Entities;
using CVerify.API.Modules.Profiles.Services;
using CVerify.API.Modules.Intelligence.Services;
using StackExchange.Redis;
using CVerify.API.Modules.Shared.System.Services;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Profiles.DTOs;
using CVerify.API.Modules.Shared.Exceptions;
using CVerify.API.Modules.Shared.Domain.Enums;

namespace CVerify.API.UnitTests.Services;

public class CandidateAssessmentServiceTests : IDisposable
{
    private readonly ApplicationDbContext _context;
    private readonly Mock<ICandidateAssessmentQueue> _mockQueue;
    private readonly Mock<IHttpClientFactory> _mockHttpClientFactory;
    private readonly Mock<IHmacSignatureService> _mockHmacService;
    private readonly Mock<IConnectionMultiplexer> _mockRedis;
    private readonly Mock<IDatabase> _mockRedisDb;
    private readonly Mock<ICandidateRepositoryProvider> _mockRepositoryProvider;
    private readonly Mock<ILogger<CandidateAssessmentService>> _mockLogger;
    private readonly Mock<ICandidateEvaluationService> _mockEvaluationService;
    private readonly Mock<ISkillTreeValidationService> _mockValidationService;
    private readonly Mock<IAiStreamingSessionService> _mockStreamingSessionService;
    private readonly Mock<IAiCancellationManager> _mockCancellationManager;
    private readonly Mock<ICandidateRankingProjectionService> _mockRankingProjectionService;
    private readonly Mock<ITechnologyNormalizationService> _mockNormalizationService;

    private readonly Guid _userId = Guid.NewGuid();
    private readonly CandidateAssessmentService _service;

    public CandidateAssessmentServiceTests()
    {
        var dbOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        _context = new ApplicationDbContext(dbOptions);

        _mockQueue = new Mock<ICandidateAssessmentQueue>();
        _mockHttpClientFactory = new Mock<IHttpClientFactory>();
        _mockHmacService = new Mock<IHmacSignatureService>();
        _mockRedis = new Mock<IConnectionMultiplexer>();
        _mockRedisDb = new Mock<IDatabase>();
        _mockRepositoryProvider = new Mock<ICandidateRepositoryProvider>();
        _mockLogger = new Mock<ILogger<CandidateAssessmentService>>();
        _mockEvaluationService = new Mock<ICandidateEvaluationService>();
        _mockValidationService = new Mock<ISkillTreeValidationService>();
        _mockStreamingSessionService = new Mock<IAiStreamingSessionService>();
        _mockCancellationManager = new Mock<IAiCancellationManager>();
        _mockRankingProjectionService = new Mock<ICandidateRankingProjectionService>();
        _mockNormalizationService = new Mock<ITechnologyNormalizationService>();

        var mockSubscriber = new Mock<ISubscriber>();
        _mockRedis.Setup(r => r.GetDatabase(It.IsAny<int>(), It.IsAny<object>())).Returns(_mockRedisDb.Object);
        _mockRedis.Setup(r => r.GetSubscriber(It.IsAny<object>())).Returns(mockSubscriber.Object);
        _mockHmacService.Setup(h => h.CreateSignatureHeaders(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
            .Returns(("sig", "timestamp", "nonce"));

        _mockNormalizationService.Setup(n => n.NormalizeAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((string rawName, CancellationToken ct) => new NormalizedSkillResult(
                $"skill:{rawName.ToLowerInvariant()}", rawName, "Emerging Technology", "15-1252.00", false));

        _service = new CandidateAssessmentService(
            _context,
            _mockQueue.Object,
            _mockHttpClientFactory.Object,
            _mockHmacService.Object,
            _mockRedis.Object,
            _mockRepositoryProvider.Object,
            _mockLogger.Object,
            _mockEvaluationService.Object,
            _mockValidationService.Object,
            _mockStreamingSessionService.Object,
            _mockCancellationManager.Object,
            _mockRankingProjectionService.Object,
            _mockNormalizationService.Object
        );
    }

    private async Task SeedUserProfileAsync(bool hasHeadline = true, bool hasBio = true)
    {
        var user = new User
        {
            Id = _userId,
            FullName = "Test Candidate",
            Email = "candidate@cverify.com",
            Username = "candidate123",
            Status = UserStatus.ACTIVE
        };

        var profile = new UserProfile
        {
            UserId = _userId,
            Username = "candidate123",
            Headline = hasHeadline ? "Software Architect" : "",
            Bio = hasBio ? "Experienced developer" : "",
            LastProfileUpdateAt = DateTimeOffset.UtcNow
        };

        _context.Users.Add(user);
        _context.UserProfiles.Add(profile);
        await _context.SaveChangesAsync();
    }

    [Fact]
    public async Task GetReadinessStatusAsync_Should_Return_IsReady_True_When_Profile_And_Repos_Are_Complete()
    {
        // Arrange
        await SeedUserProfileAsync();
        _mockRepositoryProvider.Setup(r => r.HasCompletedRepositoriesAsync(_userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);
        _context.UserSkills.Add(new UserSkill { Id = Guid.NewGuid(), UserId = _userId, Skill = "C#" });
        _context.EducationEntries.Add(new EducationEntry { Id = Guid.NewGuid(), UserId = _userId, Label = "University", SchoolName = "MIT" });
        _context.WorkExperiences.Add(new WorkExperienceEntry
        {
            Id = Guid.NewGuid(),
            UserId = _userId,
            JobTitle = "Developer",
            Company = "Corp",
            Description = "Work",
            EmploymentType = EmploymentType.FullTime,
            ExperienceCategory = ExperienceCategory.ProfessionalWork,
            StartDate = DateTimeOffset.UtcNow.AddYears(-1)
        });
        await _context.SaveChangesAsync();

        // Act
        var readiness = await _service.GetReadinessStatusAsync(_userId, CancellationToken.None);

        // Assert
        readiness.IsReady.Should().BeTrue();
        readiness.MissingFields.Should().BeEmpty();
        readiness.CompletenessScore.Should().Be(100.0);
    }

    [Fact]
    public async Task GetReadinessStatusAsync_Should_Return_IsReady_False_When_NoLinkedRepositories()
    {
        // Arrange
        await SeedUserProfileAsync();
        _mockRepositoryProvider.Setup(r => r.HasCompletedRepositoriesAsync(_userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        _context.UserSkills.Add(new UserSkill { Id = Guid.NewGuid(), UserId = _userId, Skill = "C#" });
        _context.EducationEntries.Add(new EducationEntry { Id = Guid.NewGuid(), UserId = _userId, Label = "University", SchoolName = "MIT" });
        _context.WorkExperiences.Add(new WorkExperienceEntry
        {
            Id = Guid.NewGuid(),
            UserId = _userId,
            JobTitle = "Developer",
            Company = "Corp",
            Description = "Work",
            EmploymentType = EmploymentType.FullTime,
            ExperienceCategory = ExperienceCategory.ProfessionalWork,
            StartDate = DateTimeOffset.UtcNow.AddYears(-1)
        });
        await _context.SaveChangesAsync();

        // Act
        var readiness = await _service.GetReadinessStatusAsync(_userId, CancellationToken.None);

        // Assert
        readiness.IsReady.Should().BeFalse();
        readiness.MissingFields.Should().ContainSingle(f => f.FieldKey == "Repositories" && f.IsRequired);
    }

    [Fact]
    public async Task GetReadinessStatusAsync_Should_Return_IsReady_True_With_MissingFields_When_OptionalFields_Are_Missing()
    {
        // Arrange
        await SeedUserProfileAsync(hasHeadline: false, hasBio: false);
        _mockRepositoryProvider.Setup(r => r.HasCompletedRepositoriesAsync(_userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);
        await _context.SaveChangesAsync();

        // Act
        var readiness = await _service.GetReadinessStatusAsync(_userId, CancellationToken.None);

        // Assert
        readiness.IsReady.Should().BeTrue(); // Still ready since repositories are linked
        readiness.MissingFields.Should().Contain(f => f.FieldKey == "Headline" && !f.IsRequired);
        readiness.MissingFields.Should().Contain(f => f.FieldKey == "Bio" && !f.IsRequired);
    }

    [Fact]
    public async Task GetReadinessStatusAsync_Should_Return_RequiresReassessment_True_When_NewRepoAnalysis_Completed_Since_LastAssessment()
    {
        // Arrange
        await SeedUserProfileAsync();
        _mockRepositoryProvider.Setup(r => r.HasCompletedRepositoriesAsync(_userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var lastAssessment = new CandidateAssessment
        {
            Id = Guid.NewGuid(),
            UserId = _userId,
            Status = "Completed",
            CompletedAtUtc = DateTimeOffset.UtcNow.AddHours(-1)
        };
        _context.CandidateAssessments.Add(lastAssessment);
        await _context.SaveChangesAsync();

        // Repo analysis finished after the assessment
        var recentAnalysisTime = DateTimeOffset.UtcNow;
        _mockRepositoryProvider.Setup(r => r.GetLastRepositoryAnalysisAtAsync(_userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(recentAnalysisTime);

        // Act
        var readiness = await _service.GetReadinessStatusAsync(_userId, CancellationToken.None);

        // Assert
        readiness.RequiresReassessment.Should().BeTrue();
    }

    [Fact]
    public async Task TriggerAssessmentAsync_Should_Succeed_When_CandidateIsReady()
    {
        // Arrange
        await SeedUserProfileAsync();
        _mockRepositoryProvider.Setup(r => r.HasCompletedRepositoriesAsync(_userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);
        await _context.SaveChangesAsync();

        // Act
        var response = await _service.TriggerAssessmentAsync(_userId, CancellationToken.None);

        // Assert
        response.Should().NotBeNull();
        response.Status.Should().Be("Queued");

        var assessmentInDb = await _context.CandidateAssessments.FirstOrDefaultAsync(ca => ca.Id == response.Id);
        assessmentInDb.Should().NotBeNull();

        _mockQueue.Verify(q => q.EnqueueAssessmentAsync(response.Id), Times.Once);
        _mockStreamingSessionService.Verify(s => s.CreateSessionAsync(
            response.Id, "candidate-assessment", _userId, null, "claude-haiku-4-5-20251001", "Google", "2.2.0", It.IsAny<string>()
        ), Times.Once);
    }

    [Fact]
    public async Task TriggerAssessmentAsync_Should_Throw_BusinessRuleException_When_AssessmentAlreadyActive()
    {
        // Arrange
        await SeedUserProfileAsync();
        var activeAssessment = new CandidateAssessment
        {
            Id = Guid.NewGuid(),
            UserId = _userId,
            Status = "Running"
        };
        _context.CandidateAssessments.Add(activeAssessment);
        await _context.SaveChangesAsync();

        // Act & Assert
        Func<Task> act = async () => await _service.TriggerAssessmentAsync(_userId, CancellationToken.None);
        await act.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("An assessment is already queued or running for this candidate.");
    }

    [Fact]
    public async Task TriggerAssessmentAsync_Should_Throw_BusinessRuleException_When_ProfileIncomplete()
    {
        // Arrange
        await SeedUserProfileAsync();
        _mockRepositoryProvider.Setup(r => r.HasCompletedRepositoriesAsync(_userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false); // No repos linked -> incomplete
        await _context.SaveChangesAsync();

        // Act & Assert
        Func<Task> act = async () => await _service.TriggerAssessmentAsync(_userId, CancellationToken.None);
        await act.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("At least one analyzed repository linked to your CV is required. Please connect, analyze, and link a repository to your CV first.");
    }

    [Fact]
    public async Task CancelAssessmentAsync_Should_Succeed_When_AssessmentIsActive()
    {
        // Arrange
        var assessmentId = Guid.NewGuid();
        var assessment = new CandidateAssessment
        {
            Id = assessmentId,
            UserId = _userId,
            Status = "Running"
        };
        _context.CandidateAssessments.Add(assessment);
        await _context.SaveChangesAsync();

        // Act
        var result = await _service.CancelAssessmentAsync(_userId, assessmentId);

        // Assert
        result.Should().BeTrue();

        var updated = await _context.CandidateAssessments.FirstOrDefaultAsync(ca => ca.Id == assessmentId);
        updated!.Status.Should().Be("Cancelled");

        // Verify Redis cancel flag was set
        var hasRedisCall = _mockRedisDb.Invocations.Any(inv =>
            inv.Method.Name == "StringSetAsync" &&
            inv.Arguments[0].ToString() == $"ai:cancel:{assessmentId}" &&
            inv.Arguments[1].ToString() == "true"
        );
        hasRedisCall.Should().BeTrue();

        _mockCancellationManager.Verify(c => c.Cancel(assessmentId), Times.Once);
        _mockStreamingSessionService.Verify(s => s.UpdateSessionStatusAsync(assessmentId, "Cancelled", null, null), Times.Once);
    }

    [Fact]
    public async Task CancelAssessmentAsync_Should_Return_False_When_AssessmentIsAlreadyCompleted()
    {
        // Arrange
        var assessmentId = Guid.NewGuid();
        var assessment = new CandidateAssessment
        {
            Id = assessmentId,
            UserId = _userId,
            Status = "Completed"
        };
        _context.CandidateAssessments.Add(assessment);
        await _context.SaveChangesAsync();

        // Act
        var result = await _service.CancelAssessmentAsync(_userId, assessmentId);

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public async Task CancelAssessmentAsync_Should_Return_False_When_AssessmentDoesNotExist()
    {
        // Act
        var result = await _service.CancelAssessmentAsync(_userId, Guid.NewGuid());

        // Assert
        result.Should().BeFalse();
    }

    public void Dispose()
    {
        _context.Dispose();
    }
}
