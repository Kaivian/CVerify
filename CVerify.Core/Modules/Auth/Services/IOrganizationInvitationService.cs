using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using CVerify.API.Modules.Auth.DTOs;

namespace CVerify.API.Modules.Auth.Services;

public interface IOrganizationInvitationService
{
    Task InviteMembersAsync(Guid orgId, Guid? actorUserId, CreateInvitationsDto dto, CancellationToken cancellationToken);
    Task<PaginatedInvitationsResponseDto> GetInvitationsAsync(Guid orgId, string? status, int page, int pageSize, CancellationToken cancellationToken);
    Task ResendInvitationAsync(Guid orgId, Guid? actorUserId, Guid invitationId, CancellationToken cancellationToken);
    Task CancelInvitationAsync(Guid orgId, Guid? actorUserId, Guid invitationId, CancellationToken cancellationToken);
    Task<string> AcceptInvitationAsync(Guid userId, string token, CancellationToken cancellationToken);
    Task<string> DeclineInvitationAsync(Guid userId, string token, CancellationToken cancellationToken);
    Task<string> AcceptInvitationByIdAsync(Guid userId, Guid invitationId, CancellationToken cancellationToken);
    Task<string> DeclineInvitationByIdAsync(Guid userId, Guid invitationId, CancellationToken cancellationToken);
}
