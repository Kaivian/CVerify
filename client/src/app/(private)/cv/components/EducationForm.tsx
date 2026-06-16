import React, { useState } from "react";
import {
  Input,
  Button,
  DatePicker,
  DateField,
  Calendar,
  DateRangePicker,
  RangeCalendar,
  Switch,
} from "@heroui/react";
import { parseDate } from "@internationalized/date";
import { PlusCircle, Trash2, Edit2 } from "lucide-react";
import { type EducationDraftItem } from "./types";
import { BaseUnsavedChangesBar } from "@/components/ui/unsaved-changes-bar";

// 1. Click-to-Edit Label Component (visually matching Settings)
interface ClickToEditLabelProps {
  value: string;
  onChange: (newVal: string) => void;
}

const ClickToEditLabel: React.FC<ClickToEditLabelProps> = ({ value, onChange }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value || "School / University");
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      setDraft(value || "School / University");
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing, value]);

  const commitEdit = () => {
    const trimmed = draft.trim();
    const finalValue = trimmed || "School / University";
    onChange(finalValue);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        aria-label="Edit education label"
        className="text-xs font-bold text-foreground w-full uppercase tracking-wider px-2 py-0.5 border border-accent bg-field rounded-md focus:outline-none"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitEdit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitEdit();
          }
        }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      className="group flex items-center text-[11px] cursor-pointer pb-1 bg-transparent border-0 p-0 text-left outline-none focus:outline-none focus:ring-0"
      aria-label={`Edit school label: ${value}`}
    >
      <span className="cursor-pointer hover:text-muted transition-colors select-none font-bold uppercase text-xs tracking-wider text-muted-foreground">
        {value || "School / University"}
      </span>
      <Edit2 className="size-3 text-muted/60 opacity-0 group-hover:opacity-100 transition-all ml-1.5 shrink-0" />
      <span className="text-[10px] text-muted/50 opacity-0 group-hover:opacity-100 transition-opacity font-normal normal-case ml-1">
        (Click to edit)
      </span>
    </button>
  );
};

// 2. GPA Field Components
interface GPAFieldHeaderProps {
  gpaScale: number | null;
  onChange: (scale: number) => void;
}

const GPAFieldHeader: React.FC<GPAFieldHeaderProps> = ({ gpaScale, onChange }) => {
  const scale = gpaScale || 4;
  const isSelected = scale === 10;

  return (
    <div className="flex justify-between items-center w-full select-none">
      <span className="text-xs font-bold text-foreground">GPA</span>
      <Switch
        aria-label="GPA Scale"
        isSelected={isSelected}
        onChange={(selected) => {
          onChange(selected ? 10 : 4);
        }}
      >
        <Switch.Control className="h-4">
          <Switch.Thumb className="h-3" />
        </Switch.Control>
      </Switch>
    </div>
  );
};

interface GPAInputProps {
  gpa: number | null;
  gpaScale: number | null;
  onChange: (gpa: number | null) => void;
}

const GPAInput: React.FC<GPAInputProps> = ({ gpa, gpaScale, onChange }) => {
  const scale = gpaScale || 4;
  const isSelected = scale === 10;

  return (
    <div className="flex items-center border border-field-border bg-field rounded-xl overflow-hidden focus-within:border-accent transition-all h-10 w-full px-3">
      <span className="text-sm font-bold text-muted-foreground mr-2 select-none">{scale}</span>
      <input
        type="number"
        step="0.01"
        min="0"
        max={scale}
        placeholder={isSelected ? "e.g. 9.50" : "e.g. 3.80"}
        aria-label="GPA Score"
        value={gpa === null || gpa === undefined ? "" : gpa}
        onChange={(e) => {
          const val = e.target.value;
          if (val === "") {
            onChange(null);
          } else {
            const num = Math.round(parseFloat(val) * 100) / 100;
            onChange(Math.min(Math.max(num, 0), scale));
          }
        }}
        className="bg-transparent text-sm w-full outline-none text-foreground border-none p-0 focus:ring-0"
      />
    </div>
  );
};

// 3. Individual Education Card Component
interface EducationEntryItemProps {
  item: EducationDraftItem;
  index: number;
  onChangeItem: (index: number, updated: EducationDraftItem) => void;
  onRemoveItem: (index: number) => void;
}

