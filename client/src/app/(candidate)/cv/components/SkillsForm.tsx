import React, { useState } from "react";
import { Input, Button, Chip, Spinner, Tooltip } from "@heroui/react";
import { PlusCircle, X, Info } from "lucide-react";
import { BaseUnsavedChangesBar } from "@/components/ui/unsaved-changes-bar";

interface SkillsFormProps {
  draft: { targetSkills: string[] };
  onChange: (updated: { targetSkills: string[] }) => void;
  onSave: () => Promise<void>;
  onReset: () => void;
  isSaving: boolean;
  isDirty: boolean;
}

export const SkillsForm: React.FC<SkillsFormProps> = ({
  draft,
  onChange,
  onSave,
  onReset,
  isSaving,
  isDirty,
}) => {
  const [inputValue, setInputValue] = useState("");

  const addSkill = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    if (draft.targetSkills.length >= 20) {
      return;
    }

    if (draft.targetSkills.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setInputValue("");
      return;
    }

    onChange({ targetSkills: [...draft.targetSkills, trimmed] });
    setInputValue("");
  };

  const removeSkill = (skillToRemove: string) => {
    const filtered = draft.targetSkills.filter((s) => s !== skillToRemove);
    onChange({ targetSkills: filtered });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addSkill();
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden relative text-left">
      <div className="flex-1 overflow-y-auto px-1.5 flex flex-col gap-4 pb-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5">
            <label className="text-[11px] font-bold text-foreground">
              Target Skills
            </label>
            <Tooltip delay={0}>
              <Tooltip.Trigger>
                <Info className="size-3 text-muted-foreground hover:text-foreground cursor-help" />
              </Tooltip.Trigger>
              <Tooltip.Content showArrow className="bg-surface border border-border rounded-xl p-2 text-xs max-w-xs text-foreground break-words">
                Add technologies, programming languages, frameworks, libraries, or tools you are proficient in (e.g. React.js, Java, Python, Git).
              </Tooltip.Content>
            </Tooltip>
          </div>
          <div className="flex gap-2 items-start">
            <div className="flex-1 flex flex-col gap-0.5">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Press Enter to add skill"
                className="flex-1"
                aria-label="New skill input"
                maxLength={30}
              />
              <div className="flex justify-end text-[10px] text-muted-foreground mt-0.5 select-none">
                <span>{(inputValue || "").length}/30 characters</span>
              </div>
            </div>
            <Button
              size="sm"
              variant="secondary"
              className="rounded-xl border border-border/30 h-10 w-10 min-w-10 flex items-center justify-center"
              onPress={addSkill}
              type="button"
              aria-label="Add skill"
            >
              <PlusCircle className="size-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 py-4 bg-surface-secondary/10 border border-dashed border-border/40 rounded-xl p-4 min-h-[100px] items-start">
          {draft.targetSkills.length === 0 ? (
            <span className="text-muted-foreground text-[10px] w-full text-center py-6 select-none">
              No information added yet
            </span>
          ) : (
            draft.targetSkills.map((skill) => (
              <Chip
                key={skill}
                size="sm"
                variant="soft"
                color="default"
                className="text-[10px] font-bold py-1 px-2 flex items-center gap-1.5"
              >
                <span className="flex items-center gap-1.5">
                  {skill}
                  <button
                    type="button"
                    onClick={() => removeSkill(skill)}
                    className="bg-transparent border-none text-muted-foreground hover:text-foreground cursor-pointer outline-none shrink-0"
                    aria-label={`Remove ${skill} skill`}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              </Chip>
            ))
          )}
        </div>

      </div>

      <BaseUnsavedChangesBar
        message="You have unsaved target skills changes."
        onReset={onReset}
        onSave={onSave}
        isDirty={isDirty}
        isSubmitting={isSaving}
      />
    </div>
  );
};
