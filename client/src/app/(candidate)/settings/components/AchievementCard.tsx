import React from "react";
import { useFormContext, useWatch, Controller } from "react-hook-form";
import { parseDate } from "@internationalized/date";
import {
  Calendar,
  DatePicker,
  DateField,
  Input,
  TextArea,
  FieldError,
  Label,
  Button,
} from "@heroui/react";
import { Trash2, Award } from "lucide-react";
import { UploadDropzone } from "./UploadDropzone";
import type { PersonalInfoFormValues } from "./types";

interface AchievementCardProps {
  index: number;
  remove: (index: number) => void;
}

export const AchievementCard: React.FC<AchievementCardProps> = ({
  index,
  remove,
}) => {
  const {
    control,
    setValue,
    formState: { errors },
  } = useFormContext<PersonalInfoFormValues>();

  // Watch the issueDate value locally to parse and pass to the DatePicker
  const issueDateString =
    useWatch({
      control,
      name: `achievements.${index}.issueDate`,
    }) || "";

  let issueDateValue = null;
  if (issueDateString) {
    try {
      issueDateValue = parseDate(issueDateString);
    } catch (e) {
      console.error("Failed to parse issueDate:", e);
    }
  }

  // Watch title for a premium dynamic header
  const titleValue =
    useWatch({
      control,
      name: `achievements.${index}.title`,
    }) || "New Achievement";

  return (
    <div className="relative border border-border/60 bg-surface-secondary/15 rounded-2xl p-5 sm:p-6 text-left flex flex-col gap-6 transition-all duration-300 hover:border-border">
      {/* Card Header with Title and Delete action */}
      <div className="flex items-center justify-between border-b border-border/40 pb-3 select-none">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
            <Award className="size-4" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-foreground">
            {titleValue}
          </span>
        </div>
        <Button
          isIconOnly
          variant="danger-soft"
          className="h-8 w-8 min-w-8 rounded-xl"
          onPress={() => remove(index)}
          aria-label={`Remove achievement: ${titleValue}`}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      {/* Main Grid Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Title */}
        <div className="flex flex-col gap-2">
          <Label htmlFor={`achievement-title-${index}`}>Achievement Title</Label>
          <Controller
            control={control}
            name={`achievements.${index}.title`}
            render={({ field: { value, onChange } }) => (
              <Input
                id={`achievement-title-${index}`}
                aria-label="Achievement Title"
                placeholder="e.g. AWS Certified Solutions Architect"
                value={value || ""}
                onChange={onChange}
              />
            )}
          />
          {errors.achievements?.[index]?.title && (
            <FieldError className="text-danger text-xs mt-1 block">
              {errors.achievements[index]?.title?.message}
            </FieldError>
          )}
        </div>

        {/* Issuer / Organization */}
        <div className="flex flex-col gap-2">
          <Label htmlFor={`achievement-issuer-${index}`}>
            Issuer / Organization
          </Label>
          <Controller
            control={control}
            name={`achievements.${index}.issuer`}
            render={({ field: { value, onChange } }) => (
              <Input
                id={`achievement-issuer-${index}`}
                aria-label="Issuer / Organization"
                placeholder="e.g. Amazon Web Services"
                value={value || ""}
                onChange={onChange}
              />
            )}
          />
          {errors.achievements?.[index]?.issuer && (
            <FieldError className="text-danger text-xs mt-1 block">
              {errors.achievements[index]?.issuer?.message}
            </FieldError>
          )}
        </div>

        {/* Issue Date Picker */}
        <div className="flex flex-col gap-2">
          <DatePicker
            name={`achievements.${index}.issueDate`}
            value={issueDateValue}
            onChange={(val) =>
              setValue(`achievements.${index}.issueDate`, val ? val.toString() : "", {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
            className="flex flex-col gap-1 w-full"
            isInvalid={!!errors.achievements?.[index]?.issueDate}
          >
            <Label>Issue Date</Label>
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
              <Calendar aria-label="Issue Date">
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
          {errors.achievements?.[index]?.issueDate && (
            <FieldError className="text-danger text-xs mt-1 block">
              {errors.achievements[index]?.issueDate?.message}
            </FieldError>
          )}
        </div>

        {/* Credential URL (Optional) */}
        <div className="flex flex-col gap-2">
          <Label htmlFor={`achievement-url-${index}`}>
            Credential URL (Optional)
          </Label>
          <Controller
            control={control}
            name={`achievements.${index}.credentialUrl`}
            render={({ field: { value, onChange } }) => (
              <Input
                id={`achievement-url-${index}`}
                aria-label="Credential URL"
                placeholder="e.g. https://credly.com/cert/..."
                value={value || ""}
                onChange={onChange}
              />
            )}
          />
          {errors.achievements?.[index]?.credentialUrl && (
            <FieldError className="text-danger text-xs mt-1 block">
              {errors.achievements[index]?.credentialUrl?.message}
            </FieldError>
          )}
        </div>
      </div>

      {/* Description TextArea */}
      <div className="flex flex-col gap-2">
        <Label htmlFor={`achievement-description-${index}`}>Description</Label>
        <Controller
          control={control}
          name={`achievements.${index}.description`}
          render={({ field: { value, onChange } }) => (
            <TextArea
              id={`achievement-description-${index}`}
              aria-label="Description"
              placeholder="Provide a brief summary of what this achievement entails..."
              value={value || ""}
              onChange={onChange}
              rows={3}
            />
          )}
        />
        {errors.achievements?.[index]?.description && (
          <FieldError className="text-danger text-xs mt-1 block">
            {errors.achievements[index]?.description?.message}
          </FieldError>
        )}
      </div>

      {/* Modular Upload Dropzone component for Evidence */}
      <div className="border-t border-border/40 pt-4 mt-1">
        <UploadDropzone achievementIndex={index} />
      </div>
    </div>
  );
};
