using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Profiles.Entities;

namespace CVerify.API.Modules.Shared.Persistence;

public class DemoCvSeeder : ISeederModule
{
    public string ModuleId => "DemoCvSeeder";
    public string Version => "1.0.0";
    public IReadOnlyCollection<string> Dependencies => new[] { "DemoUserSeeder" };

    public async Task<SeederResult> SeedAsync(ApplicationDbContext context, SeedingConfig config)
    {
        if (context == null) throw new ArgumentNullException(nameof(context));
        if (!config.GenerateDemoData)
        {
            return new SeederResult(ModuleId, SeedingStatus.Skipped, "Demo CV seeding skipped because GenerateDemoData is false.");
        }

        var user = await context.Users.FirstOrDefaultAsync(u => u.Email == "owner1@testbusiness.com")
                   ?? await context.Users.FirstOrDefaultAsync();

        if (user == null)
        {
            return new SeederResult(ModuleId, SeedingStatus.Failed, "No user found to associate with demo CVs.");
        }

        var assessments = new List<CandidateAssessment>
        {
            new()
            {
                Id = Guid.Parse("019f12f7-74d5-7abc-0000-000000000001"),
                UserId = user.Id,
                Status = "Completed",
                OverallScore = 85.0,
                CareerLevel = "L3",
                CareerLevelLabel = "Senior",
                PrimaryTendency = "Backend",
                PrimaryWorkingStyle = "System Designer",
                SummaryHeadline = "Senior Backend Engineer specializing in high-performance ASP.NET Core microservices",
                SummaryParagraph = "Demonstrated deep expertise in API design, SQL query tuning, and distributed systems architecture.",
                ProfessionalBio = "Backend specialist with 6+ years of industry experience building scalable web solutions.",
                PipelineVersion = "2.0.0",
                AssessmentSchemaVersion = "1.0.0",
                LastProfileUpdateAt = DateTimeOffset.UtcNow.AddDays(-3),
                LastRepositoryAnalysisAt = DateTimeOffset.UtcNow.AddDays(-3),
                LastAssessmentAt = DateTimeOffset.UtcNow.AddDays(-3),
                CreatedAtUtc = DateTimeOffset.UtcNow.AddDays(-3),
                CompletedAtUtc = DateTimeOffset.UtcNow.AddDays(-3).AddSeconds(15),
                TechnicalDepth = 8.5,
                TechnicalBreadth = 8.0,
                LeadershipPotential = 7.5,
                ExecutionStrength = 9.0,
                TrustLevel = 0.92,
                CalculationMode = "Standard"
            },
            new()
            {
                Id = Guid.Parse("019f12f7-74d5-7abc-0000-000000000002"),
                UserId = user.Id,
                Status = "Completed",
                OverallScore = 92.0,
                CareerLevel = "L4",
                CareerLevelLabel = "Staff",
                PrimaryTendency = "Fullstack",
                PrimaryWorkingStyle = "Feature Builder",
                SummaryHeadline = "Staff Fullstack Engineer with strong track record in design system and React scaling",
                SummaryParagraph = "A versatile engineer leading frontend performance tune-ups and cross-functional feature pods.",
                ProfessionalBio = "Fullstack specialist focused on React performance, Zustand state design, and Node.js microservices.",
                PipelineVersion = "2.0.0",
                AssessmentSchemaVersion = "1.0.0",
                LastProfileUpdateAt = DateTimeOffset.UtcNow.AddDays(-1),
                LastRepositoryAnalysisAt = DateTimeOffset.UtcNow.AddDays(-1),
                LastAssessmentAt = DateTimeOffset.UtcNow.AddDays(-1),
                CreatedAtUtc = DateTimeOffset.UtcNow.AddDays(-1),
                CompletedAtUtc = DateTimeOffset.UtcNow.AddDays(-1).AddSeconds(12),
                TechnicalDepth = 9.2,
                TechnicalBreadth = 9.5,
                LeadershipPotential = 8.5,
                ExecutionStrength = 9.2,
                TrustLevel = 0.98,
                CalculationMode = "Standard"
            },
            new()
            {
                Id = Guid.Parse("019f12f7-74d5-7abc-0000-000000000003"),
                UserId = user.Id,
                Status = "Failed",
                OverallScore = 0.0,
                PipelineVersion = "2.0.0",
                AssessmentSchemaVersion = "1.0.0",
                LastProfileUpdateAt = DateTimeOffset.UtcNow.AddHours(-2),
                LastRepositoryAnalysisAt = DateTimeOffset.UtcNow.AddHours(-2),
                FailedStage = "Parse Experience",
                FailureReason = "Context length limit exceeded for Google Gemini on CV document of size 12MB.",
                CreatedAtUtc = DateTimeOffset.UtcNow.AddHours(-2)
            },
            new()
            {
                Id = Guid.Parse("019f12f7-74d5-7abc-0000-000000000004"),
                UserId = user.Id,
                Status = "Running",
                OverallScore = 0.0,
                PipelineVersion = "2.0.0",
                AssessmentSchemaVersion = "1.0.0",
                LastProfileUpdateAt = DateTimeOffset.UtcNow.AddSeconds(-30),
                LastRepositoryAnalysisAt = DateTimeOffset.UtcNow.AddSeconds(-30),
                CreatedAtUtc = DateTimeOffset.UtcNow.AddSeconds(-30)
            }
        };

        int affected = 0;
        foreach (var assess in assessments)
        {
            var existing = await context.CandidateAssessments.FirstOrDefaultAsync(a => a.Id == assess.Id);
            if (existing == null)
            {
                context.CandidateAssessments.Add(assess);
                affected++;
            }
            else
            {
                existing.UserId = assess.UserId;
                existing.Status = assess.Status;
                existing.OverallScore = assess.OverallScore;
                existing.CareerLevel = assess.CareerLevel;
                existing.CareerLevelLabel = assess.CareerLevelLabel;
                existing.PrimaryTendency = assess.PrimaryTendency;
                existing.PrimaryWorkingStyle = assess.PrimaryWorkingStyle;
                existing.SummaryHeadline = assess.SummaryHeadline;
                existing.SummaryParagraph = assess.SummaryParagraph;
                existing.ProfessionalBio = assess.ProfessionalBio;
                existing.FailedStage = assess.FailedStage;
                existing.FailureReason = assess.FailureReason;
                existing.CreatedAtUtc = assess.CreatedAtUtc;
                context.CandidateAssessments.Update(existing);
                affected++;
            }
        }

        await context.SaveChangesAsync();
        return new SeederResult(ModuleId, SeedingStatus.Success, "Demo candidate assessments seeded successfully.", affected);
    }
}
