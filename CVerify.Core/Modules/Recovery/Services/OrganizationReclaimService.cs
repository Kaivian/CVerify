using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using CVerify.API.Modules.AiChat.Entities;
using CVerify.API.Modules.Auth.DTOs;
using CVerify.API.Modules.Auth.Services;
using CVerify.API.Modules.Auth.Services.OtpPolicies;
using CVerify.API.Modules.Recovery.DTOs;
using CVerify.API.Modules.Recovery.Entities;
using CVerify.API.Modules.Shared.Configuration;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Email.Entities;
using CVerify.API.Modules.Shared.Exceptions;
using CVerify.API.Modules.Shared.Exceptions.Catalogs;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.Security;
using CVerify.API.Modules.Shared.Storage.Interfaces;
using CVerify.API.Modules.Shared.System.Services;

namespace CVerify.API.Modules.Recovery.Services;

public class OrganizationReclaimService : IOrganizationReclaimService
{
    private readonly ApplicationDbContext _context;
    private readonly IEncryptedFileStorageService _encryptedFileStorageService;
    private readonly IRecoveryExecutionEngine _executionEngine;
    private readonly EnvConfiguration _envConfig;
    private readonly TimeProvider _timeProvider;
    private readonly ICacheService _cacheService;
    private readonly ILogger<OrganizationReclaimService> _logger;
    private readonly IOtpPolicyService _otpPolicyService;
    private readonly IAuthService _authService;
    private readonly IRateLimitPolicyService _rateLimitPolicyService;

