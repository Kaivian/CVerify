import React from "react";
import { Chip } from "@heroui/react";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import type { AnalysisStatus } from "@/types/repository-analysis.types";

interface AnalysisStatusBadgeProps {
  status: AnalysisStatus;
  band?: string;
  className?: string;
}

export const AnalysisStatusBadge: React.FC<AnalysisStatusBadgeProps> = ({
  status,
  band,
  className = "",
}) => {
  switch (status) {
    case "analyzing":
      return (
        <Chip size="sm" color="warning" variant="soft" className={`items-center justify-center ${className}`}>
          <Loader2 className="size-3.5 text-warning shrink-0 animate-spin" />
          <span className="text-[10px] uppercase tracking-wider font-extrabold mr-px">
            Analyzing
          </span>
        </Chip>
      );
    case "success":
      return (
        <Chip size="sm" color="success" variant="soft" className={`items-center justify-center ${className}`}>
          <CheckCircle2 className="size-3.5 text-success shrink-0" />
          <span className="text-[10px] uppercase tracking-wider font-extrabold mr-px">
            {band ? `${band} Grade` : "Analyzed"}
          </span>
        </Chip>
      );
    case "error":
      return (
        <Chip size="sm" variant="soft" color="danger" className={`items-center justify-center ${className}`}>
          <AlertCircle className="size-3.5 text-danger shrink-0" />
          <span className="text-[10px] uppercase tracking-wider font-extrabold mr-px">
            Failed
          </span>
        </Chip>
      );
    default:
      return (
        <Chip size="sm" variant="soft" color="default" className={`items-center justify-center ${className}`}>
          <span className="text-[10px] uppercase tracking-wider font-extrabold mr-px">
            Unanalyzed
          </span>
        </Chip>
      );
  }
};
