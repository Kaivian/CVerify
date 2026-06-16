import React from "react";
import {
  useFormContext,
  useFieldArray,
  Controller,
  useWatch,
  type Control,
  type UseFormSetValue,
  type FieldErrors,
} from "react-hook-form";
import {
  Typography,
  Label,
  Input,
  DateField,
  DateRangePicker,
  RangeCalendar,
  DatePicker,
  Calendar,
  FieldError,
  Button,
  TextField,
  InputGroup,
  Switch,
} from "@heroui/react";
import { Card } from "@/components/ui/card";
import { SettingsSection } from "./SettingsSection";
import { Plus, Trash2, Edit2 } from "lucide-react";
import type { PersonalInfoFormValues } from "./types";

// 1. Interactive Click-to-Edit Label Component (preventing focus loss)
interface ClickToEditLabelProps {
  index: number;
  control: Control<PersonalInfoFormValues>;
  setValue: UseFormSetValue<PersonalInfoFormValues>;
}

const ClickToEditLabel: React.FC<ClickToEditLabelProps> = ({
  index,
  control,
  setValue,
}) => {
  const labelValue =
    useWatch({
      control,
      name: `education.${index}.label`,
    }) || "School / University";

  const [isEditing, setIsEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(labelValue);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      setDraft(labelValue);
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing, labelValue]);

  const commitEdit = () => {
    const trimmed = draft.trim();
    const finalValue = trimmed || "School / University";
    setValue(`education.${index}.label`, finalValue, { shouldDirty: true });
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        aria-label="Edit education label"
        className="bg-transparent text-xs font-bold text-foreground focus:outline-none w-full uppercase tracking-wider mb-1"
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
      className="group flex items-center text-[11px] cursor-pointer pb-1 bg-transparent border-0 p-0 text-left focus-ring"
      aria-label={`Edit school label: ${labelValue}`}
    >
      <Label className="cursor-pointer hover:text-muted transition-colors select-none font-bold uppercase text-xs tracking-wider text-muted-foreground">
        {labelValue}
      </Label>
      <Edit2 className="size-3 text-muted/60 opacity-0 group-hover:opacity-100 transition-all ml-1.5 shrink-0" />
      <span className="text-[10px] text-muted/50 opacity-0 group-hover:opacity-100 transition-opacity font-normal normal-case ml-1">
        (Click to edit)
      </span>
    </button>
  );
};

const GPAField: React.FC<{
  index: number;
  control: Control<PersonalInfoFormValues>;
  errors: FieldErrors<PersonalInfoFormValues>;
}> = ({ index, control, errors }) => {
  const { setValue } = useFormContext<PersonalInfoFormValues>();
  const gpaScaleValue = useWatch({
    control,
    name: `education.${index}.gpaScale`,
  });

  const isSelected = gpaScaleValue === 10;

  return (
    <Controller
      control={control}
      name={`education.${index}.gpa`}
      render={({ field: { value, onChange } }) => (
        <TextField
          id={`gpa-field-${index}`}
          className="w-full"
          isInvalid={!!errors.education?.[index]?.gpa}
        >
          <Label>
            <div className="flex justify-between">
              GPA
              <Switch
                aria-label="GPA Scale"
                isSelected={isSelected}
                onChange={(selected) => {
                  const oldScale = isSelected ? 10 : 4;
                  const newScale = selected ? 10 : 4;
                  setValue(`education.${index}.gpaScale`, newScale, {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                  if (value !== null && value !== undefined) {
                    const converted =
                      Math.round((value / oldScale) * newScale * 100) / 100;
                    onChange(Math.min(converted, newScale));
                  }
                }}
              >
                <Switch.Control className="h-4">
                  <Switch.Thumb className="h-3" />
                </Switch.Control>
              </Switch>
            </div>
          </Label>
          <InputGroup>
            <InputGroup.Prefix>{isSelected ? 10 : 4}</InputGroup.Prefix>
            <InputGroup.Input
              type="number"
              step="0.01"
              min="0"
              max={isSelected ? 10 : 4}
              placeholder={isSelected ? "e.g. 9.50" : "e.g. 3.80"}
              value={value === null || value === undefined ? "" : value}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "") {
                  onChange(null);
                } else {
                  const maxScale = isSelected ? 10 : 4;
                  const num = Math.round(parseFloat(val) * 100) / 100;
                  onChange(Math.min(Math.max(num, 0), maxScale));
                }
              }}
              className="w-full"
            />
          </InputGroup>
          {errors.education?.[index]?.gpa && (
            <FieldError className="text-danger text-[10px] mt-1 block leading-tight">
              {errors.education[index]?.gpa?.message}
            </FieldError>
          )}
        </TextField>
      )}
    />
  );
};

