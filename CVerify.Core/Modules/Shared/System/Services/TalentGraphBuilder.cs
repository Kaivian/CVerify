using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.Domain.Models;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Profiles.Entities;

namespace CVerify.API.Modules.Shared.System.Services;

public interface ITalentGraphBuilder
{
    Task<LogicalGraph> BuildGraphAsync(Guid candidateAssessmentId, CancellationToken cancellationToken);
}

public class TalentGraphBuilder : ITalentGraphBuilder
{
    private readonly ApplicationDbContext _context;
    private readonly ICapabilityProjectionBuilder _capabilityProjectionBuilder;

    public TalentGraphBuilder(ApplicationDbContext context, ICapabilityProjectionBuilder capabilityProjectionBuilder)
    {
        _context = context;
        _capabilityProjectionBuilder = capabilityProjectionBuilder;
    }

    public async Task<LogicalGraph> BuildGraphAsync(Guid candidateAssessmentId, CancellationToken cancellationToken)
    {
        var graph = new LogicalGraph();

        var assessment = await _context.CandidateAssessments
            .Include(ca => ca.User)
            .FirstOrDefaultAsync(ca => ca.Id == candidateAssessmentId, cancellationToken);

        if (assessment == null)
        {
            throw new KeyNotFoundException($"Candidate assessment with ID '{candidateAssessmentId}' not found.");
        }

        var userId = assessment.UserId;

        // 1. Fetch Projects
        var projects = await _context.ProjectEntries
            .Include(p => p.RepositoryLinks)
            .Include(p => p.Technologies)
            .Where(p => p.UserId == userId && p.DeletedAt == null)
            .ToListAsync(cancellationToken);

        foreach (var proj in projects)
        {
            var projNodeId = $"project:{proj.Id}";
            var attributes = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                { "Description", proj.Description },
                { "Role", proj.Role ?? "" },
                { "VerificationLevel", proj.VerificationLevel.ToString() },
                { "VerificationStatus", proj.VerificationStatus.ToString() }
            };
            graph.AddNode(projNodeId, LogicalNodeType.Project, proj.Name, attributes);
        }

        // 2. Fetch Repository Assessments (Repository Evidence)
        var completedJobs = await _context.AnalysisJobs
            .Where(j => j.UserId == userId && j.Status == "Completed")
            .ToListAsync(cancellationToken);

        var jobIds = completedJobs.Select(j => j.Id).ToList();

        var repoAssessments = await _context.RepositoryAssessments
            .Where(ra => jobIds.Contains(ra.AnalysisJobId) && ra.Status == "Completed")
            .ToListAsync(cancellationToken);

        var repoAssessmentIds = repoAssessments.Select(ra => ra.Id).ToList();

