import React, { useState } from "react";
import { Input, Button, TextArea, Spinner } from "@heroui/react";
import { Card } from "@/components/ui/card";
import { PlusCircle, Trash2, Edit2, X } from "lucide-react";
import { type AchievementsDraftItem } from "./types";
import { BaseUnsavedChangesBar } from "@/components/ui/unsaved-changes-bar";

interface AchievementsFormProps {
  draft: AchievementsDraftItem[];
  onChange: (updated: AchievementsDraftItem[]) => void;
  onSave: () => Promise<void>;
  onReset: () => void;
  isSaving: boolean;
  isDirty: boolean;
}

export const AchievementsForm: React.FC<AchievementsFormProps> = ({
  draft,
  onChange,
  onSave,
  onReset,
  isSaving,
  isDirty,
}) => {
  const [editingItem, setEditingItem] = useState<AchievementsDraftItem | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleEdit = (item: AchievementsDraftItem) => {
    setEditingItem({ ...item });
    setErrors({});
  };

  const handleAddNew = () => {
    const newItem: AchievementsDraftItem = {
      id: `temp-${Date.now()}`,
      title: "",
      issuer: "",
      issueDate: "",
      description: "",
      credentialUrl: "",
      attachmentId: null,
    };
    setEditingItem(newItem);
    setErrors({});
  };

  const handleRemove = (id: string) => {
    const filtered = draft.filter((item) => item.id !== id);
    onChange(filtered);
    if (editingItem?.id === id) {
      setEditingItem(null);
    }
  };

  const validateItem = (item: AchievementsDraftItem): boolean => {
    const newErrors: Record<string, string> = {};
    if (!item.title.trim()) newErrors.title = "Required";
    if (!item.issuer.trim()) newErrors.issuer = "Required";
    if (!item.issueDate) newErrors.issueDate = "Required";

    if (item.credentialUrl && item.credentialUrl.trim()) {
      try {
        if (!item.credentialUrl.startsWith("http://") && !item.credentialUrl.startsWith("https://")) {
          new URL("https://" + item.credentialUrl);
        } else {
          new URL(item.credentialUrl);
        }
      } catch (e) {
        newErrors.credentialUrl = "Invalid URL format.";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveItem = () => {
    if (!editingItem) return;
    if (!validateItem(editingItem)) return;

    const exists = draft.some((item) => item.id === editingItem.id);
    let updatedList;
    if (exists) {
      updatedList = draft.map((item) => (item.id === editingItem.id ? editingItem : item));
    } else {
      updatedList = [...draft, editingItem];
    }
    onChange(updatedList);
    setEditingItem(null);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden relative text-left">
      <div className="flex-1 overflow-y-auto px-1.5 flex flex-col gap-4 pb-4">
        {editingItem ? (
        // Inline Edit Mode
        <div className="flex flex-col gap-5 border border-border/40 p-5 rounded-xl bg-surface-secondary/5">
          <div className="flex justify-between items-center border-b border-border/20 pb-3 select-none">
            <span className="font-bold text-xs text-foreground">
              {editingItem.id.startsWith("temp-") ? "Add Achievement" : "Edit Achievement"}
            </span>
            <Button
              isIconOnly
              size="sm"
              variant="secondary"
              className="rounded-xl border border-border/30 h-8 w-8"
              onPress={() => setEditingItem(null)}
              aria-label="Close edit mode"
            >
              <X className="size-4" />
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label className="font-bold text-foreground">Certificate / Achievement Name *</label>
              <Input
                value={editingItem.title}
                onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                placeholder="AWS Certified Solutions Architect"
                aria-label="Certificate or Achievement name"
                maxLength={150}
              />
              <div className="flex justify-between items-center text-[10px] text-muted-foreground mt-0.5 select-none">
                {errors.title ? (
                  <span className="text-danger">{errors.title}</span>
                ) : (
                  <span />
                )}
                <span>{(editingItem.title || "").length}/150 characters</span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-foreground">Issuer *</label>
              <Input
                value={editingItem.issuer}
                onChange={(e) => setEditingItem({ ...editingItem, issuer: e.target.value })}
                placeholder="Amazon Web Services (AWS)"
                aria-label="Issuer"
                maxLength={100}
              />
              <div className="flex justify-between items-center text-[10px] text-muted-foreground mt-0.5 select-none">
                {errors.issuer ? (
                  <span className="text-danger">{errors.issuer}</span>
                ) : (
                  <span />
                )}
                <span>{(editingItem.issuer || "").length}/100 characters</span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-foreground">Issue Date *</label>
              <input
                type="date"
                className="flex h-10 w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs outline-none focus:border-accent"
                value={editingItem.issueDate ? editingItem.issueDate.split("T")[0] : ""}
                onChange={(e) => setEditingItem({ ...editingItem, issueDate: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label className="font-bold text-foreground">Credential URL</label>
              <Input
                value={editingItem.credentialUrl}
                onChange={(e) => setEditingItem({ ...editingItem, credentialUrl: e.target.value })}
                placeholder="https://aws.amazon.com/verify/..."
                aria-label="Credential URL"
                maxLength={250}
              />
              <div className="flex justify-between items-center text-[10px] text-muted-foreground mt-0.5 select-none">
                {errors.credentialUrl ? (
                  <span className="text-danger">{errors.credentialUrl}</span>
                ) : (
                  <span />
                )}
                <span>{(editingItem.credentialUrl || "").length}/250 characters</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 text-xs">
            <label className="font-bold text-foreground">Description</label>
            <TextArea
              value={editingItem.description}
              onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
              placeholder="Provide a brief description of the achievement..."
              rows={3}
              aria-label="Achievement description"
              maxLength={500}
            />
            <div className="flex justify-end text-[10px] text-muted-foreground mt-0.5 select-none">
              <span>{(editingItem.description || "").length}/500 characters</span>
            </div>
          </div>

          <Button size="sm" className="bg-accent text-accent-foreground font-bold rounded-xl border-none mt-2 h-9" onPress={handleSaveItem}>
            Confirm
          </Button>
        </div>
      ) : (
        // List Mode
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center select-none">
            <span className="text-xs font-bold text-foreground">Add Achievement</span>
            <Button
              size="sm"
              variant="secondary"
              className="rounded-xl text-[10px] font-bold flex items-center gap-1 border border-border/30 h-8"
              onPress={handleAddNew}
            >
              <PlusCircle className="size-3.5" />
              Add Achievement
            </Button>
          </div>

          <div className="flex flex-col gap-3">
            {draft.length === 0 ? (
              <div className="py-10 text-center border-2 border-dashed border-border/40 rounded-xl select-none">
                <span className="text-muted-foreground text-xs">No achievements added yet.</span>
              </div>
            ) : (
              draft.map((item) => (
                <Card key={item.id} rounded="xl" glow={false} className="p-4 border border-border/40 bg-surface text-left">
                  <div className="flex flex-row justify-between items-center gap-4 w-full">
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="font-bold text-foreground text-xs truncate">
                        {item.title}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {item.issuer} ({item.issueDate})
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        isIconOnly
                        size="sm"
                        variant="secondary"
                        className="rounded-xl border border-border/30 h-8 w-8"
                        onPress={() => handleEdit(item)}
                        aria-label={`Edit achievement ${item.title}`}
                      >
                        <Edit2 className="size-3.5" />
                      </Button>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="secondary"
                        className="rounded-xl border border-border/30 h-8 w-8 text-danger"
                        onPress={() => handleRemove(item.id)}
                        aria-label={`Remove achievement ${item.title}`}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>

        </div>
      )}
      </div>

      {!editingItem && (
        <BaseUnsavedChangesBar
          message="You have unsaved achievements changes."
          onReset={onReset}
          onSave={onSave}
          isDirty={isDirty}
          isSubmitting={isSaving}
          resetLabel="Reset Changes"
          saveLabel="Save Changes"
        />
      )}
    </div>
  );
};
export default AchievementsForm;
