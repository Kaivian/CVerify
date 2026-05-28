using System;
using System.Collections.Generic;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using CVerify.API.Application.DTOs;

namespace CVerify.API.Application.Interfaces;

public interface IOrganizationReclaimService
{
    Task<SubmitClaimResponse> SubmitClaimAsync(
        SubmitClaimRequest request, 
        List<(Stream fileStream, string fileName, string contentType)> documents, 
        string userAgent, 
        string ipAddress, 
        CancellationToken cancellationToken = default);

    Task<List<ClaimDetailsResponse>> GetPendingClaimsAsync(CancellationToken cancellationToken = default);

    Task<bool> ReviewClaimAsync(Guid claimId, ReviewClaimRequest request, string reviewerName, CancellationToken cancellationToken = default);

    Task<VerifyBootstrapResponse> VerifyBootstrapTokenAsync(string token, CancellationToken cancellationToken = default);

    Task<SetupRecoveryCredentialsResponse> SetupRecoveryCredentialsAsync(SetupRecoveryCredentialsRequest request, CancellationToken cancellationToken = default);

    Task<AuthResponse> ExecuteRecoveryAsync(ExecuteRecoveryRequest request, string userAgent, string ipAddress, CancellationToken cancellationToken = default);

    Task<VerifyOtpResponse> VerifyRecoveryOtpAsync(VerifyOtpRequest request, string taxCode, CancellationToken cancellationToken = default);

    Task<RecoveryEmailValidationResult> ValidateRecoveryEmailOwnershipAsync(string taxCode, string email, CancellationToken cancellationToken = default);

    Task<(Stream fileStream, string fileName, string contentType)> DownloadDocumentAsync(Guid docId, string reviewerName, CancellationToken cancellationToken = default);
}
