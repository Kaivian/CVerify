import React, { useState } from "react";
import { Input, Button, TextArea, Checkbox, Spinner, Tooltip } from "@heroui/react";
import { Card } from "@/components/ui/card";
import { PlusCircle, Trash2, Edit2, X, Info } from "lucide-react";
import { type EducationDraftItem } from "./types";
import { BaseUnsavedChangesBar } from "@/components/ui/unsaved-changes-bar";

interface EducationFormProps {
  draft: EducationDraftItem[];
  onChange: (updated: EducationDraftItem[]) => void;
  onSave: () => Promise<void>;
  onReset: () => void;
  isSaving: boolean;
  isDirty: boolean;
}

export const EducationForm: React.FC<EducationFormProps> = ({
  draft,
  onChange,
  onSave,
  onReset,
  isSaving,
  isDirty,
}) => {
  const [editingItem, setEditingItem] = useState<EducationDraftItem | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleEdit = (item: EducationDraftItem) => {
    setEditingItem({ ...item });
    setErrors({});
  };

  const handleAddNew = () => {
    const newItem: EducationDraftItem = {
      id: `temp-${Date.now()}`,
      label: "",
      schoolName: "",
      degree: "",
      major: "",
      gpa: null,
      gpaScale: 4.0,
      description: "",
      startDate: "",
      endDate: null,
      isCurrentlyStudying: false,
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

  const validateItem = (item: EducationDraftItem): boolean => {
    const newErrors: Record<string, string> = {};
    if (!item.schoolName.trim()) newErrors.schoolName = "This field is required";
    if (!item.degree.trim()) newErrors.degree = "This field is required";
    if (!item.startDate) newErrors.startDate = "This field is required";

    if (item.startDate && item.endDate && !item.isCurrentlyStudying) {
      if (new Date(item.startDate) > new Date(item.endDate)) {
        newErrors.endDate = "Start date must not be after end date";
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
              {editingItem.id.startsWith("temp-") ? "Add Education" : "Edit Education"}
            </span>
            <Button
              isIconOnly
              size="sm"
              variant="secondary"
              className="rounded-xl border border-border/30 h-8 w-8"
              onPress={() => setEditingItem(null)}
              type="button"
              aria-label="Close edit mode"
            >
              <X className="size-4" />
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-foreground">School/University Name *</label>
              <Input
                value={editingItem.schoolName}
                onChange={(e) => setEditingItem({ ...editingItem, schoolName: e.target.value })}
                placeholder="FPT University"
                aria-label="School or University Name"
                maxLength={100}
              />
              <div className="flex justify-between items-center text-[10px] text-muted-foreground mt-0.5 select-none">
                {errors.schoolName ? (
                  <span className="text-danger">{errors.schoolName}</span>
                ) : (
                  <span />
                )}
                <span>{(editingItem.schoolName || "").length}/100 characters</span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-foreground">Degree *</label>
              <Input
                value={editingItem.degree}
                onChange={(e) => setEditingItem({ ...editingItem, degree: e.target.value, label: e.target.value })}
                placeholder="Bachelor of Software Engineering"
                aria-label="Degree title"
                maxLength={100}
              />
              <div className="flex justify-between items-center text-[10px] text-muted-foreground mt-0.5 select-none">
                {errors.degree ? (
                  <span className="text-danger">{errors.degree}</span>
                ) : (
                  <span />
                )}
                <span>{(editingItem.degree || "").length}/100 characters</span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-foreground">Major/Field of Study</label>
              <Input
                value={editingItem.major}
                onChange={(e) => setEditingItem({ ...editingItem, major: e.target.value })}
                placeholder="Software Engineering"
                aria-label="Major or Field of Study"
                maxLength={100}
              />
              <div className="flex justify-end text-[10px] text-muted-foreground mt-0.5 select-none">
                <span>{(editingItem.major || "").length}/100 characters</span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-foreground">Start Date *</label>
              <input
                type="date"
                className="flex h-10 w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs outline-none focus:border-accent"
                value={editingItem.startDate ? editingItem.startDate.split("T")[0] : ""}
                onChange={(e) => setEditingItem({ ...editingItem, startDate: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-foreground">End Date</label>
              <input
                type="date"
                className="flex h-10 w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs outline-none focus:border-accent disabled:bg-surface-secondary disabled:text-muted"
                value={editingItem.endDate ? editingItem.endDate.split("T")[0] : ""}
                disabled={editingItem.isCurrentlyStudying}
                onChange={(e) => setEditingItem({ ...editingItem, endDate: e.target.value })}
              />
            </div>

            <label className="flex items-center gap-2 py-4 select-none cursor-pointer">
              <Checkbox
                isSelected={editingItem.isCurrentlyStudying}
                onChange={(isSelected: boolean) =>
                  setEditingItem({
                    ...editingItem,
                    isCurrentlyStudying: isSelected,
                    endDate: isSelected ? null : editingItem.endDate,
                  })
                }
                aria-label="Currently studying here"
                className="cursor-pointer"
              >
                <Checkbox.Control className="w-4 h-4 rounded border border-field-border flex items-center justify-center bg-field group-data-[selected=true]:bg-accent group-data-[selected=true]:border-accent transition-all shrink-0 focus-visible:ring-2 focus-visible:ring-focus">
                  <Checkbox.Indicator className="text-accent-foreground flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 fill-none stroke-current stroke-3" viewBox="0 0 24 24">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </Checkbox.Indicator>
                </Checkbox.Control>
              </Checkbox>
              <span className="text-xs font-semibold text-foreground">
                Currently studying here
              </span>
            </label>

            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-foreground">GPA</label>
              <Input
                type="number"
                step="0.01"
                value={editingItem.gpa !== null ? String(editingItem.gpa) : ""}
                onChange={(e) =>
                  setEditingItem({
                    ...editingItem,
                    gpa: e.target.value ? parseFloat(e.target.value) : null,
                  })
                }
                placeholder="3.6"
                aria-label="GPA"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1">
                <label className="font-bold text-foreground">GPA Scale</label>
                <Tooltip delay={0}>
                  <Tooltip.Trigger>
                    <Info className="size-3.5 text-muted-foreground hover:text-foreground cursor-help" />
                  </Tooltip.Trigger>
                  <Tooltip.Content showArrow className="bg-surface border border-border rounded-xl p-2 text-xs max-w-xs text-foreground">
                    The maximum GPA scale for your institution, e.g. 4.0 or 10.0
                  </Tooltip.Content>
                </Tooltip>
              </div>
              <Input
                type="number"
                step="0.1"
                value={editingItem.gpaScale !== null ? String(editingItem.gpaScale) : "4.0"}
                onChange={(e) =>
                  setEditingItem({
                    ...editingItem,
                    gpaScale: e.target.value ? parseFloat(e.target.value) : 4.0,
                  })
                }
                placeholder="4.0"
                aria-label="GPA Scale"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5 text-xs">
            <label className="font-bold text-foreground">Description</label>
            <TextArea
              value={editingItem.description}
              onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
              placeholder="e.g. GPA 3.6, Học bổng toàn phần..."
              rows={3}
              aria-label="Education description"
              maxLength={1000}
            />
            <div className="flex justify-end text-[10px] text-muted-foreground mt-0.5 select-none">
              <span>{(editingItem.description || "").length}/1000 characters</span>
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
            <span className="text-xs font-bold text-foreground">Add Education</span>
            <Button
              size="sm"
              variant="secondary"
              className="rounded-xl text-[10px] font-bold flex items-center gap-1 border border-border/30 h-8"
              onPress={handleAddNew}
              type="button"
            >
              <PlusCircle className="size-3.5" />
              Add Education
            </Button>
          </div>

          <div className="flex flex-col gap-3">
            {draft.length === 0 ? (
              <div className="py-10 text-center border-2 border-dashed border-border/40 rounded-xl select-none">
                <span className="text-muted-foreground text-xs">No education entries added yet.</span>
              </div>
            ) : (
              draft.map((item) => (
                <Card key={item.id} rounded="xl" glow={false} className="p-4 border border-border/40 bg-surface text-left">
                  <div className="flex flex-row justify-between items-center gap-4 w-full">
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="font-bold text-foreground text-xs truncate">
                        {item.schoolName}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {item.degree || item.label} {item.major ? `- ${item.major}` : ""} ({item.startDate} to {item.isCurrentlyStudying ? "Present" : item.endDate})
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        isIconOnly
                        size="sm"
                        variant="secondary"
                        className="rounded-xl border border-border/30 h-8 w-8"
                        onPress={() => handleEdit(item)}
                        type="button"
                        aria-label={`Edit education at ${item.schoolName}`}
                      >
                        <Edit2 className="size-3.5" />
                      </Button>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="secondary"
                        className="rounded-xl border border-border/30 h-8 w-8 text-danger"
                        onPress={() => handleRemove(item.id)}
                        type="button"
                        aria-label={`Remove education at ${item.schoolName}`}
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
          message="You have unsaved education changes."
          onReset={onReset}
          onSave={onSave}
          isDirty={isDirty}
          isSubmitting={isSaving}
        />
      )}
    </div>
  );
};
