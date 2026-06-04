import React from "react";
import {
  Star,
  GitFork,
  Eye,
  Users,
  GitCommit,
  GitPullRequest,
  AlertCircle,
  GitBranch,
} from "lucide-react";
import { RepositoryAnalysis } from "@/types/repository-analysis.types";

interface MetricCardsProps {
  analysis: RepositoryAnalysis;
}

export const MetricCards: React.FC<MetricCardsProps> = ({ analysis }) => {
  const { repo, contribution_stats } = analysis;

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
      value: contribution_stats.total_commits,
      icon: <GitCommit className="size-4 text-accent" />,
    },
    {
      label: "Contributors",
      value: contribution_stats.contributors_count,
      icon: <Users className="size-4 text-accent" />,
    },
    {
      label: "Author PRs",
      value: contribution_stats.prs_authored,
      icon: <GitPullRequest className="size-4 text-accent" />,
    },
    {
      label: "Issues Count",
      value: contribution_stats.issues_count,
      icon: <AlertCircle className="size-4 text-muted-foreground" />,
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