    public OrganizationReclaimService(
        ApplicationDbContext context,
        IEncryptedFileStorageService encryptedFileStorageService,
        IRecoveryExecutionEngine executionEngine,
        EnvConfiguration envConfig,
        TimeProvider timeProvider,
        ICacheService cacheService,
        ILogger<OrganizationReclaimService> logger,
        IOtpPolicyService otpPolicyService,
        IAuthService authService,
        IRateLimitPolicyService rateLimitPolicyService)
    {
        _context = context;
        _encryptedFileStorageService = encryptedFileStorageService;
        _executionEngine = executionEngine;
        _envConfig = envConfig;
        _timeProvider = timeProvider;
        _cacheService = cacheService;
        _logger = logger;
        _otpPolicyService = otpPolicyService;
        _authService = authService;
        _rateLimitPolicyService = rateLimitPolicyService;
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
            !string.Equals(
                RecoveryTokenHelper.NormalizeTaxCode(otpPayload.GetValueOrDefault("taxCode", string.Empty)), 
                RecoveryTokenHelper.NormalizeTaxCode(request.TaxCode), 
                StringComparison.OrdinalIgnoreCase) || 
            !string.Equals(
                RecoveryTokenHelper.NormalizeEmail(otpPayload.GetValueOrDefault("email", string.Empty)), 
                RecoveryTokenHelper.NormalizeEmail(request.RecoveryEmail), 
                StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning(
                "Email OTP token verification failed. PayloadIsNull={PayloadIsNull}, TokenExists={TokenExists}, TokenLength={TokenLength}, TokenPrefix={TokenPrefix}, ExpectedTaxCode={ExpectedTaxCode}, NormalizedExpectedTaxCode={NormalizedExpectedTaxCode}, ExpectedEmail={ExpectedEmail}, NormalizedExpectedEmail={NormalizedExpectedEmail}, PayloadStep={PayloadStep}, PayloadTaxCode={PayloadTaxCode}, NormalizedPayloadTaxCode={NormalizedPayloadTaxCode}, PayloadEmail={PayloadEmail}, NormalizedPayloadEmail={NormalizedPayloadEmail}",
                otpPayload == null,
                !string.IsNullOrEmpty(request.EmailVerificationToken),
                request.EmailVerificationToken?.Length ?? 0,
                string.IsNullOrEmpty(request.EmailVerificationToken) ? "N/A" : request.EmailVerificationToken.Substring(0, Math.Min(10, request.EmailVerificationToken.Length)),
                request.TaxCode,
                RecoveryTokenHelper.NormalizeTaxCode(request.TaxCode),
                request.RecoveryEmail,
                RecoveryTokenHelper.NormalizeEmail(request.RecoveryEmail),
                otpPayload != null && otpPayload.ContainsKey("step") ? otpPayload["step"] : "N/A",
                otpPayload != null && otpPayload.ContainsKey("taxCode") ? otpPayload["taxCode"] : "N/A",
                otpPayload != null && otpPayload.ContainsKey("taxCode") ? RecoveryTokenHelper.NormalizeTaxCode(otpPayload["taxCode"]) : "N/A",
                otpPayload != null && otpPayload.ContainsKey("email") ? otpPayload["email"] : "N/A",
                otpPayload != null && otpPayload.ContainsKey("email") ? RecoveryTokenHelper.NormalizeEmail(otpPayload["email"]) : "N/A"
            );
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
        var cooldownDays = _rateLimitPolicyService.DisableRateLimits ? 0 : -7;
        var cooldownLimit = _timeProvider.GetUtcNow().AddDays(cooldownDays);
        var hasRecentClaim = await _context.OrganizationRecoveryClaims
            .AnyAsync(c => c.OrganizationId == org.Id && c.CreatedAt >= cooldownLimit, cancellationToken);

        if (hasRecentClaim)
        {
            if (_rateLimitPolicyService.DisableRateLimits)
            {
                _rateLimitPolicyService.LogBypass("Organization reclaim cooldown", "SubmitClaimAsync", org.TaxCode);
            }
            else
            {
                throw new InvalidOperationException("A recovery claim has already been initiated for this organization in the last 7 days.");
            }
        }

        // Generate unique Claim ID upfront for deterministic key generation
        var claimId = Guid.CreateVersion7();

        // 4. Strict upload validation before processing
        foreach (var doc in documents)
        {
            try
            {
                ValidateReclaimDocument(doc.fileStream, doc.fileName, doc.contentType);
            }
            catch (ArgumentException ex)
            {
                throw new ClaimDocumentUploadException(ex.Message, ex);
            }
        }

        var uploadedObjectKeys = new List<string>();
        var claimDocs = new List<ClaimDocument>();

        try
        {
            // 5. Encrypt and upload documents to Cloudflare R2
            foreach (var doc in documents)
            {
                var uploadResult = await _encryptedFileStorageService.EncryptAndUploadFileAsync(
                    claimId,
                    doc.fileStream,
                    doc.fileName,
                    cancellationToken);

                uploadedObjectKeys.Add(uploadResult.ObjectKey);

                var claimDoc = new ClaimDocument
                {
                    Id = Guid.CreateVersion7(),
                    StoragePath = uploadResult.ObjectKey,
                    FileName = doc.fileName,
                    ContentType = doc.contentType,
                    EncryptionIv = uploadResult.BaseNonceHex, // Store GCM base nonce hex
                    VirusScanStatus = "Pending",
                    CreatedAt = _timeProvider.GetUtcNow()
                };
                claimDocs.Add(claimDoc);

                _logger.LogInformation(
                    "Claim document uploaded and encrypted successfully. ClaimId={ClaimId}, ObjectKey={ObjectKey}, ContentType={ContentType}, OriginalSize={OriginalSize}, EncryptedSize={EncryptedSize}",
                    claimId,
                    uploadResult.ObjectKey,
                    doc.contentType,
                    uploadResult.OriginalSize,
                    uploadResult.EncryptedSize
                );
            }

            // 6. DB transaction persistence mapping (compensating transactional safety)
            using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);

            var claim = new OrganizationRecoveryClaim
            {
                Id = claimId,
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

            await LogAuditEventAsync(null, "RECLAIM_CLAIM_SUBMITTED", $"Organization reclaim claim submitted for {org.Name} (Tax Code: {org.TaxCode}) by {request.RepresentativeFullName}.", ipAddress, userAgent);

            await transaction.CommitAsync(cancellationToken);

            return new SubmitClaimResponse(claim.Id, claim.RiskScore, claim.RiskLevel, claim.Status);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Transaction failed during reclaim submission. Executing compensating transaction to clean up uploaded R2 documents. ClaimId={ClaimId}", claimId);

            // Compensating transaction: cleanup uploaded Cloudflare R2 objects to prevent orphans
            foreach (var key in uploadedObjectKeys)
            {
                try
                {
                    await _encryptedFileStorageService.DeleteFileAsync(key, CancellationToken.None);
                    _logger.LogInformation("Compensating transaction: Cleaned up R2 storage object key: {ObjectKey}", key);
                }
                catch (Exception cleanupEx)
                {
                    _logger.LogError(cleanupEx, "Failed to clean up orphaned R2 storage object key during rollback: {ObjectKey}", key);
                }
            }

            if (ex is CVerifyBaseException)
            {
                throw;
            }
            throw new ClaimDocumentUploadException("An unexpected error occurred during document submission.", ex);
        }
    }

    private void ValidateReclaimDocument(Stream fileStream, string fileName, string contentType)
    {
        if (fileStream == null || fileStream.Length == 0)
        {
            throw new ArgumentException("Uploaded file stream is empty or unreadable.");
        }

        // Whitelist MIME types
        var allowedMimeTypes = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "application/pdf",
            "image/jpeg",
            "image/png"
        };
        if (!allowedMimeTypes.Contains(contentType))
        {
            throw new ArgumentException($"MIME type '{contentType}' is not permitted. Only PDF, JPG, and PNG are allowed.");
        }

        // Whitelist extensions
        var allowedExtensions = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            ".pdf",
            ".jpg",
            ".jpeg",
            ".png"
        };
        var ext = Path.GetExtension(fileName);
        if (string.IsNullOrEmpty(ext) || !allowedExtensions.Contains(ext))
        {
            throw new ArgumentException($"File extension '{ext}' is not permitted. Only .pdf, .jpg, .jpeg, and .png are allowed.");
        }

