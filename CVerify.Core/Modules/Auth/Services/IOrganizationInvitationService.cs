using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using CVerify.API.Modules.Auth.DTOs;

namespace CVerify.API.Modules.Auth.Services;

public interface IOrganizationInvitationService
{
    Task InviteMembersAsync(Guid orgId, Guid actorUserId, CreateInvitationsDto dto, CancellationToken cancellationToken);
    Task<PaginatedInvitationsResponseDto> GetInvitationsAsync(Guid orgId, int page, int pageSize, CancellationToken cancellationToken);
    Task ResendInvitationAsync(Guid orgId, Guid actorUserId, Guid invitationId, CancellationToken cancellationToken);
    Task CancelInvitationAsync(Guid orgId, Guid actorUserId, Guid invitationId, CancellationToken cancellationToken);
    Task AcceptInvitationAsync(Guid userId, string token, CancellationToken cancellationToken);
}
