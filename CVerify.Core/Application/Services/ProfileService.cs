using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using CVerify.API.Application.DTOs;
using CVerify.API.Application.Interfaces;
using CVerify.API.Core.Entities;
using CVerify.API.Infrastructure.Persistence;
using CVerify.API.Infrastructure.Diagnostics;
using CVerify.API.Application.Exceptions;

namespace CVerify.API.Application.Services;

public class ProfileService : IProfileService
{
    private readonly ApplicationDbContext _context;
    private readonly ICacheService _cacheService;
    private readonly IAppLogger _logger;

    public ProfileService(
        ApplicationDbContext context,
        ICacheService cacheService,
        IAppLogger logger)
    {
        _context = context;
        _cacheService = cacheService;
        _logger = logger;
    }

    public async Task<ProfileResponse> GetProfileByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var profile = await _context.UserProfiles
            .FirstOrDefaultAsync(up => up.UserId == userId, cancellationToken);

        if (profile == null)
        {
            // Verify if user exists in database
            var userExists = await _context.Users.AnyAsync(u => u.Id == userId, cancellationToken);
            if (!userExists)
            {
                throw new ResourceNotFoundException(ProfileErrorCodes.ProfileNotFound, $"User with ID {userId} not found.");
            }

            // Create default profile for the user
            profile = new UserProfile
            {
                UserId = userId,
                ProfileVisibility = "public",
                RecruiterVisibility = true,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };

            _context.UserProfiles.Add(profile);
            await _context.SaveChangesAsync(cancellationToken);
        }

        var socialLinks = await _context.SocialLinks
            .Where(sl => sl.UserId == userId)
            .Select(sl => sl.Url)
            .ToListAsync(cancellationToken);

