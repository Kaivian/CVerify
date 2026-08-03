using System;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using FluentAssertions;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.System.Services;

namespace CVerify.API.UnitTests.Services;

public class TechnologyNormalizationServiceTests : IDisposable
{
    private readonly ApplicationDbContext _context;
    private readonly Mock<ILogger<TechnologyNormalizationService>> _mockLogger;
    private readonly TechnologyNormalizationService _service;

    public TechnologyNormalizationServiceTests()
    {
        var dbOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        _context = new ApplicationDbContext(dbOptions);
        _mockLogger = new Mock<ILogger<TechnologyNormalizationService>>();
        _service = new TechnologyNormalizationService(_context, _mockLogger.Object);

        SeedDatabase();
    }

    private void SeedDatabase()
    {
        // Seed some canonical skills
        _context.CanonicalSkills.AddRange(
            new CanonicalSkill
            {
                SkillId = "skill:react",
                TaxonomyVersion = "2026.07",
                DisplayName = "React",
                SfiaCategory = "Software Development",
                OnetCode = "15-1252.00",
                Status = "Active",
                CreatedAt = DateTimeOffset.UtcNow
            },
            new CanonicalSkill
            {
                SkillId = "skill:mongodb",
                TaxonomyVersion = "2026.07",
                DisplayName = "MongoDB",
                SfiaCategory = "Database Administration",
                OnetCode = "15-1245.00",
                Status = "Active",
                CreatedAt = DateTimeOffset.UtcNow
            }
        );

        // Seed some aliases
        _context.CanonicalSkillAliases.AddRange(
            new CanonicalSkillAlias
            {
                AliasName = "reactjs",
                SkillId = "skill:react",
                TaxonomyVersion = "2026.07"
            },
            new CanonicalSkillAlias
            {
                AliasName = "mongo",
                SkillId = "skill:mongodb",
                TaxonomyVersion = "2026.07"
            }
        );

        _context.SaveChanges();
    }

    [Fact]
    public async Task NormalizeAsync_KnownAlias_ShouldResolveCanonicalNameAndId()
    {
        // Act
        var result = await _service.NormalizeAsync("mongo");

        // Assert
        result.Found.Should().BeTrue();
        result.SkillId.Should().Be("skill:mongodb");
        result.NormalizedName.Should().Be("MongoDB");
        result.SfiaCategory.Should().Be("Database Administration");
        result.OnetCode.Should().Be("15-1245.00");
    }

    [Fact]
    public async Task NormalizeAsync_ExactDisplayNameMatch_ShouldResolveCanonicalNameAndId()
    {
        // Act
        var result = await _service.NormalizeAsync("React");

        // Assert
        result.Found.Should().BeTrue();
        result.SkillId.Should().Be("skill:react");
        result.NormalizedName.Should().Be("React");
    }

    [Fact]
    public async Task NormalizeAsync_UnknownSkill_ShouldRegisterAsEmergingSkill()
    {
        // Act
        var result = await _service.NormalizeAsync("SuperNova DB");

        // Assert
        result.Found.Should().BeFalse();
        result.SkillId.Should().Be("skill:emerging-supernovadb");
        result.NormalizedName.Should().Be("SuperNova DB");

        // Verify database entry was created
        var dbSkill = await _context.CanonicalSkills.FirstOrDefaultAsync(s => s.SkillId == "skill:emerging-supernovadb");
        dbSkill.Should().NotBeNull();
        dbSkill!.DisplayName.Should().Be("SuperNova DB");
        dbSkill.Status.Should().Be("PendingReview");
        dbSkill.SfiaCategory.Should().Be("Emerging Technology");

        var dbAlias = await _context.CanonicalSkillAliases.FirstOrDefaultAsync(a => a.AliasName == "supernova db");
        dbAlias.Should().NotBeNull();
        dbAlias!.SkillId.Should().Be("skill:emerging-supernovadb");
    }

    [Fact]
    public async Task NormalizeAsync_NullOrEmptyInput_ShouldReturnDefaultResult()
    {
        // Act
        var result1 = await _service.NormalizeAsync(null!);
        var result2 = await _service.NormalizeAsync("   ");

        // Assert
        result1.SkillId.Should().BeEmpty();
        result1.Found.Should().BeFalse();
        result2.SkillId.Should().BeEmpty();
        result2.Found.Should().BeFalse();
    }

    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
    }
}
