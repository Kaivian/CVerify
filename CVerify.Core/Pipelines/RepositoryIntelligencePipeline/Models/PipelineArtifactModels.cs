using System;
using System.Collections.Generic;

namespace CVerify.API.Pipelines.RepositoryIntelligence.Models;

public class TechStackModel
{
    public string PrimaryLanguage { get; set; } = null!;
    public List<string> Frameworks { get; set; } = new();
    public List<string> PackageFiles { get; set; } = new();
    public Dictionary<string, double> Languages { get; set; } = new();
}

public class ArchitecturePatternsModel
{
    public List<ArchitecturePatternItem> Patterns { get; set; } = new();
    public string Explanation { get; set; } = null!;
}

public class ArchitecturePatternItem
{
    public string PatternName { get; set; } = null!;
    public double Confidence { get; set; }
}

public class OwnershipScoreModel
{
    public double UserCommitRatio { get; set; }
    public int TotalCommits { get; set; }
    public bool IsPrimaryAuthor { get; set; }
    public double ArchitecturalOwnershipPct { get; set; }
    public double CriticalPathOwnershipPct { get; set; }
    public int MaintenanceDurationMonths { get; set; }
    public string Explanation { get; set; } = null!;
    public List<ContributorRatio> ContributorDistribution { get; set; } = new();
    public int BusFactor { get; set; }
    public int ActiveContributors { get; set; }
}

public class ContributorRatio
{
    public string Username { get; set; } = null!;
    public double CommitRatio { get; set; }
}

public class TrustSignalsModel
{
    public string Classification { get; set; } = null!;
    public double Confidence { get; set; }
    public List<string> RuleFlags { get; set; } = new();
    public List<string> AiFindings { get; set; } = new();
    public string Explanation { get; set; } = null!;
}

public class SkillEvidenceGraphModel
{
    public List<GraphNode> Nodes { get; set; } = new();
    public List<GraphEdge> Edges { get; set; } = new();
}

public class GraphNode
{
    public string Id { get; set; } = null!;
    public string Type { get; set; } = null!;
    public Dictionary<string, object> Data { get; set; } = new();
}

public class GraphEdge
{
    public string Id { get; set; } = null!;
    public string Source { get; set; } = null!;
    public string Target { get; set; } = null!;
    public string Label { get; set; } = null!;
    public double? Weight { get; set; }
}
