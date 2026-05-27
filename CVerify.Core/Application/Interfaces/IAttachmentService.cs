using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using CVerify.API.Application.DTOs;

namespace CVerify.API.Application.Interfaces;

public interface IAttachmentService
{
    Task<AttachmentResponse> UploadAttachmentAsync(
        Guid userId, 
        string entityType, 
        Guid? entityId, 
        Stream fileStream, 
        string fileName, 
        string contentType, 
        CancellationToken cancellationToken = default);
        
    Task<AttachmentResponse> GetAttachmentAsync(Guid userId, Guid attachmentId, CancellationToken cancellationToken = default);
    
    Task<string> GetAttachmentSignedUrlAsync(Guid userId, Guid attachmentId, CancellationToken cancellationToken = default);
    
    Task DeleteAttachmentAsync(Guid userId, Guid attachmentId, CancellationToken cancellationToken = default);
}
