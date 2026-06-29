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
using CVerify.API.Modules.Shared.System.DTOs;
using CVerify.API.Modules.SourceCode.Entities;

namespace CVerify.API.Modules.Profiles.Services;

public class ProfileService : IProfileService
{
    private readonly ApplicationDbContext _context;
    private readonly ICacheService _cacheService;
    private readonly IStorageService _storageService;
    private readonly IUsernameService _usernameService;
    private readonly TimeProvider _timeProvider;
    private readonly IAppLogger _logger;
    private readonly IProjectService _projectService;
    private readonly ICvRepositoryIndexer _cvRepositoryIndexer;

    public ProfileService(
        ApplicationDbContext context,
        ICacheService cacheService,
        IStorageService storageService,
        IUsernameService usernameService,
        TimeProvider timeProvider,
        IAppLogger logger,
        IProjectService projectService,
        ICvRepositoryIndexer cvRepositoryIndexer)
    {
        _context = context;
        _cacheService = cacheService;
        _storageService = storageService;
        _usernameService = usernameService;
        _timeProvider = timeProvider;
        _logger = logger;
        _projectService = projectService;
        _cvRepositoryIndexer = cvRepositoryIndexer;
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
        profile.AiSuggestionsJson = request.AiSuggestionsJson;
        profile.UpdatedAt = DateTimeOffset.UtcNow;
        profile.LastProfileUpdateAt = DateTimeOffset.UtcNow;

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

        try
        {
            await _cvRepositoryIndexer.IndexUserCvRepositoriesAsync(userId, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.Log(LogLevel.Warning, "Profile", $"Failed to index CV repositories during profile update for user {userId}.", ex);
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
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Username == normalizedUsername, cancellationToken);
            if (user == null)
            {
                throw new ResourceNotFoundException(ProfileErrorCodes.ProfileNotFound, "Profile not found.");
            }

            profile = new UserProfile
            {
                UserId = user.Id,
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

        var publicRepos = await _context.SourceCodeRepositories
            .FromSqlRaw(@"
                SELECT r.* 
                FROM source_code_repositories r
                INNER JOIN auth_providers ap ON r.auth_provider_id = ap.id
                WHERE ap.user_id = {0} 
                  AND ap.deleted_at IS NULL
                  AND r.latest_analysis_status = 'Completed'
                  AND r.is_private = FALSE
                  AND r.is_enabled = TRUE
                  AND r.is_accessible = TRUE
                ORDER BY r.latest_analysis_completed_at_utc DESC", 
                profile.UserId)
            .ToListAsync(cancellationToken);

        var latestAssessment = await _context.CandidateAssessments
            .Where(ca => ca.UserId == profile.UserId && ca.Status == "Completed")
            .OrderByDescending(ca => ca.CompletedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);

        bool hasCompletedAssessment = latestAssessment != null;
        DateTimeOffset? lastAssessmentDate = latestAssessment?.CompletedAtUtc;

        double? avgTrustScore = null;
        if (hasCompletedAssessment && latestAssessment != null)
        {
            // Maps to EvidenceTrustScore (TrustLevel) according to domain naming contract
            avgTrustScore = latestAssessment.TrustLevel;
        }

        var publicRepoDtos = publicRepos.Select(r => new PublicRepositoryDto(
            r.Id,
            r.Name,
            r.Owner,
            r.Description,
            r.HtmlUrl,
            r.PrimaryLanguage,
            r.TrustScore,
            r.Classification,
            r.LatestAnalysisStatus,
            r.LatestAnalysisCompletedAtUtc
        )).ToList();

        await _projectService.UpgradeRepositoryLinkedProjectsAsync(profile.UserId, cancellationToken);

        var projects = await _context.ProjectEntries
            .Include(p => p.RepositoryLinks)
                .ThenInclude(l => l.SourceCodeRepository)
            .Include(p => p.Technologies)
            .Include(p => p.Contributions)
            .Where(p => p.UserId == profile.UserId)
            .OrderBy(p => p.DisplayOrder)
            .ToListAsync(cancellationToken);

        var publicProjectDtos = projects.Select(p => new PublicProjectDto(
            p.Id,
            p.Name,
            p.Role,
            p.Description,
            p.StartDate,
            p.EndDate,
            p.IsCurrentlyWorking,
            p.VerificationLevel,
            p.VerificationStatus,
            p.VerifiedAt,
            p.VerificationMetadataJson,
            p.DisplayOrder,
            p.RepositoryLinks.Select(l => new PublicProjectRepositoryLinkDto(
                l.Id,
                l.SourceCodeRepositoryId,
                l.SourceCodeRepository?.Name ?? string.Empty,
                l.SourceCodeRepository?.Owner ?? string.Empty,
                l.SourceCodeRepository?.HtmlUrl
            )).ToList(),
            p.Technologies.Select(t => t.Name).ToList(),
            p.Contributions.Select(c => c.Content).ToList()
        )).ToList();

        // Retrieve Experiences (optimized N+1 query)
        var experiences = await _context.WorkExperiences
            .Include(we => we.Achievements)
            .Include(we => we.Technologies)
            .Include(we => we.Links)
            .Where(we => we.UserId == profile.UserId && we.DeletedAt == null)
            .OrderBy(we => we.DisplayOrder)
            .ThenByDescending(we => we.StartDate)
            .ToListAsync(cancellationToken);

        var experienceResponses = experiences.Select(we => new WorkExperienceResponse(
            we.Id,
            we.UserId,
            we.JobTitle,
            we.Company,
            (int)we.ExperienceCategory,
            (int)we.EmploymentType,
            we.Location,
            we.StartDate,
            we.EndDate,
            we.IsCurrentlyWorking,
            we.Description,
            we.DisplayOrder,
            we.Achievements.Select(a => new WorkExperienceAchievementDto(a.Title, a.Description)).ToList(),
            we.Technologies.Select(t => t.Name).ToList(),
            we.Links.Select(l => new WorkExperienceLinkDto((int)l.LinkType, l.Url)).ToList(),
            we.IsLeadership
        )).ToList();

        // Retrieve Educations
        var educations = await _context.EducationEntries
            .Where(ee => ee.UserId == profile.UserId && ee.DeletedAt == null)
            .OrderBy(ee => ee.DisplayOrder)
            .ThenByDescending(ee => ee.StartDate)
            .ToListAsync(cancellationToken);

        var educationResponses = educations.Select(ee => new EducationEntryResponse(
            ee.Id,
            ee.UserId,
            ee.Label,
            ee.SchoolName,
            ee.Degree,
            ee.Major,
            ee.GPA,
            ee.GPAScale,
            ee.Description,
            ee.StartDate,
            ee.EndDate,
            ee.IsCurrentlyStudying,
            ee.DisplayOrder
        )).ToList();

        // Retrieve AcademicAchievements & related ProfileAttachments (optimized batch query)
        var achievements = await _context.AcademicAchievements
            .Where(aa => aa.UserId == profile.UserId && aa.DeletedAt == null)
            .OrderBy(aa => aa.DisplayOrder)
            .ThenByDescending(aa => aa.IssueDate)
            .ToListAsync(cancellationToken);

        var achievementIds = achievements.Select(aa => aa.Id).ToList();

        var attachments = await _context.ProfileAttachments
            .Where(pa => pa.UserId == profile.UserId && pa.EntityType == "AcademicAchievement" && pa.EntityId.HasValue && achievementIds.Contains(pa.EntityId.Value) && pa.DeletedAt == null)
            .ToListAsync(cancellationToken);

        var achievementResponses = new List<AcademicAchievementResponse>();
        foreach (var aa in achievements)
        {
            var att = attachments.FirstOrDefault(pa => pa.EntityId == aa.Id);
            AttachmentResponse? attResponse = null;

            if (att != null)
            {
                string signedUrl;
                try
                {
                    signedUrl = await _storageService.GetSignedUrlAsync(att.FilePath, TimeSpan.FromHours(1), cancellationToken);
                }
                catch
                {
                    signedUrl = string.Empty;
                }

                attResponse = new AttachmentResponse(
                    att.Id,
                    att.FileName,
                    att.FileSize,
                    att.FileType,
                    signedUrl,
                    att.CreatedAt
                );
            }

            achievementResponses.Add(new AcademicAchievementResponse(
                aa.Id,
                aa.UserId,
                aa.Title,
                aa.Issuer,
                aa.IssueDate,
                aa.Description,
                aa.CredentialUrl,
                aa.DisplayOrder,
                attResponse
            ));
        }

        // Retrieve published jobs for the recruiter's organizations
        var organizationIds = await _context.OrganizationMemberships
            .Where(om => om.UserId == profile.UserId && om.Status == "active")
            .Select(om => om.OrganizationId)
            .ToListAsync(cancellationToken);

        var publishedVacancies = new List<JobVacancyDto>();
        if (organizationIds.Any())
        {
            var vacancies = await _context.JobVacancies
                .Include(jv => jv.Organization)
                .Where(jv => organizationIds.Contains(jv.OrganizationId) && jv.IsActive && jv.Status == "Published")
                .OrderByDescending(jv => jv.CreatedAt)
                .ToListAsync(cancellationToken);

            foreach (var jv in vacancies)
            {
                var signedCoverUrl = await GetSignedVacancyUrlAsync(jv.CoverUrl, cancellationToken) ?? jv.CoverUrl;
                var signedImages = new List<string>();
                if (jv.Images != null)
                {
                    foreach (var img in jv.Images)
                    {
                        var signedImg = await GetSignedVacancyUrlAsync(img, cancellationToken);
                        if (signedImg != null) signedImages.Add(signedImg);
                    }
                }

                publishedVacancies.Add(new JobVacancyDto(
                    jv.Id,
                    jv.OrganizationId,
                    jv.Title,
                    jv.Department,
                    jv.WorkplaceType,
                    jv.City,
                    jv.Type,
                    jv.Salary,
                    jv.SalaryMinMax,
                    jv.Headcount,
                    jv.Gender,
                    jv.Experience,
                    jv.Degree,
                    jv.Category,
                    jv.Description,
                    jv.Requirements,
                    jv.Benefits,
                    jv.Tags,
                    jv.Skills,
                    signedCoverUrl,
                    signedImages,
                    jv.IsActive,
                    jv.CreatedAt,
                    jv.UpdatedAt,
                    jv.Status,
                    jv.AcquisitionStrategy,
                    jv.DiscoveryProfileJson,
                    jv.RequirementSnapshotId,
                    jv.HiringRequirementId,
                    jv.Organization?.Username
                ));
            }
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
            publicCareerPreference,
            avgTrustScore,
            publicRepoDtos,
            publicProjectDtos,
            experienceResponses,
            educationResponses,
            achievementResponses,
            hasCompletedAssessment,
            lastAssessmentDate,
            publishedVacancies
        );
    }

    private async Task<string?> GetSignedVacancyUrlAsync(string? url, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrEmpty(url))
        {
            return null;
        }

        if (url.StartsWith("http://", StringComparison.OrdinalIgnoreCase) || 
            url.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
        {
            return url;
        }

        try
        {
            return await _storageService.GetSignedUrlAsync(url, TimeSpan.FromHours(24), cancellationToken);
        }
        catch
        {
            return null;
        }
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
            profile.AiSuggestionsJson,
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
            .OrderBy(v => v)
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

    public async Task<PaginatedResultDto<RankingResponseItemDto>> GetRankingAsync(
        Guid? currentUserId, 
        RankingQueryDto query, 
        CancellationToken cancellationToken = default)
    {
        var dbQuery = _context.CandidateRankingProjections.AsQueryable();

        // 1. Apply search filter
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var searchLower = query.Search.ToLower();
            dbQuery = dbQuery.Where(p => 
                p.FullName.ToLower().Contains(searchLower) ||
                (p.Username != null && p.Username.ToLower().Contains(searchLower)) ||
                (p.Headline != null && p.Headline.ToLower().Contains(searchLower)) ||
                (p.Bio != null && p.Bio.ToLower().Contains(searchLower)));
        }

        // 2. Apply location filter
        if (!string.IsNullOrWhiteSpace(query.Location))
        {
            var locLower = query.Location.ToLower();
            dbQuery = dbQuery.Where(p => p.Location != null && p.Location.ToLower().Contains(locLower));
        }

        // 3. Apply AvailableForHire filter
        if (query.AvailableForHire.HasValue)
        {
            dbQuery = dbQuery.Where(p => p.AvailableForHire == query.AvailableForHire.Value);
        }

        // 4. Apply ExperienceLevels filter
        if (query.ExperienceLevels != null && query.ExperienceLevels.Any())
        {
            var expLower = query.ExperienceLevels.Select(l => l.ToLower()).ToList();
            dbQuery = dbQuery.Where(p => p.CareerLevelLabel != null && expLower.Contains(p.CareerLevelLabel.ToLower()));
        }

        // 5. Apply TrustTiers filter
        if (query.TrustTiers != null && query.TrustTiers.Any())
        {
            dbQuery = dbQuery.Where(p => 
                (query.TrustTiers.Contains("HighTrust") && p.TrustScore >= 85) ||
                (query.TrustTiers.Contains("EvidenceVerified") && p.TrustScore >= 60 && p.TrustScore < 85) ||
                (query.TrustTiers.Contains("BasicVerified") && p.TrustScore >= 30 && p.TrustScore < 60) ||
                (query.TrustTiers.Contains("Unverified") && p.TrustScore < 30)
            );
        }

        // Fetch all matching projections
        var items = await dbQuery.ToListAsync(cancellationToken).ConfigureAwait(false);

        // 6. Apply Skills filter in-memory (matches in TopCapabilitiesJson)
        if (query.Skills != null && query.Skills.Any())
        {
            foreach (var skill in query.Skills)
            {
                var skillLower = skill.ToLower();
                items = items.Where(p => p.TopCapabilitiesJson != null && p.TopCapabilitiesJson.ToLower().Contains(skillLower)).ToList();
            }
        }

        // 7. Dynamic follows state for current user
        var followedUserIds = new HashSet<Guid>();
        if (currentUserId.HasValue)
        {
            var follows = await _context.UserFollowers
                .Where(uf => uf.FollowerId == currentUserId.Value)
                .Select(uf => uf.FolloweeId)
                .ToListAsync(cancellationToken)
                .ConfigureAwait(false);
            followedUserIds = new HashSet<Guid>(follows);
        }

        // 8. Dynamic assessment completion dates for Trending category
        var assessmentDates = new Dictionary<Guid, DateTimeOffset>();
        if (string.Equals(query.Category, "Trending", StringComparison.OrdinalIgnoreCase))
        {
            var userIds = items.Select(i => i.CandidateId).ToList();
            var dates = await _context.CandidateAssessments
                .Where(ca => userIds.Contains(ca.UserId) && ca.Status == "Completed")
                .GroupBy(ca => ca.UserId)
                .Select(g => new { UserId = g.Key, CompletedAtUtc = g.Max(ca => ca.CompletedAtUtc) })
                .ToDictionaryAsync(x => x.UserId, x => x.CompletedAtUtc ?? DateTimeOffset.UtcNow.AddDays(-30), cancellationToken)
                .ConfigureAwait(false);
            assessmentDates = dates;
        }

        // 9. Sort results in memory
        IEnumerable<CandidateRankingProjection> sortedItems;
        switch (query.Category?.ToLowerInvariant())
        {
            case "trending":
                sortedItems = items.OrderByDescending(p =>
                {
                    var lastDate = assessmentDates.TryGetValue(p.CandidateId, out var dt) ? dt : DateTimeOffset.UtcNow.AddDays(-30);
                    var days = Math.Max(1.0, (DateTimeOffset.UtcNow - lastDate).TotalDays);
                    return (p.CompositeScore * 0.70) + (p.FollowersCount * 2.0) + (100.0 / days);
                });
                break;
            case "topcontributors":
                sortedItems = items
                    .OrderByDescending(p => p.EvidenceTrustScore)
                    .ThenByDescending(p => p.TotalStarsCount)
                    .ThenByDescending(p => p.CompositeScore);
                break;
            case "topverified":
                sortedItems = items.OrderByDescending(p =>
                {
                    var tierVal = p.TrustScore switch
                    {
                        >= 85 => 4,
                        >= 60 => 3,
                        >= 30 => 2,
                        _ => 1
                    };
                    return tierVal;
                }).ThenByDescending(p => p.TrustScore);
                break;
            case "mostfollowed":
                sortedItems = items.OrderByDescending(p => p.FollowersCount);
                break;
            case "highesttrust":
                sortedItems = items.OrderByDescending(p => p.TrustScore);
                break;
            case "topai":
                sortedItems = items.OrderByDescending(p => p.AiScore);
                break;
            case "global":
            default:
                sortedItems = items.OrderBy(p => p.GlobalRankPosition == 0 ? int.MaxValue : p.GlobalRankPosition);
                break;
        }

        var sortedList = sortedItems.ToList();
        int totalCount = sortedList.Count;

        // Paginate
        var pageItems = sortedList
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToList();

        // 10. Map to DTOs & sign avatars
        var responseItems = new List<RankingResponseItemDto>();
        foreach (var item in pageItems)
        {
            var signedAvatarUrl = await GetSignedAvatarUrlAsync(item.AvatarUrl, cancellationToken).ConfigureAwait(false);
            
            // Deserialize capabilities list
            var capabilities = new List<CapabilityDto>();
            if (!string.IsNullOrEmpty(item.TopCapabilitiesJson))
            {
                try
                {
                    capabilities = JsonSerializer.Deserialize<List<CapabilityDto>>(item.TopCapabilitiesJson) ?? new List<CapabilityDto>();
                }
                catch
                {
                    // Fallback to empty list
                }
            }

            responseItems.Add(new RankingResponseItemDto(
                item.CandidateId,
                item.FullName,
                item.Username,
                item.Bio,
                item.Headline,
                item.Location,
                signedAvatarUrl,
                item.CompositeScore,
                item.AiScore,
                item.TrustScore,
                item.ProfileCompleteness,
                item.EvidenceTrustScore,
                item.VerifiedRepoCount,
                item.TotalStarsCount,
                item.TotalForksCount,
                item.VerifiedContributionCount,
                capabilities,
                item.PrimaryDomain,
                item.CareerLevelLabel,
                item.FollowersCount,
                item.FollowingCount,
                item.AvailableForHire,
                item.OpenToWorkStatus,
                item.GlobalRankPosition,
                item.PreviousGlobalRankPosition,
                followedUserIds.Contains(item.CandidateId),
                item.LastUpdatedAt
            ));
        }

        return new PaginatedResultDto<RankingResponseItemDto>(
            responseItems,
            totalCount,
            query.Page,
            query.PageSize
        );
    }

    public async Task FollowUserAsync(
        Guid followerId, 
        string usernameToFollow, 
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(usernameToFollow))
        {
            throw new ResourceNotFoundException("USER_NOT_FOUND", "Candidate to follow not found.");
        }

        var normalizedUsername = _usernameService.Normalize(usernameToFollow);

        var followee = await _context.Users
            .FirstOrDefaultAsync(u => u.Username == normalizedUsername && u.DeletedAt == null, cancellationToken)
            .ConfigureAwait(false);

        if (followee == null)
        {
            throw new ResourceNotFoundException("USER_NOT_FOUND", "Candidate to follow not found.");
        }

        if (followee.Id == followerId)
        {
            throw new BusinessRuleException("SELF_FOLLOW_NOT_ALLOWED", "You cannot follow your own profile.");
        }

        // Check if already followed
        var alreadyFollowing = await _context.UserFollowers
            .AnyAsync(uf => uf.FollowerId == followerId && uf.FolloweeId == followee.Id, cancellationToken)
            .ConfigureAwait(false);

        if (alreadyFollowing)
        {
            return; // Idempotent success
        }

        var follower = await _context.Users.FindAsync(new object[] { followerId }, cancellationToken).ConfigureAwait(false);
        if (follower == null)
        {
            throw new ResourceNotFoundException("USER_NOT_FOUND", "Follower user not found.");
        }

        var followRecord = new UserFollower
        {
            FollowerId = followerId,
            FolloweeId = followee.Id,
            FollowedAt = DateTimeOffset.UtcNow
        };

        _context.UserFollowers.Add(followRecord);

        // Responsive increment: Update the projection cache immediately
        var followeeProj = await _context.CandidateRankingProjections
            .FirstOrDefaultAsync(p => p.CandidateId == followee.Id, cancellationToken)
            .ConfigureAwait(false);
        if (followeeProj != null)
        {
            followeeProj.FollowersCount++;
        }

        var followerProj = await _context.CandidateRankingProjections
            .FirstOrDefaultAsync(p => p.CandidateId == followerId, cancellationToken)
            .ConfigureAwait(false);
        if (followerProj != null)
        {
            followerProj.FollowingCount++;
        }

        await _context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }

    public async Task UnfollowUserAsync(
        Guid followerId, 
        string usernameToUnfollow, 
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(usernameToUnfollow))
        {
            throw new ResourceNotFoundException("USER_NOT_FOUND", "Candidate to unfollow not found.");
        }

        var normalizedUsername = _usernameService.Normalize(usernameToUnfollow);

        var followee = await _context.Users
            .FirstOrDefaultAsync(u => u.Username == normalizedUsername && u.DeletedAt == null, cancellationToken)
            .ConfigureAwait(false);

        if (followee == null)
        {
            throw new ResourceNotFoundException("USER_NOT_FOUND", "Candidate to unfollow not found.");
        }

        var followRecord = await _context.UserFollowers
            .FirstOrDefaultAsync(uf => uf.FollowerId == followerId && uf.FolloweeId == followee.Id, cancellationToken)
            .ConfigureAwait(false);

        if (followRecord == null)
        {
            return; // Idempotent success
        }

        _context.UserFollowers.Remove(followRecord);

        // Responsive decrement: Update the projection cache immediately
        var followeeProj = await _context.CandidateRankingProjections
            .FirstOrDefaultAsync(p => p.CandidateId == followee.Id, cancellationToken)
            .ConfigureAwait(false);
        if (followeeProj != null && followeeProj.FollowersCount > 0)
        {
            followeeProj.FollowersCount--;
        }

        var followerProj = await _context.CandidateRankingProjections
            .FirstOrDefaultAsync(p => p.CandidateId == followerId, cancellationToken)
            .ConfigureAwait(false);
        if (followerProj != null && followerProj.FollowingCount > 0)
        {
            followerProj.FollowingCount--;
        }

        await _context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }

