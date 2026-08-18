using System;
using System.Threading;
using System.Threading.Tasks;
using CVerify.API.Modules.Admin.DTOs;
using CVerify.API.Modules.Shared.System.DTOs;

namespace CVerify.API.Modules.Admin.Services;

public interface IUserAdministrationService
{
    Task<PaginatedResultDto<UserListItemDto>> GetPlatformUsersAsync(
        string? search, string? status, string? roleName, int page, int pageSize, CancellationToken cancellationToken);

    Task<UserListItemDto> GetPlatformUserByIdAsync(
        Guid userId, CancellationToken cancellationToken);

    Task<UserListItemDto> UpdatePlatformUserStatusAndRolesAsync(
        Guid actorUserId, Guid targetUserId, UpdateUserDto dto, CancellationToken cancellationToken);

    Task DeletePlatformUserAsync(
        Guid actorUserId, Guid targetUserId, CancellationToken cancellationToken);
}
