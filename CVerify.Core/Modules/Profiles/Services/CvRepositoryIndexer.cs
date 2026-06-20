using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Profiles.Entities;
using CVerify.API.Modules.SourceCode.Entities;
using CVerify.API.Modules.SourceCode.Helpers;

namespace CVerify.API.Modules.Profiles.Services;

public class CvRepositoryIndexer : ICvRepositoryIndexer
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<CvRepositoryIndexer> _logger;

    public CvRepositoryIndexer(ApplicationDbContext context, ILogger<CvRepositoryIndexer> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task IndexUserCvRepositoriesAsync(Guid userId, CancellationToken cancellationToken)
    {
        _logger.LogInformation("Starting CV repository indexing for user {UserId}", userId);

        try
        {
            var references = new List<PendingReference>();

            // 1. Scan UserProfile (Bio, Headline, SocialLinks)
            var profile = await _context.UserProfiles
                .FirstOrDefaultAsync(up => up.UserId == userId && up.DeletedAt == null, cancellationToken);
            if (profile != null)
            {
                ExtractReferences(profile.Bio, "Bio", null, references);
                ExtractReferences(profile.Headline, "Headline", null, references);
                if (profile.SocialLinks != null)
                {
                    foreach (var link in profile.SocialLinks)
                    {
                        ExtractReferences(link, "SocialLink", null, references);
                    }
                }
            }

            // 2. Scan Work Experiences
            var experiences = await _context.WorkExperiences
                .Include(we => we.Links)
                .Where(we => we.UserId == userId && we.DeletedAt == null)
                .ToListAsync(cancellationToken);
            foreach (var exp in experiences)
            {
                ExtractReferences(exp.Description, "WorkExperience", exp.Id, references);
                if (exp.Links != null)
                {
                    foreach (var link in exp.Links)
                    {
                        ExtractReferences(link.Url, "WorkExperienceLink", exp.Id, references);
                    }
                }
            }

            // 3. Scan Projects (Name, Description)
            var projects = await _context.ProjectEntries
                .Where(pe => pe.UserId == userId && pe.DeletedAt == null)
                .ToListAsync(cancellationToken);
            foreach (var proj in projects)
            {
                ExtractReferences(proj.Name, "Project", proj.Id, references);
                ExtractReferences(proj.Description, "Project", proj.Id, references);
            }

            // 4. Fetch explicit ProjectRepositoryLinks
            var explicitLinks = await _context.ProjectRepositoryLinks
                .Include(rl => rl.SourceCodeRepository)
                .Where(rl => rl.ProjectEntry.UserId == userId && rl.ProjectEntry.DeletedAt == null)
                .ToListAsync(cancellationToken);

            // 5. Fetch all user's synced repositories from database using raw SQL to avoid dependency on Auth module
            var userRepos = await _context.Database.SqlQuery<UserRepoIdentityRawDto>($@"
                SELECT 
                    r.id AS ""Id"", 
                    ap.provider_name AS ""ProviderType"", 
                    r.external_repository_id AS ""ExternalRepositoryId"", 
                    r.html_url AS ""HtmlUrl""
                FROM source_code_repositories r
                INNER JOIN auth_providers ap ON r.auth_provider_id = ap.id
                WHERE ap.user_id = {userId} AND ap.deleted_at IS NULL AND r.is_accessible = true")
                .ToListAsync(cancellationToken);

            // Reconstruct canonical identity for all user repos
            var repoIdentities = userRepos.Select(r => new
            {
                RepoId = r.Id,
                Identity = new CVerify.API.Modules.SourceCode.Models.CanonicalRepositoryIdentity(
                    ProviderType: r.ProviderType?.ToLowerInvariant() ?? "unknown",
                    ProviderRepoId: r.ExternalRepositoryId,
                    CanonicalUrl: RepositoryIdentityHelper.NormalizeUrl(r.HtmlUrl)
                )
            }).ToList();

            var matchedMappings = new List<CvRepositoryMapping>();

            // Add explicit link mappings
            foreach (var link in explicitLinks)
            {
                if (!matchedMappings.Any(m => 
                    m.SourceCodeRepositoryId == link.SourceCodeRepositoryId &&
                    m.ReferenceSource == "ProjectRepositoryLink" &&
                    m.ReferenceEntityId == link.ProjectEntryId))
                {
                    matchedMappings.Add(new CvRepositoryMapping
                    {
                        Id = Guid.CreateVersion7(),
                        UserId = userId,
                        SourceCodeRepositoryId = link.SourceCodeRepositoryId,
                        ReferenceSource = "ProjectRepositoryLink",
                        ReferenceEntityId = link.ProjectEntryId,
                        IndexedAtUtc = DateTimeOffset.UtcNow
                    });
                }
            }

            // Add implicit textual match mappings
            foreach (var reference in references)
            {
                var matched = repoIdentities.FirstOrDefault(ri =>
                    ri.Identity.CanonicalUrl == reference.CanonicalUrl &&
                    string.Equals(ri.Identity.ProviderType, reference.ProviderType, StringComparison.OrdinalIgnoreCase)
                );

                if (matched != null)
                {
                    // Avoid duplicate mapping rows
                    if (!matchedMappings.Any(m =>
                        m.SourceCodeRepositoryId == matched.RepoId &&
                        m.ReferenceSource == reference.Source &&
                        m.ReferenceEntityId == reference.EntityId))
                    {
                        matchedMappings.Add(new CvRepositoryMapping
                        {
                            Id = Guid.CreateVersion7(),
                            UserId = userId,
                            SourceCodeRepositoryId = matched.RepoId,
                            ReferenceSource = reference.Source,
                            ReferenceEntityId = reference.EntityId,
                            IndexedAtUtc = DateTimeOffset.UtcNow
                        });
                    }
                }
            }

            // 6. Delete old mappings and bulk insert new mappings in a transaction
            var existingMappings = await _context.CvRepositoryMappings
                .Where(m => m.UserId == userId)
                .ToListAsync(cancellationToken);

            _context.CvRepositoryMappings.RemoveRange(existingMappings);
            _context.CvRepositoryMappings.AddRange(matchedMappings);

            await _context.SaveChangesAsync(cancellationToken);
            _logger.LogInformation("Successfully indexed {Count} CV repository mappings for user {UserId}", matchedMappings.Count, userId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to run CV repository indexing for user {UserId}", userId);
            throw;
        }
    }

    private void ExtractReferences(string? text, string source, Guid? entityId, List<PendingReference> list)
    {
        if (string.IsNullOrWhiteSpace(text)) return;

        // Github match: github.com/owner/repo or github.com:owner/repo
        var ghMatches = Regex.Matches(text, @"github\.com[:/]([a-zA-Z0-9_-]+)/([a-zA-Z0-9_.-]+)", RegexOptions.IgnoreCase);
        foreach (Match match in ghMatches)
        {
            if (match.Success)
            {
                var owner = match.Groups[1].Value;
                var repo = match.Groups[2].Value;
                if (repo.EndsWith(".git", StringComparison.OrdinalIgnoreCase))
                {
                    repo = repo.Substring(0, repo.Length - 4);
                }
                if (!IsIgnoredRepoName(repo))
                {
                    var canonicalUrl = RepositoryIdentityHelper.NormalizeUrl($"https://github.com/{owner}/{repo}");
                    list.Add(new PendingReference("github", canonicalUrl, source, entityId));
                }
            }
        }

        // Gitlab match: gitlab.com/owner/repo or gitlab.com:owner/repo
        var glMatches = Regex.Matches(text, @"gitlab\.com[:/]([a-zA-Z0-9_-]+(?:/[a-zA-Z0-9_-]+)*)/([a-zA-Z0-9_.-]+)", RegexOptions.IgnoreCase);
        foreach (Match match in glMatches)
        {
            if (match.Success)
            {
                var group = match.Groups[1].Value;
                var repo = match.Groups[2].Value;
                if (repo.EndsWith(".git", StringComparison.OrdinalIgnoreCase))
                {
                    repo = repo.Substring(0, repo.Length - 4);
                }
                if (!IsIgnoredRepoName(repo))
                {
                    var canonicalUrl = RepositoryIdentityHelper.NormalizeUrl($"https://gitlab.com/{group}/{repo}");
                    list.Add(new PendingReference("gitlab", canonicalUrl, source, entityId));
                }
            }
        }
    }

    private bool IsIgnoredRepoName(string repo)
    {
        return string.Equals(repo, "blob", StringComparison.OrdinalIgnoreCase) ||
               string.Equals(repo, "tree", StringComparison.OrdinalIgnoreCase) ||
               string.Equals(repo, "issues", StringComparison.OrdinalIgnoreCase) ||
               string.Equals(repo, "pull", StringComparison.OrdinalIgnoreCase) ||
               string.Equals(repo, "settings", StringComparison.OrdinalIgnoreCase);
    }

    private record PendingReference(string ProviderType, string CanonicalUrl, string Source, Guid? EntityId);
    private record UserRepoIdentityRawDto(Guid Id, string? ProviderType, string ExternalRepositoryId, string? HtmlUrl);
}