        return MapToResponse(profile, socialLinks);
    }

    public async Task<ProfileResponse> UpdateProfileAsync(
        Guid userId, 
        UpdateProfileRequest request, 
        string? ipAddress = null, 
        string? userAgent = null, 
        CancellationToken cancellationToken = default)
    {
        var profile = await _context.UserProfiles
            .FirstOrDefaultAsync(up => up.UserId == userId, cancellationToken);

        if (profile == null)
        {
            throw new ResourceNotFoundException(ProfileErrorCodes.ProfileNotFound, "Profile not found.");
        }

        // Concurrency Check (Fail-fast before database write)
        if (profile.Version != request.Version)
        {
            throw new ProfileException(ProfileErrorCodes.ProfileConcurrencyConflict, "This profile has been modified by another process. Please reload and try again.");
        }

        // Keep old state for activity logging
        var oldStateJson = JsonSerializer.Serialize(MapToResponse(profile, new List<string>()));

        // Update properties
        profile.Bio = request.Bio;
        profile.Location = request.Location;
        profile.PhoneNumber = request.PhoneNumber;
        profile.BirthDate = request.BirthDate;
        profile.Headline = request.Headline;
        profile.Company = request.Company;
        profile.Pronouns = request.Pronouns;
        profile.CustomPronouns = request.CustomPronouns;
        profile.PublicEmail = request.PublicEmail;
        profile.ProfileVisibility = request.ProfileVisibility;
        profile.RecruiterVisibility = request.RecruiterVisibility;
        profile.UpdatedAt = DateTimeOffset.UtcNow;

        // Sync Social Links (Delete existing and insert new is safest)
        var existingLinks = await _context.SocialLinks
            .Where(sl => sl.UserId == userId)
            .ToListAsync(cancellationToken);
        _context.SocialLinks.RemoveRange(existingLinks);

        var newSocialUrls = new List<string>();
        if (request.SocialLinks != null)
        {
            foreach (var url in request.SocialLinks.Where(u => !string.IsNullOrWhiteSpace(u)))
            {
                var socialLink = new SocialLink
                {
                    Id = Guid.CreateVersion7(),
                    UserId = userId,
                    Url = url.Trim(),
                    CreatedAt = DateTimeOffset.UtcNow,
                    UpdatedAt = DateTimeOffset.UtcNow
                };
                _context.SocialLinks.Add(socialLink);
                newSocialUrls.Add(socialLink.Url);
            }
        }

        // Log the state transition
        var newStateResponse = MapToResponse(profile, newSocialUrls);
        var newStateJson = JsonSerializer.Serialize(newStateResponse);

        var log = new ProfileActivityLog
        {
            Id = Guid.CreateVersion7(),
            UserId = userId,
            ActionType = "UPDATE_PROFILE",
            OldStateJson = oldStateJson,
            NewStateJson = newStateJson,
            IpAddress = ipAddress,
            UserAgent = userAgent,
            CreatedAt = DateTimeOffset.UtcNow
        };
        _context.ProfileActivityLogs.Add(log);

        try
        {
            await _context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException ex)
        {
            throw new ProfileException(ProfileErrorCodes.ProfileConcurrencyConflict, "A concurrency conflict occurred. Please try again.", ex);
        }

        return newStateResponse;
    }

    public async Task UpdateUsernameAsync(
        Guid userId, 
        string newUsername, 
        string? ipAddress = null, 
        string? userAgent = null, 
        CancellationToken cancellationToken = default)
    {
        var profile = await _context.UserProfiles
            .FirstOrDefaultAsync(up => up.UserId == userId, cancellationToken);

        if (profile == null)
        {
            throw new ResourceNotFoundException(ProfileErrorCodes.ProfileNotFound, "Profile not found.");
        }

        newUsername = newUsername.Trim();

        // 1. Case-insensitive conflict check
        // Because of the 'citext' type on Postgres username, a normal comparison works, but EF Core ILIKE is safest
        var isTaken = await _context.UserProfiles
            .AnyAsync(up => up.UserId != userId && up.Username == newUsername, cancellationToken);

        if (isTaken)
        {
            throw new ProfileException(ProfileErrorCodes.UsernameAlreadyExists, $"The username '{newUsername}' is already taken.");
        }

        // 2. Username Change Cooldown check (30 days)
        var cooldownKey = $"username_cooldown:{userId}";
        var hasCooldown = await _cacheService.ExistsAsync(cooldownKey);
        if (hasCooldown)
        {
            throw new ProfileException(ProfileErrorCodes.UsernameCooldownActive, "You can only update your username once every 30 days.");
        }

        var oldStateJson = JsonSerializer.Serialize(new { profile.Username });
        var newStateJson = JsonSerializer.Serialize(new { Username = newUsername });

        profile.Username = newUsername;
        profile.UpdatedAt = DateTimeOffset.UtcNow;

        // Log the state transition
        var log = new ProfileActivityLog
        {
            Id = Guid.CreateVersion7(),
            UserId = userId,
            ActionType = "UPDATE_USERNAME",
            OldStateJson = oldStateJson,
            NewStateJson = newStateJson,
            IpAddress = ipAddress,
            UserAgent = userAgent,
            CreatedAt = DateTimeOffset.UtcNow
        };
        _context.ProfileActivityLogs.Add(log);

        // Set cooldown in cache for 30 days
        await _cacheService.SetAsync(cooldownKey, true, TimeSpan.FromDays(30));

        try
        {
            await _context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (ex.InnerException is Npgsql.PostgresException pgEx && pgEx.SqlState == "23505")
        {
            // Fallback for DB-level unique index enforcement
            throw new ProfileException(ProfileErrorCodes.UsernameAlreadyExists, "This username is already taken.", ex);
        }
    }

    private static ProfileResponse MapToResponse(UserProfile profile, List<string> socialLinks)
    {
        return new ProfileResponse(
            profile.UserId,
            profile.Username,
            profile.Bio,
            profile.Location,
            profile.PhoneNumber,
            profile.BirthDate,
            profile.Headline,
            profile.Company,
            profile.Pronouns,
            profile.CustomPronouns,
            profile.PublicEmail,
            profile.ProfileVisibility,
            profile.RecruiterVisibility,
            profile.CreatedAt,
            profile.UpdatedAt,
            profile.Version,
            socialLinks
        );
    }
}
