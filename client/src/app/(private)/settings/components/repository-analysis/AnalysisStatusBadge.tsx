import React from "react";
import { Chip } from "@heroui/react";
import { CheckCircle2, AlertCircle, Loader2, BarChart2 } from "lucide-react";
import { AnalysisStatus } from "@/types/repository-analysis.types";

interface AnalysisStatusBadgeProps {
  status: AnalysisStatus;
  className?: string;
}

export const AnalysisStatusBadge: React.FC<AnalysisStatusBadgeProps> = ({
  status,
  className = "",
}) => {
  switch (status) {
    case "analyzing":
      return (
        <Chip
          variant="soft"
          color="warning"
          className={`h-6 px-1.5 ${className}`}
        >
          <span className="flex items-center gap-1">
            <Loader2 className="size-3 animate-spin text-warning shrink-0" />
            <span className="text-[9px] uppercase font-bold tracking-wider">Analyzing</span>
          </span>
        </Chip>
      );
    case "success":
      return (
        <Chip
          variant="soft"
          color="success"
          className={`h-6 px-1.5 ${className}`}
        >
          <span className="flex items-center gap-1">
            <CheckCircle2 className="size-3 text-success shrink-0" />
            <span className="text-[9px] uppercase font-bold tracking-wider">Analyzed</span>
          </span>
        </Chip>
      );
    case "error":
      return (
        <Chip
          variant="soft"
          color="danger"
          className={`h-6 px-1.5 ${className}`}
        >
          <span className="flex items-center gap-1">
            <AlertCircle className="size-3 text-danger shrink-0" />
            <span className="text-[9px] uppercase font-bold tracking-wider">Failed</span>
          </span>
        </Chip>
      );
    default:
      return (
        <Chip
          variant="soft"
          color="default"
          className={`h-6 px-1.5 bg-foreground/5 text-muted-foreground ${className}`}
        >
          <span className="flex items-center gap-1">
            <BarChart2 className="size-3 text-muted-foreground shrink-0" />
            <span className="text-[9px] uppercase font-bold tracking-wider">Unanalyzed</span>
          </span>
        </Chip>
      );
  }
};
