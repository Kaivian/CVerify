using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using CVerify.API.Modules.Intelligence.DTOs;
using CVerify.API.Modules.Shared.Domain.Entities;

namespace CVerify.API.Modules.Intelligence.Services;

public interface IQueryUnderstandingService
{
    ParsedSearchQueryDto ParsePrompt(string rawPrompt);
    ParsedSearchQueryDto ParseRequirement(HiringRequirement requirement);
}

public class QueryUnderstandingService : IQueryUnderstandingService
{
    private static readonly string[] SeniorityKeywords = { "Junior", "Mid", "Senior", "Lead", "Staff", "Principal", "Director", "VP" };
    private static readonly string[] WorkplaceKeywords = { "Remote", "Hybrid", "Onsite" };

    public ParsedSearchQueryDto ParsePrompt(string rawPrompt)
    {
        if (string.IsNullOrWhiteSpace(rawPrompt))
        {
            return new ParsedSearchQueryDto("", null, null, null, null, null, null, null, new List<string>(), new List<string>());
        }

        string cleanPrompt = rawPrompt.Trim();

        // Extract Seniority
        string? seniority = SeniorityKeywords.FirstOrDefault(s => cleanPrompt.Contains(s, StringComparison.OrdinalIgnoreCase));

        // Extract Workplace Type
        string? workplace = WorkplaceKeywords.FirstOrDefault(w => cleanPrompt.Contains(w, StringComparison.OrdinalIgnoreCase));

        // Simple skill extractor based on common tech terms
        var extractedSkills = ExtractTechSkills(cleanPrompt);

        return new ParsedSearchQueryDto(
            RawPrompt: cleanPrompt,
            TargetRoleTitle: cleanPrompt.Split(new[] { ' ', ',', ';' }, StringSplitOptions.RemoveEmptyEntries).FirstOrDefault(),
            TargetSeniority: seniority ?? "Mid",
            WorkplaceType: workplace ?? "Any",
            Location: null,
            SalaryMin: null,
            SalaryMax: null,
            MinimumYearsOfExperience: seniority == "Senior" ? 5 : seniority == "Lead" ? 8 : 2,
            ExtractedSkills: extractedSkills,
            ExtractedCapabilities: new List<string>()
        );
    }

    public ParsedSearchQueryDto ParseRequirement(HiringRequirement requirement)
    {
        ArgumentNullException.ThrowIfNull(requirement);

        var skills = requirement.TechnologyRequirements?.Select(t => t.Name).ToList() ?? new List<string>();
        var capabilities = requirement.Capabilities?.Select(c => c.CapabilityId).ToList() ?? new List<string>();

        return new ParsedSearchQueryDto(
            RawPrompt: $"{requirement.Title} - {requirement.Department}",
            TargetRoleTitle: requirement.Title,
            TargetSeniority: requirement.Seniority,
            WorkplaceType: requirement.WorkplaceType,
            Location: requirement.City,
            SalaryMin: requirement.SalaryMin,
            SalaryMax: requirement.SalaryMax,
            MinimumYearsOfExperience: requirement.Seniority == "Senior" ? 5 : requirement.Seniority == "Lead" ? 8 : 2,
            ExtractedSkills: skills,
            ExtractedCapabilities: capabilities
        );
    }

    private static List<string> ExtractTechSkills(string text)
    {
        var commonSkills = new[] { "C#", ".NET", "Python", "React", "PostgreSQL", "Docker", "Kubernetes", "AWS", "TypeScript", "Node.js" };
        return commonSkills.Where(s => text.Contains(s, StringComparison.OrdinalIgnoreCase)).ToList();
    }
}
