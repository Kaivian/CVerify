"use client";

import React, { useEffect } from "react";
import { useForm, FormProvider, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card } from "@/components/ui/card";
import { SelectDropdown } from "@/components/ui/select-dropdown";
import { SettingsSection } from "./SettingsSection";
import { Typography, Switch, Checkbox, toast, Spinner } from "@heroui/react";
import {
  UnsavedChangesBar,
  isDeepEqual,
} from "@/components/ui/unsaved-changes-bar";
import { useCareerPreferences } from "@/hooks/use-career-preferences";
import { type UpdateCareerPreferenceRequest } from "@/types/profile.types";
import { useProfileStore } from "@/stores/use-profile-store";

// 1. Zod career schema definition
const careerSchema = z.object({
  availableForHire: z.boolean(),
  employmentPreferences: z
    .array(z.string())
    .min(1, "Select at least one employment preference"),
  preferredLanguage: z.enum(["en", "vi", "ja", "ko", "zh"]),
  version: z.number(),
});

type CareerFormValues = z.infer<typeof careerSchema>;

interface CareerTabProps {
  onDirtyChange: (isDirty: boolean) => void;
  onSaveSuccess: () => void;
}

export const CareerTab: React.FC<CareerTabProps> = ({
  onDirtyChange,
  onSaveSuccess,
}) => {
  const { career, isLoading, updateCareer } = useCareerPreferences();

  const methods = useForm<CareerFormValues>({
    resolver: zodResolver(careerSchema),
    defaultValues: {
      availableForHire: true,
      employmentPreferences: [],
      preferredLanguage: "en",
      version: 0,
    },
    mode: "onChange",
  });

  const {
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = methods;

  const currentValues = useWatch({ control: methods.control });

  // Reset form when database preferences finish loading
  useEffect(() => {
    if (career && !methods.formState.isDirty) {
      reset({
        availableForHire: career.availableForHire,
        employmentPreferences: career.employmentPreferences || [],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        preferredLanguage: (career.preferredLanguage as any) || "en",
        version: career.version || 0,
      });
    }
  }, [career, reset, methods.formState.isDirty]);

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

  const handleFormSubmit = async (data: CareerFormValues) => {
    try {
      const request: UpdateCareerPreferenceRequest = {
        availableForHire: data.availableForHire,
        preferredLanguage: data.preferredLanguage,
        jobTitlePreferences: career?.jobTitlePreferences || null,
        salaryExpectations: career?.salaryExpectations || null,
        remotePreference: career?.remotePreference || null,
        openToWorkStatus: career?.openToWorkStatus || null,
        skills: career?.skills || [],
        preferredLocations: career?.preferredLocations || [],
        employmentPreferences: data.employmentPreferences,
        version:
          useProfileStore.getState().career?.version ||
          data.version ||
          career?.version ||
          0,
      };

      const updated = await updateCareer(request);

      reset({
        ...data,
        version: updated.version,
      });
      onSaveSuccess();
    } catch (error: unknown) {
      console.error("Failed to save career preferences:", error);
      const axiosError = error as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      const errMsg =
        axiosError.response?.data?.message ||
        axiosError.message ||
        "Failed to save career preferences.";
      toast.danger(errMsg);
    }
  };

  if (isLoading && !career) {
    return (
      <div className="flex items-center justify-center py-20 w-full h-full">
        <Spinner size="lg" color="accent" />
      </div>
    );
  }

  const employmentOptions = [
    { value: "full_time", label: "Full-time" },
    { value: "part_time", label: "Part-time" },
    { value: "contract", label: "Contract" },
    { value: "freelance", label: "Freelance" },
    { value: "internship", label: "Internship" },
  ];

  const languageOptions = [
    { value: "en", label: "English" },
    { value: "vi", label: "Vietnamese" },
    { value: "ja", label: "Japanese" },
    { value: "ko", label: "Korean" },
    { value: "zh", label: "Chinese" },
  ];

  const handleCheckboxChange = (value: string, isSelected: boolean) => {
    const current = currentValues.employmentPreferences || [];
    let updated;
    if (isSelected) {
      updated = [...current, value];
    } else {
      updated = current.filter((v) => v !== value);
    }
    setValue("employmentPreferences", updated, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-10">
        <input type="hidden" {...methods.register("version")} />
        {/* Hiring preferences section */}
        <SettingsSection
          title="Hiring Preferences"
          description="Signal to companies, recruiters, and the CVerify network if you are currently open to new job contracts."
        >
          <Card className="flex items-center justify-between gap-6 py-6 text-left select-none">
            <div className="flex flex-col gap-0.5">
              <Typography
                type="body-sm"
                className="font-bold text-foreground font-outfit"
              >
                Available for Hire
              </Typography>
              <Typography type="body-xs" className="text-muted max-w-md">
                When active, your public developer profile card will display a
                vibrant “Open to Work” badge to recruiters.
              </Typography>
            </div>
            <Switch
              isSelected={currentValues.availableForHire ?? true}
              onChange={(isSelected: boolean) => {
                setValue("availableForHire", isSelected, { shouldDirty: true });
              }}
              aria-label="Available for hire toggle"
              className="cursor-pointer"
            >
              {({ isSelected }) => (
                <Switch.Control
                  className={`w-11 h-6 rounded-full relative flex items-center transition-colors duration-200 ${isSelected ? "bg-success" : "bg-separator"}`}
                >
                  <Switch.Thumb
                    className={`w-4.5 h-4.5 bg-foreground rounded-full absolute transition-all duration-200 ${isSelected ? "left-[22px]" : "left-0.5"}`}
                  />
                </Switch.Control>
              )}
            </Switch>
          </Card>
        </SettingsSection>

        {/* Employment Preferences section */}
        <SettingsSection
          title="Employment Arrangements"
          description="Select your preferred job models. You can choose multiple options to maximize recruiter relevance."
        >
          <Card className="flex flex-col gap-4 text-left">
            <Typography
              type="body-sm"
              className="font-bold text-foreground font-outfit mb-1 select-none"
            >
              Preferred Arrangements
            </Typography>

            <div className="flex flex-col gap-3">
              {employmentOptions.map((option) => {
                const isSelected = (
                  currentValues.employmentPreferences || []
                ).includes(option.value);
                return (
                  <label
                    key={option.value}
                    className="flex items-center gap-3 cursor-pointer select-none text-xs font-semibold py-1 group"
                  >
                    <Checkbox
                      isSelected={isSelected}
                      onChange={(checked: boolean) =>
                        handleCheckboxChange(option.value, checked)
                      }
                      aria-label={option.label}
                      className="cursor-pointer"
                    >
                      <Checkbox.Control className="w-4 h-4 rounded border border-field-border flex items-center justify-center bg-field group-data-[selected=true]:bg-accent group-data-[selected=true]:border-accent transition-all shrink-0 focus-visible:ring-2 focus-visible:ring-focus">
                        <Checkbox.Indicator className="text-accent-foreground flex items-center justify-center">
                          <svg
                            className="w-2.5 h-2.5 fill-none stroke-current stroke-3"
                            viewBox="0 0 24 24"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </Checkbox.Indicator>
                      </Checkbox.Control>
                    </Checkbox>
                    <span className="text-foreground/90 font-semibold">
                      {option.label}
                    </span>
                  </label>
                );
              })}
            </div>

            {errors.employmentPreferences && (
              <Typography
                type="body-xs"
                className="text-danger pl-1 font-semibold block"
                role="alert"
              >
                {errors.employmentPreferences.message}
              </Typography>
            )}
          </Card>
        </SettingsSection>

        {/* Localization preferences */}
        <SettingsSection
          title="Localization Settings"
          description="Choose your primary spoken language for profile indexing and system notifications."
        >
          <Card className="text-left gap-4 flex flex-col">
            <div className="flex flex-col gap-1.5 w-full md:max-w-md">
              <SelectDropdown
                label="Preferred Spoken Language"
                value={currentValues.preferredLanguage || "en"}
                onChange={(val: string) =>
                  setValue(
                    "preferredLanguage",
                    val as "en" | "vi" | "ja" | "ko" | "zh",
                    { shouldDirty: true },
                  )
                }
                options={languageOptions}
                placeholder="Select language"
              />
            </div>
          </Card>
        </SettingsSection>

        {/* Sticky Actions Bar */}
        <UnsavedChangesBar
          message="You have unsaved career setting changes."
          onReset={handleReset}
        />
      </form>
    </FormProvider>
  );
};

export default CareerTab;
