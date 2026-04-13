using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using CVerify.API.Modules.Recovery.DTOs;

namespace CVerify.API.Modules.Recovery.Services;

public interface ILevel2RecoveryService
{
    Task<Level2CheckResponse> CheckOrganizationAsync(string taxCode, CancellationToken cancellationToken);
    Task<RepresentativeRotationRequestResponse> RequestRotationAsync(RepresentativeRotationRequestDto request, string userAgent, string ipAddress, CancellationToken cancellationToken);
    Task<List<RepresentativeRotationRequestResponse>> GetRequestsQueueAsync(CancellationToken cancellationToken);
    Task<bool> RecordVerificationCallAsync(Guid requestId, string notes, string status, string reviewerName, CancellationToken cancellationToken);
    Task<bool> ReviewSupportApprovalAsync(Guid requestId, string decision, string reviewerName, string userAgent, string ipAddress, CancellationToken cancellationToken);
    Task<bool> SubmitAdminVoteAsync(string token, string decision, string ipAddress, string userAgent, CancellationToken cancellationToken);
    Task<bool> ExecuteRotationAsync(Guid requestId, string executedBy, string userAgent, string ipAddress, CancellationToken cancellationToken);
    Task<List<RepresentativeAuthorityHistoryResponse>> GetOrganizationHistoryAsync(Guid organizationId, CancellationToken cancellationToken);
}
