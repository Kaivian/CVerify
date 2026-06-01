using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Modules.Auth.Services;
using CVerify.API.Modules.Profiles.DTOs;
using CVerify.API.Modules.Profiles.Entities;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Exceptions;
using CVerify.API.Modules.Shared.Persistence;

namespace CVerify.API.Modules.Profiles.Services;

public class CareerService : ICareerService
{
    private readonly ApplicationDbContext _context;

    public CareerService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<CareerPreferenceResponse> GetCareerPreferenceByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
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
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };

            _context.CareerPreferences.Add(career);
            await _context.SaveChangesAsync(cancellationToken);
        }

        var skills = await _context.UserSkills
            .Where(us => us.UserId == userId)
            .Select(us => us.Skill)
            .ToListAsync(cancellationToken);

        var locations = await _context.UserPreferredLocations
            .Where(upl => upl.UserId == userId)
            .Select(upl => upl.Location)
            .ToListAsync(cancellationToken);

        var employmentPrefs = await _context.UserEmploymentPreferences
            .Where(uep => uep.UserId == userId)
            .Select(uep => uep.PreferenceName)
            .ToListAsync(cancellationToken);

        return MapToResponse(career, skills, locations, employmentPrefs);
    }

    public async Task<CareerPreferenceResponse> UpdateCareerPreferenceAsync(
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

        // Update properties
        career.AvailableForHire = request.AvailableForHire;
        career.PreferredLanguage = request.PreferredLanguage;
        career.JobTitlePreferences = request.JobTitlePreferences;
        career.SalaryExpectations = request.SalaryExpectations;
        career.RemotePreference = request.RemotePreference;
        career.OpenToWorkStatus = request.OpenToWorkStatus;
        career.UpdatedAt = DateTimeOffset.UtcNow;

        // Sync Skills
        var existingSkills = await _context.UserSkills
            .Where(us => us.UserId == userId)
            .ToListAsync(cancellationToken);
        _context.UserSkills.RemoveRange(existingSkills);

        var finalSkills = new List<string>();
        if (request.Skills != null)
        {
            foreach (var s in request.Skills.Where(x => !string.IsNullOrWhiteSpace(x)))
            {
                var skill = new UserSkill
                {
                    Id = Guid.CreateVersion7(),
                    UserId = userId,
                    Skill = s.Trim(),
                    CreatedAt = DateTimeOffset.UtcNow
                };
                _context.UserSkills.Add(skill);
                finalSkills.Add(skill.Skill);
            }
        }

        // Sync Locations
        var existingLocations = await _context.UserPreferredLocations
            .Where(upl => upl.UserId == userId)
            .ToListAsync(cancellationToken);
        _context.UserPreferredLocations.RemoveRange(existingLocations);

        var finalLocations = new List<string>();
        if (request.PreferredLocations != null)
        {
            foreach (var loc in request.PreferredLocations.Where(x => !string.IsNullOrWhiteSpace(x)))
            {
                var location = new UserPreferredLocation
                {
                    Id = Guid.CreateVersion7(),
                    UserId = userId,
                    Location = loc.Trim(),
                    CreatedAt = DateTimeOffset.UtcNow
                };
                _context.UserPreferredLocations.Add(location);
                finalLocations.Add(location.Location);
            }
        }

        // Sync Employment Preferences
        var existingEmpPrefs = await _context.UserEmploymentPreferences
            .Where(uep => uep.UserId == userId)
            .ToListAsync(cancellationToken);
        _context.UserEmploymentPreferences.RemoveRange(existingEmpPrefs);

        var finalEmpPrefs = new List<string>();
        if (request.EmploymentPreferences != null)
        {
            foreach (var ep in request.EmploymentPreferences.Where(x => !string.IsNullOrWhiteSpace(x)))
            {
                var empPref = new UserEmploymentPreference
                {
                    Id = Guid.CreateVersion7(),
                    UserId = userId,
                    PreferenceName = ep.Trim(),
                    CreatedAt = DateTimeOffset.UtcNow
                };
                _context.UserEmploymentPreferences.Add(empPref);
                finalEmpPrefs.Add(empPref.PreferenceName);
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

        return MapToResponse(career, finalSkills, finalLocations, finalEmpPrefs);
    }

    private static CareerPreferenceResponse MapToResponse(
        CareerPreference career, 
        List<string> skills, 
        List<string> locations, 
        List<string> employmentPrefs)
    {
        return new CareerPreferenceResponse(
            career.UserId,
            career.AvailableForHire,
            career.PreferredLanguage,
            career.JobTitlePreferences,
            career.SalaryExpectations,
            career.RemotePreference,
            career.OpenToWorkStatus,
            skills,
            locations,
            employmentPrefs,
            career.Version
        );
    }
}
