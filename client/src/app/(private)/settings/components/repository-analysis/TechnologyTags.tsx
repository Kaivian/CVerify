import React from "react";
import { Chip, Typography } from "@heroui/react";
import { RepositoryAnalysis } from "@/types/repository-analysis.types";

interface TechnologyTagsProps {
  analysis: RepositoryAnalysis;
}

export const TechnologyTags: React.FC<TechnologyTagsProps> = ({ analysis }) => {
  const { repo, skill_tree } = analysis;

  return (
    <div className="space-y-4.5 text-left font-sans select-none">
      {/* Codebase Languages */}
      <div className="space-y-2">
        <Typography type="body-xs" className="text-muted font-bold uppercase tracking-wider text-[9px]">
          Codebase Languages
        </Typography>
        <div className="flex flex-wrap gap-2">
          {Object.entries(repo.languages).map(([lang, pct]) => (
            <Chip
              key={lang}
              variant="soft"
              color="accent"
              className="h-6.5 text-xs font-semibold px-1"
            >
              <span className="font-bold">{lang}</span>
              <span className="opacity-70 ml-1 font-mono text-[10px]">{pct}%</span>
            </Chip>
          ))}
        </div>
      </div>

      {/* Categorized Stacks from Skill Tree */}
      {Object.entries(skill_tree).map(([category, skills]) => (
        <div key={category} className="space-y-2">
          <Typography type="body-xs" className="text-muted font-bold uppercase tracking-wider text-[9px]">
            {category} Stacks & Frameworks
          </Typography>
          <div className="flex flex-wrap gap-2">
            {Object.keys(skills).map((skillName) => (
              <Chip
                key={skillName}
                variant="soft"
                color="default"
                className="h-6.5 text-xs font-medium px-2.5 bg-foreground/5 text-foreground/80 hover:bg-foreground/10 border border-border/40"
              >
                {skillName}
              </Chip>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
