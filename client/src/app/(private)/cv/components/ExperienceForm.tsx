import React, { useState } from "react";
import { Input, Button, TextArea, Checkbox, Spinner, Card, Chip } from "@heroui/react";
import { PlusCircle, Trash2, Edit2, X, Plus } from "lucide-react";
import { type ExperienceDraftItem } from "./types";

interface ExperienceFormProps {
  draft: ExperienceDraftItem[];
  onChange: (updated: ExperienceDraftItem[]) => void;
  onSave: () => Promise<void>;
  onReset: () => void;
  isSaving: boolean;
  isDirty: boolean;
}

export const ExperienceForm: React.FC<ExperienceFormProps> = ({
  draft,
  onChange,
  onSave,
  onReset,
  isSaving,
  isDirty,
}) => {
  const [editingItem, setEditingItem] = useState<ExperienceDraftItem | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [newTech, setNewTech] = useState("");

  const handleEdit = (item: ExperienceDraftItem) => {
    setEditingItem({ ...item });
    setErrors({});
  };

  const handleAddNew = () => {
    const newItem: ExperienceDraftItem = {
      id: `temp-${Date.now()}`,
      jobTitle: "",
      company: "",
      experienceCategory: 1,
      employmentType: 1,
      location: "",
      startDate: "",
      endDate: null,
      isCurrentlyWorking: false,
      description: "",
      technologies: [],
      achievements: [],
      links: [],
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

  const validateItem = (item: ExperienceDraftItem): boolean => {
    const newErrors: Record<string, string> = {};
    if (!item.jobTitle.trim()) newErrors.jobTitle = "This field is required";
    if (!item.company.trim()) newErrors.company = "This field is required";
    if (!item.startDate) newErrors.startDate = "This field is required";

    if (item.startDate && item.endDate && !item.isCurrentlyWorking) {
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

  const addTechnology = () => {
    if (!editingItem || !newTech.trim()) return;
    if (!editingItem.technologies.includes(newTech.trim())) {
      setEditingItem({
        ...editingItem,
        technologies: [...editingItem.technologies, newTech.trim()],
      });
    }
    setNewTech("");
  };

  const removeTechnology = (tech: string) => {
    if (!editingItem) return;
    setEditingItem({
      ...editingItem,
      technologies: editingItem.technologies.filter((t) => t !== tech),
    });
  };

  const addAchievement = () => {
    if (!editingItem) return;
    setEditingItem({
      ...editingItem,
      achievements: [...editingItem.achievements, { title: "", description: "" }],
    });
  };

  const removeAchievement = (index: number) => {
    if (!editingItem) return;
    setEditingItem({
      ...editingItem,
      achievements: editingItem.achievements.filter((_, i) => i !== index),
    });
  };

  const updateAchievement = (index: number, field: "title" | "description", value: string) => {
    if (!editingItem) return;
    const updated = [...editingItem.achievements];
    updated[index] = { ...updated[index], [field]: value };
    setEditingItem({ ...editingItem, achievements: updated });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden relative text-left">
      <div className="flex-1 overflow-y-auto px-1.5 flex flex-col gap-4 pb-20">
        {editingItem ? (
        // Inline Edit Mode
        <div className="flex flex-col gap-5 border border-border/40 p-5 rounded-2xl bg-surface-secondary/5">
          <div className="flex justify-between items-center border-b border-border/20 pb-3 select-none">
            <span className="font-bold text-xs text-foreground">
              {editingItem.id.startsWith("temp-") ? "Add Work Experience" : "Edit Work Experience"}
            </span>
            <Button
              isIconOnly
              size="sm"
              variant="secondary"
              className="rounded-xl border border-border/30 h-8 w-8"
              onPress={() => setEditingItem(null)}
              type="button"
            >
              <X className="size-4" />
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-foreground">Company *</label>
              <Input
                value={editingItem.company}
                onChange={(e) => setEditingItem({ ...editingItem, company: e.target.value })}
                placeholder="Google"
              />
              {errors.company && <span className="text-[10px] text-danger">{errors.company}</span>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-foreground">Role/Position *</label>
              <Input
                value={editingItem.jobTitle}
                onChange={(e) => setEditingItem({ ...editingItem, jobTitle: e.target.value })}
                placeholder="Software Engineer"
              />
              {errors.jobTitle && <span className="text-[10px] text-danger">{errors.jobTitle}</span>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-foreground">Location</label>
              <Input
                value={editingItem.location}
                onChange={(e) => setEditingItem({ ...editingItem, location: e.target.value })}
                placeholder="Hanoi, Vietnam"
              />
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
                disabled={editingItem.isCurrentlyWorking}
                onChange={(e) => setEditingItem({ ...editingItem, endDate: e.target.value })}
              />
            </div>

            <div className="flex items-center gap-2 py-4 select-none">
              <Checkbox
                isSelected={editingItem.isCurrentlyWorking}
                onChange={(isSelected: boolean) =>
                  setEditingItem({
                    ...editingItem,
                    isCurrentlyWorking: isSelected,
                    endDate: isSelected ? null : editingItem.endDate,
                  })
                }
              />
              <span className="text-xs font-semibold text-foreground">
                Currently working here
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 text-xs">
            <label className="font-bold text-foreground">Description</label>
            <TextArea
              value={editingItem.description}
              onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
              placeholder="Detail your responsibilities and achievements..."
              rows={4}
            />
          </div>

          {/* Tech stack section */}
          <div className="flex flex-col gap-2 border-t border-border/20 pt-3">
            <label className="font-bold text-xs text-foreground">Technologies Used</label>
            <div className="flex gap-2">
              <Input
                value={newTech}
                onChange={(e) => setNewTech(e.target.value)}
                placeholder="Add technology..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTechnology();
                  }
                }}
              />
              <Button size="sm" variant="secondary" className="rounded-xl border border-border/30 h-10 min-w-10" onPress={addTechnology} type="button">
                <Plus className="size-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {editingItem.technologies.map((tech) => (
                <Chip
                  key={tech}
                  size="sm"
                  variant="soft"
                  color="default"
                  className="text-[9px] font-bold py-1 px-1.5 flex items-center gap-1"
                >
                  <span className="flex items-center gap-1">
                    {tech}
                    <button type="button" onClick={() => removeTechnology(tech)} className="bg-transparent border-none text-muted-foreground cursor-pointer flex items-center">
                      <X className="size-2.5" />
                    </button>
                  </span>
                </Chip>
              ))}
            </div>
          </div>

          {/* Achievements section */}
          <div className="flex flex-col gap-3 border-t border-border/20 pt-3">
            <div className="flex justify-between items-center">
              <span className="font-bold text-xs text-foreground">Achievements</span>
              <Button size="sm" variant="secondary" className="rounded-xl border border-border/30 h-7 text-[10px] font-bold" onPress={addAchievement} type="button">
                <PlusCircle className="size-3.5" />
                Add Achievement
              </Button>
            </div>
            <div className="flex flex-col gap-3">
              {editingItem.achievements.map((ach, idx) => (
                <div key={idx} className="flex flex-col gap-2 p-3 bg-surface border border-border/40 rounded-xl relative">
                  <Button
                    isIconOnly
                    size="sm"
                    variant="secondary"
                    className="rounded-xl border border-border/30 absolute right-2 top-2 h-7 w-7 text-danger"
                    onPress={() => removeAchievement(idx)}
                    type="button"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                  <div className="flex flex-col gap-1 text-xs w-[calc(100%-40px)]">
                    <label className="font-bold">Achievement Title</label>
                    <Input
                      value={ach.title}
                      onChange={(e) => updateAchievement(idx, "title", e.target.value)}
                      placeholder="e.g. Optimize Database Query"
                    />
                  </div>
                  <div className="flex flex-col gap-1 text-xs">
                    <label className="font-bold">Description</label>
                    <TextArea
                      value={ach.description}
                      onChange={(e) => updateAchievement(idx, "description", e.target.value)}
                      placeholder="e.g. Tối ưu hóa truy vấn giúp giảm tải CPU 25%"
                      rows={2}
                    />
                  </div>
                </div>
              ))}
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
            <span className="text-xs font-bold text-foreground">Add Work Experience</span>
            <Button
              size="sm"
              variant="secondary"
              className="rounded-xl text-[10px] font-bold flex items-center gap-1 border border-border/30 h-8"
              onPress={handleAddNew}
              type="button"
            >
              <PlusCircle className="size-3.5" />
              Add Work Experience
            </Button>
          </div>

          <div className="flex flex-col gap-3">
            {draft.length === 0 ? (
              <div className="py-10 text-center border-2 border-dashed border-border/40 rounded-2xl select-none">
                <span className="text-muted-foreground text-xs">No work experience added yet.</span>
              </div>
            ) : (
              draft.map((item) => (
                <Card key={item.id} className="p-4 border border-border/40 bg-surface flex flex-row justify-between items-center gap-4">
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="font-bold text-foreground text-xs truncate">
                      {item.jobTitle} <span className="font-light text-muted">@</span> {item.company}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-medium">
                      {item.startDate} to {item.isCurrentlyWorking ? "Present" : item.endDate}
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
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>

        </div>
      )}
      </div>

      {!editingItem && (
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
      )}
    </div>
  );
};
