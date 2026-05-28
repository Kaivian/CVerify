using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using FluentAssertions;
using Moq;
using Xunit;
using Microsoft.EntityFrameworkCore.Diagnostics;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Profiles.Entities;
using CVerify.API.Modules.Intelligence.Services;

namespace CVerify.API.UnitTests.Services;

public class CandidateRankingProjectionServiceTests
{
    private readonly ApplicationDbContext _context;
    private readonly Mock<ICandidateRankingCalculator> _rankingCalculatorMock;
    private readonly Mock<ILogger<CandidateRankingProjectionService>> _loggerMock;
    private readonly CandidateRankingProjectionService _service;

    public CandidateRankingProjectionServiceTests()
    {
        var dbOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        _context = new ApplicationDbContext(dbOptions);
        _rankingCalculatorMock = new Mock<ICandidateRankingCalculator>();
        _loggerMock = new Mock<ILogger<CandidateRankingProjectionService>>();

        _service = new CandidateRankingProjectionService(
            _context,
            _rankingCalculatorMock.Object,
            _loggerMock.Object
        );
    }

    [Fact]
    public async Task RebuildRankingProjectionsAsync_ShouldRebuildSortAndPreservePreviousRanks()
    {
        // Arrange: 3 candidates
        var id1 = Guid.NewGuid();
        var id2 = Guid.NewGuid();
        var id3 = Guid.NewGuid();

        // Add 3 users
        var user1 = new User { Id = id1, FullName = "Candidate One", Email = "c1@test.com", Username = "c1", Status = UserStatus.ACTIVE };
        var user2 = new User { Id = id2, FullName = "Candidate Two", Email = "c2@test.com", Username = "c2", Status = UserStatus.ACTIVE };
        var user3 = new User { Id = id3, FullName = "Candidate Three", Email = "c3@test.com", Username = "c3", Status = UserStatus.ACTIVE };

        // Add UserProfiles: Visibilities public
        var profile1 = new UserProfile { UserId = id1, ProfileVisibility = "public", Username = "c1" };
        var profile2 = new UserProfile { UserId = id2, ProfileVisibility = "public", Username = "c2" };
        var profile3 = new UserProfile { UserId = id3, ProfileVisibility = "public", Username = "c3" };

        // Assessments completed
        var assessment1 = new CandidateAssessment { Id = Guid.NewGuid(), UserId = id1, Status = "Completed" };
        var assessment2 = new CandidateAssessment { Id = Guid.NewGuid(), UserId = id2, Status = "Completed" };
        var assessment3 = new CandidateAssessment { Id = Guid.NewGuid(), UserId = id3, Status = "Completed" };

        _context.Users.AddRange(user1, user2, user3);
        _context.UserProfiles.AddRange(profile1, profile2, profile3);
        _context.CandidateAssessments.AddRange(assessment1, assessment2, assessment3);

        // Prepopulate existing ranks to verify rank tracking
        // Candidate 1 was rank #2
        // Candidate 2 was rank #1
        _context.CandidateRankingProjections.AddRange(
            new CandidateRankingProjection { CandidateId = id1, GlobalRankPosition = 2, FullName = "Candidate One" },
            new CandidateRankingProjection { CandidateId = id2, GlobalRankPosition = 1, FullName = "Candidate Two" }
        );

        await _context.SaveChangesAsync();

        // Mock calculator
        // Target: Candidate 1 (Composite 90) -> should become rank #1
        // Target: Candidate 3 (Composite 85) -> should become rank #2
        // Target: Candidate 2 (Composite 80) -> should become rank #3
        _rankingCalculatorMock
            .Setup(c => c.CalculateCandidateRankingAsync(id1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CandidateRankingProjection { CandidateId = id1, FullName = "Candidate One", CompositeScore = 90.0, TrustScore = 80.0, AiScore = 90.0 });

        _rankingCalculatorMock
            .Setup(c => c.CalculateCandidateRankingAsync(id2, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CandidateRankingProjection { CandidateId = id2, FullName = "Candidate Two", CompositeScore = 80.0, TrustScore = 70.0, AiScore = 80.0 });

        _rankingCalculatorMock
            .Setup(c => c.CalculateCandidateRankingAsync(id3, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CandidateRankingProjection { CandidateId = id3, FullName = "Candidate Three", CompositeScore = 85.0, TrustScore = 75.0, AiScore = 85.0 });

        // Act
        await _service.RebuildRankingProjectionsAsync(CancellationToken.None);

        // Assert
        var results = await _context.CandidateRankingProjections.OrderBy(p => p.GlobalRankPosition).ToListAsync();
        results.Should().HaveCount(3);

        // Rank #1: Candidate 1 (previously rank #2)
        results[0].CandidateId.Should().Be(id1);
        results[0].GlobalRankPosition.Should().Be(1);
        results[0].PreviousGlobalRankPosition.Should().Be(2);

        // Rank #2: Candidate 3 (previously not in projection, should be 0 indicating NEW)
        results[1].CandidateId.Should().Be(id3);
        results[1].GlobalRankPosition.Should().Be(2);
        results[1].PreviousGlobalRankPosition.Should().Be(0);

        // Rank #3: Candidate 2 (previously rank #1)
        results[2].CandidateId.Should().Be(id2);
        results[2].GlobalRankPosition.Should().Be(3);
        results[2].PreviousGlobalRankPosition.Should().Be(1);
    }
}
