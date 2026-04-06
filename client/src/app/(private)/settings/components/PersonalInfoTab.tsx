"use client";

import React, { useEffect } from "react";
import {
  useForm,
  FormProvider,
  useFieldArray,
  Controller,
  useWatch,
  type Control,
  type UseFormSetValue,
  type FieldErrors,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card } from "@/components/ui/card";
import { SettingsSection } from "./SettingsSection";
import { parseDate } from "@internationalized/date";
import { Plus, Trash2, Edit2 } from "lucide-react";
import {
  UnsavedChangesBar,
  isDeepEqual,
} from "@/components/ui/unsaved-changes-bar";
import {
  Typography,
  Label,
  Input,
  DateField,
  DateRangePicker,
  RangeCalendar,
  FieldError,
  Button,
} from "@heroui/react";

// 1. Zod Education Schema with native DateRange and Label support
const educationEntrySchema = z.object({
  label: z.string().min(1, "Label is required"),
  school: z
    .string()
    .min(2, "School/University name must be at least 2 characters"),
  period: z.any().refine((val) => val && val.start && val.end, {
    message: "Valid study period is required",
  }),
});

const personalInfoSchema = z.object({
  education: z.array(educationEntrySchema),
});

type PersonalInfoFormValues = z.infer<typeof personalInfoSchema>;

interface PersonalInfoTabProps {
  onDirtyChange: (isDirty: boolean) => void;
  onSaveSuccess: () => void;
}

// 2. Interactive Click-to-Edit Label Component (uses isolated useWatch to prevent input focus loss)
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
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        aria-label="Edit education label"
        className="bg-transparent border-b border-accent text-xs font-bold text-foreground focus:outline-none focus:border-accent pb-0.5 w-full max-w-full uppercase tracking-wider"
        value={labelValue}
        onChange={(e) =>
          setValue(`education.${index}.label`, e.target.value, {
            shouldDirty: true,
          })
        }
        onBlur={() => {
          if (!labelValue.trim()) {
            setValue(`education.${index}.label`, "School / University");
          }
          setIsEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (!labelValue.trim()) {
              setValue(`education.${index}.label`, "School / University");
            }
            setIsEditing(false);
          }
        }}
      />
    );
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className="group flex items-center text-[11px] cursor-pointer w-full -mb-1"
    >
      <Label className="cursor-pointer hover:text-muted transition-colors select-none">
        {labelValue}
      </Label>
      <Edit2 className="size-3 text-muted/60 opacity-0 group-hover:opacity-100 transition-all ml-0.5 shrink-0" />
      <span className="text-[10px] text-muted/50 opacity-0 group-hover:opacity-100 transition-opacity font-normal normal-case ml-1">
        (Click to edit)
      </span>
    </div>
  );
};

// 3. Child Component for individual Education Entry (COMPLETELY quiet, zero watch-induced re-renders)
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
    <div className="grid grid-cols-1 md:grid-cols-[1fr_250px_auto] gap-4 items-start">
      {/* School Name Input with Click-to-Edit Label */}
      <div className="flex flex-col gap-2 w-full">
        <ClickToEditLabel index={index} control={control} setValue={setValue} />
        <Controller
          control={control}
          name={`education.${index}.school`}
          render={({ field: { value, onChange } }) => (
            <Input
              id={`school-${index}`}
              aria-label={labelValue}
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

      {/* Delete Entry Button */}
      <div className="flex items-end justify-center h-full select-none">
        {showRemove && (
          <Button
            isIconOnly
            variant="danger-soft"
            className="h-10 w-10 rounded-xl"
            onPress={() => remove(index)}
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
};

// 4. Main Personal Info Tab Component
export const PersonalInfoTab: React.FC<PersonalInfoTabProps> = ({
  onDirtyChange,
  onSaveSuccess,
}) => {
  const methods = useForm<PersonalInfoFormValues>({
    resolver: zodResolver(personalInfoSchema),
    defaultValues: {
      education: [
        {
          label: "University",
          school: "Harvard University",
          period: {
            start: parseDate("2020-09-01"),
            end: parseDate("2024-06-01"),
          },
        },
      ],
    },
    mode: "onChange",
  });

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = methods;

  const { fields, append, remove } = useFieldArray({
    control,
    name: "education",
  });

  const currentValues = useWatch({ control });

  useEffect(() => {
    const hasChanges = !isDeepEqual(
      currentValues,
      methods.formState.defaultValues,
    );
    onDirtyChange(hasChanges);
  }, [currentValues, methods.formState.defaultValues, onDirtyChange]);

  const handleReset = () => {
    reset();
  };

  const handleFormSubmit = async (data: PersonalInfoFormValues) => {
    try {
      // Simulate API submit delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Save data locally in-memory
      reset(data);
      onSaveSuccess();
    } catch (error) {
      console.error("Failed to save personal settings:", error);
    }
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
        <SettingsSection title="Education">
          <Card className="flex flex-col gap-6 text-left p-6">
            {fields.length === 0 ? (
              // Empty State Layout when all entries are removed
              <div className="flex flex-col items-center justify-center py-6 px-4 border border-dashed border-border rounded-xl text-center select-none bg-surface-secondary">
                <Typography className="text-muted text-xs font-semibold mb-4 max-w-sm leading-relaxed text-center">
                  No education history added yet. Share your academic background
                  by appending education rows below.
                </Typography>
                <Button
                  className="rounded-xl justify-center text-center items-center text-xs"
                  onPress={() =>
                    append({
                      label: "School / University",
                      school: "",
                      period: null,
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
                    showRemove={true} // Allow deleting even when only 1 item exists
                    errors={errors}
                    control={control}
                    setValue={setValue}
                  />
                ))}
              </div>
            )}

            {/* Append Entries Trigger Button (Visible when fields are present) */}
            {fields.length > 0 && (
              <div className="flex select-none">
                <Button
                  className="rounded-xl mt-4 justify-center text-center items-center text-xs"
                  onPress={() =>
                    append({
                      label: "School / University",
                      school: "",
                      period: null,
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

        {/* Sticky Actions Bar */}
        <UnsavedChangesBar
          message="You have unsaved personal info changes."
          onReset={handleReset}
        />
      </form>
    </FormProvider>
  );
};

export default PersonalInfoTab;
