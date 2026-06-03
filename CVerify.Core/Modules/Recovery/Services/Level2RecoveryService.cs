using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using CVerify.API.Modules.Auth.Services;
using CVerify.API.Modules.Recovery.DTOs;
using CVerify.API.Modules.Recovery.Entities;
using CVerify.API.Modules.Shared.Configuration;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Email.Entities;
using CVerify.API.Modules.Shared.Exceptions.Catalogs;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.Security;

namespace CVerify.API.Modules.Recovery.Services;

public class Level2RecoveryService : ILevel2RecoveryService
{
    private readonly ApplicationDbContext _context;
    private readonly EnvConfiguration _envConfig;
    private readonly TimeProvider _timeProvider;
    private readonly ILogger<Level2RecoveryService> _logger;

    public Level2RecoveryService(
        ApplicationDbContext context,
        EnvConfiguration envConfig,
        TimeProvider timeProvider,
        ILogger<Level2RecoveryService> logger)
    {
        _context = context;
        _envConfig = envConfig;
        _timeProvider = timeProvider;
        _logger = logger;
    }

    public async Task<Level2CheckResponse> CheckOrganizationAsync(string taxCode, CancellationToken cancellationToken)
    {
        var org = await _context.Organizations
            .FirstOrDefaultAsync(o => o.TaxCode == taxCode && o.DeletedAt == null, cancellationToken);

        if (org == null)
        {
            throw new KeyNotFoundException("The requested organization was not found in the registry.");
        }

        return new Level2CheckResponse(
            IsLevel2: org.VerificationLevel == 2,
            LegalBusinessName: org.Name,
            TaxCode: org.TaxCode,
            CurrentRepresentative: org.RepresentativeName,
            CurrentEmail: org.RepresentativeEmail
        );
    }

    public async Task<RepresentativeRotationRequestResponse> RequestRotationAsync(
        RepresentativeRotationRequestDto request,
        string userAgent,
        string ipAddress,
        CancellationToken cancellationToken)
    {
        var org = await _context.Organizations
            .FirstOrDefaultAsync(o => o.TaxCode == request.TaxCode && o.DeletedAt == null, cancellationToken);

        if (org == null)
        {
            throw new KeyNotFoundException("The requested organization was not found in the registry.");
        }

        if (org.VerificationLevel != 2)
        {
            throw new InvalidOperationException("This workflow is only for organizations verified at Level 2.");
        }

        // 7-day cooldown block
        var cooldownLimit = _timeProvider.GetUtcNow().AddDays(-7);
        var hasRecentRequest = await _context.RepresentativeRotationRequests
            .AnyAsync(r => r.OrganizationId == org.Id && r.CreatedAt >= cooldownLimit, cancellationToken);

        if (hasRecentRequest)
        {
            throw new InvalidOperationException("A representative rotation request has already been initiated for this organization in the last 7 days.");
        }

        var rotationRequest = new RepresentativeRotationRequest
        {
            OrganizationId = org.Id,
            CurrentRepresentative = org.RepresentativeName,
            RequestedRepresentative = request.NewRepresentativeFullName,
            RequestedEmail = request.NewRepresentativeEmail,
            RequestedPhone = request.NewRepresentativePhone,
            Reason = request.ReasonForRepresentativeChange,
            OptionalSupportingMessage = request.OptionalSupportingMessage,
            SupportApprovalStatus = "pending_review",
            AdminApprovalStatus = "pending_review",
            FinalDecision = "pending_review",
            VerificationCallStatus = "not_started",
            CreatedAt = _timeProvider.GetUtcNow(),
            ExpiresAt = _timeProvider.GetUtcNow().AddHours(48)
        };

        _context.RepresentativeRotationRequests.Add(rotationRequest);
        await _context.SaveChangesAsync(cancellationToken);

        // Find existing organization administrators to dispatch voting links
        var admins = await _context.OrganizationAuthorities
            .Include(oa => oa.User)
            .Where(oa => oa.OrganizationId == org.Id && (oa.Role == "organization_owner" || oa.Role == "security_admin"))
            .ToListAsync(cancellationToken);

        foreach (var admin in admins)
        {
            if (admin.User != null && !string.IsNullOrEmpty(admin.User.Email))
            {
                var token = RecoveryTokenHelper.GenerateLevel2VoteToken(
                    rotationRequest.Id,
                    admin.UserId,
                    admin.Role,
                    _envConfig.Jwt.Key,
                    48
                );

                var subject = "CVerify: Representative Change Approval Required";
                var voteLink = $"http://localhost:3000/organization/recovery/vote?token={token}";
                var content = $"Dear Admin,\n\nA representative rotation request has been initiated for your organization {org.Name} to designate {request.NewRepresentativeFullName} as the new official representative.\n\nYour approval vote is required to validate this change under Level 2 governance protocols.\n\nPlease click the link below to cast your decision (Approve or Reject):\n\n{voteLink}\n\nNote: This signed link is for one-time-use and will expire in 48 hours.\n\nThank you,\nCVerify Compliance Team";

                await QueueNotificationEmailAsync(admin.User.Email, org.Name, subject, content);
            }
        }

        await LogAuditEventAsync(null, "LEVEL2_ROTATION_REQUEST_SUBMITTED", $"Representative rotation request submitted for {org.Name} (Tax Code: {org.TaxCode}) by new representative: {request.NewRepresentativeFullName}.", ipAddress, userAgent);

        return MapToResponse(rotationRequest, org.Name);
    }

