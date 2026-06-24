using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Modules.Profiles.DTOs;
using CVerify.API.Modules.Profiles.Entities;
using CVerify.API.Modules.Shared.Exceptions;
using CVerify.API.Modules.Shared.Persistence;

namespace CVerify.API.Modules.Profiles.Services;

public class CareerService : ICareerService
{
    private readonly ApplicationDbContext _context;
    private readonly ICareerReadinessEngine _readinessEngine;

    // Standardized Taxonomies Registries for Validation
    private static readonly HashSet<string> ValidCompanyStages = new(StringComparer.OrdinalIgnoreCase)
    {
        "Bootstrap", "Seed", "Series A", "Series B", "Scaleup", "Enterprise"
    };

    private static readonly HashSet<string> ValidIndustries = new(StringComparer.OrdinalIgnoreCase)
    {
        "Fintech", "Edtech", "Healthtech", "E-commerce", "AI/ML", "SaaS", "Blockchain", "Cybersecurity", "GameDev", "DevOps"
    };

    private static readonly HashSet<string> ValidRoles = new(StringComparer.OrdinalIgnoreCase)
    {
        "Frontend Engineer", "Backend Engineer", "Fullstack Engineer", "DevOps Engineer", "Data Engineer",
        "AI/ML Engineer", "Mobile Engineer", "QA Engineer", "Security Engineer", "System Architect",
        "Tech Lead", "Engineering Manager"
    };

    public CareerService(ApplicationDbContext context, ICareerReadinessEngine readinessEngine)
    {
        _context = context;
        _readinessEngine = readinessEngine;
    }

    public async Task<CareerPreferencesDashboardResponse> GetCareerDashboardAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        // 1. Fetch user declared preferences
        var career = await _context.CareerPreferences
            .FirstOrDefaultAsync(cp => cp.UserId == userId, cancellationToken);

        if (career == null)
        {
            // Verify if user exists
            var userExists = await _context.Users.AnyAsync(u => u.Id == userId, cancellationToken);
            if (!userExists)
            {
                throw new ResourceNotFoundException(ProfileErrorCodes.ProfileNotFound, "User not found.");
            }

            // Create default career preferences
            career = new CareerPreference
            {
                UserId = userId,
                AvailableForHire = true,
                PreferredLanguage = "en",
                OpenToWorkStatus = "casual",
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };

            _context.CareerPreferences.Add(career);
            await _context.SaveChangesAsync(cancellationToken);
        }

        // 2. Fetch AI Inferred Preferences
        var inferred = await _context.AiInferredPreferences
            .FirstOrDefaultAsync(ap => ap.UserId == userId, cancellationToken);

        // 3. Fetch junction details
        var skills = await _context.UserSkills
            .Where(us => us.UserId == userId)
            .Select(us => us.Skill)
            .ToListAsync(cancellationToken);

        var locations = career.PreferredLocations ?? new List<string>();

        var employmentPrefs = career.EmploymentPreferences ?? new List<string>();

        // 4. Calculate Readiness on the fly
        var readinessReport = await _readinessEngine.CalculateReadinessAsync(career, cancellationToken);

