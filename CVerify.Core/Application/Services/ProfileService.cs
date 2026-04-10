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
using CVerify.API.Application.Storage.Interfaces;
using CVerify.API.Application.Storage.Enums;

namespace CVerify.API.Application.Services;

public class ProfileService : IProfileService
{
    private readonly ApplicationDbContext _context;
    private readonly ICacheService _cacheService;
    private readonly IStorageService _storageService;
    private readonly IAppLogger _logger;

    public ProfileService(
        ApplicationDbContext context,
        ICacheService cacheService,
        IStorageService storageService,
        IAppLogger logger)
    {
        _context = context;
        _cacheService = cacheService;
        _storageService = storageService;
        _logger = logger;
    }

    public async Task<ProfileResponse> GetProfileByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var profile = await _context.UserProfiles
            .Include(up => up.User)
            .FirstOrDefaultAsync(up => up.UserId == userId, cancellationToken);

        if (profile == null)
        {
            // Auto-provision if user exists but profile is missing
            var userExists = await _context.Users.AnyAsync(u => u.Id == userId, cancellationToken);
            if (!userExists)
            {
                throw new ResourceNotFoundException(ProfileErrorCodes.ProfileNotFound, "User not found.");
            }

            profile = new UserProfile
            {
                UserId = userId,
                ProfileVisibility = "public",
                RecruiterVisibility = true,
                AiTalentDiscovery = "disabled",
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };

            _context.UserProfiles.Add(profile);
            await _context.SaveChangesAsync(cancellationToken);
            await _context.Entry(profile).Reference(p => p.User).LoadAsync(cancellationToken);
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
            .Include(up => up.User)
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

        // Update associated User properties
        if (!string.IsNullOrWhiteSpace(request.FullName))
        {
            profile.User.FullName = request.FullName.Trim();
            profile.User.UpdatedAt = DateTimeOffset.UtcNow;
        }

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
        profile.AiTalentDiscovery = request.AiTalentDiscovery;
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
        var logResponse = MapToResponse(profile, newSocialUrls);
        var newStateJson = JsonSerializer.Serialize(logResponse);

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

        return MapToResponse(profile, newSocialUrls);
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
            profile.User?.FullName,
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
            profile.AiTalentDiscovery,
            profile.CreatedAt,
            profile.UpdatedAt,
            profile.Version,
            socialLinks
        );
    }

    public async Task<(string SignedUrl, string ObjectKey)> UploadAvatarAsync(
        Guid userId,
        System.IO.Stream fileStream,
        string fileName,
        string contentType,
        CancellationToken cancellationToken = default)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        if (user == null)
        {
            throw new ResourceNotFoundException(ProfileErrorCodes.ProfileNotFound, "User not found.");
        }

        // Delete old avatar from R2 storage physically if it is an object key we managed
        if (!string.IsNullOrEmpty(user.AvatarUrl) && 
            !user.AvatarUrl.StartsWith("http://", StringComparison.OrdinalIgnoreCase) && 
            !user.AvatarUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
        {
            try
            {
                await _storageService.DeleteFileAsync(user.AvatarUrl, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.Log(LogLevel.Warning, "Profile", $"Failed to delete old avatar key: {user.AvatarUrl}", ex);
            }
        }

        // Physical upload to R2
        var uploadedFile = await _storageService.UploadFileAsync(
            fileStream,
            fileName,
            contentType,
            StorageModule.Profile,
            null,
            cancellationToken);

        // Update user record
        user.AvatarUrl = uploadedFile.ObjectKey;
        user.UpdatedAt = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);

        // Generate signed URL
        var signedUrl = await _storageService.GetSignedUrlAsync(
            uploadedFile.ObjectKey,
            TimeSpan.FromHours(24),
            cancellationToken);

        return (signedUrl, uploadedFile.ObjectKey);
    }
}
