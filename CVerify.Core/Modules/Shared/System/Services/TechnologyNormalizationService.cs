using System;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.Domain.Entities;

namespace CVerify.API.Modules.Shared.System.Services;

public class TechnologyNormalizationService : ITechnologyNormalizationService
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<TechnologyNormalizationService> _logger;

    public TechnologyNormalizationService(ApplicationDbContext context, ILogger<TechnologyNormalizationService> logger)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<NormalizedSkillResult> NormalizeAsync(string rawName, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(rawName))
        {
            return new NormalizedSkillResult("", "", "Unknown", "", false);
        }

        var trimmedLower = rawName.Trim().ToLowerInvariant();
        var cleanSlug = GetCleanSlug(rawName);

        // 1. Check exact match in canonical_skill_aliases
        var alias = await _context.CanonicalSkillAliases
            .AsNoTracking()
            .FirstOrDefaultAsync(a => a.AliasName == trimmedLower || a.AliasName == cleanSlug, cancellationToken);

        if (alias != null)
        {
            var canonical = await _context.CanonicalSkills
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.SkillId == alias.SkillId && s.TaxonomyVersion == alias.TaxonomyVersion, cancellationToken);

            if (canonical != null)
            {
                return new NormalizedSkillResult(
                    canonical.SkillId,
                    canonical.DisplayName,
                    canonical.SfiaCategory,
                    canonical.OnetCode,
                    true
                );
            }
        }

        // 2. Check match in canonical_skills by skill_id or clean display name
        var allSkills = await _context.CanonicalSkills.AsNoTracking().ToListAsync(cancellationToken);

        // Match by clean slug of display_name or clean slug of skill_id
        var matchedCanonical = allSkills.FirstOrDefault(s =>
            GetCleanSlug(s.DisplayName) == cleanSlug ||
            GetCleanSlug(s.SkillId.Replace("skill:", "")) == cleanSlug
        );

        if (matchedCanonical != null)
        {
            return new NormalizedSkillResult(
                matchedCanonical.SkillId,
                matchedCanonical.DisplayName,
                matchedCanonical.SfiaCategory,
                matchedCanonical.OnetCode,
                true
            );
        }

        // 3. Fallback workflow for Emerging Technologies
        var finalSkillId = $"skill:emerging-{cleanSlug}";
        var finalSkillName = rawName.Trim();
        var taxonomyVersion = "2026.07";

        var existingEmerging = await _context.CanonicalSkills
            .FirstOrDefaultAsync(s => s.SkillId == finalSkillId && s.TaxonomyVersion == taxonomyVersion, cancellationToken);

        if (existingEmerging == null)
        {
            try
            {
                var canonicalSkill = new CanonicalSkill
                {
                    SkillId = finalSkillId,
                    TaxonomyVersion = taxonomyVersion,
                    DisplayName = finalSkillName,
                    SfiaCategory = "Emerging Technology",
                    OnetCode = "15-1252.00",
                    Status = "PendingReview",
                    CreatedAt = DateTimeOffset.UtcNow
                };
                _context.CanonicalSkills.Add(canonicalSkill);

                // Also register an alias for it to optimize future queries
                var newAlias = new CanonicalSkillAlias
                {
                    AliasName = trimmedLower,
                    SkillId = finalSkillId,
                    TaxonomyVersion = taxonomyVersion
                };
                _context.CanonicalSkillAliases.Add(newAlias);

                await _context.SaveChangesAsync(cancellationToken);

                // Telemetry Event for Unknown Technology
                _logger.LogWarning("Taxonomy.UnknownSkill Encountered: registered emerging skill {SkillId} for raw input {RawInput}", finalSkillId, rawName);
            }
            catch (DbUpdateException)
            {
                // Gracefully handle concurrent database insert collisions
                var localEntry = _context.CanonicalSkills.Local.FirstOrDefault(x => x.SkillId == finalSkillId);
                if (localEntry != null)
                {
                    _context.Entry(localEntry).State = EntityState.Detached;
                }
            }
        }

        return new NormalizedSkillResult(
            finalSkillId,
            finalSkillName,
            "Emerging Technology",
            "15-1252.00",
            false
        );
    }

    private static string GetCleanSlug(string name)
    {
        if (string.IsNullOrWhiteSpace(name)) return "";
        var cleaned = name.Trim().ToLowerInvariant()
            .Replace("#", "sharp")
            .Replace("+", "plus");
        // Remove all non-alphanumeric characters
        cleaned = Regex.Replace(cleaned, @"[^a-z0-9]", "");
        return cleaned;
    }
}