    public async Task<RankingStatsDto> GetRankingStatsAsync(CancellationToken cancellationToken = default)
    {
        // 1. Total talents count
        var totalTalents = await _context.CandidateRankingProjections.CountAsync(cancellationToken).ConfigureAwait(false);

        // 2. Sum of verified repositories (SourceCodeRepositories count that are verified)
        var totalRepositories = await _context.SourceCodeRepositories.CountAsync(r => r.IsVerified, cancellationToken).ConfigureAwait(false);

        // 3. Country/Geography count (unique geographies represented)
        var totalCountries = await _context.CandidateRankingProjections
            .Where(p => p.Location != null && p.Location != "")
            .Select(p => p.Location)
            .Distinct()
            .CountAsync(cancellationToken)
            .ConfigureAwait(false);

        // 4. Top Technologies (from candidate capabilities, fallback to .NET, TypeScript, Java, Python, Go)
        var topTechs = await _context.CandidateCapabilities
            .Include(cc => cc.CapabilityNode)
            .Where(cc => cc.CapabilityNode.Category == "Language" || cc.CapabilityNode.Category == "Framework" || cc.CapabilityNode.Category == "Library")
            .GroupBy(cc => cc.CapabilityNode.Name)
            .OrderByDescending(g => g.Count())
            .Select(g => g.Key)
            .Take(5)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);