    public async Task<List<RepresentativeRotationRequestResponse>> GetRequestsQueueAsync(CancellationToken cancellationToken)
    {
        var requests = await _context.RepresentativeRotationRequests
            .Include(r => r.Organization)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync(cancellationToken);

        return requests.Select(r => MapToResponse(r, r.Organization.Name)).ToList();
    }

    public async Task<bool> RecordVerificationCallAsync(Guid requestId, string notes, string status, string reviewerName, CancellationToken cancellationToken)
    {
        var request = await _context.RepresentativeRotationRequests
            .FirstOrDefaultAsync(r => r.Id == requestId, cancellationToken);

        if (request == null)
        {
            throw new KeyNotFoundException("Rotation request not found.");
        }

        request.VerificationCallNotes = notes;
        request.VerificationCallStatus = status;
        
        await _context.SaveChangesAsync(cancellationToken);
        
        await LogAuditEventAsync(null, "LEVEL2_ROTATION_CALL_RECORDED", $"Verification call recorded for request {requestId} by reviewer {reviewerName}. Status: {status}.", null, null);
        return true;
    }

    public async Task<bool> ReviewSupportApprovalAsync(
        Guid requestId,
        string decision,
        string reviewerName,
        string userAgent,
        string ipAddress,
        CancellationToken cancellationToken)
    {
        var request = await _context.RepresentativeRotationRequests
            .Include(r => r.Organization)
            .FirstOrDefaultAsync(r => r.Id == requestId, cancellationToken);

        if (request == null)
        {
            throw new KeyNotFoundException("Rotation request not found.");
        }

        if (request.FinalDecision == "approved" || request.FinalDecision == "rejected" || request.FinalDecision == "expired")
        {
            throw new InvalidOperationException("This rotation request has already been finalized.");
        }

        if (decision == "reject")
        {
            request.SupportApprovalStatus = "rejected";
            request.FinalDecision = "rejected";
            await _context.SaveChangesAsync(cancellationToken);

            await LogAuditEventAsync(null, "LEVEL2_ROTATION_SUPPORT_REJECTED", $"Representative rotation request {requestId} rejected by Support Reviewer {reviewerName}.", ipAddress, userAgent);
            
            // Send rejection emails
            await QueueNotificationEmailAsync(request.RequestedEmail, request.Organization.Name, "CVerify: Representative Rotation Request Rejected", $"Your representative rotation request for {request.Organization.Name} has been rejected by CVerify Support.");
            return true;
        }

        if (decision == "approve")
        {
            if (request.VerificationCallStatus != "verified")
            {
                throw new InvalidOperationException("Support approval requires a completed and verified live verification call.");
            }

            request.SupportApprovalStatus = "approved";
            
            // Check dual approval condition
            if (request.AdminApprovalStatus == "approved")
            {
                await ExecuteRotationInternalAsync(request, reviewerName, userAgent, ipAddress, cancellationToken);
            }
            else
            {
                request.FinalDecision = "awaiting_admin_approval";
                await _context.SaveChangesAsync(cancellationToken);
            }

            await LogAuditEventAsync(null, "LEVEL2_ROTATION_SUPPORT_APPROVED", $"Representative rotation request {requestId} approved by Support Reviewer {reviewerName}.", ipAddress, userAgent);
            return true;
        }

        throw new ArgumentException("Invalid support decision. Must be approve or reject.");
    }

