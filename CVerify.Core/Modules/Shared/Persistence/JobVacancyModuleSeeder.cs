using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Modules.Shared.Domain.Entities;

namespace CVerify.API.Modules.Shared.Persistence;

public class JobVacancyModuleSeeder : IPublicWorkspaceModuleSeeder
{
    public string ModuleName => "Job Vacancies Seeder";

    public async Task SeedModuleAsync(Guid organizationId, object orgDto, ApplicationDbContext context)
    {
        if (orgDto is not PublicWorkspaceSeeder.SeedOrganizationAggregate aggregateDto)
        {
            throw new ArgumentException("Invalid organization DTO type passed to JobVacancyModuleSeeder.", nameof(orgDto));
        }

        foreach (var jobDto in aggregateDto.Jobs)
        {
            // Idempotency check: lookup existing job by Organization, Title, Department and WorkplaceType
            var existingJob = await context.JobVacancies
                .FirstOrDefaultAsync(j => j.OrganizationId == organizationId &&
                                          j.Title.ToLower() == jobDto.Title.ToLower() &&
                                          j.Department.ToLower() == jobDto.Department.ToLower() &&
                                          j.WorkplaceType.ToLower() == jobDto.WorkplaceType.ToLower());

            if (existingJob != null)
            {
                // Update existing vacancy properties (Upsert)
                existingJob.City = jobDto.City;
                existingJob.Type = jobDto.Type;
                existingJob.Salary = jobDto.Salary;
                existingJob.SalaryMinMax = jobDto.SalaryMinMax;
                existingJob.Headcount = jobDto.Headcount;
                existingJob.Gender = jobDto.Gender;
                existingJob.Experience = jobDto.Experience;
                existingJob.Degree = jobDto.Degree;
                existingJob.Category = jobDto.Category;
                existingJob.Description = jobDto.Description;
                existingJob.Requirements = jobDto.Requirements;
                existingJob.Benefits = jobDto.Benefits;
                existingJob.Tags = jobDto.Tags;
                existingJob.Skills = jobDto.Skills;
                existingJob.CoverUrl = jobDto.CoverUrl;
                existingJob.Images = jobDto.Images;
                existingJob.IsActive = jobDto.IsActive;
                existingJob.UpdatedAt = DateTimeOffset.UtcNow;
            }
            else
            {
                // Create new vacancy
                var newJob = new JobVacancy
                {
                    Id = Guid.CreateVersion7(),
                    OrganizationId = organizationId,
                    Title = jobDto.Title,
                    Department = jobDto.Department,
                    WorkplaceType = jobDto.WorkplaceType,
                    City = jobDto.City,
                    Type = jobDto.Type,
                    Salary = jobDto.Salary,
                    SalaryMinMax = jobDto.SalaryMinMax,
                    Headcount = jobDto.Headcount,
                    Gender = jobDto.Gender,
                    Experience = jobDto.Experience,
                    Degree = jobDto.Degree,
                    Category = jobDto.Category,
                    Description = jobDto.Description,
                    Requirements = jobDto.Requirements,
                    Benefits = jobDto.Benefits,
                    Tags = jobDto.Tags,
                    Skills = jobDto.Skills,
                    CoverUrl = jobDto.CoverUrl,
                    Images = jobDto.Images,
                    IsActive = jobDto.IsActive,
                    CreatedAt = DateTimeOffset.UtcNow,
                    UpdatedAt = DateTimeOffset.UtcNow
                };
                context.JobVacancies.Add(newJob);
            }
        }
        await context.SaveChangesAsync();
    }
}
