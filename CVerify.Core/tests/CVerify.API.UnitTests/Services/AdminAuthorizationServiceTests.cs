using System;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Moq;
using Xunit;
using CVerify.API.Modules.Admin.Services;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.System.Services;

namespace CVerify.API.UnitTests.Services;

public class AdminAuthorizationServiceTests : IDisposable
{
    private readonly ApplicationDbContext _context;
    private readonly Mock<ICacheService> _cacheServiceMock;
    private readonly AdminAuthorizationService _service;

    public AdminAuthorizationServiceTests()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .ConfigureWarnings(x => x.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        _context = new ApplicationDbContext(options);
        _cacheServiceMock = new Mock<ICacheService>();

        _service = new AdminAuthorizationService(_context, _cacheServiceMock.Object);
    }

    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
    }

    [Theory]
    [InlineData("ACTIVE")]
    [InlineData("Active")]
    [InlineData("active")]
    public async Task GetSessionVersionAsync_WithDifferentStatusCasings_ShouldReturnSessionVersion(string statusCasing)
    {
        // Arrange
        var userId = Guid.NewGuid();
        var adminMember = new AdminMember
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Status = statusCasing,
            SessionVersion = 5
        };

        _context.AdminMembers.Add(adminMember);
        await _context.SaveChangesAsync();

        _cacheServiceMock
            .Setup(c => c.GetAsync<string>(It.IsAny<string>()))
            .ReturnsAsync((string?)null);

        // Act
        var version = await _service.GetSessionVersionAsync(userId, CancellationToken.None);

        // Assert
        version.Should().Be(5);
    }
}