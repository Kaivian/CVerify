using System;
using System.Collections.Generic;

namespace CVerify.API.Modules.Shared.System.Pipelines;

public record PipelineMetadata(
    string Id,
    string DisplayName,
    string RouteSlug,
    string[] QueueTypes,
    string Description
);

public static class PipelineRegistry
{
    public static readonly List<PipelineMetadata> Pipelines = new()
    {
        new PipelineMetadata(
            "repository-analysis",
            "Repository AI",
            "repository",
            new[] { "git", "static", "ai" },
            "Deep codebase indexing, commit authorship audits, and Trust Score calculations."
        ),
        new PipelineMetadata(
            "cv-analysis",
            "CV Intelligence",
            "cv",
            new[] { "ai" },
            "Resume parsing, skill trees extraction, and candidate capability mapping."
        ),
        new PipelineMetadata(
            "jd-generation",
            "Job Intelligence",
            "job",
            new[] { "ai" },
            "AI-powered requirements elicitation, seniority estimation, and skill mapping."
        ),
        new PipelineMetadata(
            "candidate-match",
            "Matching Intelligence",
            "matching",
            new[] { "aggregation", "ai" },
            "Semantic matching, candidacy ranking, and profile-to-job matching evaluations."
        )
    };
}
