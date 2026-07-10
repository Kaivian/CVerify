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
using CVerify.API.Modules.Shared.Storage.Interfaces;

namespace CVerify.API.Modules.Profiles.Services;

public class AchievementService : IAchievementService
{
    private readonly ApplicationDbContext _context;
    private readonly IStorageService _storageService;

    public AchievementService(ApplicationDbContext context, IStorageService storageService)
    {
        _context = context;
        _storageService = storageService;
    }

    public async Task<List<AcademicAchievementResponse>> GetAchievementsAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var achievements = await _context.AcademicAchievements
            .Where(aa => aa.UserId == userId)
            .OrderBy(aa => aa.DisplayOrder)
            .ThenByDescending(aa => aa.IssueDate)
            .ToListAsync(cancellationToken);

        var achievementIds = achievements.Select(aa => aa.Id).ToList();

        // Get linked attachments
        var attachments = await _context.ProfileAttachments
            .Where(pa => pa.UserId == userId && pa.EntityType == "AcademicAchievement" && pa.EntityId.HasValue && achievementIds.Contains(pa.EntityId.Value))
            .ToListAsync(cancellationToken);

        var responseList = new List<AcademicAchievementResponse>();

        foreach (var aa in achievements)
        {
            var att = attachments.FirstOrDefault(pa => pa.EntityId == aa.Id);
            AttachmentResponse? attResponse = null;

            if (att != null)
            {
                // Generate a temporary signed R2 URL (valid for 1 hour)
                string signedUrl;
                try
                {
                    signedUrl = await _storageService.GetSignedUrlAsync(att.FilePath, TimeSpan.FromHours(1), cancellationToken);
                }
                catch
                {
                    signedUrl = string.Empty;
                }

                attResponse = new AttachmentResponse(
                    att.Id,
                    att.FileName,
                    att.FileSize,
                    att.FileType,
                    signedUrl,
                    att.CreatedAt
                );
            }

            responseList.Add(new AcademicAchievementResponse(
                aa.Id,
                aa.UserId,
                aa.Title,
                aa.Issuer,
                aa.IssueDate,
                aa.Description,
                aa.CredentialUrl,
                aa.DisplayOrder,
                attResponse
            ));
        }

