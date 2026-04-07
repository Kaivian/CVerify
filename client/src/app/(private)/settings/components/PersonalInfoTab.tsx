"use client";

import React, { useEffect } from "react";
import { useForm, FormProvider, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { parseDate } from "@internationalized/date";
import {
  UnsavedChangesBar,
  isDeepEqual,
} from "@/components/ui/unsaved-changes-bar";
import { personalInfoSchema, type PersonalInfoFormValues } from "./types";
import { EducationSection } from "./EducationSection";
import { AcademicAchievementsSection } from "./AcademicAchievementsSection";

interface PersonalInfoTabProps {
  onDirtyChange: (isDirty: boolean) => void;
  onSaveSuccess: () => void;
}

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
          gpa: 3.8,
          gpaScale: 4.0,
        },
      ],
      achievements: [], // Clean empty state for production purity
    },
    mode: "onChange",
  });

  const { control, handleSubmit, reset } = methods;

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

      console.log("Submitted payload:", data);

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
        {/* Modular Education Section with GPA inputs */}
        <EducationSection />

        {/* Modular Academic Achievements Section with Dropzone evidence upload */}
        <AcademicAchievementsSection />

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
