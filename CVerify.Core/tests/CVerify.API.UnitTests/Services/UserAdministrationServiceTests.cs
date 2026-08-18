using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Time.Testing;
using FluentAssertions;
using Moq;
using Xunit;
using CVerify.API.Modules.Admin.DTOs;
using CVerify.API.Modules.Admin.Services;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.Exceptions;
using CVerify.API.Modules.Shared.Persistence;

using Microsoft.EntityFrameworkCore.Diagnostics;

namespace CVerify.API.UnitTests.Services;

public class UserAdministrationServiceTests : IDisposable
{
    private readonly ApplicationDbContext _context;
    private readonly Mock<IAdminAuthorizationService> _authServiceMock;
    private readonly Mock<ILogger<UserAdministrationService>> _loggerMock;
    private readonly FakeTimeProvider _timeProvider;
    private readonly UserAdministrationService _service;

    public UserAdministrationServiceTests()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .ConfigureWarnings(x => x.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        _context = new ApplicationDbContext(options);
        _authServiceMock = new Mock<IAdminAuthorizationService>();
        _loggerMock = new Mock<ILogger<UserAdministrationService>>();
        _timeProvider = new FakeTimeProvider();

        _service = new UserAdministrationService(
            _context,
            _authServiceMock.Object,
            _timeProvider,
            _loggerMock.Object
        );
    }

    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
    }

    private async Task SeedDataAsync()
    {
        var superAdminRole = new Role
        {
            Id = Guid.NewGuid(),
            Name = "SUPER_ADMIN",
            DisplayName = "System Administrator",
            Domain = "SYSTEM",
            IsActive = true
        };

        var userRole = new Role
        {
            Id = Guid.NewGuid(),
            Name = "USER",
            DisplayName = "General User",
            Domain = "SYSTEM",
            IsActive = true
        };

        _context.Roles.AddRange(superAdminRole, userRole);

        var adminUser = new User
        {
            Id = Guid.NewGuid(),
            Email = "admin@system.com",
            FullName = "Admin User",
            Status = UserStatus.ACTIVE,
            CreatedAt = _timeProvider.GetUtcNow()
        };

        var regularUser = new User
        {
            Id = Guid.NewGuid(),
            Email = "jane.doe@example.com",
            FullName = "Jane Doe",
            Status = UserStatus.ACTIVE,
            CreatedAt = _timeProvider.GetUtcNow()
        };

        var candidateUser = new User
        {
            Id = Guid.NewGuid(),
            Email = "john.candidate@example.com",
            FullName = "John Candidate",
            Status = UserStatus.SUSPENDED,
            CreatedAt = _timeProvider.GetUtcNow()
        };

        _context.Users.AddRange(adminUser, regularUser, candidateUser);

        _context.RoleAssignments.Add(new RoleAssignment
        {
            Id = Guid.NewGuid(),
            UserId = adminUser.Id,
            RoleId = superAdminRole.Id,
            ScopeType = "SYSTEM",
            ScopeId = Guid.Empty
        });

        _context.RoleAssignments.Add(new RoleAssignment
        {
            Id = Guid.NewGuid(),
            UserId = regularUser.Id,
            RoleId = userRole.Id,
            ScopeType = "SYSTEM",
            ScopeId = Guid.Empty
        });

        await _context.SaveChangesAsync();
    }

    [Fact]
    public async Task GetPlatformUsersAsync_ShouldReturnAllNonDeletedUsers()
    {
        // Arrange
        await SeedDataAsync();

        // Act
        var result = await _service.GetPlatformUsersAsync(null, null, null, 1, 20, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.TotalCount.Should().Be(3);
        result.Items.Should().HaveCount(3);
        result.Items.Select(u => u.Email).Should().Contain("admin@system.com");
        result.Items.Select(u => u.Email).Should().Contain("jane.doe@example.com");
        result.Items.Select(u => u.Email).Should().Contain("john.candidate@example.com");
    }

    [Fact]
    public async Task GetPlatformUsersAsync_WithSearch_ShouldFilterByEmailOrFullName()
    {
        // Arrange
        await SeedDataAsync();

        // Act
        var result = await _service.GetPlatformUsersAsync("jane", null, null, 1, 20, CancellationToken.None);

        // Assert
        result.TotalCount.Should().Be(1);
        result.Items.First().Email.Should().Be("jane.doe@example.com");
    }

    [Fact]
    public async Task GetPlatformUsersAsync_WithStatus_ShouldFilterByStatus()
    {
        // Arrange
        await SeedDataAsync();

        // Act
        var result = await _service.GetPlatformUsersAsync(null, "SUSPENDED", null, 1, 20, CancellationToken.None);

        // Assert
        result.TotalCount.Should().Be(1);
        result.Items.First().Email.Should().Be("john.candidate@example.com");
    }

    [Fact]
    public async Task UpdatePlatformUserStatusAndRolesAsync_SelfUpdate_ShouldThrowValidationException()
    {
        // Arrange
        await SeedDataAsync();
        var admin = await _context.Users.FirstAsync(u => u.Email == "admin@system.com");

        var dto = new UpdateUserDto("ACTIVE", new List<string> { "SUPER_ADMIN" });

        // Act
        Func<Task> act = async () => await _service.UpdatePlatformUserStatusAndRolesAsync(
            admin.Id, admin.Id, dto, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ValidationException>()
            .WithMessage("*cannot modify your own administrative account*");
    }

    [Fact]
    public async Task UpdatePlatformUserStatusAndRolesAsync_ValidUpdate_ShouldTransitionStatusAndInvalidateSession()
    {
        // Arrange
        await SeedDataAsync();
        var admin = await _context.Users.FirstAsync(u => u.Email == "admin@system.com");
        var regularUser = await _context.Users.FirstAsync(u => u.Email == "jane.doe@example.com");

        var dto = new UpdateUserDto("SUSPENDED", new List<string> { "USER" });

        // Act
        var result = await _service.UpdatePlatformUserStatusAndRolesAsync(
            admin.Id, regularUser.Id, dto, CancellationToken.None);

        // Assert
        result.Status.Should().Be("SUSPENDED");
        result.SessionVersion.Should().Be(2);

        var updatedUserInDb = await _context.Users.FindAsync(regularUser.Id);
        updatedUserInDb!.Status.Should().Be(UserStatus.SUSPENDED);
        updatedUserInDb.SessionVersion.Should().Be(2);

        _authServiceMock.Verify(a => a.InvalidateCacheAsync(regularUser.Id), Times.Once);
    }

    [Fact]
    public async Task DeletePlatformUserAsync_ValidTarget_ShouldSoftDeleteUser()
    {
        // Arrange
        await SeedDataAsync();
        var admin = await _context.Users.FirstAsync(u => u.Email == "admin@system.com");
        var regularUser = await _context.Users.FirstAsync(u => u.Email == "jane.doe@example.com");

        // Act
        await _service.DeletePlatformUserAsync(admin.Id, regularUser.Id, CancellationToken.None);

        // Assert
        var deletedUserInDb = await _context.Users.FindAsync(regularUser.Id);
        deletedUserInDb!.Status.Should().Be(UserStatus.DELETED);
        deletedUserInDb.DeletedAt.Should().NotBeNull();

        var listResult = await _service.GetPlatformUsersAsync(null, null, null, 1, 20, CancellationToken.None);
        listResult.TotalCount.Should().Be(2);
    }
}
