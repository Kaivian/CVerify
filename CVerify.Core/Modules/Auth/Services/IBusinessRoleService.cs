using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using CVerify.API.Modules.Auth.DTOs;

namespace CVerify.API.Modules.Auth.Services;

public interface IBusinessRoleService
{
    Task<List<BusinessRoleDetailsDto>> GetRolesAsync(Guid orgId, CancellationToken cancellationToken);
    Task<Guid> CreateRoleAsync(Guid orgId, Guid? actorUserId, CreateBusinessRoleDto dto, CancellationToken cancellationToken);
    Task UpdateRoleAsync(Guid orgId, Guid? actorUserId, Guid roleId, CreateBusinessRoleDto dto, CancellationToken cancellationToken);
    Task DeleteRoleAsync(Guid orgId, Guid? actorUserId, Guid roleId, CancellationToken cancellationToken);
    Task<List<RoleAssignmentDto>> GetRoleAssignmentsAsync(Guid orgId, CancellationToken cancellationToken);
    Task AssignRoleAsync(Guid orgId, Guid? actorUserId, AssignScopedRoleDto dto, CancellationToken cancellationToken);
    Task RevokeRoleAsync(Guid orgId, Guid? actorUserId, AssignScopedRoleDto dto, CancellationToken cancellationToken);
    Task<PaginatedAuditLogsResponseDto> GetAuditLogsAsync(Guid orgId, int page, int pageSize, CancellationToken cancellationToken);
    Task<List<PermissionDto>> GetAvailablePermissionsAsync(CancellationToken cancellationToken);
}
