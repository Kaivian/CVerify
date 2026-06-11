using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using CVerify.API.Modules.Profiles.DTOs;
using CVerify.API.Modules.Profiles.Entities;
using CVerify.API.Modules.Shared.Diagnostics;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.Exceptions;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.Security;
using CVerify.API.Modules.Shared.Storage.Enums;
using CVerify.API.Modules.Shared.Storage.Interfaces;
using CVerify.API.Modules.Shared.System.Services;

namespace CVerify.API.Modules.Profiles.Services;

public class ProfileService : IProfileService
{
    private readonly ApplicationDbContext _context;
    private readonly ICacheService _cacheService;
    private readonly IStorageService _storageService;
    private readonly IUsernameService _usernameService;
    private readonly TimeProvider _timeProvider;
    private readonly IAppLogger _logger;

    public ProfileService(
        ApplicationDbContext context,
        ICacheService cacheService,
        IStorageService storageService,
        IUsernameService usernameService,
        TimeProvider timeProvider,
        IAppLogger logger)
    {
        _context = context;
        _cacheService = cacheService;
        _storageService = storageService;
        _usernameService = usernameService;
        _timeProvider = timeProvider;
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
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
            if (user == null)
            {
                throw new ResourceNotFoundException(ProfileErrorCodes.ProfileNotFound, "User not found.");
            }

            profile = new UserProfile
            {
                UserId = userId,
                Username = user.Username,
                ProfileVisibility = "public",
                RecruiterVisibility = true,
                AiTalentDiscovery = "disabled",
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };

            _context.UserProfiles.Add(profile);
            await _context.SaveChangesAsync(cancellationToken);
            profile.User = user;
        }

        return MapToResponse(profile, profile.SocialLinks);
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

        var newSocialUrls = new List<string>();
        if (request.SocialLinks != null)
        {
            newSocialUrls = request.SocialLinks
                .Where(u => !string.IsNullOrWhiteSpace(u))
                .Select(u => u.Trim())
                .ToList();
        }
        profile.SocialLinks = newSocialUrls;

        // Log the state transition
        var logResponse = MapToResponse(profile, newSocialUrls);
        var newStateJson = JsonSerializer.Serialize(logResponse);

        var log = new AuditLog
        {
            Id = Guid.CreateVersion7(),
            UserId = userId,
            EventType = "UPDATE_PROFILE",
            Description = $"User profile updated for {profile.User?.FullName ?? userId.ToString()}.",
            OldStateJson = oldStateJson,
            NewStateJson = newStateJson,
            IpAddress = ipAddress,
            UserAgent = userAgent,
            CreatedAt = DateTimeOffset.UtcNow
        };
        _context.AuditLogs.Add(log);

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
        _usernameService.ValidateUsername(newUsername);

        var profile = await _context.UserProfiles
            .Include(up => up.User)
            .FirstOrDefaultAsync(up => up.UserId == userId, cancellationToken);

        if (profile == null)
        {
            throw new ResourceNotFoundException(ProfileErrorCodes.ProfileNotFound, "Profile not found.");
        }

        newUsername = _usernameService.Normalize(newUsername);

        // 1. Username Change Cooldown check (30 days)
        await _usernameService.CheckChangeCooldownAsync(userId, cancellationToken);

        // 2. Case-insensitive conflict check
        var isTaken = await _context.Users
            .AnyAsync(u => u.Id != userId && u.Username == newUsername, cancellationToken);

        if (isTaken)
        {
            throw new ProfileException(ProfileErrorCodes.UsernameAlreadyExists, $"The username '{newUsername}' is already taken.");
        }

        var oldStateJson = JsonSerializer.Serialize(new { profile.Username });
        var newStateJson = JsonSerializer.Serialize(new { Username = newUsername });

        profile.Username = newUsername;
        profile.UpdatedAt = _timeProvider.GetUtcNow();

        if (profile.User != null)
        {
            profile.User.Username = newUsername;
            profile.User.LastUsernameChangeAt = _timeProvider.GetUtcNow();
            profile.User.UpdatedAt = _timeProvider.GetUtcNow();
        }

        // Log the state transition
        var log = new AuditLog
        {
            Id = Guid.CreateVersion7(),
            UserId = userId,
            EventType = "UPDATE_USERNAME",
            Description = $"Username updated to {newUsername}.",
            OldStateJson = oldStateJson,
            NewStateJson = newStateJson,
            IpAddress = ipAddress,
            UserAgent = userAgent,
            CreatedAt = _timeProvider.GetUtcNow()
        };
        _context.AuditLogs.Add(log);

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

