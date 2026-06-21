using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.Domain.Models;
using CVerify.API.Modules.Shared.System.DTOs;

namespace CVerify.API.Modules.Shared.System.Services;

public interface IRequirementGraphBuilder
{
    Task<LogicalGraph> BuildGraphAsync(HiringRequirement requirement, CancellationToken cancellationToken);
    Task<LogicalGraph> BuildGraphFromSnapshotAsync(RequirementSnapshot snapshot, CancellationToken cancellationToken);
}

public class RequirementGraphBuilder : IRequirementGraphBuilder
{
    private readonly ICapabilityProjectionBuilder _capabilityProjectionBuilder;

    public RequirementGraphBuilder(ICapabilityProjectionBuilder capabilityProjectionBuilder)
    {
        _capabilityProjectionBuilder = capabilityProjectionBuilder;
    }

    public async Task<LogicalGraph> BuildGraphAsync(HiringRequirement requirement, CancellationToken cancellationToken)
    {
        var graph = new LogicalGraph();

        // 1. Add Business Outcome Nodes
        var outcomesList = requirement.BusinessOutcomes?.ToList() ?? new List<BusinessOutcome>();
        foreach (var outcome in outcomesList)
        {
            var outcomeNodeId = $"outcome:{outcome.Id}";
            graph.AddNode(outcomeNodeId, LogicalNodeType.Outcome, outcome.Text);
        }

        // 2. Add Responsibility Nodes
        var respList = requirement.Responsibilities?.ToList() ?? new List<Responsibility>();
        foreach (var resp in respList)
        {
            var respNodeId = $"responsibility:{resp.Id}";
            var attributes = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                { "Priority", resp.Priority.ToString() },
                { "OwnershipLevel", resp.OwnershipLevel.ToString() },
                { "IsLeadership", resp.IsLeadership.ToString() }
            };
            graph.AddNode(respNodeId, LogicalNodeType.Responsibility, resp.Text, attributes);
        }

        // 3. Add Capability Nodes (resolving canonical IDs)
        var capList = requirement.Capabilities?.ToList() ?? new List<RequirementCapability>();
        var capNodesMap = new Dictionary<string, (string CanonicalId, RequirementCapability Entity)>(StringComparer.OrdinalIgnoreCase);

        foreach (var cap in capList)
        {
            var canonicalId = await _capabilityProjectionBuilder.ResolveCanonicalIdAsync(cap.CapabilityId, cancellationToken);
            if (string.IsNullOrEmpty(canonicalId))
            {
                canonicalId = await _capabilityProjectionBuilder.ResolveCanonicalIdAsync(cap.Name, cancellationToken);
            }
            if (string.IsNullOrEmpty(canonicalId))
            {
                canonicalId = cap.CapabilityId;
            }

            var capNodeId = $"capability:{canonicalId}";
            var attributes = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                { "ExpectedProficiency", cap.ExpectedProficiency.ToString() },
                { "Priority", cap.Priority.ToString() },
                { "OwnershipLevel", cap.OwnershipLevel.ToString() },
                { "Category", cap.Category }
            };