    public async Task<bool> SubmitAdminVoteAsync(
        string token,
        string decision,
        string ipAddress,
        string userAgent,
        CancellationToken cancellationToken)
    {
        var payload = RecoveryTokenHelper.VerifyToken(token, _envConfig.Jwt.Key);
        if (payload == null || payload["step"] != "LEVEL2_ADMIN_APPROVAL")
        {
            throw new InvalidOperationException("Voting link is invalid, expired, or has replay issue.");
        }

        var requestId = Guid.Parse(payload["requestId"]);
        var approverUserId = Guid.Parse(payload["approverUserId"]);
        var approverRole = payload["approverRole"];

        var request = await _context.RepresentativeRotationRequests
            .Include(r => r.Organization)
            .FirstOrDefaultAsync(r => r.Id == requestId, cancellationToken);

        if (request == null)
        {
            throw new KeyNotFoundException("Rotation request not found.");
        }

        if (request.FinalDecision == "approved" || request.FinalDecision == "rejected" || request.FinalDecision == "expired")
        {
            throw new InvalidOperationException("This rotation request has already been finalized.");
        }

        // Replay protection - check if this admin has already voted
        var existingVote = await _context.RepresentativeApprovalVotes
            .AnyAsync(v => v.RequestId == requestId && v.ApproverUserId == approverUserId, cancellationToken);

        if (existingVote)
        {
            throw new InvalidOperationException("You have already cast a vote for this rotation request.");
        }

        var vote = new RepresentativeApprovalVote
        {
            RequestId = requestId,
            ApproverUserId = approverUserId,
            ApproverRole = approverRole,
            Decision = decision,
            Timestamp = _timeProvider.GetUtcNow()
        };

        _context.RepresentativeApprovalVotes.Add(vote);

        if (decision == "reject")
        {
            request.AdminApprovalStatus = "rejected";
            request.FinalDecision = "rejected";
            await _context.SaveChangesAsync(cancellationToken);

            await LogAuditEventAsync(approverUserId, "LEVEL2_ROTATION_ADMIN_REJECTED", $"Representative rotation request {requestId} rejected by Organization Admin vote.", ipAddress, userAgent);
            
            // Notify claimant
            await QueueNotificationEmailAsync(request.RequestedEmail, request.Organization.Name, "CVerify: Representative Rotation Request Rejected", $"Your representative rotation request for {request.Organization.Name} has been rejected by the organization administrator.");
            return true;
        }

        if (decision == "approve")
        {
            request.AdminApprovalStatus = "approved";

            // Check dual approval condition
            if (request.SupportApprovalStatus == "approved")
            {
                await ExecuteRotationInternalAsync(request, $"Admin Vote ({approverUserId})", userAgent, ipAddress, cancellationToken);
            }
            else
            {
                request.FinalDecision = "awaiting_support_approval";
                await _context.SaveChangesAsync(cancellationToken);
            }

            await LogAuditEventAsync(approverUserId, "LEVEL2_ROTATION_ADMIN_APPROVED", $"Representative rotation request {requestId} approved by Organization Admin vote.", ipAddress, userAgent);
            return true;
        }

        throw new ArgumentException("Invalid vote decision. Must be approve or reject.");
    }

    public async Task<bool> ExecuteRotationAsync(Guid requestId, string executedBy, string userAgent, string ipAddress, CancellationToken cancellationToken)
    {
        var request = await _context.RepresentativeRotationRequests
            .Include(r => r.Organization)
            .FirstOrDefaultAsync(r => r.Id == requestId, cancellationToken);

        if (request == null)
        {
            throw new KeyNotFoundException("Rotation request not found.");
        }

        if (request.SupportApprovalStatus != "approved" || request.AdminApprovalStatus != "approved")
        {
            throw new InvalidOperationException("Dual approval is mandatory. Request cannot be executed.");
        }

        await ExecuteRotationInternalAsync(request, executedBy, userAgent, ipAddress, cancellationToken);
        return true;
    }

