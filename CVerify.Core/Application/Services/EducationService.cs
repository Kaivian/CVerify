using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Application.DTOs;
using CVerify.API.Application.Interfaces;
using CVerify.API.Core.Entities;
using CVerify.API.Infrastructure.Persistence;
using CVerify.API.Application.Exceptions;

namespace CVerify.API.Application.Services;

public class EducationService : IEducationService
{
    private readonly ApplicationDbContext _context;

    public EducationService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<EducationEntryResponse>> GetEducationEntriesAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var entries = await _context.EducationEntries
            .Where(ee => ee.UserId == userId)
            .OrderBy(ee => ee.DisplayOrder)
            .ThenByDescending(ee => ee.StartDate)
            .ToListAsync(cancellationToken);

        return entries.Select(MapToResponse).ToList();
    }

    public async Task<EducationEntryResponse> CreateEducationEntryAsync(
        Guid userId, 
        EducationEntryRequest request, 
        CancellationToken cancellationToken = default)
    {
        // Calculate display order
        var maxOrder = await _context.EducationEntries
            .Where(ee => ee.UserId == userId)
            .Select(ee => (int?)ee.DisplayOrder)
            .MaxAsync(cancellationToken) ?? -1;

        var entry = new EducationEntry
        {
            Id = Guid.CreateVersion7(),
            UserId = userId,
            Label = request.Label.Trim(),
            SchoolName = request.SchoolName.Trim(),
            Degree = request.Degree?.Trim(),
            Major = request.Major?.Trim(),
            GPA = request.GPA,
            GPAScale = request.GPAScale,
            Description = request.Description?.Trim(),
            StartDate = request.StartDate,
            EndDate = request.EndDate,
            IsCurrentlyStudying = request.IsCurrentlyStudying,
            DisplayOrder = maxOrder + 1,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        _context.EducationEntries.Add(entry);
        await _context.SaveChangesAsync(cancellationToken);

        return MapToResponse(entry);
    }

    public async Task<EducationEntryResponse> UpdateEducationEntryAsync(
        Guid userId, 
        Guid entryId, 
        EducationEntryRequest request, 
        CancellationToken cancellationToken = default)
    {
        var entry = await _context.EducationEntries
            .FirstOrDefaultAsync(ee => ee.Id == entryId && ee.UserId == userId, cancellationToken);

        if (entry == null)
        {
            throw new ResourceNotFoundException(ProfileErrorCodes.EducationNotFound, "Education entry not found.");
        }

        entry.Label = request.Label.Trim();
        entry.SchoolName = request.SchoolName.Trim();
        entry.Degree = request.Degree?.Trim();
        entry.Major = request.Major?.Trim();
        entry.GPA = request.GPA;
        entry.GPAScale = request.GPAScale;
        entry.Description = request.Description?.Trim();
        entry.StartDate = request.StartDate;
        entry.EndDate = request.EndDate;
        entry.IsCurrentlyStudying = request.IsCurrentlyStudying;
        entry.UpdatedAt = DateTimeOffset.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        return MapToResponse(entry);
    }

    public async Task DeleteEducationEntryAsync(Guid userId, Guid entryId, CancellationToken cancellationToken = default)
    {
        var entry = await _context.EducationEntries
            .FirstOrDefaultAsync(ee => ee.Id == entryId && ee.UserId == userId, cancellationToken);

        if (entry == null)
        {
            throw new ResourceNotFoundException(ProfileErrorCodes.EducationNotFound, "Education entry not found.");
        }

        entry.DeletedAt = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task ReorderEducationEntriesAsync(Guid userId, List<Guid> orderedIds, CancellationToken cancellationToken = default)
    {
        if (orderedIds == null || orderedIds.Count == 0) return;

        var entries = await _context.EducationEntries
            .Where(ee => ee.UserId == userId && orderedIds.Contains(ee.Id))
            .ToListAsync(cancellationToken);

        for (int i = 0; i < orderedIds.Count; i++)
        {
            var id = orderedIds[i];
            var entry = entries.FirstOrDefault(ee => ee.Id == id);
            if (entry != null)
            {
                entry.DisplayOrder = i;
                entry.UpdatedAt = DateTimeOffset.UtcNow;
            }
        }

        await _context.SaveChangesAsync(cancellationToken);
    }

    private static EducationEntryResponse MapToResponse(EducationEntry entry)
    {
        return new EducationEntryResponse(
            entry.Id,
            entry.UserId,
            entry.Label,
            entry.SchoolName,
            entry.Degree,
            entry.Major,
            entry.GPA,
            entry.GPAScale,
            entry.Description,
            entry.StartDate,
            entry.EndDate,
            entry.IsCurrentlyStudying,
            entry.DisplayOrder
        );
    }
}