            graph.AddNode(capNodeId, LogicalNodeType.Capability, cap.Name, attributes);
            capNodesMap[capNodeId] = (canonicalId, cap);
        }

        // 4. Add Technology Nodes
        var techList = requirement.TechnologyRequirements?.ToList() ?? new List<TechnologyRequirement>();
        var techNodesMap = new Dictionary<string, TechnologyRequirement>(StringComparer.OrdinalIgnoreCase);
        foreach (var tech in techList)
        {
            var techNodeId = $"technology:{tech.Name.ToLowerInvariant()}";
            var attributes = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                { "Priority", tech.Priority.ToString() },
                { "SfiaLevel", tech.SfiaLevel.ToString() }
            };

            graph.AddNode(techNodeId, LogicalNodeType.Technology, tech.Name, attributes);
            techNodesMap[techNodeId] = tech;
        }

        // 5. Connect Outcomes to Capabilities (LogicalRelationType.REQUIRES)
        foreach (var outcome in outcomesList)
        {
            var outcomeNodeId = $"outcome:{outcome.Id}";
            var matchedCaps = new List<string>();

            foreach (var kvp in capNodesMap)
            {
                var capNodeId = kvp.Key;
                var capName = kvp.Value.Entity.Name;
                var capId = kvp.Value.CanonicalId;

                if (outcome.Text.Contains(capName, StringComparison.OrdinalIgnoreCase) ||
                    outcome.Text.Contains(capId, StringComparison.OrdinalIgnoreCase))
                {
                    matchedCaps.Add(capNodeId);
                }
            }

            // Fallback: If no capability matches semantically, link to all capabilities in the requirement
            var targets = matchedCaps.Any() ? matchedCaps : capNodesMap.Keys.ToList();
            foreach (var target in targets)
            {
                graph.AddEdge(outcomeNodeId, target, LogicalRelationType.REQUIRES, 1.0);
            }
        }

        // 6. Connect Responsibilities to Capabilities (LogicalRelationType.REQUIRES)
        foreach (var resp in respList)
        {
            var respNodeId = $"responsibility:{resp.Id}";
            var matchedCaps = new List<string>();

            foreach (var kvp in capNodesMap)
            {
                var capNodeId = kvp.Key;
                var capName = kvp.Value.Entity.Name;
                var capId = kvp.Value.CanonicalId;

                if (resp.Text.Contains(capName, StringComparison.OrdinalIgnoreCase) ||
                    resp.Text.Contains(capId, StringComparison.OrdinalIgnoreCase))
                {
                    matchedCaps.Add(capNodeId);
                }
            }

            var targets = matchedCaps.Any() ? matchedCaps : capNodesMap.Keys.ToList();
            foreach (var target in targets)
            {
                var weight = GetWeightForPriority(resp.Priority) * GetWeightForOwnership(resp.OwnershipLevel);
                graph.AddEdge(respNodeId, target, LogicalRelationType.REQUIRES, weight);
            }
        }

        // 7. Connect Capabilities to Technologies (LogicalRelationType.USES)
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
                var techName = techKvp.Value.Name;

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
                var tech = techNodesMap[target];
                var weight = GetWeightForPriority(tech.Priority);
                graph.AddEdge(capNodeId, target, LogicalRelationType.USES, weight);
            }
        }

        // 8. Connect Capabilities to Domains (LogicalRelationType.ALIGNS_TO)
        foreach (var kvp in capNodesMap)
        {
            var capNodeId = kvp.Key;
            var category = kvp.Value.Entity.Category;
            var domainNodeId = $"domain:{category.Replace(" ", "-").ToLowerInvariant()}";

            graph.AddNode(domainNodeId, LogicalNodeType.Domain, category);
            graph.AddEdge(capNodeId, domainNodeId, LogicalRelationType.ALIGNS_TO, 1.0);
        }

        return graph;
    }

    public async Task<LogicalGraph> BuildGraphFromSnapshotAsync(RequirementSnapshot snapshot, CancellationToken cancellationToken)
    {
        var graph = new LogicalGraph();

        // Deserialize collections from json fields
        var outcomesList = !string.IsNullOrEmpty(snapshot.BusinessOutcomesJson)
            ? JsonSerializer.Deserialize<List<string>>(snapshot.BusinessOutcomesJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new()
            : new();

        var respList = !string.IsNullOrEmpty(snapshot.ResponsibilitiesJson)
            ? JsonSerializer.Deserialize<List<ResponsibilityDto>>(snapshot.ResponsibilitiesJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new()
            : new();

        var capList = !string.IsNullOrEmpty(snapshot.CapabilitiesJson)
            ? JsonSerializer.Deserialize<List<RequirementCapabilityDto>>(snapshot.CapabilitiesJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new()
            : new();

        var techList = !string.IsNullOrEmpty(snapshot.TechnologyRequirementsJson)
            ? JsonSerializer.Deserialize<List<TechnologyRequirementDto>>(snapshot.TechnologyRequirementsJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new()
            : new();

        // 1. Add Outcomes
        for (int i = 0; i < outcomesList.Count; i++)
        {
            var outcomeText = outcomesList[i];
            var outcomeNodeId = $"outcome:snapshot_{i}";
            graph.AddNode(outcomeNodeId, LogicalNodeType.Outcome, outcomeText);
        }

        // 2. Add Responsibilities
        for (int i = 0; i < respList.Count; i++)
        {
            var resp = respList[i];
            var respNodeId = $"responsibility:snapshot_{i}";
            var attributes = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                { "Priority", resp.Priority.ToString() },
                { "OwnershipLevel", resp.OwnershipLevel.ToString() },
                { "IsLeadership", resp.IsLeadership.ToString() }
            };
            graph.AddNode(respNodeId, LogicalNodeType.Responsibility, resp.Text, attributes);
        }

        // 3. Add Capabilities
        var capNodesMap = new Dictionary<string, (string CanonicalId, RequirementCapabilityDto Dto)>(StringComparer.OrdinalIgnoreCase);
        foreach (var cap in capList)
        {
            var canonicalId = await _capabilityProjectionBuilder.ResolveCanonicalIdAsync(cap.CapabilityId, cancellationToken);
            if (string.IsNullOrEmpty(canonicalId))
            {
                canonicalId = await _capabilityProjectionBuilder.ResolveCanonicalIdAsync(cap.Name, cancellationToken);
            }
            if (string.IsNullOrEmpty(canonicalId))
            {
                canonicalId = cap.CapabilityId;
            }

            var capNodeId = $"capability:{canonicalId}";
            var attributes = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                { "ExpectedProficiency", cap.ExpectedProficiency.ToString() },
                { "Priority", cap.Priority.ToString() },
                { "OwnershipLevel", cap.OwnershipLevel.ToString() },
                { "Category", cap.Category }
            };

            graph.AddNode(capNodeId, LogicalNodeType.Capability, cap.Name, attributes);
            capNodesMap[capNodeId] = (canonicalId, cap);
        }

        // 4. Add Technologies
        var techNodesMap = new Dictionary<string, TechnologyRequirementDto>(StringComparer.OrdinalIgnoreCase);
        foreach (var tech in techList)
        {
            var techNodeId = $"technology:{tech.Name.ToLowerInvariant()}";
            var attributes = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                { "Priority", tech.Priority.ToString() },
                { "SfiaLevel", tech.SfiaLevel.ToString() }
            };

            graph.AddNode(techNodeId, LogicalNodeType.Technology, tech.Name, attributes);
            techNodesMap[techNodeId] = tech;
        }

        // 5. Connect Outcomes to Capabilities
        for (int i = 0; i < outcomesList.Count; i++)
        {
            var outcomeText = outcomesList[i];
            var outcomeNodeId = $"outcome:snapshot_{i}";
            var matchedCaps = new List<string>();

            foreach (var kvp in capNodesMap)
            {
                var capNodeId = kvp.Key;
                var capName = kvp.Value.Dto.Name;
                var capId = kvp.Value.CanonicalId;

                if (outcomeText.Contains(capName, StringComparison.OrdinalIgnoreCase) ||
                    outcomeText.Contains(capId, StringComparison.OrdinalIgnoreCase))
                {
                    matchedCaps.Add(capNodeId);
                }
            }

            var targets = matchedCaps.Any() ? matchedCaps : capNodesMap.Keys.ToList();
            foreach (var target in targets)
            {
                graph.AddEdge(outcomeNodeId, target, LogicalRelationType.REQUIRES, 1.0);
            }
        }

        // 6. Connect Responsibilities to Capabilities
        for (int i = 0; i < respList.Count; i++)
        {
            var resp = respList[i];
            var respNodeId = $"responsibility:snapshot_{i}";
            var matchedCaps = new List<string>();

            foreach (var kvp in capNodesMap)
            {
                var capNodeId = kvp.Key;
                var capName = kvp.Value.Dto.Name;
                var capId = kvp.Value.CanonicalId;

                if (resp.Text.Contains(capName, StringComparison.OrdinalIgnoreCase) ||
                    resp.Text.Contains(capId, StringComparison.OrdinalIgnoreCase))
                {
                    matchedCaps.Add(capNodeId);
                }
            }

            var targets = matchedCaps.Any() ? matchedCaps : capNodesMap.Keys.ToList();
            foreach (var target in targets)
            {
                var weight = GetWeightForPriority(resp.Priority) * GetWeightForOwnership(resp.OwnershipLevel);
                graph.AddEdge(respNodeId, target, LogicalRelationType.REQUIRES, weight);
            }
        }

        // 7. Connect Capabilities to Technologies
        foreach (var capKvp in capNodesMap)
        {
            var capNodeId = capKvp.Key;
            var capName = capKvp.Value.Dto.Name;
            var capCategory = capKvp.Value.Dto.Category;

            var registry = await _capabilityProjectionBuilder.GetCapabilityRegistryAsync(capKvp.Value.CanonicalId, cancellationToken);
            var regDescription = registry?.Description ?? "";
            var regDisplayName = registry?.DisplayName ?? "";

            var matchedTechs = new List<string>();

            foreach (var techKvp in techNodesMap)
            {
                var techNodeId = techKvp.Key;
                var techName = techKvp.Value.Name;

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
                var tech = techNodesMap[target];
                var weight = GetWeightForPriority(tech.Priority);
                graph.AddEdge(capNodeId, target, LogicalRelationType.USES, weight);
            }
        }

        // 8. Connect Capabilities to Domains
        foreach (var kvp in capNodesMap)
        {
            var capNodeId = kvp.Key;
            var category = kvp.Value.Dto.Category;
            var domainNodeId = $"domain:{category.Replace(" ", "-").ToLowerInvariant()}";

            graph.AddNode(domainNodeId, LogicalNodeType.Domain, category);
            graph.AddEdge(capNodeId, domainNodeId, LogicalRelationType.ALIGNS_TO, 1.0);
        }

        return graph;
    }

    private double GetWeightForPriority(RequirementPriority priority)
    {
        return priority switch
        {
            RequirementPriority.MustHave => 1.0,
            RequirementPriority.ShouldHave => 0.7,
            RequirementPriority.NiceToHave => 0.3,
            _ => 0.7
        };
    }

    private double GetWeightForOwnership(OwnershipLevel level)
    {
        return level switch
        {
            OwnershipLevel.Awareness => 0.25,
            OwnershipLevel.Contributor => 0.5,
            OwnershipLevel.Owner => 0.75,
            OwnershipLevel.Leader => 1.0,
            _ => 0.75
        };
    }
}