// 2. Individual Education Entry Card
interface EducationEntryItemProps {
  index: number;
  remove: (index: number) => void;
  showRemove: boolean;
  errors: FieldErrors<PersonalInfoFormValues>;
  control: Control<PersonalInfoFormValues>;
  setValue: UseFormSetValue<PersonalInfoFormValues>;
}

const EducationEntryItem: React.FC<EducationEntryItemProps> = ({
  index,
  remove,
  showRemove,
  errors,
  control,
  setValue,
}) => {
  const labelValue =
    useWatch({
      control,
      name: `education.${index}.label`,
    }) || "School / University";

  const isCurrentlyStudying = useWatch({
    control,
    name: `education.${index}.isCurrentlyStudying`,
  });

  const isUniversity =
    (labelValue || "").toLowerCase().includes("university") ||
    (labelValue || "").toLowerCase().includes("đại học") ||
    (labelValue || "").toLowerCase().includes("dai hoc");

  const [newDesc, setNewDesc] = React.useState("");

  const descriptionValue = useWatch({
    control,
    name: `education.${index}.description`,
  });

  const lines = descriptionValue
    ? descriptionValue.split("\n").filter((line: string) => line.trim() !== "")
    : [];

  const handleAddDesc = () => {
    const trimmed = newDesc.trim();
    if (!trimmed) return;
    const updatedLines = [...lines, trimmed];
    setValue(`education.${index}.description`, updatedLines.join("\n"), {
      shouldDirty: true,
      shouldValidate: true,
    });
    setNewDesc("");
  };

  const handleRemoveDesc = (idxToRemove: number) => {
    const updatedLines = lines.filter((_, idx) => idx !== idxToRemove);
    setValue(
      `education.${index}.description`,
      updatedLines.length > 0 ? updatedLines.join("\n") : null,
      {
        shouldDirty: true,
        shouldValidate: true,
      }
    );
  };

  return (
    <div className="relative border border-border/60 bg-surface-secondary/10 hover:bg-surface-secondary/20 rounded-2xl p-5 sm:p-6 flex flex-col gap-5 text-left transition-all duration-300 hover:border-border">
      {/* Grid Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_275px_130px_auto] gap-4 items-start">
        {/* School Name Input */}
        <div className="flex flex-col gap-1 w-full">
          <ClickToEditLabel index={index} control={control} setValue={setValue} />
          <Controller
            control={control}
            name={`education.${index}.school`}
            render={({ field: { value, onChange } }) => (
              <Input
                id={`school-${index}`}
                aria-label="School/University Name"
                placeholder="e.g. Stanford University"
                value={value || ""}
                onChange={onChange}
              />
            )}
          />
          {errors.education?.[index]?.school && (
            <FieldError className="text-danger text-xs mt-1 block">
              {errors.education[index]?.school?.message}
            </FieldError>
          )}
          {isUniversity && (
            <div className="mt-2 animate-fade-in flex flex-col gap-1">
              <Label htmlFor={`major-${index}`} className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                Major
              </Label>
              <Controller
                control={control}
                name={`education.${index}.major`}
                render={({ field: { value, onChange } }) => (
                  <Input
                    id={`major-${index}`}
                    aria-label="Major"
                    placeholder="e.g. Computer Science"
                    value={value || ""}
                    onChange={onChange}
                  />
                )}
              />
            </div>
          )}
        </div>

        {/* Date Range Picker */}
        <div className="flex flex-col gap-2 w-full">
          {isCurrentlyStudying ? (
            <Controller
              control={control}
              name={`education.${index}.period`}
              render={({ field: { value, onChange } }) => (
                <DatePicker
                  className="w-full"
                  value={value?.start || null}
                  onChange={(val) =>
                    onChange({
                      start: val,
                      end: null,
                    })
                  }
                  isInvalid={!!errors.education?.[index]?.period}
                >
                  <Label>Study Period (Start)</Label>
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
              )}
            />
          ) : (
            <Controller
              control={control}
              name={`education.${index}.period`}
              render={({ field: { value, onChange } }) => (
                <DateRangePicker
                  className="w-full"
                  value={value || null}
                  onChange={onChange}
                  isInvalid={!!errors.education?.[index]?.period}
                >
                  <Label>Study Period</Label>
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
            />
          )}
          {errors.education?.[index]?.period && (
            <FieldError className="text-danger text-xs mt-1 block">
              Valid study period is required
            </FieldError>
          )}
        </div>

        <GPAField index={index} control={control} errors={errors} />

        {/* Remove Button */}
        {showRemove && (
          <div className="flex items-end h-full pt-5">
            <Button
              isIconOnly
              variant="danger-soft"
              className="h-9 w-9 min-w-9 rounded-xl"
              onPress={() => remove(index)}
              aria-label={`Remove ${labelValue}`}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Description List Editor */}
      <div className="border-t border-border/40 pt-4 flex flex-col gap-2">
        <Label className="font-bold text-foreground text-xs uppercase tracking-wider">
          Description
        </Label>
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
            <Plus className="size-4" />
          </Button>
        </div>

        <div className="flex flex-col gap-2 mt-1">
          {lines.map((line: string, idx: number) => (
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

      {/* Toggles Row */}
      <div className="flex items-center justify-between border-t border-border/40 pt-4 select-none animate-fade-in">
        <div className="flex flex-col gap-0.5">
          <Typography className="text-xs font-bold text-foreground font-outfit">
            Currently Studying Here
          </Typography>
          <Typography className="text-[10px] text-muted-foreground">
            Check this if you are currently enrolled in this institution.
          </Typography>
        </div>
        <Controller
          control={control}
          name={`education.${index}.isCurrentlyStudying`}
          render={({ field: { value, onChange } }) => (
            <Switch
              isSelected={value}
              onChange={(checked) => {
                if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
                  document.activeElement.blur();
                }
                onChange(checked);
                // Clear the end date in the form if currently studying
                const currentPeriod = control._formValues.education?.[index]?.period;
                setValue(`education.${index}.period`, {
                  start: currentPeriod?.start || null,
                  end: null,
                }, { shouldDirty: true, shouldValidate: true });
              }}
              aria-label="Currently studying toggle"
              className="cursor-pointer"
            >
              {({ isSelected }) => (
                <Switch.Control
                  className={`w-10 h-5.5 rounded-full relative flex items-center transition-colors duration-200 ${isSelected ? "bg-success" : "bg-separator"}`}
                >
                  <Switch.Thumb
                    className={`w-4 h-4 bg-foreground rounded-full absolute transition-all duration-200 ${isSelected ? "left-[20px]" : "left-0.5"}`}
                  />
                </Switch.Control>
              )}
            </Switch>
          )}
        />
      </div>
    </div>
  );
};

// 3. Main Education Section
export const EducationSection: React.FC = () => {
  const {
    control,
    setValue,
    formState: { errors },
  } = useFormContext<PersonalInfoFormValues>();

  const { fields, append, remove } = useFieldArray({
    control,
    name: "education",
  });

  return (
    <SettingsSection title="Education">
      <Card className="flex flex-col gap-6 text-left p-6">
        {fields.length === 0 ? (
          // Empty State Layout when all entries are removed
          <div className="flex flex-col items-center justify-center py-6 px-4 border border-dashed border-border rounded-xl text-center select-none bg-surface-secondary/20">
            <Typography className="text-muted text-xs font-semibold mb-4 max-w-sm leading-relaxed text-center">
              No education history added yet. Share your academic background by
              appending education rows below.
            </Typography>
            <Button
              className="rounded-xl justify-center text-center items-center text-xs"
              onPress={() =>
                append({
                  label: "School / University",
                  school: "",
                  period: null,
                  gpa: null,
                  gpaScale: 4,
                  isCurrentlyStudying: false,
                })
              }
            >
              <Plus className="size-4" />
              <span className="pt-0.5">Add Education</span>
            </Button>
          </div>
        ) : (
          // Dynamic Entries List
          <div className="flex flex-col gap-5">
            {fields.map((field, index) => (
              <EducationEntryItem
                key={field.id}
                index={index}
                remove={remove}
                showRemove={true}
                errors={errors}
                control={control}
                setValue={setValue}
              />
            ))}
          </div>
        )}

        {/* Append Entries Trigger Button (Visible when fields are present) */}
        {fields.length > 0 && (
          <div className="flex select-none border-t border-border/40 pt-4 mt-2">
            <Button
              className="rounded-xl justify-center text-center items-center text-xs"
              onPress={() =>
                append({
                  label: "School / University",
                  school: "",
                  period: null,
                  gpa: null,
                  gpaScale: 4,
                  isCurrentlyStudying: false,
                })
              }
            >
              <Plus className="size-4" />
              <span className="pt-0.5">Add Education</span>
            </Button>
          </div>
        )}
      </Card>
    </SettingsSection>
  );
};

export default EducationSection;
