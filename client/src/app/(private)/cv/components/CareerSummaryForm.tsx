import React from "react";
import { TextArea, Button, Spinner } from "@heroui/react";
import { type CareerSummaryDraft } from "./types";
import { BaseUnsavedChangesBar } from "@/components/ui/unsaved-changes-bar";

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
    if (draft.bio.length > 160) {
      return;
    }
    await onSave();
  };

  return (
    <form onSubmit={handleSave} className="flex flex-col h-full overflow-hidden relative text-left">
      <div className="flex-1 overflow-y-auto px-1.5 flex flex-col gap-4 pb-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-foreground">
            Bio Summary
          </label>
          <TextArea
            aria-label="Bio Summary"
            value={draft.bio}
            onChange={(e) => onChange({ bio: e.target.value.slice(0, 160) })}
            placeholder="Brief description of yourself and career direction (Uses Bio)"
            rows={6}
            maxLength={160}
          />
          <div className="text-[10px] text-muted-foreground flex justify-end select-none">
            {draft.bio.length}/160 characters
          </div>
        </div>
      </div>

      <BaseUnsavedChangesBar
        message="You have unsaved career summary changes."
        onReset={onReset}
        isDirty={isDirty}
        isSubmitting={isSaving}
      />
    </form>
  );
};