    public async Task<PublicProfileResponse> GetPublicProfileByUsernameAsync(string username, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(username))
        {
            throw new ResourceNotFoundException(ProfileErrorCodes.ProfileNotFound, "Profile not found.");
        }

        var normalizedUsername = _usernameService.Normalize(username);

        var profile = await _context.UserProfiles
            .Include(up => up.User)
            .FirstOrDefaultAsync(up => up.User.Username == normalizedUsername, cancellationToken);

        if (profile == null)
        {
            throw new ResourceNotFoundException(ProfileErrorCodes.ProfileNotFound, "Profile not found.");
        }

        // Visibility settings of "private" or "connections" return 404 Not Found for public lookup
        if (string.Equals(profile.ProfileVisibility, "private", StringComparison.OrdinalIgnoreCase) || 
            string.Equals(profile.ProfileVisibility, "connections", StringComparison.OrdinalIgnoreCase))
        {
            throw new ResourceNotFoundException(ProfileErrorCodes.ProfileNotFound, "Profile not found.");
        }

        var socialLinks = profile.SocialLinks;

        var signedAvatarUrl = await GetSignedAvatarUrlAsync(profile.User?.AvatarUrl, cancellationToken);

        var careerPreference = await _context.CareerPreferences
            .FirstOrDefaultAsync(cp => cp.UserId == profile.UserId, cancellationToken);

        PublicCareerPreferenceDto? publicCareerPreference = null;
        if (careerPreference != null)
        {
            var employmentPrefs = careerPreference.EmploymentPreferences ?? new List<string>();
            var preferredLocations = careerPreference.PreferredLocations ?? new List<string>();

            var preferredWorkEnvironments = careerPreference.PreferredWorkEnvironments ?? new List<string>();
            var workStyles = careerPreference.WorkStyles ?? new List<string>();
            var companyValues = careerPreference.CompanyValues ?? new List<string>();
            var desiredJobPositions = careerPreference.DesiredJobPositions ?? new List<string>();

            decimal? expectedSalaryMin = careerPreference.IsExpectedSalaryVisible ? careerPreference.ExpectedSalaryMin : null;
            decimal? expectedSalaryMax = careerPreference.IsExpectedSalaryVisible ? careerPreference.ExpectedSalaryMax : null;
            string? expectedSalaryCurrency = careerPreference.IsExpectedSalaryVisible ? careerPreference.ExpectedSalaryCurrency : null;
            string? expectedSalaryType = careerPreference.IsExpectedSalaryVisible ? careerPreference.ExpectedSalaryType : null;

            publicCareerPreference = new PublicCareerPreferenceDto(
                careerPreference.AvailableForHire,
                careerPreference.PreferredLanguage,
                employmentPrefs,
                preferredWorkEnvironments,
                workStyles,
                companyValues,
                preferredLocations,
                desiredJobPositions,
                expectedSalaryMin,
                expectedSalaryMax,
                expectedSalaryCurrency,
                expectedSalaryType,
                careerPreference.ExpectedSalaryNegotiable,
                careerPreference.IsExpectedSalaryVisible,
                careerPreference.WorkPreferenceNotes
            );
        }