        return responseList;
    }

    public async Task<AcademicAchievementResponse> CreateAchievementAsync(
        Guid userId,
        AcademicAchievementRequest request,
        CancellationToken cancellationToken = default)
    {
        // Calculate display order
        var maxOrder = await _context.AcademicAchievements
            .Where(aa => aa.UserId == userId)
            .Select(aa => (int?)aa.DisplayOrder)
            .MaxAsync(cancellationToken) ?? -1;

        var achievement = new AcademicAchievement
        {
            Id = Guid.CreateVersion7(),
            UserId = userId,
            Title = request.Title.Trim(),
            Issuer = request.Issuer.Trim(),
            IssueDate = request.IssueDate,
            Description = request.Description.Trim(),
            CredentialUrl = request.CredentialUrl?.Trim(),
            DisplayOrder = maxOrder + 1,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        _context.AcademicAchievements.Add(achievement);

        AttachmentResponse? attResponse = null;

        // If an attachment ID is provided, associate it polymorphicly
        if (request.AttachmentId.HasValue)
        {
            var attachment = await _context.ProfileAttachments
                .FirstOrDefaultAsync(pa => pa.Id == request.AttachmentId.Value && pa.UserId == userId, cancellationToken);

            if (attachment != null)
            {
                attachment.EntityType = "AcademicAchievement";
                attachment.EntityId = achievement.Id;
                attachment.UpdatedAt = DateTimeOffset.UtcNow;

                string signedUrl;
                try
                {
                    signedUrl = await _storageService.GetSignedUrlAsync(attachment.FilePath, TimeSpan.FromHours(1), cancellationToken);
                }
                catch
                {
                    signedUrl = string.Empty;
                }

                attResponse = new AttachmentResponse(
                    attachment.Id,
                    attachment.FileName,
                    attachment.FileSize,
                    attachment.FileType,
                    signedUrl,
                    attachment.CreatedAt
                );
            }
        }

        await _context.SaveChangesAsync(cancellationToken);

        return new AcademicAchievementResponse(
            achievement.Id,
            achievement.UserId,
            achievement.Title,
            achievement.Issuer,
            achievement.IssueDate,
            achievement.Description,
            achievement.CredentialUrl,
            achievement.DisplayOrder,
            attResponse
        );
    }

    public async Task<AcademicAchievementResponse> UpdateAchievementAsync(
        Guid userId,
        Guid achievementId,
        AcademicAchievementRequest request,
        CancellationToken cancellationToken = default)
    {
        var achievement = await _context.AcademicAchievements
            .FirstOrDefaultAsync(aa => aa.Id == achievementId && aa.UserId == userId, cancellationToken);

        if (achievement == null)
        {
            throw new ResourceNotFoundException(ProfileErrorCodes.AchievementNotFound, "Achievement not found.");
        }

        achievement.Title = request.Title.Trim();
        achievement.Issuer = request.Issuer.Trim();
        achievement.IssueDate = request.IssueDate;
        achievement.Description = request.Description.Trim();
        achievement.CredentialUrl = request.CredentialUrl?.Trim();
        achievement.UpdatedAt = DateTimeOffset.UtcNow;

        // Sync linked attachment
        // 1. Unlink any previous attachment that was linked to this achievement
        var previousAttachments = await _context.ProfileAttachments
            .Where(pa => pa.UserId == userId && pa.EntityType == "AcademicAchievement" && pa.EntityId == achievementId)
            .ToListAsync(cancellationToken);

        foreach (var pa in previousAttachments)
        {
            pa.EntityType = "Orphaned";
            pa.EntityId = null;
            pa.UpdatedAt = DateTimeOffset.UtcNow;
        }

        AttachmentResponse? attResponse = null;

        // 2. Link new attachment if provided
        if (request.AttachmentId.HasValue)
        {
            var attachment = await _context.ProfileAttachments
                .FirstOrDefaultAsync(pa => pa.Id == request.AttachmentId.Value && pa.UserId == userId, cancellationToken);

            if (attachment != null)
            {
                attachment.EntityType = "AcademicAchievement";
                attachment.EntityId = achievementId;
                attachment.UpdatedAt = DateTimeOffset.UtcNow;

                string signedUrl;
                try
                {
                    signedUrl = await _storageService.GetSignedUrlAsync(attachment.FilePath, TimeSpan.FromHours(1), cancellationToken);
                }
                catch
                {
                    signedUrl = string.Empty;
                }

                attResponse = new AttachmentResponse(
                    attachment.Id,
                    attachment.FileName,
                    attachment.FileSize,
                    attachment.FileType,
                    signedUrl,
                    attachment.CreatedAt
                );
            }
        }

        await _context.SaveChangesAsync(cancellationToken);

        return new AcademicAchievementResponse(
            achievement.Id,
            achievement.UserId,
            achievement.Title,
            achievement.Issuer,
            achievement.IssueDate,
            achievement.Description,
            achievement.CredentialUrl,
            achievement.DisplayOrder,
            attResponse
        );
    }

    public async Task DeleteAchievementAsync(Guid userId, Guid achievementId, CancellationToken cancellationToken = default)
    {
        var achievement = await _context.AcademicAchievements
            .FirstOrDefaultAsync(aa => aa.Id == achievementId && aa.UserId == userId, cancellationToken);

        if (achievement == null)
        {
            throw new ResourceNotFoundException(ProfileErrorCodes.AchievementNotFound, "Achievement not found.");
        }

        achievement.DeletedAt = DateTimeOffset.UtcNow;

        // Also clean up/soft delete or unlink associated attachments
        var attachments = await _context.ProfileAttachments
            .Where(pa => pa.UserId == userId && pa.EntityType == "AcademicAchievement" && pa.EntityId == achievementId)
            .ToListAsync(cancellationToken);

        foreach (var pa in attachments)
        {
            pa.DeletedAt = DateTimeOffset.UtcNow;
        }

        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task ReorderAchievementsAsync(Guid userId, List<Guid> orderedIds, CancellationToken cancellationToken = default)
    {
        if (orderedIds == null || orderedIds.Count == 0) return;

        var achievements = await _context.AcademicAchievements
            .Where(aa => aa.UserId == userId && orderedIds.Contains(aa.Id))
            .ToListAsync(cancellationToken);

        for (int i = 0; i < orderedIds.Count; i++)
        {
            var id = orderedIds[i];
            var aa = achievements.FirstOrDefault(x => x.Id == id);
            if (aa != null)
            {
                aa.DisplayOrder = i;
                aa.UpdatedAt = DateTimeOffset.UtcNow;
            }
        }

        await _context.SaveChangesAsync(cancellationToken);
    }
}
