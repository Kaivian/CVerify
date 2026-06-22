using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.Persistence;

namespace CVerify.API.Modules.Intelligence.Services;

public interface ITrustEngineService
{
    Task<TrustProfile> GetOrCreateProfileAsync(Guid targetId, string targetType);
    Task<CandidateTrustProjection> RecalculateCandidateTrustAsync(Guid candidateId);
}

public class TrustEngineService : ITrustEngineService
{
    private readonly ApplicationDbContext _context;

    public TrustEngineService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<TrustProfile> GetOrCreateProfileAsync(Guid targetId, string targetType)
    {
        var profile = await _context.TrustProfiles
            .Include(p => p.Components)
            .FirstOrDefaultAsync(p => p.TargetEntityId == targetId && p.TargetType == targetType)
            .ConfigureAwait(false);

        if (profile == null)
        {
            profile = new TrustProfile
            {
                Id = Guid.CreateVersion7(),
                TargetEntityId = targetId,
                TargetType = targetType,
                RecalculatedAt = DateTimeOffset.UtcNow
            };
            _context.TrustProfiles.Add(profile);
            await _context.SaveChangesAsync().ConfigureAwait(false);
        }

        return profile;
    }

    public async Task<CandidateTrustProjection> RecalculateCandidateTrustAsync(Guid candidateId)
    {
        var profile = await GetOrCreateProfileAsync(candidateId, "Candidate").ConfigureAwait(false);

        // 1. Calculate Identity Component
        var identityScore = 0;
        var hasKyc = await _context.EvidenceVerifications
            .AnyAsync(v => v.EvidenceClaim.CandidateId == candidateId && v.VerificationType == "Sumsub_KYC_Check" && v.Status == "Verified")
            .ConfigureAwait(false);
        var hasOtp = await _context.EvidenceVerifications
            .AnyAsync(v => v.EvidenceClaim.CandidateId == candidateId && v.VerificationType == "PhoneOTP" && v.Status == "Verified")
            .ConfigureAwait(false);

        if (hasKyc) identityScore += 70;
        if (hasOtp) identityScore += 30;

        // 2. Calculate Authorship Component
        var authorshipScore = 50; // baseline
        var claims = await _context.EvidenceClaims
            .Where(c => c.CandidateId == candidateId && c.AssertionType == "AuthoredCode")
            .ToListAsync()
            .ConfigureAwait(false);

        if (claims.Any())
        {
            var averageConfidence = claims.Average(c => c.ConfidenceScore);
            authorshipScore = (int)(averageConfidence * 100);
        }

        // 3. Calculate Professional Component
        var professionalScore = 0;
        var hasDomainVerify = await _context.EvidenceVerifications
            .AnyAsync(v => v.EvidenceClaim.CandidateId == candidateId && v.VerificationType == "Domain_DNS_Match" && v.Status == "Verified")
            .ConfigureAwait(false);
        if (hasDomainVerify) professionalScore = 100;

        // 4. Calculate Behavioral Component
        var behavioralScore = 100;
        var user = await _context.Users.FindAsync(candidateId).ConfigureAwait(false);
        if (user != null && user.Status == UserStatus.SUSPENDED)
        {
            behavioralScore = 0;
        }

        // 5. Update Trust Components
        await UpdateComponentAsync(profile.Id, "KYC_Identity", identityScore, 0.30).ConfigureAwait(false);
        await UpdateComponentAsync(profile.Id, "GitAuthorship", authorshipScore, 0.40).ConfigureAwait(false);
        await UpdateComponentAsync(profile.Id, "DomainMatch", professionalScore, 0.20).ConfigureAwait(false);
        await UpdateComponentAsync(profile.Id, "BehaviorPenalty", behavioralScore, 0.10).ConfigureAwait(false);

        // 6. Aggregate Score
        var components = await _context.TrustComponents
            .Where(c => c.TrustProfileId == profile.Id)
            .ToListAsync()
            .ConfigureAwait(false);

        double aggregate = 0;
        foreach (var c in components)
        {
            aggregate += c.ComponentScore * c.Weight;
        }
        var finalScore = (int)Math.Clamp(aggregate, 0, 100);

        // Log calculation details
        var explanation = new Dictionary<string, string>
        {
            { "KYC_Identity", $"{identityScore} (Weight: 30%)" },
            { "GitAuthorship", $"{authorshipScore} (Weight: 40%)" },
            { "DomainMatch", $"{professionalScore} (Weight: 20%)" },
            { "BehaviorPenalty", $"{behavioralScore} (Weight: 10%)" }
        };

        var calculation = new TrustCalculation
        {
            Id = Guid.CreateVersion7(),
            TrustProfileId = profile.Id,
            AggregateScore = finalScore,
            CalculationDetails = JsonSerializer.Serialize(explanation),
            CalculatedAt = DateTimeOffset.UtcNow
        };
        _context.TrustCalculations.Add(calculation);

        // Update Projection
        var projection = await _context.CandidateTrustProjections
            .FirstOrDefaultAsync(p => p.CandidateId == candidateId)
            .ConfigureAwait(false);

        var tier = finalScore switch
        {
            >= 85 => "HighTrust",
            >= 60 => "EvidenceVerified",
            >= 30 => "BasicVerified",
            _ => "Unverified"
        };

        if (projection == null)
        {
            projection = new CandidateTrustProjection
            {
                CandidateId = candidateId,
                TrustProfileId = profile.Id,
                AggregateScore = finalScore,
                TrustTier = tier,
                LastUpdatedAt = DateTimeOffset.UtcNow
            };
            _context.CandidateTrustProjections.Add(projection);
        }
        else
        {
            projection.AggregateScore = finalScore;
            projection.TrustTier = tier;
            projection.LastUpdatedAt = DateTimeOffset.UtcNow;
        }

        profile.RecalculatedAt = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync().ConfigureAwait(false);

        return projection;
    }

    private async Task UpdateComponentAsync(Guid profileId, string componentName, int score, double weight)
    {
        var component = await _context.TrustComponents
            .FirstOrDefaultAsync(c => c.TrustProfileId == profileId && c.ComponentName == componentName)
            .ConfigureAwait(false);

        if (component == null)
        {
            component = new TrustComponent
            {
                Id = Guid.CreateVersion7(),
                TrustProfileId = profileId,
                ComponentName = componentName,
                ComponentScore = score,
                Weight = weight,
                UpdatedAt = DateTimeOffset.UtcNow
            };
            _context.TrustComponents.Add(component);
        }
        else
        {
            component.ComponentScore = score;
            component.Weight = weight;
            component.UpdatedAt = DateTimeOffset.UtcNow;
        }
    }
}
