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
  const [isSelected, setIsSelected] = React.useState(false);

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
                  setIsSelected(selected);
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
        </div>

        {/* Date Range Picker */}
        <div className="flex flex-col gap-2 w-full">
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
                  gpaScale: null,
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
                  gpaScale: null,
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