const EducationEntryItem: React.FC<EducationEntryItemProps> = ({
  item,
  index,
  onChangeItem,
  onRemoveItem,
}) => {
  const isCurrentlyStudying = item.isCurrentlyStudying || false;
  const isUniversity =
    (item.label || "").toLowerCase().includes("university") ||
    (item.label || "").toLowerCase().includes("đại học") ||
    (item.label || "").toLowerCase().includes("dai hoc");

  const [newDesc, setNewDesc] = useState("");

  const lines = item.description
    ? item.description.split("\n").filter((line) => line.trim() !== "")
    : [];

  const handleAddDesc = () => {
    const trimmed = newDesc.trim();
    if (!trimmed) return;
    const updatedLines = [...lines, trimmed];
    onChangeItem(index, {
      ...item,
      description: updatedLines.join("\n"),
    });
    setNewDesc("");
  };

  const handleRemoveDesc = (idxToRemove: number) => {
    const updatedLines = lines.filter((_, idx) => idx !== idxToRemove);
    onChangeItem(index, {
      ...item,
      description: updatedLines.length > 0 ? updatedLines.join("\n") : null,
    });
  };

  // Map starting and ending values for DatePicker/DateRangePicker
  const startVal = item.period?.start
    ? typeof item.period.start === "string"
      ? parseDate(item.period.start.split("T")[0])
      : item.period.start
    : null;
  const endVal = item.period?.end
    ? typeof item.period.end === "string"
      ? parseDate(item.period.end.split("T")[0])
      : item.period.end
    : null;

  return (
    <div className="relative border border-border/60 bg-surface-secondary/10 hover:bg-surface-secondary/20 rounded-2xl p-5 sm:p-6 flex flex-col gap-5 text-left transition-all duration-300 hover:border-border">
      {/* Grid Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_275px_130px_auto] gap-4 items-start">
        {/* School Input */}
        <div className="flex flex-col gap-1 w-full">
          <div className="h-6 flex items-center">
            <ClickToEditLabel
              value={item.label}
              onChange={(newLabel) => onChangeItem(index, { ...item, label: newLabel })}
            />
          </div>
          <Input
            aria-label="School/University Name"
            placeholder="e.g. Stanford University"
            value={item.school || ""}
            onChange={(e) => onChangeItem(index, { ...item, school: e.target.value })}
          />
          {isUniversity && (
            <div className="mt-2 animate-fade-in flex flex-col gap-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                Major
              </span>
              <Input
                aria-label="Major"
                placeholder="e.g. Computer Science"
                value={item.major || ""}
                onChange={(e) => onChangeItem(index, { ...item, major: e.target.value })}
              />
            </div>
          )}
        </div>

        {/* Date Fields */}
        <div className="flex flex-col gap-2 w-full">
          <div className="h-6 flex items-center">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
              {isCurrentlyStudying ? "Study Period (Start)" : "Study Period"}
            </span>
          </div>
          {isCurrentlyStudying ? (
            <DatePicker
              className="w-full"
              aria-label="Study Period (Start)"
              value={startVal}
              onChange={(val) =>
                onChangeItem(index, {
                  ...item,
                  period: {
                    start: val ? val.toString() : null,
                    end: null,
                  },
                })
              }
            >
              <DateField.Group fullWidth>
                <DateField.Input>
                  {(segment) => <DateField.Segment segment={segment} />}
                </DateField.Input>
                <DateField.Suffix>
                  <DatePicker.Trigger>
                    <DatePicker.TriggerIndicator />
                  </DatePicker.Trigger>
                </DateField.Suffix>
              </DateField.Group>
              <DatePicker.Popover>
                <Calendar aria-label="Study Start Date">
                  <Calendar.Header>
                    <Calendar.YearPickerTrigger>
                      <Calendar.YearPickerTriggerHeading />
                      <Calendar.YearPickerTriggerIndicator />
                    </Calendar.YearPickerTrigger>
                    <Calendar.NavButton slot="previous" />
                    <Calendar.NavButton slot="next" />
                  </Calendar.Header>
                  <Calendar.Grid>
                    <Calendar.GridHeader>
                      {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
                    </Calendar.GridHeader>
                    <Calendar.GridBody>
                      {(date) => <Calendar.Cell date={date} />}
                    </Calendar.GridBody>
                  </Calendar.Grid>
                  <Calendar.YearPickerGrid>
                    <Calendar.YearPickerGridBody>
                      {({ year }) => <Calendar.YearPickerCell year={year} />}
                    </Calendar.YearPickerGridBody>
                  </Calendar.YearPickerGrid>
                </Calendar>
              </DatePicker.Popover>
            </DatePicker>
          ) : (
            <DateRangePicker
              className="w-full"
              aria-label="Study Period"
              value={startVal && endVal ? { start: startVal, end: endVal } : null}
              onChange={(val) =>
                onChangeItem(index, {
                  ...item,
                  period: {
                    start: val?.start ? val.start.toString() : null,
                    end: val?.end ? val.end.toString() : null,
                  },
                })
              }
            >
              <DateField.Group fullWidth>
                <DateField.Input slot="start">
                  {(segment) => <DateField.Segment segment={segment} />}
                </DateField.Input>
                <DateRangePicker.RangeSeparator />
                <DateField.Input slot="end">
                  {(segment) => <DateField.Segment segment={segment} />}
                </DateField.Input>
                <DateField.Suffix>
                  <DateRangePicker.Trigger>
                    <DateRangePicker.TriggerIndicator />
                  </DateRangePicker.Trigger>
                </DateField.Suffix>
              </DateField.Group>
              <DateRangePicker.Popover>
                <RangeCalendar aria-label="Study Period">
                  <RangeCalendar.Header>
                    <RangeCalendar.YearPickerTrigger>
                      <RangeCalendar.YearPickerTriggerHeading />
                      <RangeCalendar.YearPickerTriggerIndicator />
                    </RangeCalendar.YearPickerTrigger>
                    <RangeCalendar.NavButton slot="previous" />
                    <RangeCalendar.NavButton slot="next" />
                  </RangeCalendar.Header>
                  <RangeCalendar.Grid>
                    <RangeCalendar.GridHeader>
                      {(day) => (
                        <RangeCalendar.HeaderCell>
                          {day}
                        </RangeCalendar.HeaderCell>
                      )}
                    </RangeCalendar.GridHeader>
                    <RangeCalendar.GridBody>
                      {(date) => <RangeCalendar.Cell date={date} />}
                    </RangeCalendar.GridBody>
                  </RangeCalendar.Grid>
                  <RangeCalendar.YearPickerGrid>
                    <RangeCalendar.YearPickerGridBody>
                      {({ year }) => (
                        <RangeCalendar.YearPickerCell year={year} />
                      )}
                    </RangeCalendar.YearPickerGridBody>
                  </RangeCalendar.YearPickerGrid>
                </RangeCalendar>
              </DateRangePicker.Popover>
            </DateRangePicker>
          )}
        </div>

        {/* GPA Field */}
        <div className="flex flex-col gap-1 w-full">
          <div className="h-6 flex items-center">
            <GPAFieldHeader
              gpaScale={item.gpaScale}
              onChange={(newScale) => {
                const oldScale = item.gpaScale || 4;
                let newGpa = item.gpa;
                if (item.gpa !== null && item.gpa !== undefined) {
                  const converted = Math.round((item.gpa / oldScale) * newScale * 100) / 100;
                  newGpa = Math.min(converted, newScale);
                }
                onChangeItem(index, { ...item, gpa: newGpa, gpaScale: newScale });
              }}
            />
          </div>
          <GPAInput
            gpa={item.gpa}
            gpaScale={item.gpaScale}
            onChange={(newGpa) => onChangeItem(index, { ...item, gpa: newGpa })}
          />
        </div>

        {/* Remove Trigger */}
        <div className="flex items-end h-full pt-6">
          <Button
            isIconOnly
            variant="danger-soft"
            className="h-9 w-9 min-w-9 rounded-xl"
            onPress={() => onRemoveItem(index)}
            aria-label={`Remove ${item.label}`}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Description List Editor */}
      <div className="border-t border-border/40 pt-4 flex flex-col gap-2">
        <span className="text-xs font-bold text-foreground font-outfit uppercase tracking-wider block">
          Description
        </span>
        <div className="flex gap-2 items-start">
          <div className="flex-1 flex flex-col gap-0.5">
            <Input
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Add description..."
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddDesc();
                }
              }}
              aria-label="Description line"
              maxLength={300}
            />
            <div className="flex justify-end text-[10px] text-muted-foreground mt-0.5 select-none">
              <span>{(newDesc || "").length}/300 characters</span>
            </div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="rounded-xl border border-border/30 h-10 w-10 min-w-10 flex items-center justify-center"
            onPress={handleAddDesc}
            type="button"
            aria-label="Add description line"
          >
            <PlusCircle className="size-4" />
          </Button>
        </div>

        <div className="flex flex-col gap-2 mt-1">
          {lines.map((line, idx) => (
            <div
              key={idx}
              className="flex items-start justify-between gap-3 p-2 border border-border/30 rounded-lg bg-surface text-xs"
            >
              <span className="leading-relaxed text-muted-foreground">{line}</span>
              <Button
                isIconOnly
                size="sm"
                variant="secondary"
                className="rounded-xl border border-border/30 h-6 w-6 text-danger shrink-0"
                onPress={() => handleRemoveDesc(idx)}
                type="button"
                aria-label="Remove description line"
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Currently Studying Toggles */}
      <div className="flex items-center justify-between border-t border-border/40 pt-4 select-none animate-fade-in">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-bold text-foreground font-outfit">
            Currently Studying Here
          </span>
          <span className="text-[10px] text-muted-foreground">
            Check this if you are currently enrolled in this institution.
          </span>
        </div>
        <Switch
          isSelected={isCurrentlyStudying}
          onChange={(checked) => {
            onChangeItem(index, {
              ...item,
              isCurrentlyStudying: checked,
              period: {
                start: item.period?.start || null,
                end: null,
              },
            });
          }}
          aria-label="Currently studying toggle"
          className="cursor-pointer"
        >
          {({ isSelected }) => (
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          )}
        </Switch>
      </div>
    </div>
  );
};

