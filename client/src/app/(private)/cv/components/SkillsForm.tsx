import React, { useState } from "react";
import { Input, Button, Chip, Spinner } from "@heroui/react";
import { PlusCircle, X } from "lucide-react";

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
      <div className="flex-1 overflow-y-auto px-1.5 flex flex-col gap-4 pb-20">
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-bold text-foreground">
            Target Skills
          </label>
          <div className="flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Press Enter to add skill"
              className="flex-1"
              aria-label="New skill input"
            />
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

        <div className="flex flex-wrap gap-2 py-4 bg-surface-secondary/10 border border-dashed border-border/40 rounded-2xl p-4 min-h-[100px] items-start">
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

      {/* Form Action Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border/20 bg-background/95 backdrop-blur-sm flex justify-end gap-3 shrink-0 rounded-b-xl z-20">
        <Button
          size="sm"
          variant="secondary"
          className="rounded-xl font-bold select-none border border-border/30 h-9"
          isDisabled={!isDirty || isSaving}
          onPress={onReset}
          type="button"
        >
          Reset
        </Button>
        <Button
          size="sm"
          onPress={onSave}
          className={`rounded-xl font-bold select-none border-none h-9 ${
            isDirty ? "bg-accent text-accent-foreground" : "bg-surface-secondary text-muted cursor-not-allowed"
          }`}
          isDisabled={!isDirty || isSaving}
        >
          {isSaving ? <Spinner size="sm" color="current" /> : "Save changes"}
        </Button>
      </div>
    </div>
  );
};
