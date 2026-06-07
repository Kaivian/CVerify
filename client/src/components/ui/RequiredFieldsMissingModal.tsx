"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Sparkles,
  ArrowRight,
  GitFork,
  CheckCircle2,
  FileText,
  User,
  GraduationCap,
  Briefcase,
  Award
} from "lucide-react";
import { Chip } from "@heroui/react";
import { Button } from "@/components/ui/button";
import { DialogModal } from "./dialog-modal";
import { type MissingFieldDto } from "@/types/profile.types";

interface RequiredFieldsMissingModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  missingFields: MissingFieldDto[];
  onProceedAnyway?: () => Promise<void>;
  isProceeding?: boolean;
}

export const RequiredFieldsMissingModal: React.FC<RequiredFieldsMissingModalProps> = ({
  isOpen,
  onOpenChange,
  missingFields,
  onProceedAnyway,
  isProceeding = false,
}) => {
  const router = useRouter();

  const requiredFields = missingFields.filter((f) => f.isRequired);
  const optionalFields = missingFields.filter((f) => !f.isRequired);

  const hasRequiredMissing = requiredFields.length > 0;

  const getIconForField = (key: string) => {
    switch (key.toLowerCase()) {
      case "repositories":
        return <GitFork className="size-4.5 text-accent" />;
      case "headline":
      case "bio":
        return <User className="size-4.5 text-blue-500" />;
      case "skills":
        return <Sparkles className="size-4.5 text-amber-500" />;
      case "education":
        return <GraduationCap className="size-4.5 text-purple-500" />;
      case "experiences":
        return <Briefcase className="size-4.5 text-emerald-500" />;
      default:
        return <FileText className="size-4.5 text-muted" />;
    }
  };

  const handleNavigateToEdit = (key: string) => {
    onOpenChange(false);
    if (key.toLowerCase() === "repositories") {
      router.push("/settings/source-code-providers");
    } else if (["headline", "bio"].includes(key.toLowerCase())) {
      router.push("/cv?tab=basic-info");
    } else if (key.toLowerCase() === "skills") {
      router.push("/cv?tab=skills");
    } else if (key.toLowerCase() === "education") {
      router.push("/cv?tab=education");
    } else if (key.toLowerCase() === "experiences") {
      router.push("/cv?tab=experience");
    } else {
      router.push("/cv");
    }
  };

  const footer = (
    <div className="flex w-full items-center justify-between gap-3 font-sans">
      <Button
        size="sm"
        variant="ghost"
        className="rounded-xl border border-border/30 px-4 h-9 cursor-pointer"
        onPress={() => onOpenChange(false)}
      >
        Close
      </Button>
      <div className="flex gap-2">
        {!hasRequiredMissing && onProceedAnyway && (
          <Button
            size="sm"
            variant="ghost"
            isLoading={isProceeding}
            className="rounded-xl border-accent text-accent hover:bg-accent/10 px-4 h-9 font-bold cursor-pointer"
            onPress={async () => {
              await onProceedAnyway();
              onOpenChange(false);
            }}
          >
            Run Assessment Anyway
          </Button>
        )}
        <Button
          size="sm"
          className="rounded-xl bg-accent text-accent-foreground font-bold px-4 h-9 cursor-pointer"
          onPress={() => {
            onOpenChange(false);
            if (hasRequiredMissing) {
              router.push("/settings/source-code-providers");
            } else {
              router.push("/cv");
            }
          }}
        >
          <span>{hasRequiredMissing ? "Connect Repository" : "Optimize Profile"}</span>
          <ArrowRight size={14} className="ml-0.5 shrink-0" />
        </Button>
      </div>
    </div>
  );

  return (
    <DialogModal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title="AI Vetting Prerequisites"
      size="lg"
      footer={footer}
    >
      <div className="flex flex-col gap-5 text-left font-sans select-none">
        <p className="text-xs text-muted-foreground leading-relaxed">
          CVerify AI runs a high-precision calibration engine using code metrics and profile orientation. Below are details regarding required and recommended sections to achieve high-quality analysis.
        </p>

        {/* Required Missing Fields (Blockers) */}
        {requiredFields.length > 0 && (
          <div className="flex flex-col gap-3">
            <span className="text-[10px] font-black uppercase text-danger tracking-wider block">
              Required Prerequisites (Missing):
            </span>
            <div className="flex flex-col gap-3">
              {requiredFields.map((field) => (
                <div
                  key={field.fieldKey}
                  className="flex gap-3.5 p-4 rounded-xl border border-danger/25 bg-danger/5 items-start cursor-pointer hover:bg-danger/10 transition-colors"
                  onClick={() => handleNavigateToEdit(field.fieldKey)}
                >
                  <div className="p-2.5 rounded-lg bg-surface text-danger shrink-0 shadow-2xs border border-danger/10">
                    <AlertCircle className="size-4.5" />
                  </div>
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground">
                        {field.displayLabel}
                      </span>
                      <Chip
                        size="sm"
                        color="danger"
                        variant="soft"
                        className="text-[8px] font-extrabold uppercase px-1.5 h-4.5 bg-danger/10 text-danger border-none"
                      >
                        Blocker
                      </Chip>
                    </div>
                    <span className="text-[10px] text-muted-foreground leading-relaxed">
                      {field.recommendationMessage}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Optional Missing Fields (Recommendations) */}
        {optionalFields.length > 0 && (
          <div className="flex flex-col gap-3">
            <span className="text-[10px] font-black uppercase text-primary tracking-wider block">
              Recommended for Best Accuracy:
            </span>
            <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-1">
              {optionalFields.map((field) => (
                <div
                  key={field.fieldKey}
                  className="flex gap-3.5 p-4 rounded-xl border border-border hover:border-accent/35 bg-surface-secondary/20 items-start cursor-pointer transition-colors"
                  onClick={() => handleNavigateToEdit(field.fieldKey)}
                >
                  <div className="p-2.5 rounded-lg bg-surface text-accent shrink-0 shadow-2xs border border-border/30">
                    {getIconForField(field.fieldKey)}
                  </div>
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground">
                        {field.displayLabel}
                      </span>
                      <Chip
                        size="sm"
                        color="default"
                        variant="soft"
                        className="text-[8px] font-extrabold uppercase px-1.5 h-4.5 bg-surface-secondary text-muted-foreground border-none"
                      >
                        Recommended
                      </Chip>
                    </div>
                    <span className="text-[10px] text-muted-foreground leading-relaxed">
                      {field.recommendationMessage}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!hasRequiredMissing && (
          <div className="p-3.5 rounded-xl border border-success/20 bg-success/5 flex gap-2.5 items-start">
            <CheckCircle2 className="size-4 text-success shrink-0 mt-0.5" />
            <span className="text-[10px] text-success font-medium leading-relaxed">
              Minimum requirements met. You can run the assessment now, but adding recommended fields provides better calibration and reduces missing info gaps in the generated assessment report.
            </span>
          </div>
        )}
      </div>
    </DialogModal>
  );
};
