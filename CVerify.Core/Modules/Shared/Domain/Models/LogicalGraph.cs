using System;
using System.Collections.Generic;

namespace CVerify.API.Modules.Shared.Domain.Models;

public enum LogicalNodeType
{
    Capability,
    Technology,
    Domain,
    Responsibility,
    Outcome,
    Project,
    Repository,
    CommitFileCitation
}

public enum LogicalRelationType
{
    REQUIRES,
    PROVES,
    IMPLEMENTS,
    USES,
    ALIGNS_TO,
    CONNECTS_TO,
    CONTAINS
}

public class LogicalGraphNode
{
    public string Id { get; set; } = null!;
    public LogicalNodeType NodeType { get; set; }
    public string DisplayName { get; set; } = null!;
    public Dictionary<string, string> Attributes { get; set; } = new(StringComparer.OrdinalIgnoreCase);
}

public class LogicalGraphEdge
{
    public string SourceId { get; set; } = null!;
    public string TargetId { get; set; } = null!;
    public LogicalRelationType RelationType { get; set; }
    public double Weight { get; set; } = 1.0;
    public Dictionary<string, string> Attributes { get; set; } = new(StringComparer.OrdinalIgnoreCase);
}

public class LogicalGraph
{
    public Dictionary<string, LogicalGraphNode> Nodes { get; } = new(StringComparer.OrdinalIgnoreCase);
    public Dictionary<string, List<LogicalGraphEdge>> AdjacencyList { get; } = new(StringComparer.OrdinalIgnoreCase);

    public void AddNode(string id, LogicalNodeType type, string displayName, Dictionary<string, string>? attributes = null)
    {
        if (!Nodes.ContainsKey(id))
        {
            Nodes[id] = new LogicalGraphNode
            {
                Id = id,
                NodeType = type,
                DisplayName = displayName,
                Attributes = attributes ?? new(StringComparer.OrdinalIgnoreCase)
            };
            AdjacencyList[id] = new List<LogicalGraphEdge>();
        }
    }

    public void AddEdge(string sourceId, string targetId, LogicalRelationType relation, double weight = 1.0, Dictionary<string, string>? attributes = null)
    {
        if (!Nodes.ContainsKey(sourceId) || !Nodes.ContainsKey(targetId))
        {
            throw new InvalidOperationException($"Both source '{sourceId}' and target '{targetId}' nodes must exist in the graph.");
        }

        var edge = new LogicalGraphEdge
        {
            SourceId = sourceId,
            TargetId = targetId,
            RelationType = relation,
            Weight = weight,
            Attributes = attributes ?? new(StringComparer.OrdinalIgnoreCase)
        };

        AdjacencyList[sourceId].Add(edge);
    }

    public IEnumerable<LogicalGraphEdge> GetNeighbors(string nodeId)
    {
        return AdjacencyList.TryGetValue(nodeId, out var edges) ? edges : Array.Empty<LogicalGraphEdge>();
    }
}
