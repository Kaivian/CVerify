import React from "react";
import {
  Star,
  GitFork,
  GitCommit,
  GitPullRequest,
  GitBranch,
  Crown,
  Users,
  Activity,
} from "lucide-react";
import type { RepositoryAnalysis } from "@/types/repository-analysis.types";

interface MetricCardsProps {
  analysis: RepositoryAnalysis;
}

export const MetricCards: React.FC<MetricCardsProps> = ({ analysis }) => {
  const repo = analysis.repo;
  const gitMetrics = analysis.facts?.git_metrics || {
    total_commits: 0,
    user_commit_ratio: 1.0,
    is_primary_author: true,
    bus_factor: 1,
    active_contributors: 1
  };

  const metrics = [
    {
      label: "Stars",
      value: repo.stars,
      icon: <Star className="size-4 text-yellow-500 fill-yellow-500/10" />,
    },
    {
      label: "Forks",
      value: repo.forks,
      icon: <GitFork className="size-4 text-muted-foreground" />,
    },
    {
      label: "Open Pull Requests",
      value: repo.open_prs,
      icon: <GitPullRequest className="size-4 text-success" />,
    },
    {
      label: "Branches",
      value: repo.branches,
      icon: <GitBranch className="size-4 text-primary" />,
    },
    {
      label: "Total Commits",
      value: gitMetrics.total_commits,
      icon: <GitCommit className="size-4 text-accent" />,
    },
    {
      label: "Contribution Ratio",
      value: `${(gitMetrics.user_commit_ratio * 100).toFixed(0)}%`,
      icon: <Crown className="size-4 text-yellow-500" />,
    },
    {
      label: "Bus Factor",
      value: gitMetrics.bus_factor,
      icon: <Users className="size-4 text-primary" />,
    },
    {
      label: "Active Authors",
      value: gitMetrics.active_contributors,
      icon: <Activity className="size-4 text-muted-foreground" />,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 select-none font-sans">
      {metrics.map((m, idx) => (
        <div
          key={idx}
          className="flex flex-col justify-between p-4 border border-border/80 bg-surface rounded-2xl h-24 hover:border-accent/30 transition-all text-left"
        >
          <div className="flex items-center justify-between gap-2 text-muted">
            <span className="text-[10px] uppercase font-bold tracking-wider truncate">
              {m.label}
            </span>
            <div className="shrink-0">{m.icon}</div>
          </div>
          <strong className="text-xl text-foreground font-black font-mono mt-1">
            {m.value}
          </strong>
        </div>
      ))}
    </div>
  );
};

export default MetricCards;
