"use client";

import React, { useEffect } from "react";
import { useForm, FormProvider, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { parseDate } from "@internationalized/date";
import { toast, Skeleton } from "@heroui/react";
import { Card } from "@/components/ui/card";
import { SettingsSection } from "./SettingsSection";
import {
  UnsavedChangesBar,
  isDeepEqual,
} from "@/components/ui/unsaved-changes-bar";
import { personalInfoSchema, type PersonalInfoFormValues } from "./types";
import { EducationSection } from "./EducationSection";
import { AcademicAchievementsSection } from "./AcademicAchievementsSection";
import { useEducation } from "@/hooks/use-education";
import { useAchievements } from "@/hooks/use-achievements";
import {
  type EducationEntryRequest,
  type AcademicAchievementRequest,
  type EducationEntryResponse,
  type AcademicAchievementResponse,
} from "@/types/profile.types";

// Map Education Entry Response to Form representation
const mapEducationFromDb = (ee: EducationEntryResponse) => ({
  id: ee.id,
  label: ee.label,
  school: ee.schoolName,
  period: {
    start: ee.startDate ? parseDate(ee.startDate.split("T")[0]) : null,
    end: ee.endDate ? parseDate(ee.endDate.split("T")[0]) : null,
  },
  gpa: ee.gpa,
  gpaScale: ee.gpaScale,
});

// Map Academic Achievement Response to Form representation
const mapAchievementFromDb = (aa: AcademicAchievementResponse) => ({
  id: aa.id,
  title: aa.title,
  issuer: aa.issuer,
  issueDate: aa.issueDate ? aa.issueDate.split("T")[0] : "",
  description: aa.description,
  credentialUrl: aa.credentialUrl || "",
  evidence: aa.attachment
    ? [
        {
          id: aa.attachment.id,
          name: aa.attachment.fileName,
          size: aa.attachment.fileSize,
          type: aa.attachment.fileType,
          progress: 100,
          status: "success" as const,
          url: aa.attachment.fileUrl,
        },
      ]
    : [],
});

interface PersonalInfoTabProps {
  onDirtyChange: (isDirty: boolean) => void;
  onSaveSuccess: () => void;
}

export const PersonalInfoTab: React.FC<PersonalInfoTabProps> = ({
  onDirtyChange,
  onSaveSuccess,
}) => {
  const {
    education,
    isLoading: isEduLoading,
    isFetched: isEduFetched,
    addEducation,
    updateEducation,
    deleteEducation,
    reorderEducation,
  } = useEducation();

  const {
    achievements,
    isLoading: isAchLoading,
    isFetched: isAchFetched,
    addAchievement,
    updateAchievement,
    deleteAchievement,
    reorderAchievements,
  } = useAchievements();

  // Removed temporary diagnostics render/mount tracking

  const methods = useForm<PersonalInfoFormValues>({
    resolver: zodResolver(personalInfoSchema),
    defaultValues: {
      education: [],
      achievements: [],
    },
    mode: "onChange",
  });

  const { control, handleSubmit, reset } = methods;

  const currentValues = useWatch({ control });

  // Reset form when education/achievements database lists finish loading
  useEffect(() => {
    if (!isEduLoading && !isAchLoading && !methods.formState.isDirty) {
      reset({
        education: education.map(mapEducationFromDb),
        achievements: achievements.map(mapAchievementFromDb),
      });
    }
  }, [education, achievements, isEduLoading, isAchLoading, reset, methods.formState.isDirty]);

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
      // 1. Sync Education list with backend via list diffing
      const dbEduIds = education.map((e) => e.id);
      const formEdu = data.education || [];
      const formEduIds = formEdu.map((e) => e.id).filter(Boolean) as string[];

      // Delete removed education entries
      const eduToDelete = dbEduIds.filter((id) => !formEduIds.includes(id));
      for (const id of eduToDelete) {
        await deleteEducation(id);
      }

      // Add or update education entries
      const updatedEducation = [...formEdu];
      const finalEduIds: string[] = [];

      for (let i = 0; i < formEdu.length; i++) {
        const item = formEdu[i];
        const request: EducationEntryRequest = {
          label: item.label,
          schoolName: item.school,
          degree: null,
          major: null,
          gpa: item.gpa ?? null,
          gpaScale: item.gpaScale ?? null,
          description: null,
          startDate: item.period?.start ? new Date(item.period.start.toString()).toISOString() : null,
          endDate: item.period?.end ? new Date(item.period.end.toString()).toISOString() : null,
          isCurrentlyStudying: false,
        };

        if (item.id && dbEduIds.includes(item.id)) {
          await updateEducation(item.id, request);
          finalEduIds.push(item.id);
        } else {
          const added = await addEducation(request);
          updatedEducation[i].id = added.id;
          finalEduIds.push(added.id);
        }
      }

      // Reorder if items exist and order changed
      if (finalEduIds.length > 0) {
        await reorderEducation(finalEduIds);
      }

      // 2. Sync Achievements list with backend via list diffing
      const dbAchIds = achievements.map((a) => a.id);
      const formAch = data.achievements || [];
      const formAchIds = formAch.map((a) => a.id).filter(Boolean) as string[];

      // Delete removed achievements
      const achToDelete = dbAchIds.filter((id) => !formAchIds.includes(id));
      for (const id of achToDelete) {
        await deleteAchievement(id);
      }

      // Add or update achievements
      const updatedAchievements = [...formAch];
      const finalAchIds: string[] = [];

      for (let i = 0; i < formAch.length; i++) {
        const item = formAch[i];
        // Take the first valid uploaded evidence file
        const attachmentId = item.evidence?.find((e) => e.status === "success")?.id || null;

        const request: AcademicAchievementRequest = {
          title: item.title,
          issuer: item.issuer,
          issueDate: item.issueDate ? new Date(item.issueDate).toISOString() : new Date().toISOString(),
          description: item.description,
          credentialUrl: item.credentialUrl || null,
          attachmentId,
        };

        if (item.id && dbAchIds.includes(item.id)) {
          await updateAchievement(item.id, request);
          finalAchIds.push(item.id);
        } else {
          const added = await addAchievement(request);
          updatedAchievements[i].id = added.id;
          finalAchIds.push(added.id);
        }
      }

      // Reorder achievements
      if (finalAchIds.length > 0) {
        await reorderAchievements(finalAchIds);
      }

      // Reset RHF internal state with final matched/created items to clear isDirty
      reset({
        education: updatedEducation,
        achievements: updatedAchievements,
      });

      onSaveSuccess();
    } catch (error: unknown) {
      console.error("Failed to save personal settings:", error);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = error as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const errMsg = (err as any).response?.data?.message || (err as any).message || "Failed to save personal information.";
      toast.danger(errMsg);
    }
  };

  const isFirstLoad = (isEduLoading && !isEduFetched) || (isAchLoading && !isAchFetched);

  if (isFirstLoad) {
    return (
      <div className="space-y-6">
        {/* Education Section Skeleton */}
        <SettingsSection title="Education">
          <Card className="flex flex-col gap-6 p-6">
            <div className="flex flex-col gap-5">
              <div className="relative border border-border/60 bg-surface-secondary/10 rounded-2xl p-5 sm:p-6 flex flex-col gap-5">
                <div className="grid grid-cols-1 md:grid-cols-[1fr_275px_130px_auto] gap-4 items-end">
                  <div className="flex flex-col gap-2 w-full">
                    <Skeleton className="h-4 w-28 rounded animate-pulse" />
                    <Skeleton className="h-10 w-full rounded-xl animate-pulse" />
                  </div>
                  <div className="flex flex-col gap-2 w-full">
                    <Skeleton className="h-4 w-24 rounded animate-pulse" />
                    <Skeleton className="h-10 w-full rounded-xl animate-pulse" />
                  </div>
                  <div className="flex flex-col gap-2 w-full">
                    <Skeleton className="h-4 w-12 rounded animate-pulse" />
                    <Skeleton className="h-10 w-full rounded-xl animate-pulse" />
                  </div>
                  <Skeleton className="h-9 w-9 rounded-xl animate-pulse shrink-0" />
                </div>
              </div>
            </div>
            <div className="flex border-t border-border/40 pt-4 mt-2">
              <Skeleton className="h-8 w-28 rounded-xl animate-pulse" />
            </div>
          </Card>
        </SettingsSection>

        {/* Modular Academic Achievements Section Skeleton */}
        <SettingsSection title="Academic Achievements">
          <Card className="flex flex-col gap-6 p-6">
            <div className="flex flex-col gap-6">
              <div className="relative border border-border/60 bg-surface-secondary/15 rounded-2xl p-5 sm:p-6 flex flex-col gap-6">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border/40 pb-3">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-7 w-7 rounded-lg animate-pulse" />
                    <Skeleton className="h-4 w-28 rounded animate-pulse" />
                  </div>
                  <Skeleton className="h-8 w-8 rounded-xl animate-pulse" />
                </div>
                {/* Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="flex flex-col gap-2">
                    <Skeleton className="h-4 w-24 rounded animate-pulse" />
                    <Skeleton className="h-10 w-full rounded-xl animate-pulse" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Skeleton className="h-4 w-24 rounded animate-pulse" />
                    <Skeleton className="h-10 w-full rounded-xl animate-pulse" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Skeleton className="h-4 w-20 rounded animate-pulse" />
                    <Skeleton className="h-10 w-full rounded-xl animate-pulse" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Skeleton className="h-4 w-24 rounded animate-pulse" />
                    <Skeleton className="h-10 w-full rounded-xl animate-pulse" />
                  </div>
                </div>
                {/* Description */}
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-20 rounded animate-pulse" />
                  <Skeleton className="h-20 w-full rounded-xl animate-pulse" />
                </div>
                {/* Evidence dropzone */}
                <div className="border-t border-border/40 pt-4 mt-1">
                  <Skeleton className="h-24 w-full rounded-xl animate-pulse" />
                </div>
              </div>
            </div>
            <div className="flex border-t border-border/40 pt-4 mt-2">
              <Skeleton className="h-8 w-32 rounded-xl animate-pulse" />
            </div>
          </Card>
        </SettingsSection>
      </div>
    );
  }

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
