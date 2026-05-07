using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using FluentAssertions;
using Xunit;
using CVerify.API.Modules.Shared.Configuration;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.Email.Services;
using CVerify.API.Modules.Shared.Persistence;

namespace CVerify.API.UnitTests.Services;

/// <summary>
/// Unit tests validating the resolution of recipient profiles, fallback rules, and configuration-driven placeholder filtering.
/// </summary>
public class EmailPersonalizationTests
{
    private readonly ApplicationDbContext _context;
    private readonly IOptions<EmailSettings> _options;

    public EmailPersonalizationTests()
    {
        // Use a unique InMemory database instance per test run to prevent cross-contamination
        var dbOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        _context = new ApplicationDbContext(dbOptions);

        var emailSettings = new EmailSettings
        {
            InvalidPlaceholders = new List<string>
            {
                "Candidate User",
                "John Doe",
                "Example User",
                "Test User",
                "CVerify User",
                "Workspace Administrator"
            }
        };

        _options = Microsoft.Extensions.Options.Options.Create(emailSettings);
    }

    [Fact]
    public async Task ResolveByEmailAsync_ShouldReturnProfileWithNames_WhenUserExistsWithPrimaryEmail()
    {
        // Arrange
        var resolver = new EmailRecipientResolver(_context, _options);
        var targetUser = new User
        {
            Id = Guid.Parse("018fbfb3-caab-7df2-a384-25e22709e3e3"),
            Email = "primary@cverify.ai",
            FullName = "Kaivian Dev",
            Username = "kaiviandev",
            Status = UserStatus.ACTIVE
        };

        _context.Users.Add(targetUser);
        await _context.SaveChangesAsync();

        // Act
        var result = await resolver.ResolveByEmailAsync("primary@cverify.ai");

        // Assert
        result.Should().NotBeNull();
        result.Email.Should().Be("primary@cverify.ai");
        result.DisplayName.Should().Be("Kaivian Dev");
        result.Username.Should().Be("kaiviandev");
    }

    [Fact]
    public async Task ResolveByEmailAsync_ShouldReturnProfileWithNames_WhenUserExistsWithLinkedEmail()
    {
        // Arrange
        var resolver = new EmailRecipientResolver(_context, _options);
        var targetUser = new User
        {
            Id = Guid.Parse("018fbfb3-caab-7df2-a384-25e22709e3e3"),
            Email = "primary@cverify.ai",
            FullName = "Kaivian Dev",
            Username = "kaiviandev",
            Status = UserStatus.ACTIVE
        };

        var linkedEmail = new LinkedEmail
        {
            Id = Guid.Parse("018fbfb3-caab-7df2-a384-25e22709e3e4"),
            Email = "linked@cverify.ai",
            IsVerified = true
        };

        targetUser.LinkedEmails.Add(linkedEmail);
        _context.Users.Add(targetUser);
        await _context.SaveChangesAsync();

        // Act
        var result = await resolver.ResolveByEmailAsync("linked@cverify.ai");

        // Assert
        result.Should().NotBeNull();
        result.Email.Should().Be("linked@cverify.ai");
        result.DisplayName.Should().Be("Kaivian Dev");
        result.Username.Should().Be("kaiviandev");
    }

    [Fact]
    public async Task ResolveByEmailAsync_ShouldFilterInvalidPlaceholders_WhenResolvingNames()
    {
        // Arrange
        var resolver = new EmailRecipientResolver(_context, _options);
        var targetUser = new User
        {
            Id = Guid.Parse("018fbfb3-caab-7df2-a384-25e22709e3e3"),
            Email = "placeholder@cverify.ai",
            FullName = "   Candidate User   ", // Trimming and case-insensitive check
            Username = "John Doe",
            Status = UserStatus.ACTIVE
        };

        _context.Users.Add(targetUser);
        await _context.SaveChangesAsync();

        // Act
        var result = await resolver.ResolveByEmailAsync("placeholder@cverify.ai");

        // Assert
        result.Should().NotBeNull();
        result.Email.Should().Be("placeholder@cverify.ai");
        result.DisplayName.Should().BeNull();
        result.Username.Should().BeNull();
    }

    [Fact]
    public async Task ResolveByEmailAsync_ShouldReturnProfileWithNullNames_WhenUserDoesNotExist()
    {
        // Arrange
        var resolver = new EmailRecipientResolver(_context, _options);

        // Act
        var result = await resolver.ResolveByEmailAsync("nonexistent@cverify.ai");

        // Assert
        result.Should().NotBeNull();
        result.Email.Should().Be("nonexistent@cverify.ai");
        result.DisplayName.Should().BeNull();
        result.Username.Should().BeNull();
    }
}
