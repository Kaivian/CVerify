using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Modules.Profiles.DTOs;
using CVerify.API.Modules.Profiles.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.Exceptions;
using CVerify.API.Modules.Shared.Persistence;

namespace CVerify.API.Modules.Profiles.Services;

public class WorkExperienceService : IWorkExperienceService
{
    private readonly ApplicationDbContext _context;
    private readonly ICvRepositoryIndexer _cvRepositoryIndexer;

    public WorkExperienceService(ApplicationDbContext context, ICvRepositoryIndexer cvRepositoryIndexer)
    {
        _context = context;
        _cvRepositoryIndexer = cvRepositoryIndexer;
    }

    public async Task<List<WorkExperienceResponse>> GetWorkExperiencesAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var entries = await _context.WorkExperiences
            .Include(we => we.Achievements)
            .Include(we => we.Technologies)
            .Include(we => we.Links)
            .Where(we => we.UserId == userId)
            .OrderBy(we => we.DisplayOrder)
            .ThenByDescending(we => we.StartDate)
            .ToListAsync(cancellationToken);

        return entries.Select(MapToResponse).ToList();
    }

    public async Task<WorkExperienceResponse> CreateWorkExperienceAsync(
        Guid userId, 
        WorkExperienceRequest request, 
        CancellationToken cancellationToken = default)
    {
        ValidateDateConstraints(request);

        var maxOrder = await _context.WorkExperiences
            .Where(we => we.UserId == userId)
            .Select(we => (int?)we.DisplayOrder)
            .MaxAsync(cancellationToken) ?? -1;

        var id = Guid.CreateVersion7();
        var entry = new WorkExperienceEntry
        {
            Id = id,
            UserId = userId,
            JobTitle = request.JobTitle.Trim(),
            Company = request.Company.Trim(),
            ExperienceCategory = (ExperienceCategory)request.ExperienceCategory,
            EmploymentType = (EmploymentType)request.EmploymentType,
            Location = request.Location?.Trim(),
            StartDate = request.StartDate,
            EndDate = request.IsCurrentlyWorking ? null : request.EndDate,
            IsCurrentlyWorking = request.IsCurrentlyWorking,
            IsLeadership = request.IsLeadership,
            Description = request.Description.Trim(),
            DisplayOrder = maxOrder + 1,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
            Achievements = request.Achievements?.Select(a => new WorkExperienceAchievement
            {
                Id = Guid.CreateVersion7(),
                WorkExperienceId = id,
                Title = a.Title.Trim(),
                Description = a.Description.Trim(),
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            }).ToList() ?? new List<WorkExperienceAchievement>(),
            Technologies = request.Technologies?.Select(t => new WorkExperienceTechnology
            {
                Id = Guid.CreateVersion7(),
                WorkExperienceId = id,
                Name = t.Trim(),
                CreatedAt = DateTimeOffset.UtcNow
            }).ToList() ?? new List<WorkExperienceTechnology>(),
            Links = request.Links?.Select(l => new WorkExperienceLink
            {
                Id = Guid.CreateVersion7(),
                WorkExperienceId = id,
                LinkType = (WorkLinkType)l.LinkType,
                Url = l.Url.Trim(),
                CreatedAt = DateTimeOffset.UtcNow
            }).ToList() ?? new List<WorkExperienceLink>()
        };

        _context.WorkExperiences.Add(entry);

        var profile = await _context.UserProfiles.FirstOrDefaultAsync(up => up.UserId == userId, cancellationToken);
        if (profile != null)
        {
            profile.LastProfileUpdateAt = DateTimeOffset.UtcNow;
            profile.UpdatedAt = DateTimeOffset.UtcNow;
        }

        await _context.SaveChangesAsync(cancellationToken);

        try
        {
            await _cvRepositoryIndexer.IndexUserCvRepositoriesAsync(userId, cancellationToken);
        }
        catch
        {
            // Do not fail the work experience operation if indexing throws
        }

        return MapToResponse(entry);
    }

    public async Task<WorkExperienceResponse> UpdateWorkExperienceAsync(
        Guid userId, 
        Guid id, 
        WorkExperienceRequest request, 
        CancellationToken cancellationToken = default)
    {
        var entry = await _context.WorkExperiences
            .Include(we => we.Achievements)
            .Include(we => we.Technologies)
            .Include(we => we.Links)
            .FirstOrDefaultAsync(we => we.Id == id && we.UserId == userId, cancellationToken);

        if (entry == null)
        {
            throw new ResourceNotFoundException(ProfileErrorCodes.WorkExperienceNotFound, "Work experience entry not found.");
        }

        ValidateDateConstraints(request);

        entry.JobTitle = request.JobTitle.Trim();
        entry.Company = request.Company.Trim();
        entry.ExperienceCategory = (ExperienceCategory)request.ExperienceCategory;
        entry.EmploymentType = (EmploymentType)request.EmploymentType;
        entry.Location = request.Location?.Trim();
        entry.StartDate = request.StartDate;
        entry.EndDate = request.IsCurrentlyWorking ? null : request.EndDate;
        entry.IsCurrentlyWorking = request.IsCurrentlyWorking;
        entry.IsLeadership = request.IsLeadership;
        entry.Description = request.Description.Trim();
        entry.UpdatedAt = DateTimeOffset.UtcNow;

        // Clear existing child lists
        _context.WorkExperienceAchievements.RemoveRange(entry.Achievements);
        _context.WorkExperienceTechnologies.RemoveRange(entry.Technologies);
        _context.WorkExperienceLinks.RemoveRange(entry.Links);

        // Add new child lists
        entry.Achievements = request.Achievements?.Select(a => new WorkExperienceAchievement
        {
            Id = Guid.CreateVersion7(),
            WorkExperienceId = id,
            Title = a.Title.Trim(),
            Description = a.Description.Trim(),
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        }).ToList() ?? new List<WorkExperienceAchievement>();

        entry.Technologies = request.Technologies?.Select(t => new WorkExperienceTechnology
        {
            Id = Guid.CreateVersion7(),
            WorkExperienceId = id,
            Name = t.Trim(),
            CreatedAt = DateTimeOffset.UtcNow
        }).ToList() ?? new List<WorkExperienceTechnology>();

        entry.Links = request.Links?.Select(l => new WorkExperienceLink
        {
            Id = Guid.CreateVersion7(),
            WorkExperienceId = id,
            LinkType = (WorkLinkType)l.LinkType,
            Url = l.Url.Trim(),
            CreatedAt = DateTimeOffset.UtcNow
        }).ToList() ?? new List<WorkExperienceLink>();

        var profile = await _context.UserProfiles.FirstOrDefaultAsync(up => up.UserId == userId, cancellationToken);
        if (profile != null)
        {
            profile.LastProfileUpdateAt = DateTimeOffset.UtcNow;
            profile.UpdatedAt = DateTimeOffset.UtcNow;
        }

        await _context.SaveChangesAsync(cancellationToken);

        try
        {
            await _cvRepositoryIndexer.IndexUserCvRepositoriesAsync(userId, cancellationToken);
        }
        catch
        {
            // Do not fail the work experience operation if indexing throws
        }

        return MapToResponse(entry);
    }

    public async Task DeleteWorkExperienceAsync(Guid userId, Guid id, CancellationToken cancellationToken = default)
    {
        var entry = await _context.WorkExperiences
            .FirstOrDefaultAsync(we => we.Id == id && we.UserId == userId, cancellationToken);

        if (entry == null)
        {
            throw new ResourceNotFoundException(ProfileErrorCodes.WorkExperienceNotFound, "Work experience entry not found.");
        }

        entry.DeletedAt = DateTimeOffset.UtcNow;
        entry.UpdatedAt = DateTimeOffset.UtcNow;

        var profile = await _context.UserProfiles.FirstOrDefaultAsync(up => up.UserId == userId, cancellationToken);
        if (profile != null)
        {
            profile.LastProfileUpdateAt = DateTimeOffset.UtcNow;
            profile.UpdatedAt = DateTimeOffset.UtcNow;
        }

        await _context.SaveChangesAsync(cancellationToken);

        try
        {
            await _cvRepositoryIndexer.IndexUserCvRepositoriesAsync(userId, cancellationToken);
        }
        catch
        {
            // Do not fail the work experience operation if indexing throws
        }
    }

    public async Task ReorderWorkExperiencesAsync(Guid userId, List<Guid> orderedIds, CancellationToken cancellationToken = default)
    {
        if (orderedIds == null || orderedIds.Count == 0) return;

        // Fetch user's active work experiences matching list IDs
        var entries = await _context.WorkExperiences
            .Where(we => we.UserId == userId && orderedIds.Contains(we.Id))
            .ToListAsync(cancellationToken);

        // Verify ownership check: throw on any mismatched or missing ID
        if (entries.Count != orderedIds.Count)
        {
            throw new BusinessRuleException("INVALID_REORDER_PAYLOAD", "One or more of the specified work experience IDs are invalid or belong to another user.");
        }

        for (int i = 0; i < orderedIds.Count; i++)
        {
            var id = orderedIds[i];
            var entry = entries.FirstOrDefault(we => we.Id == id);
            if (entry != null)
            {
                entry.DisplayOrder = i;
                entry.UpdatedAt = DateTimeOffset.UtcNow;
            }
        }

        var profile = await _context.UserProfiles.FirstOrDefaultAsync(up => up.UserId == userId, cancellationToken);
        if (profile != null)
        {
            profile.LastProfileUpdateAt = DateTimeOffset.UtcNow;
            profile.UpdatedAt = DateTimeOffset.UtcNow;
        }

        await _context.SaveChangesAsync(cancellationToken);

        try
        {
            await _cvRepositoryIndexer.IndexUserCvRepositoriesAsync(userId, cancellationToken);
        }
        catch
        {
            // Do not fail the work experience operation if indexing throws
        }
    }

    private static void ValidateDateConstraints(WorkExperienceRequest request)
    {
        if (request.IsCurrentlyWorking)
        {
            if (request.EndDate.HasValue)
            {
                throw new BusinessRuleException("INVALID_DATE_CONSTRAINT", "End date must be empty if currently working.");
            }
        }
        else
        {
            if (!request.EndDate.HasValue)
            {
                throw new BusinessRuleException("INVALID_DATE_CONSTRAINT", "End date is required if not currently working.");
            }

            if (request.EndDate.Value < request.StartDate)
            {
                throw new BusinessRuleException("INVALID_DATE_CONSTRAINT", "End date cannot be before start date.");
            }
        }
    }

    private static WorkExperienceResponse MapToResponse(WorkExperienceEntry entry)
    {
        return new WorkExperienceResponse(
            entry.Id,
            entry.UserId,
            entry.JobTitle,
            entry.Company,
            (int)entry.ExperienceCategory,
            (int)entry.EmploymentType,
            entry.Location,
            entry.StartDate,
            entry.EndDate,
            entry.IsCurrentlyWorking,
            entry.Description,
            entry.DisplayOrder,
            entry.Achievements.Select(a => new WorkExperienceAchievementDto(a.Title, a.Description)).ToList(),
            entry.Technologies.Select(t => t.Name).ToList(),
            entry.Links.Select(l => new WorkExperienceLinkDto((int)l.LinkType, l.Url)).ToList(),
            entry.IsLeadership
        );
    }
}
