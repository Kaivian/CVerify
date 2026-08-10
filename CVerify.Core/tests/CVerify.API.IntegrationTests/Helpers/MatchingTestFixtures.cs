using System;
using System.Collections.Generic;
using System.Text.Json;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.System.DTOs;
using CVerify.API.Modules.Profiles.Entities;
using CVerify.API.Modules.Intelligence.Services;

namespace CVerify.API.IntegrationTests.Helpers;

public static class MatchingTestFixtures
{
    public static User CreateCandidateUser(Guid id, string name, string email, string username)
    {
        return new User
        {
            Id = id,
            FullName = name,
            Email = email,
            Username = username,
            Status = UserStatus.ACTIVE,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
    }

    public static UserProfile CreateCandidateProfile(Guid userId, string username, string headline, string bio, string location)
    {
        return new UserProfile
        {
            UserId = userId,
            Username = username,
            Headline = headline,
            Bio = bio,
            Location = location,
            LastProfileUpdateAt = DateTimeOffset.UtcNow
        };
    }

    public static HiringRequirement CreateHiringRequirement(Guid id, Guid orgId, Guid workspaceId, string title, string seniority)
    {
        return new HiringRequirement
        {
            Id = id,
            OrganizationId = orgId,
            WorkspaceId = workspaceId,
            Title = title,
            Department = "Engineering",
            Seniority = seniority, // Junior, Middle, Senior, Staff, Principal
            WorkplaceType = "Remote",
            EmploymentType = "Full-Time",
            SalaryMin = 50000,
            SalaryMax = 120000,
            Currency = "USD",
            SalaryPeriod = SalaryPeriod.Monthly,
            IsSalaryNegotiable = true,
            Status = "Published",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
    }

    public static RequirementSnapshot CreateRequirementSnapshot(
        Guid requirementId,
        string title,
        string seniority,
        List<RequirementCapabilityDto> capabilities,
        List<TechnologyRequirementDto> skills,
        List<ResponsibilityDto> responsibilities)
    {
        return new RequirementSnapshot
        {
            Id = Guid.CreateVersion7(),
            HiringRequirementId = requirementId,
            Version = 1,
            Title = title,
            Department = "Engineering",
            Seniority = seniority,
            WorkplaceType = "Remote",
            EmploymentType = "Full-Time",
            SalaryMin = 50000,
            SalaryMax = 120000,
            Currency = "USD",
            SalaryPeriod = SalaryPeriod.Monthly,
            IsSalaryNegotiable = true,
            SnapshottedAt = DateTimeOffset.UtcNow,
            CapabilitiesJson = JsonSerializer.Serialize(capabilities),
            TechnologyRequirementsJson = JsonSerializer.Serialize(skills),
            ResponsibilitiesJson = JsonSerializer.Serialize(responsibilities)
        };
    }

    public static JobVacancy CreateJobVacancy(Guid id, Guid orgId, string title, string seniority)
    {
        return new JobVacancy
        {
            Id = id,
            OrganizationId = orgId,
            Title = title,
            Department = "Engineering",
            Experience = seniority,
            WorkplaceType = "Remote",
            City = "San Jose",
            Type = "Full-Time",
            Status = "Published",
            Salary = "Negotiable",
            SalaryMinMax = "0 - 0",
            Gender = "No requirement",
            Degree = "Bachelor",
            Category = "Software Development",
            CoverUrl = "https://example.com/cover.png",
            Skills = new List<string>(),
            Requirements = new List<string>(),
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
    }

    public static CandidateAssessment CreateCandidateAssessment(Guid userId, string careerLevel, double overallScore)
    {
        return new CandidateAssessment
        {
            Id = Guid.CreateVersion7(),
            UserId = userId,
            Status = "Completed",
            OverallScore = overallScore,
            CareerLevel = careerLevel,
            CareerLevelLabel = careerLevel,
            PrimaryTendency = "Backend",
            CreatedAtUtc = DateTimeOffset.UtcNow.AddDays(-1),
            CompletedAtUtc = DateTimeOffset.UtcNow
        };
    }

    public static CandidateSearchProfile CreateCandidateSearchProfile(Guid candidateId, string fullName, int trustScore, string capabilitiesJson)
    {
        return new CandidateSearchProfile
        {
            CandidateId = candidateId,
            FullName = fullName,
            Location = "Remote",
            TrustScore = trustScore,
            TrustTier = "Verified",
            CapabilitiesJson = capabilitiesJson,
            SearchEmbedding = new float[1536],
            LastProjectedAt = DateTimeOffset.UtcNow
        };
    }

    public static CandidateMatchProjection CreateCandidateMatchProjection(Guid candidateId, string profileSummary, Guid[] normalizedCapabilities)
    {
        return new CandidateMatchProjection
        {
            CandidateId = candidateId,
            ProfileSummary = profileSummary,
            NormalizedCapabilities = normalizedCapabilities,
            LastProjectedAt = DateTimeOffset.UtcNow
        };
    }

    public static string CreateCapabilitiesJson(List<CapabilityItem> items)
    {
        return JsonSerializer.Serialize(items);
    }
}