        // Double extension blocking (prevent executable masquerading e.g., license.pdf.exe)
        var firstDotIndex = fileName.IndexOf('.');
        if (firstDotIndex >= 0 && firstDotIndex < fileName.LastIndexOf('.'))
        {
            var parts = fileName.Split('.');
            foreach (var part in parts.Skip(1))
            {
                var upperPart = part.ToUpperInvariant();
                if (upperPart == "EXE" || upperPart == "BAT" || upperPart == "CMD" || upperPart == "SH" || upperPart == "JS" || upperPart == "VBS" || upperPart == "PS1")
                {
                    throw new ArgumentException("Files containing double extensions representing executable or script formats are strictly blocked.");
                }
            }
        }

        // Maximum size constraint: 10MB
        if (fileStream.Length > 10 * 1024 * 1024)
        {
            throw new ArgumentException("File size exceeds the maximum limit of 10MB.");
        }

        // Placeholder for future malware/virus scanning hook
    }

    public async Task<List<ClaimDetailsResponse>> GetPendingClaimsAsync(CancellationToken cancellationToken = default)
    {
        var claims = await _context.OrganizationRecoveryClaims
            .Include(c => c.Organization)
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
            .FirstOrDefaultAsync(c => c.Id == claimId, cancellationToken);

        if (claim == null)
        {
            throw new KeyNotFoundException("Reclaim claim not found.");
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
                    
                    await LogAuditEventAsync(null, "RECLAIM_CLAIM_FIRST_APPROVAL", $"Claim {claim.Id} received first approval signature from {reviewerName}.", null, null);
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

            await LogAuditEventAsync(null, "RECLAIM_CLAIM_APPROVED", $"Recovery claim {claim.Id} fully approved by {session.ApprovedBy}.", null, null);

            // Queue approval/bootstrap link email via outbox
            await QueueNotificationEmailAsync(
                claim.RecoveryEmail,
                claim.Organization.Name,
                "CVerify: Organization Reclaim Approved",
                $"Your organization ownership reclaim for {claim.Organization.Name} has been approved. Please visit the link below to verify your token and configure your new administrator account:\n\nhttp://localhost:3000/organization/reclaim/bootstrap?token={tokenHash}\n\nNote: This link will expire in 24 hours."
            );
        }
        else if (request.Status == "Rejected")
        {
            claim.Status = "Rejected";
            claim.RejectionReason = request.RejectionReason;
            claim.ReviewedBy = reviewerName;
            claim.ReviewedAt = _timeProvider.GetUtcNow();

            await _context.SaveChangesAsync(cancellationToken);

            await LogAuditEventAsync(null, "RECLAIM_CLAIM_REJECTED", $"Recovery claim {claim.Id} rejected by {reviewerName}. Reason: {request.RejectionReason}", null, null);

            // Queue rejection email via outbox
            await QueueNotificationEmailAsync(
                claim.RecoveryEmail,
                claim.Organization.Name,
                "CVerify: Organization Reclaim Rejected",
                $"We regret to inform you that your organization reclaim for {claim.Organization.Name} was rejected.\n\nReason:\n{request.RejectionReason}"
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
        var claim = await _context.OrganizationRecoveryClaims
            .FromSqlRaw("SELECT * FROM organization_recovery_claims WHERE documents @> {0}::jsonb", $"[{{\"id\":\"{docId}\"}}]")
            .OrderBy(c => c.Id)
            .FirstOrDefaultAsync(cancellationToken);

        var doc = claim?.Documents?.FirstOrDefault(d => d.Id == docId);

        if (doc == null)
        {
            throw new KeyNotFoundException("Document not found.");
        }

        await LogAuditEventAsync(null, "RECLAIM_DOCUMENT_DOWNLOADED", $"Claim document {docId} downloaded by administrator {reviewerName}.", null, null);

        var stream = await _encryptedFileStorageService.ReadAndDecryptFileAsync(doc.StoragePath, doc.EncryptionIv, cancellationToken);
        return (stream, doc.FileName, doc.ContentType);
    }

    public async Task<VerifyOtpResponse> VerifyRecoveryOtpAsync(VerifyOtpRequest request, string taxCode, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Reclaim OTP verification requested. ChallengeId={ChallengeId}, Purpose={Purpose}", request.ChallengeId, request.Purpose);
        
        // Delegate core verification to the highly secure, central, and normalized AuthService
        var otpResult = await _authService.VerifyOtpAsync(request, cancellationToken);
        
        // Generate the custom signed recovery verification token for Reclaim flow
        var verifiedToken = RecoveryTokenHelper.GenerateOtpVerifiedToken(taxCode, otpResult.Email, _envConfig.Jwt.Key);

        _logger.LogInformation("Reclaim OTP verified successfully. ChallengeId={ChallengeId}, VerifiedEmail={VerifiedEmail}", request.ChallengeId, otpResult.Email);
        return new VerifyOtpResponse(request.ChallengeId, otpResult.Email, verifiedToken);
    }

    public async Task<RecoveryEmailValidationResult> ValidateRecoveryEmailOwnershipAsync(string taxCode, string email, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(taxCode) || string.IsNullOrWhiteSpace(email))
        {
            throw new ArgumentException("Tax Code and Email are required.");
        }

        var normalizedTax = taxCode.Trim();
        var normalizedEmail = email.Trim().ToLowerInvariant();

        var org = await _context.Organizations
            .FirstOrDefaultAsync(o => o.TaxCode == normalizedTax && o.DeletedAt == null, cancellationToken);

        if (org == null)
        {
            return new RecoveryEmailValidationResult(
                RecoveryEmailValidationStatus.OrganizationNotFound,
                "The requested organization was not found in the registry."
            );
        }

        // Check 1: Check if it matches RepresentativeEmail of the organization
        if (!string.IsNullOrEmpty(org.RepresentativeEmail) && 
            string.Equals(org.RepresentativeEmail.Trim(), normalizedEmail, StringComparison.OrdinalIgnoreCase))
        {
            return new RecoveryEmailValidationResult(
                RecoveryEmailValidationStatus.DuplicateOldOwnerEmail,
                "This email cannot be used for account recovery."
            );
        }

        // Check 2: Check if it matches any active user holding organization_owner role in this organization (optimized via direct database check)
        var isDuplicate = await _context.OrganizationAuthorities
            .AnyAsync(oa => oa.OrganizationId == org.Id && 
                            oa.Role == "organization_owner" && 
                            oa.User != null && 
                            oa.User.DeletedAt == null && 
                            oa.User.Email.Trim().ToLower() == normalizedEmail, 
                      cancellationToken);

        if (isDuplicate)
        {
            return new RecoveryEmailValidationResult(
                RecoveryEmailValidationStatus.DuplicateOldOwnerEmail,
                "This email cannot be used for account recovery."
            );
        }

        return new RecoveryEmailValidationResult(RecoveryEmailValidationStatus.Valid, null);
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
        var correlationId = Guid.NewGuid().ToString("N");
        var payloadObj = new
        {
            Email = email,
            CompanyName = companyName,
            Subject = subject,
            Content = content,
            CorrelationId = correlationId
        };

        _context.AddAndAuditOutboxMessage("SystemNotificationEmail", email, correlationId, payloadObj, _timeProvider.GetUtcNow());
        await _context.SaveChangesAsync();
    }
}