        // 5. Fastest Rising Skills (from recently evaluated capability scores, fallback to AI Engineering, Agent Systems, Cloud Architecture, DevOps, MLOps)
        var risingSkills = await _context.CandidateCapabilities
            .Include(cc => cc.Score)
            .Include(cc => cc.CapabilityNode)
            .Where(cc => cc.Score != null && cc.Score.CalculatedAt >= DateTimeOffset.UtcNow.AddDays(-30))
            .GroupBy(cc => cc.CapabilityNode.Name)
            .OrderByDescending(g => g.Average(cc => cc.Score!.ProficiencyScore))
            .Select(g => g.Key)
            .Take(5)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);



        // 6. Trending Engineers (highest positive rank delta: PreviousGlobalRankPosition - GlobalRankPosition)
        var trendingCandidates = await _context.CandidateRankingProjections
            .Where(p => p.PreviousGlobalRankPosition > 0 && p.GlobalRankPosition > 0)
            .Select(p => new {
                Projection = p,
                Delta = p.PreviousGlobalRankPosition - p.GlobalRankPosition
            })
            .Where(x => x.Delta > 0)
            .OrderByDescending(x => x.Delta)
            .ThenByDescending(x => x.Projection.CompositeScore)
            .Select(x => x.Projection)
            .Take(5)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        if (trendingCandidates.Count < 5)
        {
            var existingIds = trendingCandidates.Select(t => t.CandidateId).ToList();
            var fallbackCandidates = await _context.CandidateRankingProjections
                .Where(p => !existingIds.Contains(p.CandidateId))
                .OrderByDescending(p => p.CompositeScore)
                .Take(5 - trendingCandidates.Count)
                .ToListAsync(cancellationToken)
                .ConfigureAwait(false);
            trendingCandidates.AddRange(fallbackCandidates);
        }

        var trendingDtos = new List<TrendingEngineerDto>();
        foreach (var tc in trendingCandidates)
        {
            var signedAvatarUrl = await GetSignedAvatarUrlAsync(tc.AvatarUrl, cancellationToken).ConfigureAwait(false);
            var delta = tc.PreviousGlobalRankPosition > 0 ? tc.PreviousGlobalRankPosition - tc.GlobalRankPosition : 0;
            trendingDtos.Add(new TrendingEngineerDto(
                tc.CandidateId,
                tc.FullName,
                tc.Username,
                signedAvatarUrl,
                tc.CompositeScore,
                tc.GlobalRankPosition,
                tc.PreviousGlobalRankPosition,
                delta
            ));
        }

        var averageTrustScore = await _context.CandidateRankingProjections.AnyAsync(cancellationToken).ConfigureAwait(false)
            ? await _context.CandidateRankingProjections.AverageAsync(p => p.TrustScore, cancellationToken).ConfigureAwait(false)
            : 0.0;
        averageTrustScore = Math.Round(averageTrustScore, 1);

        var averageCapabilityScore = await _context.CandidateRankingProjections.AnyAsync(cancellationToken).ConfigureAwait(false)
            ? await _context.CandidateRankingProjections.AverageAsync(p => p.AiScore, cancellationToken).ConfigureAwait(false)
            : 0.0;
        averageCapabilityScore = Math.Round(averageCapabilityScore, 1);

        var reposData = await _context.CandidateRankingProjections
            .Select(p => new { p.TotalStarsCount, p.TotalForksCount, p.VerifiedRepoCount })
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        double averageRepositoryImpact = 0.0;
        if (reposData.Any())
        {
            averageRepositoryImpact = reposData.Average(p => 
                CVerify.API.Modules.Intelligence.Services.CandidateRankingCalculator.CalculateRepositoryImpactScore(
                    p.TotalStarsCount, p.TotalForksCount, p.VerifiedRepoCount));
        }
        averageRepositoryImpact = Math.Round(averageRepositoryImpact, 1);

        var totalActiveProfiles = await _context.UserProfiles
            .CountAsync(up => up.DeletedAt == null &&
                              up.User.DeletedAt == null &&
                              up.User.Status == UserStatus.ACTIVE, cancellationToken)
            .ConfigureAwait(false);

        var verificationRate = totalActiveProfiles > 0
            ? Math.Round((double)totalTalents / totalActiveProfiles * 100.0, 1)
            : 0.0;

        var averageCompositeScore = await _context.CandidateRankingProjections.AnyAsync(cancellationToken).ConfigureAwait(false)
            ? await _context.CandidateRankingProjections.AverageAsync(p => p.CompositeScore, cancellationToken).ConfigureAwait(false)
            : 0.0;
        averageCompositeScore = Math.Round(averageCompositeScore, 1);

        return new RankingStatsDto(
            totalTalents,
            totalRepositories,
            totalCountries,
            topTechs,
            risingSkills,
            trendingDtos,
            averageTrustScore,
            averageCapabilityScore,
            averageRepositoryImpact,
            verificationRate,
            averageCompositeScore
        );
    }
}
