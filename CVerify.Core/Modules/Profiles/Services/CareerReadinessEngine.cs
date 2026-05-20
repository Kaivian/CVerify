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

        // 1. Calculate Completeness Percent (0-100)
        int completeness = 0;

        // Availability Status (15%)
        if (!string.IsNullOrWhiteSpace(career.OpenToWorkStatus))
        {
            completeness += 15;
        }
        else
        {
            actionItems.Add(new CareerReadinessActionItem(
                "add-availability-status",
                "Set your availability status (Active, Casual, Closed) to inform recruiters of your search intent.",
                15
            ));
        }

        // Desired job positions (15%)
        if (career.DesiredJobPositions != null && career.DesiredJobPositions.Any())
        {
            completeness += 15;
        }
        else
        {
            actionItems.Add(new CareerReadinessActionItem(
                "add-desired-roles",
                "Add desired job roles to specify the engineering positions you want to target.",
                15
            ));
        }

        // Spoken language (10%)
        if (!string.IsNullOrWhiteSpace(career.PreferredLanguage))
        {
            completeness += 10;
        }

        // Work arrangement remote/hybrid/onsite (10%)
        if (!string.IsNullOrWhiteSpace(career.RemotePreference))
        {
            completeness += 10;
        }
        else
        {
            actionItems.Add(new CareerReadinessActionItem(
                "specify-arrangement",
                "Specify your preferred work arrangements (Remote, Hybrid, or Onsite).",
                10
            ));
        }

        // Expected salary min (15%)
        if (career.ExpectedSalaryMin.HasValue)
        {
            completeness += 15;
        }
        else
        {
            actionItems.Add(new CareerReadinessActionItem(
                "add-expected-salary",
                "Set expected salary boundaries to improve match alignment with recruiters.",
                15
            ));
        }

        // Target skills (15%)
        if (career.TargetSkills != null && career.TargetSkills.Any())
        {
            completeness += 15;
        }
        else
        {
            actionItems.Add(new CareerReadinessActionItem(
                "add-target-skills",
                "Add target skills you want to use in your next engineering role.",
                15
            ));
        }

        // Work Preference Notes (10%)
        if (!string.IsNullOrWhiteSpace(career.WorkPreferenceNotes))
        {
            completeness += 10;
        }
        else
        {
            actionItems.Add(new CareerReadinessActionItem(
                "add-preference-notes",
                "Write a brief description of your ideal team culture or work environment.",
                10
            ));
        }

        // Preferred stage & industries (10%)
        if ((career.CompanyStagePreferences != null && career.CompanyStagePreferences.Any()) ||
            (career.PreferredIndustries != null && career.PreferredIndustries.Any()))
        {
            completeness += 10;
        }
        else
        {
            actionItems.Add(new CareerReadinessActionItem(
                "add-company-stage",
                "List target company stages or industries of interest to refine matches.",
                10
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
