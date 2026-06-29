using System;
using System.Collections.Generic;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using CVerify.API.Modules.Profiles.Entities;

namespace CVerify.API.Modules.Profiles.Services;

public class SkillTreeValidationService : ISkillTreeValidationService
{
    private static readonly HashSet<string> CanonicalCategories = new(StringComparer.OrdinalIgnoreCase)
    {
        "Domain", "Subdomain", "Technology", "Framework", "Library", "Tool", "Methodology"
    };

    private const int MaxAllowedDepth = 5;

    public Task<List<CandidateSkillTreeNode>> ValidateAndNormalizeTreeAsync(
        Guid candidateId,
        Guid assessmentId,
        JsonElement rootElement)
    {
        var flatList = new List<CandidateSkillTreeNode>();
        var seenSlugs = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        if (rootElement.ValueKind == JsonValueKind.Array)
        {
            foreach (var nodeElement in rootElement.EnumerateArray())
            {
                ProcessNode(candidateId, assessmentId, nodeElement, null, null, 1, flatList, seenSlugs);
            }
        }
        else if (rootElement.ValueKind == JsonValueKind.Object)
        {
            // If the element has a key "skillTree", get that first
            if (rootElement.TryGetProperty("skillTree", out var innerTree))
            {
                ProcessNode(candidateId, assessmentId, innerTree, null, null, 1, flatList, seenSlugs);
            }
            else
            {
                ProcessNode(candidateId, assessmentId, rootElement, null, null, 1, flatList, seenSlugs);
            }
        }

        // Validate parent relationships & detect cycles
        ValidateHierarchyAndCycles(flatList);

        return Task.FromResult(flatList);
    }

    private void ProcessNode(
        Guid candidateId,
        Guid assessmentId,
        JsonElement element,
        string? parentSlug,
        Guid? parentId,
        int depth,
        List<CandidateSkillTreeNode> flatList,
        HashSet<string> seenSlugs)
    {
        if (depth > MaxAllowedDepth)
        {
            throw new InvalidOperationException($"Skill Tree exceeds the maximum allowed depth of {MaxAllowedDepth}. Root/parent path: '{parentSlug}'.");
        }

        if (!element.TryGetProperty("id", out var idProp) || string.IsNullOrEmpty(idProp.GetString()))
        {
            throw new ArgumentException("A node in the Skill Tree is missing the required 'id' (slug) property.");
        }

        var rawSlug = idProp.GetString()!;
        var slug = rawSlug.Trim().ToLowerInvariant();

        if (seenSlugs.Contains(slug))
        {
            throw new InvalidOperationException($"Duplicate node slug detected: '{slug}'. Node slugs must be unique within the candidate's skill tree.");
        }
        seenSlugs.Add(slug);

        var displayName = element.TryGetProperty("displayName", out var displayProp) ? displayProp.GetString() ?? "unknown" : "unknown";
        var category = element.TryGetProperty("category", out var catProp) ? catProp.GetString() ?? "Methodology" : "Methodology";

        if (!CanonicalCategories.Contains(category))
        {
            throw new ArgumentException($"Invalid skill taxonomy category '{category}' for node '{slug}'. Must be one of: {string.Join(", ", CanonicalCategories)}");
        }

        var proficiencyLevel = element.TryGetProperty("proficiencyLevel", out var profProp) ? profProp.GetString() ?? "Working" : "Working";
        var confidenceScore = element.TryGetProperty("confidenceScore", out var confProp) ? confProp.GetDouble() : 1.0;
        var estimatedExperience = element.TryGetProperty("estimatedExperience", out var expProp) ? expProp.GetDouble() : 0.0;

        string? supportingEvidenceJson = null;
        if (element.TryGetProperty("supportingEvidence", out var evProp))
        {
            supportingEvidenceJson = JsonSerializer.Serialize(evProp);
        }

        // Compute stable hashed Guid ID for the node using the assessment ID and the hierarchical path slug
        var nodeId = GenerateStableGuid(assessmentId, slug);

        var node = new CandidateSkillTreeNode
        {
            Id = nodeId,
            CandidateAssessmentId = assessmentId,
            ParentId = parentId,
            DisplayName = displayName,
            Category = category,
            ProficiencyLevel = proficiencyLevel,
            ConfidenceScore = confidenceScore,
            EstimatedExperienceMonths = estimatedExperience,
            SupportingEvidence = supportingEvidenceJson
        };

        // Cache node for parenting check or cyclic reference checks
        flatList.Add(node);

        // Process children
        if (element.TryGetProperty("children", out var childrenProp) && childrenProp.ValueKind == JsonValueKind.Array)
        {
            foreach (var childElement in childrenProp.EnumerateArray())
            {
                ProcessNode(candidateId, assessmentId, childElement, slug, nodeId, depth + 1, flatList, seenSlugs);
            }
        }
    }

    private static void ValidateHierarchyAndCycles(List<CandidateSkillTreeNode> nodes)
    {
        var nodeMap = new Dictionary<Guid, CandidateSkillTreeNode>();
        foreach (var node in nodes)
        {
            nodeMap[node.Id] = node;
        }

        foreach (var node in nodes)
        {
            if (node.ParentId.HasValue)
            {
                if (!nodeMap.ContainsKey(node.ParentId.Value))
                {
                    throw new InvalidOperationException($"Node '{node.DisplayName}' references a parent ID '{node.ParentId.Value}' that does not exist in the flat node set.");
                }

                // Cycle detection: traverse parent references upwards
                var visited = new HashSet<Guid> { node.Id };
                var current = node;
                while (current.ParentId.HasValue)
                {
                    var parentId = current.ParentId.Value;
                    if (visited.Contains(parentId))
                    {
                        throw new InvalidOperationException($"Cyclic parent-child relationship detected for node '{node.DisplayName}' (ID: {node.Id}).");
                    }
                    visited.Add(parentId);

                    if (!nodeMap.TryGetValue(parentId, out var parentNode))
                    {
                        break;
                    }
                    current = parentNode;
                }
            }
        }
    }

    private static Guid GenerateStableGuid(Guid assessmentId, string pathSlug)
    {
        using var md5 = MD5.Create();
        var key = $"{assessmentId.ToString().ToLowerInvariant()}:{pathSlug.ToLowerInvariant().Trim('/')}";
        var inputBytes = Encoding.UTF8.GetBytes(key);
        var hashBytes = md5.ComputeHash(inputBytes);
        return new Guid(hashBytes);
    }
}
