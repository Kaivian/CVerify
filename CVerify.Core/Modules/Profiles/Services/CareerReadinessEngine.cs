using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Modules.Profiles.DTOs;
using CVerify.API.Modules.Profiles.Entities;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.SourceCode.Entities;

namespace CVerify.API.Modules.Profiles.Services;

public class CareerReadinessEngine : ICareerReadinessEngine
{
    private readonly ApplicationDbContext _context;

    public CareerReadinessEngine(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<CareerReadinessReportDto> CalculateReadinessAsync(
        CareerPreference career,
        CancellationToken cancellationToken = default)
    {
        if (career == null)
        {
            return new CareerReadinessReportDto(0, "Low", 0, new List<CareerReadinessActionItem>());
        }

        var actionItems = new List<CareerReadinessActionItem>();

        // 1. Fetch UserProfile to check Name, Bio, and Headline
        var userId = career.UserId;
        var profile = await _context.UserProfiles
            .Include(u => u.User)
            .FirstOrDefaultAsync(u => u.UserId == userId, cancellationToken);

        // Calculate Completeness Percent (0-100)
        int completeness = 0;

        // 1. Full Name (5%)
        if (!string.IsNullOrWhiteSpace(profile?.User?.FullName))
        {
            completeness += 5;
        }
        else
        {
            actionItems.Add(new CareerReadinessActionItem(
                "add-fullname",
                "Add your full name to your profile.",
                5
            ));
        }

        // 2. Biography/Summary (10%)
        if (!string.IsNullOrWhiteSpace(profile?.Bio))
        {
            completeness += 10;
        }
        else
        {
            actionItems.Add(new CareerReadinessActionItem(
                "add-bio",
                "Add a professional bio or profile summary to introduce yourself to recruiters.",
                10
            ));
        }

        // 3. Professional Headline (5%)
        if (!string.IsNullOrWhiteSpace(profile?.Headline))
        {
            completeness += 5;
        }
        else
        {
            actionItems.Add(new CareerReadinessActionItem(
                "add-headline",
                "Add a professional headline summarizing your targeted title or expertise.",
                5
            ));
        }

        // 4. Target Skills (15%)
        if (career.TargetSkills != null && career.TargetSkills.Any())
        {
            completeness += 15;
        }
        else
        {
            actionItems.Add(new CareerReadinessActionItem(
                "add-target-skills",
                "Add target skills to specify your primary technologies and areas of expertise.",
                15
            ));
        }

        // 5. Work Experience (15%)
        var hasExperience = await _context.WorkExperiences.AnyAsync(we => we.UserId == userId, cancellationToken);
        if (hasExperience)
        {
            completeness += 15;
        }
        else
        {
            actionItems.Add(new CareerReadinessActionItem(
                "add-experience",
                "Add work experience history to showcase your professional employment track record.",
                15
            ));
        }

        // 6. Education (10%)
        var hasEducation = await _context.EducationEntries.AnyAsync(ee => ee.UserId == userId, cancellationToken);
        if (hasEducation)
        {
            completeness += 10;
        }
        else
        {
            actionItems.Add(new CareerReadinessActionItem(
                "add-education",
                "Add education entries to document your academic credentials and background.",
                10
            ));
        }

        // 7. Achievements & Certifications (5%)
        var hasAchievements = await _context.AcademicAchievements.AnyAsync(a => a.UserId == userId, cancellationToken);
        if (hasAchievements)
        {
            completeness += 5;
        }
        else
        {
            actionItems.Add(new CareerReadinessActionItem(
                "add-achievements",
                "Add certifications, achievements, or awards to validate your credentials.",
                5
            ));
        }

        // 8. Linked Projects/Repositories (10%)
        var hasRepos = await _context.SourceCodeRepositories
            .FromSqlRaw(@"
                SELECT r.* 
                FROM source_code_repositories r
                INNER JOIN auth_providers ap ON r.auth_provider_id = ap.id
                WHERE ap.user_id = {0} 
                  AND ap.deleted_at IS NULL
                  AND r.latest_analysis_status = 'Completed'
                  AND r.is_enabled = TRUE
                  AND r.is_accessible = TRUE", 
                userId)
            .AnyAsync(cancellationToken);
        if (hasRepos)
        {
            completeness += 10;
        }
        else
        {
            actionItems.Add(new CareerReadinessActionItem(
                "add-repos",
                "Connect and link public GitHub repositories to provide source code evidence.",
                10
            ));
        }

        // 9. Open to Work Status (5%)
        if (!string.IsNullOrWhiteSpace(career.OpenToWorkStatus))
        {
            completeness += 5;
        }
        else
        {
            actionItems.Add(new CareerReadinessActionItem(
                "add-availability",
                "Set your job search status (Active, Casual, or Closed) to indicate your availability.",
                5
            ));
        }

        // 10. Desired Job Positions (10%)
        if (career.DesiredJobPositions != null && career.DesiredJobPositions.Any())
        {
            completeness += 10;
        }
        else
        {
            actionItems.Add(new CareerReadinessActionItem(
                "add-desired-roles",
                "Add desired job roles to specify the engineering positions you want to target.",
                10
            ));
        }

        // 11. Remote Preference / Work Arrangement (5%)
        if (!string.IsNullOrWhiteSpace(career.RemotePreference))
        {
            completeness += 5;
        }
        else
        {
            actionItems.Add(new CareerReadinessActionItem(
                "specify-arrangement",
                "Specify your preferred work arrangements (Remote, Hybrid, or Onsite).",
                5
            ));
        }

        // 12. Expected Salary (5%)
        if (career.ExpectedSalaryMin.HasValue)
        {
            completeness += 5;
        }
        else
        {
            actionItems.Add(new CareerReadinessActionItem(
                "add-expected-salary",
                "Set your expected salary boundaries to improve match alignment.",
                5
            ));
        }

        // 2. Calculate Skill Verification Strength (30% weight in discoverability)
        // Check how many target skills are backed by verified developer user skills
        double verificationStrength = 0;
        var repositorySkills = await _context.SourceCodeRepositories
            .FromSqlRaw(@"
                SELECT r.* 
                FROM source_code_repositories r
                INNER JOIN auth_providers ap ON r.auth_provider_id = ap.id
                WHERE ap.user_id = {0} 
                  AND ap.deleted_at IS NULL
                  AND r.latest_analysis_status = 'Completed'
                  AND r.is_private = FALSE
                  AND r.is_enabled = TRUE
                  AND r.is_accessible = TRUE", 
                career.UserId)
            .Select(r => new { r.PrimaryLanguage, r.Classification })
            .ToListAsync(cancellationToken);

        var verifiedSkills = repositorySkills
            .SelectMany(r => new[] { r.PrimaryLanguage, r.Classification })
            .Where(s => !string.IsNullOrWhiteSpace(s))
            .Select(s => s.ToLower().Trim())
            .Distinct()
            .ToList();

        if (career.TargetSkills != null && career.TargetSkills.Any())
        {
            int verifiedTargetCount = career.TargetSkills
                .Count(ts => verifiedSkills.Contains(ts.ToLower().Trim()));

            verificationStrength = (double)verifiedTargetCount / career.TargetSkills.Count;

            if (verificationStrength < 0.5)
            {
                actionItems.Add(new CareerReadinessActionItem(
                    "verify-more-skills",
                    "Add more verified repositories or credentials to back up your targeted tech stack.",
                    15
                ));
            }
        }
        else if (verifiedSkills.Any())
        {
            verificationStrength = 0.5; // Base strength if they have verified skills but no target list
        }

        // 3. Activity Signal (20% weight in discoverability)
        double activityScore = 0;
        if (string.Equals(career.OpenToWorkStatus, "active", StringComparison.OrdinalIgnoreCase))
        {
            activityScore = 1.0;
        }
        else if (string.Equals(career.OpenToWorkStatus, "casual", StringComparison.OrdinalIgnoreCase))
        {
            activityScore = 0.75;
        }
        else
        {
            activityScore = 0.1;
        }

        // 4. Calculate Discoverability Score
        // Weight distribution:
        // - 50% Completeness
        // - 30% Skill Verification Strength
        // - 20% Search Activity Signal
        double score = (completeness * 0.5) + (verificationStrength * 100 * 0.3) + (activityScore * 100 * 0.2);
        int discoverabilityScore = (int)Math.Clamp(Math.Round(score), 0, 100);

        string discoverabilityStatus = "Low";
        if (discoverabilityScore >= 80)
        {
            discoverabilityStatus = "High";
        }
        else if (discoverabilityScore >= 50)
        {
            discoverabilityStatus = "Medium";
        }

        // Sort action items so highest impact issues come first
        var sortedActions = actionItems
            .OrderByDescending(item => item.ImpactScore)
            .ToList();

        return new CareerReadinessReportDto(
            discoverabilityScore,
            discoverabilityStatus,
            completeness,
            sortedActions
        );
    }
}
