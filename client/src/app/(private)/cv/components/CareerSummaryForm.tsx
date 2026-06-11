import React from "react";
import { TextArea, Button, Spinner } from "@heroui/react";
import { type CareerSummaryDraft } from "./types";

interface CareerSummaryFormProps {
  draft: CareerSummaryDraft;
  onChange: (updated: Partial<CareerSummaryDraft>) => void;
  onSave: () => Promise<void>;
  onReset: () => void;
  isSaving: boolean;
  isDirty: boolean;
}

export const CareerSummaryForm: React.FC<CareerSummaryFormProps> = ({
  draft,
  onChange,
  onSave,
  onReset,
  isSaving,
  isDirty,
}) => {
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (draft.bio.length > 500) {
      return;
    }
    await onSave();
  };

  return (
    <form onSubmit={handleSave} className="flex flex-col h-full overflow-hidden relative text-left">
      <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-4 pb-20">
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-foreground">
            Bio Summary
          </label>
          <TextArea
            aria-label="Bio Summary"
            value={draft.bio}
            onChange={(e) => onChange({ bio: e.target.value.slice(0, 500) })}
            placeholder="Brief description of yourself and career direction (Uses Bio)"
            rows={6}
            maxLength={500}
          />
          <div className="text-[10px] text-muted-foreground flex justify-end select-none">
            {draft.bio.length}/500 characters
          </div>
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
          type="submit"
          size="sm"
          className={`rounded-xl font-bold select-none border-none h-9 ${
            isDirty ? "bg-accent text-accent-foreground" : "bg-surface-secondary text-muted cursor-not-allowed"
          }`}
          isDisabled={!isDirty || isSaving}
        >
          {isSaving ? <Spinner size="sm" color="current" /> : "Save changes"}
        </Button>
      </div>
    </form>
  );
};
