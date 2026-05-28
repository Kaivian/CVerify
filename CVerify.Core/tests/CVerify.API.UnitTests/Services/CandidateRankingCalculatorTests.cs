using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using FluentAssertions;
using Xunit;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Profiles.Entities;
using CVerify.API.Modules.Auth.Entities;
using CVerify.API.Modules.SourceCode.Entities;
using CVerify.API.Modules.Intelligence.Services;

namespace CVerify.API.UnitTests.Services;

public class CandidateRankingCalculatorTests
{
    private readonly ApplicationDbContext _context;
    private readonly CandidateRankingCalculator _calculator;

    public CandidateRankingCalculatorTests()
    {
        var dbOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        _context = new ApplicationDbContext(dbOptions);
        _calculator = new CandidateRankingCalculator(_context);
    }

    [Fact]
    public async Task CalculateCandidateRankingAsync_ShouldComputeScoresAndStatsCorrectly()
    {
        // Arrange
        var candidateId = Guid.NewGuid();

        var user = new User
        {
            Id = candidateId,
            FullName = "Jane Developer",
            Username = "janedev",
            Email = "jane@cverify.io",
            AvatarUrl = "https://cverify.io/avatars/jane.png"
        };

        var profile = new UserProfile
        {
            UserId = candidateId,
            Username = "janedev",
            Bio = "Passionate systems engineer.",
            Headline = "Lead Systems Engineer",
            Location = "Vietnam"
        };

        var careerPreference = new CareerPreference
        {
            UserId = candidateId,
            AvailableForHire = true,
            OpenToWorkStatus = "actively"
        };

        var snapshot = new CandidateEvaluationSnapshot
        {
            CandidateId = candidateId,
            ProfileCompleteness = 90.0,
            EvidenceTrustScore = 85.0,
            VerificationState = "Verified"
        };

        var trustProj = new CandidateTrustProjection
        {
            CandidateId = candidateId,
            AggregateScore = 75,
            TrustTier = "HighTrust"
        };

        var latestAssessment = new CandidateAssessment
        {
            Id = Guid.NewGuid(),
            UserId = candidateId,
            Status = "Completed",
            OverallScore = 80.0,
            CompletedAtUtc = DateTimeOffset.UtcNow.AddDays(-1),
            PrimaryTendency = "Backend",
            CareerLevelLabel = "Lead"
        };

        // Source Code Repos
        var authProvider = new AuthProvider
        {
            Id = Guid.NewGuid(),
            UserId = candidateId,
            ProviderName = "GitHub",
            ProviderKey = "gh-jane"
        };

        var repo1 = new SourceCodeRepository
        {
            Id = Guid.NewGuid(),
            AuthProviderId = authProvider.Id,
            AuthProvider = authProvider,
            ExternalRepositoryId = "repo-1",
            Name = "fast-api",
            IsEnabled = true,
            IsVerified = true,
            StarsCount = 8,  // 8 * 5 = 40 stars score
            ForksCount = 2,  // 2 * 10 = 20 forks score
            Owner = "janedev",
            OwnerLogin = "janedev",
            OwnerType = "User"
        };

        var repo2 = new SourceCodeRepository
        {
            Id = Guid.NewGuid(),
            AuthProviderId = authProvider.Id,
            AuthProvider = authProvider,
            ExternalRepositoryId = "repo-2",
            Name = "wasm-compiler",
            IsEnabled = true,
            IsVerified = false,
            StarsCount = 4,  // 4 * 5 = 20 stars score (total 12 stars * 5 = 60, capped at 50)
            ForksCount = 1,   // 1 * 10 = 10 forks score (total 3 forks * 10 = 30, capped at 30)
            Owner = "janedev",
            OwnerLogin = "janedev",
            OwnerType = "User"
        };

        // Project Entries (verified contributions)
        var projectEntry1 = new ProjectEntry
        {
            Id = Guid.NewGuid(),
            UserId = candidateId,
            Name = "Contrib 1",
            Role = "Contributor",
            Description = "A systems programming contribution.",
            VerificationStatus = ProjectVerificationStatus.Verified
        };

        var projectEntry2 = new ProjectEntry
        {
            Id = Guid.NewGuid(),
            UserId = candidateId,
            Name = "Contrib 2",
            Role = "Contributor",
            Description = "Another systems programming contribution.",
            VerificationStatus = ProjectVerificationStatus.Unverified
        };

        // Capabilities
        var node1 = new CapabilityNode
        {
            Id = Guid.NewGuid(),
            Slug = "tech.csharp",
            Name = "C#",
            Category = "Backend"
        };

        var cap1 = new CandidateCapability
        {
            Id = Guid.NewGuid(),
            CandidateId = candidateId,
            CapabilityNodeId = node1.Id,
            CapabilityNode = node1
        };

        var capScore1 = new CandidateCapabilityScore
        {
            CandidateCapabilityId = cap1.Id,
            CandidateCapability = cap1,
            ProficiencyScore = 95.0,
            ExpertiseLevel = "Architecture"
        };
        cap1.Score = capScore1;

        var node2 = new CapabilityNode
        {
            Id = Guid.NewGuid(),
            Slug = "tech.wasm",
            Name = "WebAssembly",
            Category = "Systems"
        };

        var cap2 = new CandidateCapability
        {
            Id = Guid.NewGuid(),
            CandidateId = candidateId,
            CapabilityNodeId = node2.Id,
            CapabilityNode = node2
        };

        var capScore2 = new CandidateCapabilityScore
        {
            CandidateCapabilityId = cap2.Id,
            CandidateCapability = cap2,
            ProficiencyScore = 88.0,
            ExpertiseLevel = "Production"
        };
        cap2.Score = capScore2;

        // Followers
        var follower1Id = Guid.NewGuid();
        var follower = new User { Id = follower1Id, FullName = "Follower One", Email = "follower1@cverify.io", Username = "follower1" };
        var followRelation = new UserFollower
        {
            FollowerId = follower1Id,
            FolloweeId = candidateId,
            FollowedAt = DateTimeOffset.UtcNow
        };

        _context.Users.AddRange(user, follower);
        _context.UserProfiles.Add(profile);
        _context.CareerPreferences.Add(careerPreference);
        _context.CandidateEvaluationSnapshots.Add(snapshot);
        _context.CandidateTrustProjections.Add(trustProj);
        _context.CandidateAssessments.Add(latestAssessment);
        _context.AuthProviders.Add(authProvider);
        _context.SourceCodeRepositories.AddRange(repo1, repo2);
        _context.ProjectEntries.AddRange(projectEntry1, projectEntry2);
        _context.CapabilityNodes.AddRange(node1, node2);
        _context.CandidateCapabilityScores.AddRange(capScore1, capScore2);
        _context.CandidateCapabilities.AddRange(cap1, cap2);
        _context.UserFollowers.Add(followRelation);

        await _context.SaveChangesAsync();

        // Act
        var result = await _calculator.CalculateCandidateRankingAsync(candidateId, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.CandidateId.Should().Be(candidateId);
        result.FullName.Should().Be("Jane Developer");
        result.Username.Should().Be("janedev");
        result.Bio.Should().Be("Passionate systems engineer.");
        result.Headline.Should().Be("Lead Systems Engineer");
        result.Location.Should().Be("Vietnam");
        result.AvatarUrl.Should().Be("https://cverify.io/avatars/jane.png");

        // Stat counts
        result.VerifiedRepoCount.Should().Be(1); // Only repo1 is verified
        result.TotalStarsCount.Should().Be(12);  // 8 + 4
        result.TotalForksCount.Should().Be(3);   // 2 + 1
        result.VerifiedContributionCount.Should().Be(1); // Only projectEntry1 is verified
        result.FollowersCount.Should().Be(1);
        result.FollowingCount.Should().Be(0);

        // Scoring
        // StarsScore = min(12 * 5, 50) = 50
        // ForksScore = min(3 * 10, 30) = 30
        // RepoScore = min(1 * 10, 20) = 10
        // OssImpactScore = 50 + 30 + 10 = 90
        // CompositeScore = (AiScore * 0.35) + (TrustScore * 0.35) + (Completeness * 0.15) + (OssImpactScore * 0.15)
        // CompositeScore = (80 * 0.35) + (75 * 0.35) + (90 * 0.15) + (90 * 0.15)
        // = 28 + 26.25 + 13.5 + 13.5 = 81.25
        result.AiScore.Should().Be(80.0);
        result.TrustScore.Should().Be(75.0);
        result.ProfileCompleteness.Should().Be(90.0);
        result.EvidenceTrustScore.Should().Be(85.0);
        result.CompositeScore.Should().Be(81.25);

        // Top Capabilities Json Serialization
        var parsedCapabilities = JsonSerializer.Deserialize<List<CapabilityNodeDto>>(result.TopCapabilitiesJson);
        parsedCapabilities.Should().NotBeNull();
        parsedCapabilities.Should().HaveCount(2);
        parsedCapabilities[0].name.Should().Be("C#");
        parsedCapabilities[0].score.Should().Be(95.0);
        parsedCapabilities[1].name.Should().Be("WebAssembly");
        parsedCapabilities[1].score.Should().Be(88.0);
        
        result.PrimaryDomain.Should().Be("Backend");
        result.CareerLevelLabel.Should().Be("Lead");
        result.AvailableForHire.Should().BeTrue();
    }

    private class CapabilityNodeDto
    {
        public string name { get; set; } = string.Empty;
        public double score { get; set; }
    }
}