        return new CareerPreferencesDashboardResponse(
            MapToDeclaredDto(career, skills, locations, employmentPrefs),
            MapToInferredDto(inferred),
            readinessReport
        );
    }

    public async Task<CareerPreferencesDashboardResponse> UpdateCareerPreferenceAsync(
        Guid userId,
        UpdateCareerPreferenceRequest request,
        CancellationToken cancellationToken = default)
    {
        var career = await _context.CareerPreferences
            .FirstOrDefaultAsync(cp => cp.UserId == userId, cancellationToken);

        if (career == null)
        {
            throw new ResourceNotFoundException(ProfileErrorCodes.ProfileNotFound, "Career preferences not found.");
        }

        // Concurrency Control
        if (career.Version != request.Version)
        {
            throw new ProfileException(ProfileErrorCodes.ProfileConcurrencyConflict, "Career preferences were modified by another process. Please reload and try again.");
        }

        // Validation: Min Salary <= Max Salary
        decimal? finalMin = request.ExpectedSalaryMin ?? career.ExpectedSalaryMin;
        decimal? finalMax = request.ExpectedSalaryMax ?? career.ExpectedSalaryMax;
        if (finalMin.HasValue && finalMax.HasValue && finalMin.Value > finalMax.Value)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                { nameof(request.ExpectedSalaryMax), new[] { "Maximum salary must be greater than or equal to minimum salary." } }
            }, "Minimum expected salary cannot exceed the maximum expected salary.");
        }

        // Validate and normalize tags against registries where relevant
        var preferredWorkEnvironments = ValidateAndNormalizeTags(request.PreferredWorkEnvironments ?? career.PreferredWorkEnvironments, nameof(request.PreferredWorkEnvironments));
        var workStyles = ValidateAndNormalizeTags(request.WorkStyles ?? career.WorkStyles, nameof(request.WorkStyles));
        var companyValues = ValidateAndNormalizeTags(request.CompanyValues ?? career.CompanyValues, nameof(request.CompanyValues));
        var preferredLocations = ValidateAndNormalizeTags(request.PreferredLocations, nameof(request.PreferredLocations));
        var employmentPreferences = ValidateAndNormalizeTags(request.EmploymentPreferences, nameof(request.EmploymentPreferences));
        var skills = ValidateAndNormalizeTags(request.Skills, nameof(request.Skills));

        // Registry check for roles, stages, and industries
        var desiredJobPositions = ValidateAndNormalizeTaxonomy(request.DesiredJobPositions ?? career.DesiredJobPositions, nameof(request.DesiredJobPositions), ValidRoles);
        var companyStages = ValidateAndNormalizeTaxonomy(request.CompanyStagePreferences ?? career.CompanyStagePreferences, nameof(request.CompanyStagePreferences), ValidCompanyStages);
        var preferredIndustries = ValidateAndNormalizeTaxonomy(request.PreferredIndustries ?? career.PreferredIndustries, nameof(request.PreferredIndustries), ValidIndustries);
        var targetSkills = ValidateAndNormalizeTags(request.TargetSkills ?? career.TargetSkills, nameof(request.TargetSkills));

        // Update properties if provided in the PATCH payload
        if (request.AvailableForHire.HasValue) career.AvailableForHire = request.AvailableForHire.Value;
        if (request.PreferredLanguage != null) career.PreferredLanguage = request.PreferredLanguage;
        if (request.JobTitlePreferences != null) career.JobTitlePreferences = request.JobTitlePreferences;
        if (request.SalaryExpectations.HasValue) career.SalaryExpectations = request.SalaryExpectations.Value;
        if (request.RemotePreference != null) career.RemotePreference = request.RemotePreference;
        if (request.OpenToWorkStatus != null) career.OpenToWorkStatus = request.OpenToWorkStatus;
        if (request.OpenToRelocation.HasValue) career.OpenToRelocation = request.OpenToRelocation.Value;
        if (request.LeadershipTrack != null) career.LeadershipTrack = request.LeadershipTrack;

        career.PreferredWorkEnvironments = preferredWorkEnvironments;
        career.WorkStyles = workStyles;
        career.CompanyValues = companyValues;
        career.DesiredJobPositions = desiredJobPositions;
        career.CompanyStagePreferences = companyStages;
        career.PreferredIndustries = preferredIndustries;
        career.TargetSkills = targetSkills;

        if (request.ExpectedSalaryMin.HasValue) career.ExpectedSalaryMin = request.ExpectedSalaryMin;
        if (request.ExpectedSalaryMax.HasValue) career.ExpectedSalaryMax = request.ExpectedSalaryMax;
        if (request.ExpectedSalaryCurrency != null) career.ExpectedSalaryCurrency = request.ExpectedSalaryCurrency;
        if (request.ExpectedSalaryType != null) career.ExpectedSalaryType = request.ExpectedSalaryType;
        if (request.ExpectedSalaryNegotiable.HasValue) career.ExpectedSalaryNegotiable = request.ExpectedSalaryNegotiable.Value;
        if (request.IsExpectedSalaryVisible.HasValue) career.IsExpectedSalaryVisible = request.IsExpectedSalaryVisible.Value;
        if (request.WorkPreferenceNotes != null) career.WorkPreferenceNotes = request.WorkPreferenceNotes;

        career.UpdatedAt = DateTimeOffset.UtcNow;

        // Sync Skills if request skills list was provided
        if (request.Skills != null)
        {
            var existingSkills = await _context.UserSkills
                .Where(us => us.UserId == userId)
                .ToListAsync(cancellationToken);
            _context.UserSkills.RemoveRange(existingSkills);

            foreach (var s in skills)
            {
                var userSkill = new UserSkill
                {
                    Id = Guid.CreateVersion7(),
                    UserId = userId,
                    Skill = s,
                    CreatedAt = DateTimeOffset.UtcNow
                };
                _context.UserSkills.Add(userSkill);
            }
        }

        // Sync Locations if request locations list was provided
        if (request.PreferredLocations != null)
        {
            career.PreferredLocations = preferredLocations;
        }

        // Sync Employment Preferences if request employment preferences list was provided
        if (request.EmploymentPreferences != null)
        {
            career.EmploymentPreferences = employmentPreferences;
        }

        if (request.TargetSkills != null || request.Skills != null)
        {
            var profile = await _context.UserProfiles.FirstOrDefaultAsync(up => up.UserId == userId, cancellationToken);
            if (profile != null)
            {
                profile.LastProfileUpdateAt = DateTimeOffset.UtcNow;
                profile.UpdatedAt = DateTimeOffset.UtcNow;
            }
        }

        try
        {
            await _context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException ex)
        {
            throw new ProfileException(ProfileErrorCodes.ProfileConcurrencyConflict, "A concurrency conflict occurred. Please reload and try again.", ex);
        }

        // Reload junction tables for mapping
        var finalSkills = request.Skills != null ? skills : await _context.UserSkills.Where(us => us.UserId == userId).Select(us => us.Skill).ToListAsync(cancellationToken);
        var finalLocations = request.PreferredLocations != null ? preferredLocations : career.PreferredLocations ?? new List<string>();
        var finalEmpPrefs = request.EmploymentPreferences != null ? employmentPreferences : career.EmploymentPreferences ?? new List<string>();

        var inferred = await _context.AiInferredPreferences.FirstOrDefaultAsync(ap => ap.UserId == userId, cancellationToken);
        var readinessReport = await _readinessEngine.CalculateReadinessAsync(career, cancellationToken);

        return new CareerPreferencesDashboardResponse(
            MapToDeclaredDto(career, finalSkills, finalLocations, finalEmpPrefs),
            MapToInferredDto(inferred),
            readinessReport
        );
    }

    public async Task<CareerPreferencesDashboardResponse> AcceptAiSuggestionsAsync(
        Guid userId,
        AcceptAiSuggestionsRequest request,
        CancellationToken cancellationToken = default)
    {
        var career = await _context.CareerPreferences
            .FirstOrDefaultAsync(cp => cp.UserId == userId, cancellationToken);

        if (career == null)
        {
            throw new ResourceNotFoundException(ProfileErrorCodes.ProfileNotFound, "Career preferences not found.");
        }

        if (career.Version != request.Version)
        {
            throw new ProfileException(ProfileErrorCodes.ProfileConcurrencyConflict, "Career preferences were modified by another process. Please reload and try again.");
        }

        var inferred = await _context.AiInferredPreferences
            .FirstOrDefaultAsync(ap => ap.UserId == userId, cancellationToken);

        if (inferred == null)
        {
            throw new ResourceNotFoundException(ProfileErrorCodes.ProfileNotFound, "AI recommendations not found.");
        }

        bool updated = false;

        if (request.AcceptRoles && !string.IsNullOrWhiteSpace(inferred.InferredPrimaryRole))
        {
            var currentRoles = career.DesiredJobPositions ?? new List<string>();
            if (!currentRoles.Any(r => string.Equals(r, inferred.InferredPrimaryRole, StringComparison.OrdinalIgnoreCase)))
            {
                // Capitalize and add
                var matchedRole = ValidRoles.FirstOrDefault(vr => string.Equals(vr, inferred.InferredPrimaryRole, StringComparison.OrdinalIgnoreCase)) ?? inferred.InferredPrimaryRole;
                career.DesiredJobPositions = currentRoles.Concat(new[] { matchedRole }).ToList();
                updated = true;
            }
        }

        if (request.AcceptSkills && inferred.InferredSkills != null && inferred.InferredSkills.Any())
        {
            var currentSkills = career.TargetSkills ?? new List<string>();
            var newSkills = inferred.InferredSkills
                .Where(infSkill => !currentSkills.Any(curSkill => string.Equals(curSkill, infSkill, StringComparison.OrdinalIgnoreCase)));

            if (newSkills.Any())
            {
                career.TargetSkills = currentSkills.Concat(newSkills).ToList();
                updated = true;
            }
        }

        if (updated)
        {
            career.UpdatedAt = DateTimeOffset.UtcNow;

            if (request.AcceptSkills && inferred.InferredSkills != null && inferred.InferredSkills.Any())
            {
                var profile = await _context.UserProfiles.FirstOrDefaultAsync(up => up.UserId == userId, cancellationToken);
                if (profile != null)
                {
                    profile.LastProfileUpdateAt = DateTimeOffset.UtcNow;
                    profile.UpdatedAt = DateTimeOffset.UtcNow;
                }
            }

            try
            {
                await _context.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateConcurrencyException ex)
            {
                throw new ProfileException(ProfileErrorCodes.ProfileConcurrencyConflict, "A concurrency conflict occurred. Please reload and try again.", ex);
            }
        }

        var skills = await _context.UserSkills.Where(us => us.UserId == userId).Select(us => us.Skill).ToListAsync(cancellationToken);
        var locations = career.PreferredLocations ?? new List<string>();
        var employmentPrefs = career.EmploymentPreferences ?? new List<string>();

        var readinessReport = await _readinessEngine.CalculateReadinessAsync(career, cancellationToken);

        return new CareerPreferencesDashboardResponse(
            MapToDeclaredDto(career, skills, locations, employmentPrefs),
            MapToInferredDto(inferred),
            readinessReport
        );
    }

    private static DeclaredCareerPreferenceDto MapToDeclaredDto(
        CareerPreference career,
        List<string> skills,
        List<string> locations,
        List<string> employmentPrefs)
    {
        return new DeclaredCareerPreferenceDto(
            career.UserId,
            career.AvailableForHire,
            career.PreferredLanguage,
            career.JobTitlePreferences,
            career.SalaryExpectations,
            career.RemotePreference,
            career.OpenToWorkStatus,
            career.OpenToRelocation,
            career.LeadershipTrack,
            career.CompanyStagePreferences ?? new List<string>(),
            career.PreferredIndustries ?? new List<string>(),
            career.TargetSkills ?? new List<string>(),
            career.PreferredWorkEnvironments ?? new List<string>(),
            career.WorkStyles ?? new List<string>(),
            career.CompanyValues ?? new List<string>(),
            career.ExpectedSalaryMin,
            career.ExpectedSalaryMax,
            career.ExpectedSalaryCurrency,
            career.ExpectedSalaryType,
            career.ExpectedSalaryNegotiable,
            career.IsExpectedSalaryVisible,
            career.WorkPreferenceNotes,
            career.DesiredJobPositions ?? new List<string>(),
            skills,
            locations,
            employmentPrefs,
            career.Version
        );
    }

    private static AiInferredPreferenceDto? MapToInferredDto(AiInferredPreference? inferred)
    {
        if (inferred == null) return null;
        return new AiInferredPreferenceDto(
            inferred.InferredPrimaryRole,
            inferred.InferredSeniority,
            inferred.InferredSkills ?? new List<string>(),
            inferred.InferredSalaryMin,
            inferred.InferredSalaryMax,
            inferred.InferredSalaryCurrency,
            inferred.InferredIndustries ?? new List<string>(),
            inferred.ConfidenceScore,
            inferred.SynthesisRationale,
            inferred.LastAnalyzedAt
        );
    }

    private static List<string> ValidateAndNormalizeTaxonomy(List<string>? tags, string fieldName, HashSet<string> validRegistry)
    {
        var normalized = ValidateAndNormalizeTags(tags, fieldName);
        if (normalized == null || !normalized.Any()) return new List<string>();

        var matched = new List<string>();
        foreach (var tag in normalized)
        {
            var match = validRegistry.FirstOrDefault(r => string.Equals(r, tag, StringComparison.OrdinalIgnoreCase));
            if (match == null)
            {
                throw new ValidationException(new Dictionary<string, string[]>
                {
                    { fieldName, new[] { $"'{tag}' is not a recognized option for {fieldName}." } }
                }, $"Invalid selection for {fieldName}.");
            }
            matched.Add(match);
        }

        return matched;
    }

    private static List<string> ValidateAndNormalizeTags(List<string>? tags, string fieldName)
    {
        if (tags == null) return new List<string>();

        if (tags.Count > 20)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                { fieldName, new[] { "Maximum of 20 items is allowed." } }
            }, "Preference list exceeds maximum items limit.");
        }

        var normalized = new List<string>();
        foreach (var tag in tags)
        {
            if (string.IsNullOrWhiteSpace(tag))
            {
                throw new ValidationException(new Dictionary<string, string[]>
                {
                    { fieldName, new[] { "Preference tag cannot be empty or whitespace." } }
                }, "Invalid preference tag.");
            }

            var trimmed = tag.Trim();
            if (trimmed.Length > 100)
            {
                throw new ValidationException(new Dictionary<string, string[]>
                {
                    { fieldName, new[] { $"Preference tag '{trimmed}' exceeds maximum length of 100 characters." } }
                }, "Preference tag too long.");
            }

            if (normalized.Any(t => string.Equals(t, trimmed, StringComparison.OrdinalIgnoreCase)))
            {
                throw new ValidationException(new Dictionary<string, string[]>
                {
                    { fieldName, new[] { $"Duplicate preference tag '{trimmed}' is not allowed." } }
                }, "Duplicate preference tag.");
            }

            normalized.Add(trimmed);
        }

        return normalized;
    }
}
