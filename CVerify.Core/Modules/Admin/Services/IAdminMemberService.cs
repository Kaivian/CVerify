using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using CVerify.API.Modules.Admin.DTOs;
using CVerify.API.Modules.Shared.System.DTOs;

namespace CVerify.API.Modules.Admin.Services;

public interface IAdminMemberService
{
    Task<PaginatedResultDto<AdminMemberListItemDto>> GetMembersAsync(
        string? search, string? status, int page, int pageSize, CancellationToken cancellationToken);
    
    Task InviteMemberAsync(Guid actorUserId, InviteAdminDto dto, CancellationToken cancellationToken);
    
    Task AcceptInvitationAsync(Guid userId, string token, CancellationToken cancellationToken);
    
    Task UpdateMemberAsync(Guid actorUserId, Guid memberId, UpdateAdminMemberDto dto, CancellationToken cancellationToken);
    
    Task RemoveMemberAsync(Guid actorUserId, Guid memberId, CancellationToken cancellationToken);
    
    Task<PaginatedResultDto<AdminInvitationListItemDto>> GetInvitationsAsync(
        string? search, int page, int pageSize, CancellationToken cancellationToken);
    
    Task CancelInvitationAsync(Guid actorUserId, Guid invitationId, CancellationToken cancellationToken);
}
