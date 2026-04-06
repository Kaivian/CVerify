using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using CVerify.API.Application.DTOs;
using CVerify.API.Application.Interfaces;
using CVerify.API.Core.Entities;
using CVerify.API.Infrastructure.Configuration;
using CVerify.API.Infrastructure.Persistence;
using CVerify.API.Infrastructure.Security;
using CVerify.API.Application.Security.OtpPolicies;

namespace CVerify.API.Application.Services;

public class RecoveryService : IRecoveryService
{
    private readonly ApplicationDbContext _context;
    private readonly IEncryptedFileStorageService _encryptedFileStorageService;
    private readonly IRecoveryExecutionEngine _executionEngine;
    private readonly EnvConfiguration _envConfig;
    private readonly TimeProvider _timeProvider;
    private readonly ICacheService _cacheService;
    private readonly ILogger<RecoveryService> _logger;
    private readonly IOtpPolicyService _otpPolicyService;

    public RecoveryService(
        ApplicationDbContext context,
        IEncryptedFileStorageService encryptedFileStorageService,
        IRecoveryExecutionEngine executionEngine,
        EnvConfiguration envConfig,
        TimeProvider timeProvider,
        ICacheService cacheService,
        ILogger<RecoveryService> logger,
        IOtpPolicyService otpPolicyService)
    {
        _context = context;
        _encryptedFileStorageService = encryptedFileStorageService;
        _executionEngine = executionEngine;
        _envConfig = envConfig;
        _timeProvider = timeProvider;
        _cacheService = cacheService;
        _logger = logger;
        _otpPolicyService = otpPolicyService;
    }