        var reposMap = new Dictionary<Guid, Guid>(); // RepoId -> RepoAssessmentId
        foreach (var ra in repoAssessments)
        {
            var repoNodeId = $"repository:{ra.Id}";
            var attributes = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                { "RepositoryId", ra.RepositoryId.ToString() },
                { "CommitSha", ra.CommitSha },
                { "OverallScore", ra.OverallScore.ToString() }
            };
            graph.AddNode(repoNodeId, LogicalNodeType.Repository, $"Repository {ra.RepositoryId.ToString().Substring(0, 8)}", attributes);
            reposMap[ra.RepositoryId] = ra.Id;
        }

        // 3. Connect Projects to Repository Evidence (Project -> CONNECTS_TO -> Repository)
        foreach (var proj in projects)
        {
            var projNodeId = $"project:{proj.Id}";
            foreach (var link in proj.RepositoryLinks)
            {
                if (reposMap.TryGetValue(link.SourceCodeRepositoryId, out var repoAssessId))
                {
                    var repoNodeId = $"repository:{repoAssessId}";
                    graph.AddEdge(projNodeId, repoNodeId, LogicalRelationType.CONNECTS_TO, 1.0);
                }
            }
        }

        // 4. Fetch Capabilities (from both CandidateAssessment and RepositoryAssessments)
        var candidateCapabilities = await _context.RepositoryCapabilities
            .Where(rc => rc.RepositoryAssessmentId == candidateAssessmentId)
            .ToListAsync(cancellationToken);

        var raCapabilities = await _context.RepositoryCapabilities
            .Where(rc => repoAssessmentIds.Contains(rc.RepositoryAssessmentId))
            .ToListAsync(cancellationToken);

        var allCapabilities = candidateCapabilities.Concat(raCapabilities).ToList();
        var capNodesMap = new Dictionary<string, (string CanonicalId, RepositoryCapability Entity)>(StringComparer.OrdinalIgnoreCase);

        foreach (var cap in allCapabilities)
        {
            var canonicalId = await _capabilityProjectionBuilder.ResolveCanonicalIdAsync(cap.Name, cancellationToken);
            if (string.IsNullOrEmpty(canonicalId))
            {
                canonicalId = cap.Name;
            }

            var capNodeId = $"capability:{canonicalId}";
            var attributes = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                { "Maturity", cap.Maturity },
                { "Confidence", cap.Confidence.ToString() },
                { "Score", cap.Score.ToString() },
                { "Category", cap.Category }
            };

            graph.AddNode(capNodeId, LogicalNodeType.Capability, cap.Name, attributes);
            capNodesMap[capNodeId] = (canonicalId, cap);
        }

        // 5. Build CommitFileCitations (Repository -> CONTAINS -> Citation -> PROVES -> Capability)
        foreach (var cap in raCapabilities)
        {
            var canonicalId = await _capabilityProjectionBuilder.ResolveCanonicalIdAsync(cap.Name, cancellationToken);
            if (string.IsNullOrEmpty(canonicalId))
            {
                canonicalId = cap.Name;
            }
            var capNodeId = $"capability:{canonicalId}";

            if (!string.IsNullOrEmpty(cap.EvidenceJson))
            {
                try
                {
                    using var evDoc = JsonDocument.Parse(cap.EvidenceJson);
                    var root = evDoc.RootElement;
                    string? filePath = null;
                    string? desc = null;

                    if (root.TryGetProperty("file_path", out var pathProp)) filePath = pathProp.GetString();
                    if (root.TryGetProperty("description", out var descProp)) desc = descProp.GetString();

                    if (!string.IsNullOrEmpty(filePath))
                    {
                        var citationNodeId = $"citation:{cap.RepositoryAssessmentId}:{filePath.GetHashCode()}";
                        var citationAttributes = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                        {
                            { "FilePath", filePath },
                            { "Description", desc ?? "" }
                        };

                        graph.AddNode(citationNodeId, LogicalNodeType.CommitFileCitation, filePath, citationAttributes);

                        // Connect Repository to Citation
                        var repoNodeId = $"repository:{cap.RepositoryAssessmentId}";
                        if (graph.Nodes.ContainsKey(repoNodeId))
                        {
                            graph.AddEdge(repoNodeId, citationNodeId, LogicalRelationType.CONTAINS, 1.0);
                        }

                        // Connect Citation to Capability
                        if (graph.Nodes.ContainsKey(capNodeId))
                        {
                            graph.AddEdge(citationNodeId, capNodeId, LogicalRelationType.PROVES, cap.Confidence);
                        }
                    }
                }
                catch { }
            }
        }

        // 6. Fetch Skills & Technologies (ProjectTechnologies, CandidateSkills, UserSkills)
        var candidateSkills = await _context.CandidateSkills
            .Where(cs => cs.CandidateAssessmentId == candidateAssessmentId)
            .ToListAsync(cancellationToken);

        var selfDeclaredSkills = await _context.UserSkills
            .Where(us => us.UserId == userId)
            .Select(us => us.Skill)
            .ToListAsync(cancellationToken);

        var careerPref = await _context.CareerPreferences
            .FirstOrDefaultAsync(cp => cp.UserId == userId, cancellationToken);
        if (careerPref?.TargetSkills != null)
        {
            selfDeclaredSkills = selfDeclaredSkills.Concat(careerPref.TargetSkills).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        }

        var projectTechs = projects.SelectMany(p => p.Technologies).Select(t => t.Name).Distinct(StringComparer.OrdinalIgnoreCase).ToList();

        var allTechNames = candidateSkills.Select(cs => cs.SkillName)
            .Concat(selfDeclaredSkills)
            .Concat(projectTechs)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var techNodesMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var techName in allTechNames)
        {
            var techNodeId = $"technology:{techName.ToLowerInvariant()}";
            graph.AddNode(techNodeId, LogicalNodeType.Technology, techName);
            techNodesMap[techNodeId] = techName;
        }

        // Connect Capabilities to Technologies (Capability -> USES -> Technology)
        foreach (var capKvp in capNodesMap)
        {
            var capNodeId = capKvp.Key;
            var capName = capKvp.Value.Entity.Name;
            var capCategory = capKvp.Value.Entity.Category;

            var registry = await _capabilityProjectionBuilder.GetCapabilityRegistryAsync(capKvp.Value.CanonicalId, cancellationToken);
            var regDescription = registry?.Description ?? "";
            var regDisplayName = registry?.DisplayName ?? "";

            var matchedTechs = new List<string>();

            foreach (var techKvp in techNodesMap)
            {
                var techNodeId = techKvp.Key;
                var techName = techKvp.Value;

                if (capName.Contains(techName, StringComparison.OrdinalIgnoreCase) ||
                    capCategory.Contains(techName, StringComparison.OrdinalIgnoreCase) ||
                    regDisplayName.Contains(techName, StringComparison.OrdinalIgnoreCase) ||
                    regDescription.Contains(techName, StringComparison.OrdinalIgnoreCase))
                {
                    matchedTechs.Add(techNodeId);
                }
            }

            var targets = matchedTechs.Any() ? matchedTechs : techNodesMap.Keys.ToList();
            foreach (var target in targets)
            {
                graph.AddEdge(capNodeId, target, LogicalRelationType.USES, 1.0);
            }
        }

        // 7. Fetch Domains (from CandidateDomainProfile)
        var domains = await _context.CandidateDomainProfiles
            .Where(dp => dp.CandidateAssessmentId == candidateAssessmentId)
            .ToListAsync(cancellationToken);

        foreach (var dom in domains)
        {
            var domNodeId = $"domain:{dom.DomainName.Replace(" ", "-").ToLowerInvariant()}";
            var attributes = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                { "Score", dom.Score.ToString() },
                { "Confidence", dom.Confidence.ToString() },
                { "Seniority", dom.Seniority }
            };
            graph.AddNode(domNodeId, LogicalNodeType.Domain, dom.DomainName, attributes);

            // Connect matching Capabilities to Domains (Capability -> ALIGNS_TO -> Domain)
            foreach (var capKvp in capNodesMap)
            {
                var capNodeId = capKvp.Key;
                var capCategory = capKvp.Value.Entity.Category;

                if (capCategory.Equals(dom.DomainName, StringComparison.OrdinalIgnoreCase))
                {
                    graph.AddEdge(capNodeId, domNodeId, LogicalRelationType.ALIGNS_TO, 1.0);
                }
            }
        }

        return graph;
    }
}
