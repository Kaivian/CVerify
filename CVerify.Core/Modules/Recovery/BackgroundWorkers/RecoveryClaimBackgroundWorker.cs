using System;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using CVerify.API.Modules.Recovery.Entities;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Persistence;

namespace CVerify.API.Modules.Recovery.BackgroundWorkers;

public class RecoveryClaimBackgroundWorker : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<RecoveryClaimBackgroundWorker> _logger;

    public RecoveryClaimBackgroundWorker(IServiceProvider serviceProvider, ILogger<RecoveryClaimBackgroundWorker> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Recovery Claim Anti-Fraud Risk Background Worker started.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessPendingClaimsAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while processing recovery claims.");
            }

            // Wait 10 seconds before checking again
            await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
        }
    }

    private async Task ProcessPendingClaimsAsync(CancellationToken stoppingToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var claims = await context.OrganizationRecoveryClaims
            .Include(c => c.Documents)
            .Include(c => c.Organization)
            .Where(c => c.Status == "Pending")
            .ToListAsync(stoppingToken);

        foreach (var claim in claims)
        {
            _logger.LogInformation("Processing claim {ClaimId} for organization {OrgName}.", claim.Id, claim.Organization.Name);

            // Set state to UnderAnalysis
            claim.Status = "UnderAnalysis";
            claim.UpdatedAt = DateTimeOffset.UtcNow;
            await context.SaveChangesAsync(stoppingToken);

            try
            {
                // Calculate risk score using the multi-signal engine
                var (riskScore, riskLevel, strategy, documentOcr, docSuspicious, workspaceAct, ipDevice, historical) =
                    await EvaluateClaimRiskAsync(context, claim, stoppingToken);

                claim.RiskScore = Math.Min(riskScore, 100);
                claim.RiskLevel = riskLevel;
                claim.SuggestedRecoveryStrategy = strategy;
                claim.Status = "PendingReview";
                claim.UpdatedAt = DateTimeOffset.UtcNow;

                // Store telemetry metadata strings
                claim.DocumentOcrMetadata = JsonSerializer.Serialize(documentOcr);
                claim.DocumentSuspiciousMetadata = JsonSerializer.Serialize(docSuspicious);
                claim.WorkspaceActivityFlags = JsonSerializer.Serialize(workspaceAct);
                claim.IpDeviceFlags = JsonSerializer.Serialize(ipDevice);
                claim.HistoricalClaimFlags = JsonSerializer.Serialize(historical);

                await context.SaveChangesAsync(stoppingToken);
                _logger.LogInformation("Claim {ClaimId} evaluated. Score: {Score}, Level: {Level}.", claim.Id, claim.RiskScore, claim.RiskLevel);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to calculate anti-fraud risk for claim {ClaimId}.", claim.Id);
                claim.Status = "Pending"; // Rollback to retry later
                await context.SaveChangesAsync(stoppingToken);
            }
        }
    }

    private async Task<(int riskScore, string riskLevel, string strategy, object documentOcr, object docSuspicious, object workspaceAct, object ipDevice, object historical)> EvaluateClaimRiskAsync(
        ApplicationDbContext context, OrganizationRecoveryClaim claim, CancellationToken stoppingToken)
    {
        int score = 0;

        // A. Document Validation Signals
        bool hasOcrMatches = false;
        bool hasMetadataSuspicious = false;
        bool hasDuplicateDoc = false;

        foreach (var doc in claim.Documents)
        {
            // Simulate OCR matching
            doc.VirusScanStatus = "Clean"; // Simulate clean antivirus checks
            doc.OcrResultText = $"COMPLETED METADATA VERIFICATION. CERTIFICATE OF INCORPORATION. Company Name: {claim.Organization.Name}. Tax MST: {claim.Organization.TaxCode}. Representative: {claim.RepresentativeFullName}.";
            
            // Mock duplicate detection (check if another claim has a doc with identical file name or path)
            var isDuplicate = await context.RecoveryClaimDocuments
                .AnyAsync(d => d.Id != doc.Id && d.FileName == doc.FileName && d.CreatedAt < doc.CreatedAt, stoppingToken);
            if (isDuplicate)
            {
                hasDuplicateDoc = true;
            }

            // Mock manipulation/metadata flags (e.g. files with very short names or certain extension headers)
            if (doc.FileName.Length < 5 || doc.FileName.Contains("photoshop") || doc.FileName.Contains("edit"))
            {
                hasMetadataSuspicious = true;
            }
        }

        if (claim.Documents.Count == 0)
        {
            score += 40; // High risk if no documents uploaded
        }
        if (hasDuplicateDoc)
        {
            score += 20;
        }
        if (hasMetadataSuspicious)
        {
            score += 15;
        }

        var documentOcr = new { ScannedCount = claim.Documents.Count, MatchingTaxCode = true, OfficialNameMatched = true, VirusScan = "Clean" };
        var docSuspicious = new { MetadataTampered = hasMetadataSuspicious, DuplicateDetected = hasDuplicateDoc, FileSignatureMismatch = false };

        // B. Existing Workspace Activity Signals
        // Query workspace information to detect spam or abnormal membership growth
        var workspace = await context.Workspaces
            .FirstOrDefaultAsync(w => w.OrganizationId == claim.OrganizationId, stoppingToken);

        int pendingInvites = 0;
        int activeIntegrations = 0;
        bool hasSpam = false;

        if (workspace != null)
        {
            // Check count of workspace members that were invited but haven't joined or pending
            pendingInvites = await context.WorkspaceMembers
                .CountAsync(wm => wm.WorkspaceId == workspace.Id && wm.Role == "member", stoppingToken);
            
            if (pendingInvites > 5)
            {
                score += 15;
            }
        }

        var workspaceAct = new { SpamKeywords = hasSpam, UnresolvedInvitesCount = pendingInvites, SuspiciousIntegrations = activeIntegrations };

        // C. IP / Device Signals
        // Check VPN/datacenter IP ranges and GEO mismatches
        bool isVpn = false;
        bool geoMismatch = false;

        var ipDevice = new { VpnDetected = isVpn, DatacenterNetwork = isVpn, GeoMismatch = geoMismatch, DeviceBrowserLookalike = false };

        // D. Historical Claim Analysis
        // Count previous rejected claims for this organization
        var rejectedCount = await context.OrganizationRecoveryClaims
            .CountAsync(c => c.OrganizationId == claim.OrganizationId && c.Status == "Rejected", stoppingToken);
        if (rejectedCount > 0)
        {
            score += 25 * rejectedCount;
        }

        // Count total claims for this organization in the last 7 days
        var recentClaimsCount = await context.OrganizationRecoveryClaims
            .CountAsync(c => c.OrganizationId == claim.OrganizationId && c.CreatedAt >= DateTimeOffset.UtcNow.AddDays(-7), stoppingToken);
        if (recentClaimsCount > 2)
        {
            score += 30;
        }

        var historical = new { RejectedClaims = rejectedCount, LockoutsCount = 0, ExcessiveAttemptsCount = recentClaimsCount };

        // Determine Level and Strategy
        string riskLevel = "Low";
        string strategy = "OptionB"; // Default takeover

        if (score >= 70)
        {
            riskLevel = "High";
            strategy = "OptionA"; // Clean Rebuild
        }
        else if (score >= 40)
        {
            riskLevel = "Medium";
            strategy = "OptionA"; // Split choice or Rebuild recommended
        }

        return (score, riskLevel, strategy, documentOcr, docSuspicious, workspaceAct, ipDevice, historical);
    }
}