    public async Task<SubmitClaimResponse> SubmitClaimAsync(
        SubmitClaimRequest request,
        List<(Stream fileStream, string fileName, string contentType)> documents,
        string userAgent,
        string ipAddress,
        CancellationToken cancellationToken = default)
    {
        // 1. Verify representative OTP validation token
        var otpPayload = RecoveryTokenHelper.VerifyToken(request.EmailVerificationToken, _envConfig.Jwt.Key);
        if (otpPayload == null || 
            otpPayload["step"] != "OTP_VERIFIED" || 
            !string.Equals(otpPayload["taxCode"], request.TaxCode, StringComparison.OrdinalIgnoreCase) || 
            !string.Equals(otpPayload["email"], request.RecoveryEmail, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Email OTP verification token is invalid or has expired.");
        }

        // 2. Fetch target organization
        var org = await _context.Organizations
            .FirstOrDefaultAsync(o => o.TaxCode == request.TaxCode && o.DeletedAt == null, cancellationToken);

        if (org == null)
        {
            throw new KeyNotFoundException("The requested organization was not found in the registry.");
        }

        // 3. Enforce 7-day cooldown block
        var cooldownLimit = _timeProvider.GetUtcNow().AddDays(-7);
        var hasRecentClaim = await _context.OrganizationRecoveryClaims
            .AnyAsync(c => c.OrganizationId == org.Id && c.CreatedAt >= cooldownLimit, cancellationToken);

        if (hasRecentClaim)
        {
            throw new InvalidOperationException("A recovery claim has already been initiated for this organization in the last 7 days.");
        }

        // 4. Encrypt and save uploaded documents
        var claimDocs = new List<RecoveryClaimDocument>();
        foreach (var doc in documents)
        {
            var (storagePath, encryptionIv) = await _encryptedFileStorageService.EncryptAndSaveFileAsync(doc.fileStream, doc.fileName);
            var claimDoc = new RecoveryClaimDocument
            {
                StoragePath = storagePath,
                FileName = doc.fileName,
                ContentType = doc.contentType,
                EncryptionIv = encryptionIv,
                VirusScanStatus = "Pending",
                CreatedAt = _timeProvider.GetUtcNow()
            };
            claimDocs.Add(claimDoc);
        }

        // 5. Create Organization Recovery Claim
        var claim = new OrganizationRecoveryClaim
        {
            OrganizationId = org.Id,
            RepresentativeFullName = request.RepresentativeFullName,
            RepresentativePosition = request.RepresentativePosition,
            PhoneNumber = request.PhoneNumber,
            RecoveryEmail = request.RecoveryEmail,
            RiskScore = 0,
            RiskLevel = "Low",
            SuggestedRecoveryStrategy = "OptionB",
            Status = "Pending",
            CreatedAt = _timeProvider.GetUtcNow(),
            UpdatedAt = _timeProvider.GetUtcNow(),
            Documents = claimDocs
        };

        _context.OrganizationRecoveryClaims.Add(claim);
        await _context.SaveChangesAsync(cancellationToken);

        await LogAuditEventAsync(null, "RECOVERY_CLAIM_SUBMITTED", $"Recovery claim submitted for {org.Name} (Tax Code: {org.TaxCode}) by {request.RepresentativeFullName}.", ipAddress, userAgent);

        return new SubmitClaimResponse(claim.Id, claim.RiskScore, claim.RiskLevel, claim.Status);
    }

    public async Task<List<ClaimDetailsResponse>> GetPendingClaimsAsync(CancellationToken cancellationToken = default)
    {
        var claims = await _context.OrganizationRecoveryClaims
            .Include(c => c.Organization)
            .Include(c => c.Documents)
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync(cancellationToken);

        return claims.Select(c => new ClaimDetailsResponse(
            c.Id,
            c.Organization.TaxCode,
            c.Organization.Name,
            c.RepresentativeFullName,
            c.RepresentativePosition,
            c.PhoneNumber,
            c.RecoveryEmail,
            c.RiskScore,
            c.RiskLevel,
            c.SuggestedRecoveryStrategy,
            c.Status,
            c.RejectionReason,
            c.ReviewedBy,
            c.SecondReviewerBy,
            c.ReviewedAt,
            c.CreatedAt,
            c.Documents.Select(d => new DocumentInfo(d.Id, d.FileName, d.ContentType, d.VirusScanStatus, d.CreatedAt)).ToList(),
            new RiskHeuristicsInfo(
                c.DocumentOcrMetadata ?? "{}",
                c.DocumentSuspiciousMetadata ?? "{}",
                c.WorkspaceActivityFlags ?? "{}",
                c.IpDeviceFlags ?? "{}",
                c.HistoricalClaimFlags ?? "{}"
            )
        )).ToList();
    }

    public async Task<bool> ReviewClaimAsync(Guid claimId, ReviewClaimRequest request, string reviewerName, CancellationToken cancellationToken = default)
    {
        var claim = await _context.OrganizationRecoveryClaims
            .Include(c => c.Organization)
            .Include(c => c.Documents)
            .FirstOrDefaultAsync(c => c.Id == claimId, cancellationToken);

        if (claim == null)
        {
            throw new KeyNotFoundException("Recovery claim not found.");
        }

        if (claim.Status == "Approved" || claim.Status == "Rejected")
        {
            throw new InvalidOperationException("This recovery claim has already been finalized.");
        }

        if (request.Status == "Approved")
        {
            // Dual sign-off workflow check for high-risk claims
            if (string.Equals(claim.RiskLevel, "High", StringComparison.OrdinalIgnoreCase))
            {
                bool isSuperAdmin = string.Equals(reviewerName, _envConfig.SuperAdmin.Email, StringComparison.OrdinalIgnoreCase);

                if (isSuperAdmin)
                {
                    // Super Admin auto-approves high-risk claim immediately
                    claim.ReviewedBy = reviewerName;
                    claim.SecondReviewerBy = reviewerName;
                }
                else if (string.IsNullOrEmpty(claim.ReviewedBy))
                {
                    // First approval signature
                    claim.ReviewedBy = reviewerName;
                    claim.UpdatedAt = _timeProvider.GetUtcNow();
                    await _context.SaveChangesAsync(cancellationToken);
                    
                    await LogAuditEventAsync(null, "RECOVERY_CLAIM_FIRST_APPROVAL", $"Claim {claim.Id} received first approval signature from {reviewerName}.", null, null);
                    return true; // Return true indicating successful partial signature, but not fully approved
                }
                else
                {
                    // Second approval signature
                    if (string.Equals(claim.ReviewedBy, reviewerName, StringComparison.OrdinalIgnoreCase))
                    {
                        throw new InvalidOperationException("The same administrator cannot sign off twice for a high-risk recovery claim.");
                    }
                    claim.SecondReviewerBy = reviewerName;
                }
            }
            else
            {
                // Low and Medium risk claims only require single reviewer
                claim.ReviewedBy = reviewerName;
            }

            claim.Status = "Approved";
            claim.ReviewedAt = _timeProvider.GetUtcNow();

            // Generate approved recovery session
            var tokenHash = Guid.NewGuid().ToString("N");
            var session = new ApprovedRecoverySession
            {
                OrganizationId = claim.OrganizationId,
                ApprovedRepresentative = claim.RepresentativeFullName,
                VerifiedRecoveryEmail = claim.RecoveryEmail,
                RecoveryTokenHash = tokenHash,
                ExpiresAt = _timeProvider.GetUtcNow().AddHours(24),
                ApprovedBy = claim.ReviewedBy + (claim.SecondReviewerBy != null ? $", {claim.SecondReviewerBy}" : ""),
                SuggestedStrategy = claim.SuggestedRecoveryStrategy,
                CreatedAt = _timeProvider.GetUtcNow()
            };

            _context.ApprovedRecoverySessions.Add(session);
            await _context.SaveChangesAsync(cancellationToken);

            await LogAuditEventAsync(null, "RECOVERY_CLAIM_APPROVED", $"Recovery claim {claim.Id} fully approved by {session.ApprovedBy}.", null, null);

            // Queue approval/bootstrap link email via outbox
            await QueueNotificationEmailAsync(
                claim.RecoveryEmail,
                claim.Organization.Name,
                "CVerify: Organization Recovery Approved",
                $"Your organization recovery claim for {claim.Organization.Name} has been approved. Please visit the link below to verify your token and configure your new administrator account:\n\nhttp://localhost:3000/organization/recovery/bootstrap?token={tokenHash}\n\nNote: This link will expire in 24 hours."
            );
        }
        else if (request.Status == "Rejected")
        {
            claim.Status = "Rejected";
            claim.RejectionReason = request.RejectionReason;
            claim.ReviewedBy = reviewerName;
            claim.ReviewedAt = _timeProvider.GetUtcNow();

            await _context.SaveChangesAsync(cancellationToken);

            await LogAuditEventAsync(null, "RECOVERY_CLAIM_REJECTED", $"Recovery claim {claim.Id} rejected by {reviewerName}. Reason: {request.RejectionReason}", null, null);

            // Queue rejection email via outbox
            await QueueNotificationEmailAsync(
                claim.RecoveryEmail,
                claim.Organization.Name,
                "CVerify: Organization Recovery Rejected",
                $"We regret to inform you that your organization recovery claim for {claim.Organization.Name} was rejected.\n\nReason:\n{request.RejectionReason}"
            );
        }
        else
        {
            throw new ArgumentException("Invalid review status. Must be Approved or Rejected.");
        }

        claim.UpdatedAt = _timeProvider.GetUtcNow();
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<VerifyBootstrapResponse> VerifyBootstrapTokenAsync(string token, CancellationToken cancellationToken = default)
    {
        var session = await _context.ApprovedRecoverySessions
            .Include(s => s.Organization)
            .FirstOrDefaultAsync(s => s.RecoveryTokenHash == token && !s.IsConsumed && s.RevokedAt == null && s.ExpiresAt > _timeProvider.GetUtcNow(), cancellationToken);

        if (session == null)
        {
            return new VerifyBootstrapResponse(
                IsValid: false,
                ApprovedRepresentative: string.Empty,
                VerifiedRecoveryEmail: string.Empty,
                SuggestedStrategy: string.Empty,
                OrganizationName: string.Empty,
                OrganizationSlug: string.Empty
            );
        }

        return new VerifyBootstrapResponse(
            IsValid: true,
            ApprovedRepresentative: session.ApprovedRepresentative,
            VerifiedRecoveryEmail: session.VerifiedRecoveryEmail,
            SuggestedStrategy: session.SuggestedStrategy,
            OrganizationName: session.Organization.Name,
            OrganizationSlug: session.Organization.Username
        );
    }

    public async Task<SetupRecoveryCredentialsResponse> SetupRecoveryCredentialsAsync(SetupRecoveryCredentialsRequest request, CancellationToken cancellationToken = default)
    {
        var session = await _context.ApprovedRecoverySessions
            .Include(s => s.Organization)
            .FirstOrDefaultAsync(s => s.RecoveryTokenHash == request.Token && !s.IsConsumed && s.RevokedAt == null && s.ExpiresAt > _timeProvider.GetUtcNow(), cancellationToken);

        if (session == null)
        {
            throw new InvalidOperationException("Invalid or expired recovery token.");
        }

        // Generate temporary session token to bridge credential setup and strategy execution
        var sessionToken = Guid.NewGuid().ToString("N");
        await _cacheService.SetAsync($"recovery:session:{sessionToken}", session.Id, TimeSpan.FromMinutes(30));
        await _cacheService.SetAsync($"recovery:password:{session.Id}", request.NewPassword, TimeSpan.FromMinutes(30));

        return new SetupRecoveryCredentialsResponse(sessionToken, session.VerifiedRecoveryEmail);
    }

    public async Task<AuthResponse> ExecuteRecoveryAsync(ExecuteRecoveryRequest request, string userAgent, string ipAddress, CancellationToken cancellationToken = default)
    {
        var sessionId = await _cacheService.GetAsync<Guid>($"recovery:session:{request.SessionToken}");
        if (sessionId == Guid.Empty)
        {
            throw new InvalidOperationException("Invalid or expired recovery session token.");
        }

        // Fetch recovery session
        var session = await _context.ApprovedRecoverySessions
            .Include(s => s.Organization)
            .FirstOrDefaultAsync(s => s.Id == sessionId && !s.IsConsumed && s.RevokedAt == null && s.ExpiresAt > _timeProvider.GetUtcNow(), cancellationToken);

        if (session == null)
        {
            throw new InvalidOperationException("Recovery session is invalid, expired, or already used.");
        }

        // Retrieve cached password
        var password = await _cacheService.GetAsync<string>($"recovery:password:{sessionId}");
        if (string.IsNullOrEmpty(password))
        {
            throw new InvalidOperationException("Password credentials session expired. Please restart bootstrap verification.");
        }

        // Enforce recovery execution lock (idempotency check)
        var executionLock = await _context.RecoveryExecutionLocks
            .FirstOrDefaultAsync(l => l.RecoverySessionId == sessionId, cancellationToken);

        if (executionLock != null && (executionLock.Status == "InProgress" || executionLock.Status == "Succeeded"))
        {
            throw new InvalidOperationException("Recovery execution is already in progress or has completed successfully.");
        }

        if (executionLock == null)
        {
            executionLock = new RecoveryExecutionLock
            {
                RecoverySessionId = sessionId,
                Status = "InProgress",
                AcquiredAt = _timeProvider.GetUtcNow()
            };
            _context.RecoveryExecutionLocks.Add(executionLock);
        }
        else
        {
            executionLock.Status = "InProgress";
            executionLock.AcquiredAt = _timeProvider.GetUtcNow();
        }
        await _context.SaveChangesAsync(cancellationToken);

        try
        {
            AuthResponse response;
            if (string.Equals(request.Strategy, "OptionA", StringComparison.OrdinalIgnoreCase))
            {
                response = await _executionEngine.ExecuteOptionAAsync(sessionId, request.DisplayName, request.Slug, password, userAgent, ipAddress, cancellationToken);
            }
            else if (string.Equals(request.Strategy, "OptionB", StringComparison.OrdinalIgnoreCase))
            {
                response = await _executionEngine.ExecuteOptionBAsync(sessionId, request.DisplayName, request.Slug, password, userAgent, ipAddress, cancellationToken);
            }
            else
            {
                throw new ArgumentException("Invalid recovery strategy selected. Strategy must be OptionA or OptionB.");
            }

            executionLock.Status = "Succeeded";
            executionLock.CompletedAt = _timeProvider.GetUtcNow();
            await _context.SaveChangesAsync(cancellationToken);

            // Clean up cache
            await _cacheService.RemoveAsync($"recovery:session:{request.SessionToken}");
            await _cacheService.RemoveAsync($"recovery:password:{sessionId}");

            return response;
        }
        catch (Exception)
        {
            executionLock.Status = "Failed";
            await _context.SaveChangesAsync(cancellationToken);
            throw;
        }
    }

    public async Task<(Stream fileStream, string fileName, string contentType)> DownloadDocumentAsync(Guid docId, string reviewerName, CancellationToken cancellationToken = default)
    {
        var doc = await _context.RecoveryClaimDocuments
            .FirstOrDefaultAsync(d => d.Id == docId, cancellationToken);

        if (doc == null)
        {
            throw new KeyNotFoundException("Document not found.");
        }

        await LogAuditEventAsync(null, "RECOVERY_DOCUMENT_DOWNLOADED", $"Claim document {docId} downloaded by administrator {reviewerName}.", null, null);

        var stream = await _encryptedFileStorageService.ReadAndDecryptFileAsync(doc.StoragePath, doc.EncryptionIv);
        return (stream, doc.FileName, doc.ContentType);
    }

    public async Task<VerifyOtpResponse> VerifyRecoveryOtpAsync(VerifyOtpRequest request, string taxCode, CancellationToken cancellationToken = default)
    {
        _otpPolicyService.ValidateAndThrow(request.Code, "Default");
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();

        var verification = await _context.OtpVerifications
            .Where(v => v.ChallengeId == request.ChallengeId && v.Email == normalizedEmail && v.Purpose == request.Purpose)
            .FirstOrDefaultAsync(cancellationToken);

        if (verification == null)
        {
            throw new InvalidOperationException("The OTP challenge is invalid or does not match.");
        }

        if (verification.ConsumedAt != null)
        {
            throw new InvalidOperationException("This OTP has already been verified.");
        }

        if (verification.ExpiresAt <= _timeProvider.GetUtcNow())
        {
            throw new InvalidOperationException("This OTP has expired.");
        }

        if (verification.Attempts >= 5)
        {
            throw new InvalidOperationException("Too many failed attempts. This OTP has been blocked.");
        }

        var inputHash = GenerateHmacSha256OtpHash(request.Code);
        bool matches = string.Equals(verification.OtpHash, inputHash, StringComparison.OrdinalIgnoreCase);

        verification.Attempts += 1;
        verification.LastAttemptAt = _timeProvider.GetUtcNow();

        if (!matches)
        {
            await _context.SaveChangesAsync(cancellationToken);
            throw new InvalidOperationException("The OTP entered is incorrect.");
        }

        verification.ConsumedAt = _timeProvider.GetUtcNow();
        await _context.SaveChangesAsync(cancellationToken);

        var verifiedToken = RecoveryTokenHelper.GenerateOtpVerifiedToken(taxCode, normalizedEmail, _envConfig.Jwt.Key);

        return new VerifyOtpResponse(request.ChallengeId, normalizedEmail, verifiedToken);
    }

    private string GenerateHmacSha256OtpHash(string plainOtp)
    {
        using var hmac = new System.Security.Cryptography.HMACSHA256(System.Text.Encoding.UTF8.GetBytes(_envConfig.Jwt.Key));
        var hashBytes = hmac.ComputeHash(System.Text.Encoding.UTF8.GetBytes(plainOtp));
        return Convert.ToHexString(hashBytes).ToLowerInvariant();
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
}
