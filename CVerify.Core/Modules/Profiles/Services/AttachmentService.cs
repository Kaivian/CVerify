using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Modules.AiChat.Entities;
using CVerify.API.Modules.Profiles.DTOs;
using CVerify.API.Modules.Profiles.Entities;
using CVerify.API.Modules.Shared.Exceptions;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.Storage.Enums;
using CVerify.API.Modules.Shared.Storage.Interfaces;

namespace CVerify.API.Modules.Profiles.Services;

public class AttachmentService : IAttachmentService
{
    private readonly ApplicationDbContext _context;
    private readonly IStorageService _storageService;

    public AttachmentService(ApplicationDbContext context, IStorageService storageService)
    {
        _context = context;
        _storageService = storageService;
    }

    public async Task<AttachmentResponse> UploadAttachmentAsync(
        Guid userId,
        string entityType,
        Guid? entityId,
        Stream fileStream,
        string fileName,
        string contentType,
        CancellationToken cancellationToken = default)
    {
        // 1. Determine Storage Module rules based on EntityType
        StorageModule module = StorageModule.Evidence;
        if (string.Equals(entityType, "Avatar", StringComparison.OrdinalIgnoreCase))
        {
            module = StorageModule.Profile;
        }
        else if (string.Equals(entityType, "AcademicAchievement", StringComparison.OrdinalIgnoreCase))
        {
            module = StorageModule.Evidence; // Or StorageModule.Achievement / StorageModule.Certificate
        }

        // 2. Perform the physical upload to Cloudflare R2
        var uploadedFile = await _storageService.UploadFileAsync(
            fileStream,
            fileName,
            contentType,
            module,
            null,
            cancellationToken);

        // 3. Save reference in PostgreSQL database
        var attachment = new ProfileAttachment
        {
            Id = Guid.CreateVersion7(),
            UserId = userId,
            EntityType = entityType,
            EntityId = entityId,
            FileName = fileName,
            FilePath = uploadedFile.ObjectKey, // R2 unique object key
            FileSize = uploadedFile.Size,
            FileType = uploadedFile.MimeType,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        _context.ProfileAttachments.Add(attachment);
        await _context.SaveChangesAsync(cancellationToken);

        // 4. Generate signed retrieval URL for immediate client preview
        var signedUrl = await _storageService.GetSignedUrlAsync(attachment.FilePath, TimeSpan.FromHours(1), cancellationToken);

        return new AttachmentResponse(
            attachment.Id,
            attachment.FileName,
            attachment.FileSize,
            attachment.FileType,
            signedUrl,
            attachment.CreatedAt
        );
    }

    public async Task<AttachmentResponse> GetAttachmentAsync(Guid userId, Guid attachmentId, CancellationToken cancellationToken = default)
    {
        var attachment = await _context.ProfileAttachments
            .FirstOrDefaultAsync(pa => pa.Id == attachmentId && pa.UserId == userId, cancellationToken);

        if (attachment == null)
        {
            throw new ResourceNotFoundException(ProfileErrorCodes.AttachmentNotFound, "Attachment not found.");
        }

        var signedUrl = await _storageService.GetSignedUrlAsync(attachment.FilePath, TimeSpan.FromHours(1), cancellationToken);

        return new AttachmentResponse(
            attachment.Id,
            attachment.FileName,
            attachment.FileSize,
            attachment.FileType,
            signedUrl,
            attachment.CreatedAt
        );
    }

    public async Task<string> GetAttachmentSignedUrlAsync(Guid userId, Guid attachmentId, CancellationToken cancellationToken = default)
    {
        var attachment = await _context.ProfileAttachments
            .FirstOrDefaultAsync(pa => pa.Id == attachmentId && pa.UserId == userId, cancellationToken);

        if (attachment == null)
        {
            throw new ResourceNotFoundException(ProfileErrorCodes.AttachmentNotFound, "Attachment not found.");
        }

        return await _storageService.GetSignedUrlAsync(attachment.FilePath, TimeSpan.FromHours(1), cancellationToken);
    }

    public async Task DeleteAttachmentAsync(Guid userId, Guid attachmentId, CancellationToken cancellationToken = default)
    {
        var attachment = await _context.ProfileAttachments
            .FirstOrDefaultAsync(pa => pa.Id == attachmentId && pa.UserId == userId, cancellationToken);

        if (attachment == null)
        {
            throw new ResourceNotFoundException(ProfileErrorCodes.AttachmentNotFound, "Attachment not found.");
        }

        // Clean up from Cloudflare R2 physically
        try
        {
            await _storageService.DeleteFileAsync(attachment.FilePath, cancellationToken);
        }
        catch (Exception ex)
        {
            // Log warning but proceed with DB soft-delete to avoid locking state
            Console.WriteLine($"[R2 Cleanup Warning] Failed to delete object '{attachment.FilePath}' physically: {ex.Message}");
        }

        // Soft delete from database
        attachment.DeletedAt = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);
    }
}