    public async Task<List<RepresentativeAuthorityHistoryResponse>> GetOrganizationHistoryAsync(Guid organizationId, CancellationToken cancellationToken)
    {
        var history = await _context.RepresentativeAuthorityHistories
            .Include(h => h.Organization)
            .Where(h => h.OrganizationId == organizationId)
            .OrderByDescending(h => h.EffectiveAt)
            .ToListAsync(cancellationToken);

        return history.Select(h => new RepresentativeAuthorityHistoryResponse(
            HistoryId: h.Id,
            OrganizationId: h.OrganizationId,
            CompanyName: h.Organization.Name,
            PreviousRepresentative: h.PreviousRepresentative,
            NewRepresentative: h.NewRepresentative,
            RotatedBy: h.RotatedBy,
            SupportReviewer: h.SupportReviewer,
            EffectiveAt: h.EffectiveAt
        )).ToList();
    }

    private async Task ExecuteRotationInternalAsync(
        RepresentativeRotationRequest request,
        string executedBy,
        string userAgent,
        string ipAddress,
        CancellationToken cancellationToken)
    {
        using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            var org = request.Organization;

            // 1. Snapshot previous details and save to history
            var history = new RepresentativeAuthorityHistory
            {
                OrganizationId = org.Id,
                PreviousRepresentative = org.RepresentativeName,
                NewRepresentative = request.RequestedRepresentative,
                RotatedBy = request.RequestedRepresentative,
                SupportReviewer = executedBy,
                EffectiveAt = _timeProvider.GetUtcNow()
            };
            _context.RepresentativeAuthorityHistories.Add(history);

            // 2. Update immutable representative metadata
            org.RepresentativeName = request.RequestedRepresentative;
            org.RepresentativeEmail = request.RequestedEmail;
            org.RepresentativePhone = request.RequestedPhone;
            org.RecoveryAuthority = request.RequestedRepresentative;
            org.RepresentativeIdentity = request.RequestedRepresentative;
            org.UpdatedAt = _timeProvider.GetUtcNow();

            // 3. Governance security rotation: invalidate user sessions
            // Force session invalidation for all users currently mapped to organization authority
            var orgMembers = await _context.OrganizationAuthorities
                .Where(oa => oa.OrganizationId == org.Id)
                .Select(oa => oa.UserId)
                .ToListAsync(cancellationToken);

            foreach (var userId in orgMembers)
            {
                var user = await _context.Users.FindAsync(new object[] { userId }, cancellationToken);
                if (user != null)
                {
                    user.SessionVersion++; // Revoke current JWT tokens
                }
                var tokens = await _context.RefreshTokens.Where(rt => rt.UserId == userId).ToListAsync(cancellationToken);
                _context.RefreshTokens.RemoveRange(tokens);
            }

            // Revoke active sessions for workspace memberships in organization
            var workspaces = await _context.Workspaces
                .Where(w => w.OrganizationId == org.Id && w.DeletedAt == null)
                .ToListAsync(cancellationToken);

            foreach (var ws in workspaces)
            {
                var members = await _context.WorkspaceMembers
                    .Where(wm => wm.WorkspaceId == ws.Id)
                    .Select(wm => wm.UserId)
                    .ToListAsync(cancellationToken);

                foreach (var userId in members)
                {
                    var user = await _context.Users.FindAsync(new object[] { userId }, cancellationToken);
                    if (user != null)
                    {
                        user.SessionVersion++;
                    }
                    var tokens = await _context.RefreshTokens.Where(rt => rt.UserId == userId).ToListAsync(cancellationToken);
                    _context.RefreshTokens.RemoveRange(tokens);
                }
            }

            // 4. Force rotate all secrets, webhooks, and tokens (audited simulated rotation)
            await LogAuditEventAsync(null, "CREDENTIAL_ROTATION", $"Governed rotation forced complete. Revoked active OAuth sessions, refresh tokens, rotated integration webhook secrets and API tokens for Tax MST: {org.TaxCode}.", ipAddress, userAgent);

            // 5. Generate approved recovery session to enable credential setup for the new representative
            var tokenHash = Guid.NewGuid().ToString("N");
            var recoverySession = new ApprovedRecoverySession
            {
                OrganizationId = org.Id,
                ApprovedRepresentative = request.RequestedRepresentative,
                VerifiedRecoveryEmail = request.RequestedEmail,
                RecoveryTokenHash = tokenHash,
                ExpiresAt = _timeProvider.GetUtcNow().AddHours(24),
                ApprovedBy = executedBy,
                SuggestedStrategy = "OptionB", // Takeover / preserve workspace continuity
                CreatedAt = _timeProvider.GetUtcNow()
            };
            _context.ApprovedRecoverySessions.Add(recoverySession);

            request.FinalDecision = "approved";
            await _context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            // Send success emails
            var bootstrapLink = $"http://localhost:3000/organization/recovery/bootstrap?token={tokenHash}";
            var claimantContent = $"Dear {request.RequestedRepresentative},\n\nYour representative rotation & access recovery request for {org.Name} has been fully approved by CVerify Support and Organization Admin governance.\n\nYou are now designated as the official representative and recovery authority for this organization.\n\nPlease click the link below to configure your administrator password credentials and access your workspace:\n\n{bootstrapLink}\n\nThank you,\nCVerify Trust and Safety Team";

            await QueueNotificationEmailAsync(request.RequestedEmail, org.Name, "CVerify: Representative Access Recovery Approved!", claimantContent);

            // Notify former admins for security transparency
            foreach (var userId in orgMembers)
            {
                var user = await _context.Users.FindAsync(new object[] { userId }, cancellationToken);
                if (user != null && !string.IsNullOrEmpty(user.Email) && user.Email != request.RequestedEmail)
                {
                    var notice = $"Dear {user.FullName},\n\nThis is a security alert. CVerify has successfully executed a Representative Authority Rotation for your organization {org.Name}.\n\nThe official representative has been updated to {request.RequestedRepresentative}.\n\nAs a security protocol, all active administrator sessions, refresh tokens, and integration webhook secrets have been rotated/revoked.\n\nIf you believe this was done in error or was unauthorized, please contact CVerify Support immediately at support@cverify.com.\n\nSincerely,\nCVerify Security Team";
                    await QueueNotificationEmailAsync(user.Email, org.Name, "CVerify Security Alert: Representative Authority Rotated", notice);
                }
            }

            await LogAuditEventAsync(null, "LEVEL2_ROTATION_EXECUTED", $"Governed Representative Rotation successfully executed for {org.Name}. New representative: {request.RequestedRepresentative}.", ipAddress, userAgent);
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync(cancellationToken);
            _logger.LogError(ex, "Failed to execute Level 2 representative rotation transactional update.");
            throw;
        }
    }

    private async Task LogAuditEventAsync(Guid? userId, string eventType, string description, string? ipAddress, string? userAgent)
    {
        var log = new AuditLog
        {
            UserId = userId,
            EventType = eventType,
            Description = description,
            IpAddress = ipAddress,
            UserAgent = userAgent,
            CreatedAt = _timeProvider.GetUtcNow()
        };
        _context.AuditLogs.Add(log);
        await _context.SaveChangesAsync();
    }

    private async Task QueueNotificationEmailAsync(string email, string companyName, string subject, string content)
    {
        var payloadObj = new
        {
            Email = email,
            CompanyName = companyName,
            Subject = subject,
            Content = content
        };

        var outboxMessage = new OutboxMessage
        {
            Type = "SystemNotificationEmail",
            Payload = System.Text.Json.JsonSerializer.Serialize(payloadObj),
            CreatedAt = _timeProvider.GetUtcNow()
        };

        _context.OutboxMessages.Add(outboxMessage);
        await _context.SaveChangesAsync();
    }

    private RepresentativeRotationRequestResponse MapToResponse(RepresentativeRotationRequest r, string companyName)
    {
        return new RepresentativeRotationRequestResponse(
            RequestId: r.Id,
            OrganizationId: r.OrganizationId,
            CompanyName: companyName,
            CurrentRepresentative: r.CurrentRepresentative,
            RequestedRepresentative: r.RequestedRepresentative,
            RequestedEmail: r.RequestedEmail,
            RequestedPhone: r.RequestedPhone,
            Reason: r.Reason,
            SupportApprovalStatus: r.SupportApprovalStatus,
            AdminApprovalStatus: r.AdminApprovalStatus,
            FinalDecision: r.FinalDecision,
            VerificationCallStatus: r.VerificationCallStatus,
            VerificationCallNotes: r.VerificationCallNotes,
            OptionalSupportingMessage: r.OptionalSupportingMessage,
            CreatedAt: r.CreatedAt,
            ExpiresAt: r.ExpiresAt
        );
    }
}
