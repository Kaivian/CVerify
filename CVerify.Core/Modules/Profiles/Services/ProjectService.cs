using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Modules.Profiles.DTOs;
using CVerify.API.Modules.Profiles.Entities;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.Exceptions;
using CVerify.API.Modules.SourceCode.Entities;

namespace CVerify.API.Modules.Profiles.Services;

public class ProjectService : IProjectService
{
    private readonly ApplicationDbContext _context;

    public ProjectService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<ProjectEntryResponse>> GetProjectsAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        await UpgradeRepositoryLinkedProjectsAsync(userId, cancellationToken);

        var projects = await _context.ProjectEntries
            .Include(p => p.RepositoryLinks)
                .ThenInclude(l => l.SourceCodeRepository)
            .Include(p => p.Technologies)
            .Include(p => p.Contributions)
            .Where(p => p.UserId == userId)
            .OrderBy(p => p.DisplayOrder)
            .ToListAsync(cancellationToken);

        return projects.Select(MapToResponse).ToList();
    }

    public async Task<ProjectEntryResponse> CreateProjectAsync(Guid userId, ProjectEntryRequest request, CancellationToken cancellationToken = default)
    {
        var displayOrder = await _context.ProjectEntries
            .Where(p => p.UserId == userId)
            .Select(p => (int?)p.DisplayOrder)
            .MaxAsync(cancellationToken) ?? -1;

        var project = new ProjectEntry
        {
            Id = Guid.CreateVersion7(),
            UserId = userId,
            Name = request.Name,
            Role = request.Role,
            Description = request.Description,
            StartDate = request.StartDate,
            EndDate = request.EndDate,
            IsCurrentlyWorking = request.IsCurrentlyWorking,
            VerificationLevel = request.VerificationLevel,
            VerificationStatus = ProjectVerificationStatus.Unverified,
            DisplayOrder = displayOrder + 1,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        // Link repositories
        if (request.LinkedRepositoryIds != null)
        {
            foreach (var repoId in request.LinkedRepositoryIds)
            {
                var repoExists = await _context.SourceCodeRepositories
                    .FromSqlRaw(@"
                        SELECT r.*
                        FROM source_code_repositories r
                        INNER JOIN auth_providers ap ON r.auth_provider_id = ap.id
                        WHERE r.id = {0} AND ap.user_id = {1} AND ap.deleted_at IS NULL",
                        repoId, userId)
                    .AnyAsync(cancellationToken);

                if (repoExists)
                {
                    project.RepositoryLinks.Add(new ProjectRepositoryLink
                    {
                        Id = Guid.CreateVersion7(),
                        SourceCodeRepositoryId = repoId,
                        LinkedAt = DateTimeOffset.UtcNow
                    });
                }
            }
        }

        // If AI Analyzed, let's build the snapshot from the latest reports
        if (request.VerificationLevel == ProjectVerificationLevel.AiAnalyzed && request.LinkedRepositoryIds != null && request.LinkedRepositoryIds.Any())
        {
            await PopulateAiSnapshotAsync(userId, project, request.LinkedRepositoryIds, cancellationToken);
        }
        else
        {
            // Otherwise, we populate manually passed details
            if (request.Technologies != null)
            {
                foreach (var tech in request.Technologies.Where(t => !string.IsNullOrWhiteSpace(t)))
                {
                    project.Technologies.Add(new ProjectTechnology { Id = Guid.CreateVersion7(), Name = tech.Trim() });
                }
            }

            if (request.Contributions != null)
            {
                foreach (var cont in request.Contributions.Where(c => !string.IsNullOrWhiteSpace(c)))
                {
                    project.Contributions.Add(new ProjectContribution { Id = Guid.CreateVersion7(), Content = cont.Trim() });
                }
            }

            if (request.VerificationLevel == ProjectVerificationLevel.RepositoryLinked)
            {
                project.VerificationStatus = ProjectVerificationStatus.Verified;
                project.VerifiedAt = DateTimeOffset.UtcNow;
            }
        }

        _context.ProjectEntries.Add(project);
        await _context.SaveChangesAsync(cancellationToken);

        return await GetProjectByIdOrThrowAsync(userId, project.Id, cancellationToken);
    }

    public async Task<ProjectEntryResponse> UpdateProjectAsync(Guid userId, Guid id, ProjectEntryRequest request, CancellationToken cancellationToken = default)
    {
        var project = await _context.ProjectEntries
            .Include(p => p.RepositoryLinks)
            .Include(p => p.Technologies)
            .Include(p => p.Contributions)
            .FirstOrDefaultAsync(p => p.Id == id && p.UserId == userId, cancellationToken);

        if (project == null)
        {
            throw new ResourceNotFoundException("PROJECT_NOT_FOUND", "Project not found.");
        }

        project.Name = request.Name;
        project.Role = request.Role;
        project.Description = request.Description;
        project.StartDate = request.StartDate;
        project.EndDate = request.EndDate;
        project.IsCurrentlyWorking = request.IsCurrentlyWorking;
        project.VerificationLevel = request.VerificationLevel;
        project.UpdatedAt = DateTimeOffset.UtcNow;

        // Sync Technologies
        _context.ProjectTechnologies.RemoveRange(project.Technologies);
        project.Technologies.Clear();
        if (request.Technologies != null)
        {
            foreach (var tech in request.Technologies.Where(t => !string.IsNullOrWhiteSpace(t)))
            {
                project.Technologies.Add(new ProjectTechnology { Id = Guid.CreateVersion7(), Name = tech.Trim() });
            }
        }

        // Sync Contributions
        _context.ProjectContributions.RemoveRange(project.Contributions);
        project.Contributions.Clear();
        if (request.Contributions != null)
        {
            foreach (var cont in request.Contributions.Where(c => !string.IsNullOrWhiteSpace(c)))
            {
                project.Contributions.Add(new ProjectContribution { Id = Guid.CreateVersion7(), Content = cont.Trim() });
            }
        }

        // Sync Repository Links
        _context.ProjectRepositoryLinks.RemoveRange(project.RepositoryLinks);
        project.RepositoryLinks.Clear();
        if (request.LinkedRepositoryIds != null)
        {
            foreach (var repoId in request.LinkedRepositoryIds)
            {
                var repoExists = await _context.SourceCodeRepositories
                    .FromSqlRaw(@"
                        SELECT r.*
                        FROM source_code_repositories r
                        INNER JOIN auth_providers ap ON r.auth_provider_id = ap.id
                        WHERE r.id = {0} AND ap.user_id = {1} AND ap.deleted_at IS NULL",
                        repoId, userId)
                    .AnyAsync(cancellationToken);

                if (repoExists)
                {
                    project.RepositoryLinks.Add(new ProjectRepositoryLink
                    {
                        Id = Guid.CreateVersion7(),
                        SourceCodeRepositoryId = repoId,
                        LinkedAt = DateTimeOffset.UtcNow
                    });
                }
            }
        }

        // Set Verification Status based on level
        if (request.VerificationLevel == ProjectVerificationLevel.AiAnalyzed)
        {
            bool hasCompletedAnalysis = false;
            if (request.LinkedRepositoryIds != null && request.LinkedRepositoryIds.Any())
            {
                hasCompletedAnalysis = await _context.SourceCodeRepositories
                    .AnyAsync(r => request.LinkedRepositoryIds.Contains(r.Id) && r.LatestAnalysisStatus == "Completed", cancellationToken);
            }
            project.VerificationStatus = hasCompletedAnalysis ? ProjectVerificationStatus.Verified : ProjectVerificationStatus.Unverified;
            project.VerifiedAt = hasCompletedAnalysis ? DateTimeOffset.UtcNow : null;
        }
        else if (request.VerificationLevel == ProjectVerificationLevel.RepositoryLinked)
        {
            project.VerificationStatus = ProjectVerificationStatus.Verified;
            project.VerifiedAt = DateTimeOffset.UtcNow;
        }
        else
        {
            project.VerificationStatus = ProjectVerificationStatus.Unverified;
            project.VerifiedAt = null;
        }

        await _context.SaveChangesAsync(cancellationToken);
        return MapToResponse(project);
    }

    public async Task DeleteProjectAsync(Guid userId, Guid id, CancellationToken cancellationToken = default)
    {
        var project = await _context.ProjectEntries
            .FirstOrDefaultAsync(p => p.Id == id && p.UserId == userId, cancellationToken);

        if (project == null)
        {
            throw new ResourceNotFoundException("PROJECT_NOT_FOUND", "Project not found.");
        }

        _context.ProjectEntries.Remove(project);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task ReorderProjectsAsync(Guid userId, List<Guid> orderedIds, CancellationToken cancellationToken = default)
    {
        var projects = await _context.ProjectEntries
            .Where(p => p.UserId == userId)
            .ToListAsync(cancellationToken);

        for (int i = 0; i < orderedIds.Count; i++)
        {
            var id = orderedIds[i];
            var proj = projects.FirstOrDefault(p => p.Id == id);
            if (proj != null)
            {
                proj.DisplayOrder = i;
                proj.UpdatedAt = DateTimeOffset.UtcNow;
            }
        }

        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task UpgradeRepositoryLinkedProjectsAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var projects = await _context.ProjectEntries
            .Include(p => p.RepositoryLinks)
                .ThenInclude(l => l.SourceCodeRepository)
            .Include(p => p.Technologies)
            .Include(p => p.Contributions)
            .Where(p => p.UserId == userId && p.VerificationLevel == ProjectVerificationLevel.RepositoryLinked)
            .ToListAsync(cancellationToken);

        bool anyUpgraded = false;

        foreach (var project in projects)
        {
            var repoIds = project.RepositoryLinks
                .Where(l => l.SourceCodeRepository != null && l.SourceCodeRepository.LatestAnalysisStatus == "Completed")
                .Select(l => l.SourceCodeRepositoryId)
                .ToList();

            if (repoIds.Any())
            {
                // Upgrade this project to AI Analyzed
                project.VerificationLevel = ProjectVerificationLevel.AiAnalyzed;
                project.UpdatedAt = DateTimeOffset.UtcNow;

                // Clear manual technologies and contributions
                if (project.Technologies.Any())
                {
                    _context.ProjectTechnologies.RemoveRange(project.Technologies);
                    project.Technologies.Clear();
                }

                if (project.Contributions.Any())
                {
                    _context.ProjectContributions.RemoveRange(project.Contributions);
                    project.Contributions.Clear();
                }

                // Populate AI snapshot
                await PopulateAiSnapshotAsync(userId, project, repoIds, cancellationToken);
                anyUpgraded = true;
            }
        }

        // Backfill dates for AI Analyzed projects that have StartDate == null
        var emptyAiProjects = await _context.ProjectEntries
            .Include(p => p.RepositoryLinks)
                .ThenInclude(l => l.SourceCodeRepository)
            .Include(p => p.Technologies)
            .Include(p => p.Contributions)
            .Where(p => p.UserId == userId && p.VerificationLevel == ProjectVerificationLevel.AiAnalyzed && p.StartDate == null)
            .ToListAsync(cancellationToken);

        foreach (var project in emptyAiProjects)
        {
            var repoIds = project.RepositoryLinks
                .Where(l => l.SourceCodeRepository != null)
                .Select(l => l.SourceCodeRepositoryId)
                .ToList();

            if (repoIds.Any())
            {
                await PopulateAiSnapshotAsync(userId, project, repoIds, cancellationToken);
                anyUpgraded = true;
            }
        }

        if (anyUpgraded)
        {
            await _context.SaveChangesAsync(cancellationToken);
        }
    }

    private async Task PopulateAiSnapshotAsync(Guid userId, ProjectEntry project, List<Guid> repoIds, CancellationToken cancellationToken)
    {
        bool hasSnapshotPopulated = false;

        foreach (var repoId in repoIds)
        {
            var report = await _context.AnalysisReports
                .Include(r => r.Repository)
                .Where(r => r.RepositoryId == repoId)
                .OrderByDescending(r => r.CreatedAtUtc)
                .FirstOrDefaultAsync(cancellationToken);

            if (report != null)
            {
                try
                {
                    using var doc = JsonDocument.Parse(report.ReportData);
                    var root = doc.RootElement;

                    string? title = null;
                    string? summary = null;

                    if (root.TryGetProperty("cvSynthesis", out var cvSynth))
                    {
                        if (cvSynth.TryGetProperty("title", out var titleProp)) title = titleProp.GetString();
                        if (cvSynth.TryGetProperty("summary", out var summaryProp)) summary = summaryProp.GetString();
                    }

                    if (string.IsNullOrWhiteSpace(summary) && root.TryGetProperty("narrative", out var narrative))
                    {
                        if (narrative.TryGetProperty("recruiter_summary", out var recSummary)) summary = recSummary.GetString();
                    }

                    if (string.IsNullOrWhiteSpace(summary) && root.TryGetProperty("repo", out var repoNode))
                    {
                        if (repoNode.TryGetProperty("description", out var descProp)) summary = descProp.GetString();
                    }

                    if (string.IsNullOrWhiteSpace(project.Name))
                    {
                        project.Name = report.Repository.Name;
                    }

                    if (!string.IsNullOrWhiteSpace(title))
                    {
                        project.Role = title;
                    }

                    if (!string.IsNullOrWhiteSpace(summary))
                    {
                        project.Description = summary;
                    }

                    if (project.StartDate == null && report.Repository.CreatedAtUtc != default)
                    {
                        project.StartDate = report.Repository.CreatedAtUtc;
                    }

                    if (project.EndDate == null)
                    {
                        project.EndDate = report.Repository.LastCommitAt;
                        project.IsCurrentlyWorking = report.Repository.LastCommitAt == null;
                    }

                    var techList = new List<string>();
                    if (cvSynth.ValueKind == JsonValueKind.Object && cvSynth.TryGetProperty("skills", out var skillsProp) && skillsProp.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var s in skillsProp.EnumerateArray())
                        {
                            var sStr = s.GetString();
                            if (!string.IsNullOrWhiteSpace(sStr)) techList.Add(sStr.Trim());
                        }
                    }

                    if (!techList.Any() && root.TryGetProperty("profile", out var profile) && profile.TryGetProperty("technologies", out var techs) && techs.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var t in techs.EnumerateArray())
                        {
                            if (t.TryGetProperty("name", out var nProp))
                            {
                                var nStr = nProp.GetString();
                                if (!string.IsNullOrWhiteSpace(nStr)) techList.Add(nStr.Trim());
                            }
                        }
                    }

                    if (!techList.Any() && !string.IsNullOrWhiteSpace(report.Repository.PrimaryLanguage))
                    {
                        techList.Add(report.Repository.PrimaryLanguage);
                    }

                    foreach (var tech in techList.Distinct())
                    {
                        project.Technologies.Add(new ProjectTechnology { Id = Guid.CreateVersion7(), Name = tech });
                    }

                    var contList = new List<string>();
                    if (cvSynth.ValueKind == JsonValueKind.Object && cvSynth.TryGetProperty("highlights", out var highlightsProp) && highlightsProp.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var h in highlightsProp.EnumerateArray())
                        {
                            string? sig = null;
                            string? imp = null;
                            if (h.TryGetProperty("signal", out var sigProp)) sig = sigProp.GetString();
                            if (h.TryGetProperty("impact", out var impProp)) imp = impProp.GetString();

                            if (!string.IsNullOrWhiteSpace(sig) && !string.IsNullOrWhiteSpace(imp))
                            {
                                contList.Add($"{sig}: {imp}");
                            }
                            else if (!string.IsNullOrWhiteSpace(sig))
                            {
                                contList.Add(sig);
                            }
                        }
                    }

                    if (!contList.Any() && root.TryGetProperty("findings", out var findings) && findings.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var f in findings.EnumerateArray())
                        {
                            if (f.TryGetProperty("finding", out var findProp))
                            {
                                var findStr = findProp.GetString();
                                if (!string.IsNullOrWhiteSpace(findStr)) contList.Add(findStr.Trim());
                            }
                        }
                    }

                    foreach (var cont in contList.Distinct())
                    {
                        project.Contributions.Add(new ProjectContribution { Id = Guid.CreateVersion7(), Content = cont });
                    }

                    project.VerificationStatus = ProjectVerificationStatus.Verified;
                    project.VerifiedAt = DateTimeOffset.UtcNow;
                    hasSnapshotPopulated = true;
                    break;
                }
                catch
                {
                    // Ignore and try next repo if any
                }
            }
        }

        if (!hasSnapshotPopulated)
        {
            project.VerificationStatus = ProjectVerificationStatus.Unverified;
            project.VerifiedAt = null;
        }
    }

    private async Task<ProjectEntryResponse> GetProjectByIdOrThrowAsync(Guid userId, Guid id, CancellationToken cancellationToken)
    {
        var project = await _context.ProjectEntries
            .Include(p => p.RepositoryLinks)
                .ThenInclude(l => l.SourceCodeRepository)
            .Include(p => p.Technologies)
            .Include(p => p.Contributions)
            .FirstOrDefaultAsync(p => p.Id == id && p.UserId == userId, cancellationToken);

        if (project == null)
        {
            throw new ResourceNotFoundException("PROJECT_NOT_FOUND", "Project not found.");
        }

        return MapToResponse(project);
    }

    private static ProjectEntryResponse MapToResponse(ProjectEntry project)
    {
        var links = project.RepositoryLinks.Select(l => new ProjectRepositoryLinkResponse(
            l.Id,
            l.SourceCodeRepositoryId,
            l.SourceCodeRepository?.Name ?? string.Empty,
            l.SourceCodeRepository?.Owner ?? string.Empty,
            l.SourceCodeRepository?.HtmlUrl
        )).ToList();

        return new ProjectEntryResponse(
            project.Id,
            project.UserId,
            project.Name,
            project.Role,
            project.Description,
            project.StartDate,
            project.EndDate,
            project.IsCurrentlyWorking,
            project.VerificationLevel,
            project.VerificationStatus,
            project.VerifiedAt,
            project.VerificationMetadataJson,
            project.DisplayOrder,
            links,
            project.Technologies.Select(t => t.Name).ToList(),
            project.Contributions.Select(c => c.Content).ToList()
        );
    }
}
