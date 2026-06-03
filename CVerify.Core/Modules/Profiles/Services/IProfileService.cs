using System;
using System.Threading;
using System.Threading.Tasks;
using CVerify.API.Modules.Profiles.DTOs;

namespace CVerify.API.Modules.Profiles.Services;

public interface IProfileService
{
    Task<ProfileResponse> GetProfileByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);
    
    Task<ProfileResponse> UpdateProfileAsync(
        Guid userId, 
        UpdateProfileRequest request, 
        string? ipAddress = null, 
        string? userAgent = null, 
        CancellationToken cancellationToken = default);
        
    Task UpdateUsernameAsync(
        Guid userId, 
        string newUsername, 
        string? ipAddress = null, 
        string? userAgent = null, 
        CancellationToken cancellationToken = default);

    Task<(string SignedUrl, string ObjectKey)> UploadAvatarAsync(
        Guid userId,
        System.IO.Stream fileStream,
        string fileName,
        string contentType,
        CancellationToken cancellationToken = default);

    Task<(string SignedUrl, string ObjectKey)> SyncAvatarWithProviderAsync(
        Guid userId,
        string providerName,
        CancellationToken cancellationToken = default);

    Task DeleteAvatarAsync(
        Guid userId,
        CancellationToken cancellationToken = default);

    Task<PublicProfileResponse> GetPublicProfileByUsernameAsync(string username, CancellationToken cancellationToken = default);
}