// 4. Main CV Education Form component
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
  const handleAddEducation = () => {
    const newItem: EducationDraftItem = {
      id: `temp-${Date.now()}`,
      label: "School / University",
      school: "",
      degree: "",
      major: "",
      description: "",
      isCurrentlyStudying: false,
      period: null,
      gpa: null,
      gpaScale: 4,
    };
    onChange([...draft, newItem]);
  };

  const handleChangeItem = (index: number, updatedItem: EducationDraftItem) => {
    const updated = [...draft];
    updated[index] = updatedItem;
    onChange(updated);
  };

  const handleRemoveItem = (index: number) => {
    const updated = draft.filter((_, idx) => idx !== index);
    onChange(updated);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden relative text-left">
      <div className="flex-1 overflow-y-auto px-1.5 flex flex-col gap-4 pb-4">
        <div className="flex flex-col gap-6 text-left">
          {draft.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 px-4 border border-dashed border-border rounded-xl text-center select-none bg-surface-secondary/20">
              <span className="text-muted text-xs font-semibold mb-4 max-w-sm leading-relaxed text-center">
                No education history added yet. Share your academic background by appending education rows below.
              </span>
              <Button
                className="rounded-xl justify-center text-center items-center text-xs"
                onPress={handleAddEducation}
              >
                <PlusCircle className="size-4" />
                <span className="pt-0.5 font-bold">Add Education</span>
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {draft.map((item, index) => (
                <EducationEntryItem
                  key={item.id}
                  item={item}
                  index={index}
                  onChangeItem={handleChangeItem}
                  onRemoveItem={handleRemoveItem}
                />
              ))}
            </div>
          )}

          {draft.length > 0 && (
            <div className="flex select-none border-t border-border/40 pt-4 mt-2">
              <Button
                className="rounded-xl justify-center text-center items-center text-xs"
                onPress={handleAddEducation}
              >
                <PlusCircle className="size-4" />
                <span className="pt-0.5 font-bold">Add Education</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      <BaseUnsavedChangesBar
        message="You have unsaved education changes."
        onReset={onReset}
        onSave={onSave}
        isDirty={isDirty}
        isSubmitting={isSaving}
      />
    </div>
  );
};

export default EducationForm;