        return new PublicProfileResponse(
            profile.UserId,
            profile.Username ?? profile.User?.Username ?? string.Empty,
            profile.User?.FullName ?? string.Empty,
            signedAvatarUrl,
            profile.Bio,
            profile.Headline,
            profile.Company,
            profile.Location,
            socialLinks,
            publicCareerPreference
        );
    }

    private async Task<string?> GetSignedAvatarUrlAsync(string? avatarUrl, CancellationToken cancellationToken)
    {
        if (string.IsNullOrEmpty(avatarUrl))
        {
            return null;
        }

        if (avatarUrl.StartsWith("http://", StringComparison.OrdinalIgnoreCase) || 
            avatarUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
        {
            return avatarUrl;
        }

        try
        {
            return await _storageService.GetSignedUrlAsync(avatarUrl, TimeSpan.FromHours(24), cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.Log(LogLevel.Warning, "Profile", $"Failed to sign avatar URL: {avatarUrl}", ex);
            return null;
        }
    }

    private static ProfileResponse MapToResponse(UserProfile profile, List<string> socialLinks)
    {
        return new ProfileResponse(
            profile.UserId,
            profile.Username ?? profile.User?.Username,
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
        user.AvatarSource = AvatarSource.Uploaded;
        user.UpdatedAt = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);

        // Generate signed URL
        var signedUrl = await _storageService.GetSignedUrlAsync(
            uploadedFile.ObjectKey,
            TimeSpan.FromHours(24),
            cancellationToken);

        return (signedUrl, uploadedFile.ObjectKey);
    }

    public async Task<(string SignedUrl, string ObjectKey)> SyncAvatarWithProviderAsync(
        Guid userId,
        string providerName,
        CancellationToken cancellationToken = default)
    {
        var canonicalName = providerName.ToLowerInvariant();
        if (canonicalName != "google" && canonicalName != "github" && canonicalName != "gitlab")
        {
            throw new BusinessRuleException("INVALID_PROVIDER", "Unsupported sync provider.");
        }

        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

        if (user == null)
        {
            throw new ResourceNotFoundException("USER_NOT_FOUND", "User not found.");
        }

        var providerAvatarUrl = await _context.Database
            .SqlQueryRaw<string>(
                "SELECT provider_avatar_url AS \"Value\" FROM auth_providers WHERE user_id = {0} AND LOWER(provider_name) = {1} AND deleted_at IS NULL LIMIT 1",
                userId,
                canonicalName)
            .FirstOrDefaultAsync(cancellationToken);

        if (string.IsNullOrEmpty(providerAvatarUrl))
        {
            throw new BusinessRuleException("PROVIDER_AVATAR_MISSING", $"No connected {providerName} account or provider avatar URL found.");
        }

        // Clean up old uploaded file from storage if applicable
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

        user.AvatarUrl = providerAvatarUrl;
        user.AvatarSource = canonicalName switch
        {
            "google" => AvatarSource.Google,
            "github" => AvatarSource.GitHub,
            "gitlab" => AvatarSource.GitLab,
            _ => AvatarSource.Default
        };
        user.UpdatedAt = DateTimeOffset.UtcNow;
        
        await _context.SaveChangesAsync(cancellationToken);

        var log = new AuditLog
        {
            Id = Guid.CreateVersion7(),
            UserId = userId,
            EventType = "SYNC_AVATAR",
            Description = $"Avatar synchronized with provider: {canonicalName}.",
            OldStateJson = JsonSerializer.Serialize(new { Source = "Manual" }),
            NewStateJson = JsonSerializer.Serialize(new { Source = canonicalName, Url = providerAvatarUrl }),
            CreatedAt = DateTimeOffset.UtcNow
        };
        _context.AuditLogs.Add(log);
        await _context.SaveChangesAsync(cancellationToken);

        return (providerAvatarUrl, providerAvatarUrl);
    }

    public async Task DeleteAvatarAsync(
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        if (user == null)
        {
            throw new ResourceNotFoundException("USER_NOT_FOUND", "User not found.");
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

        var oldStateJson = JsonSerializer.Serialize(new { user.AvatarUrl, user.AvatarSource });

        user.AvatarUrl = null;
        user.AvatarSource = AvatarSource.Default;
        user.UpdatedAt = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);

        var log = new AuditLog
        {
            Id = Guid.CreateVersion7(),
            UserId = userId,
            EventType = "DELETE_AVATAR",
            Description = "User avatar deleted.",
            OldStateJson = oldStateJson,
            NewStateJson = JsonSerializer.Serialize(new { AvatarUrl = (string?)null, AvatarSource = AvatarSource.Default }),
            CreatedAt = DateTimeOffset.UtcNow
        };
        _context.AuditLogs.Add(log);
        await _context.SaveChangesAsync(cancellationToken);
    }

    private static List<string> SafeDeserializeList(string? json, string fieldName)
    {
        if (string.IsNullOrEmpty(json))
        {
            return new List<string>();
        }

        try
        {
            return JsonSerializer.Deserialize<List<string>>(json) ?? new List<string>();
        }
        catch (JsonException ex)
        {
            Console.WriteLine($"[JSON Deserialization Warning] Failed to deserialize career preference field '{fieldName}': {ex.Message}. Falling back to empty list.");
            return new List<string>();
        }
    }
}
