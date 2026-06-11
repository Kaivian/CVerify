"use client";

import React, { useEffect, useState } from "react";
import { useForm, FormProvider, useWatch, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card } from "@/components/ui/card";
import { SelectDropdown } from "@/components/ui/select-dropdown";
import { SettingsSection } from "./SettingsSection";
import { TagChipMultiSelect } from "./TagChipMultiSelect";
import { PreferenceCard } from "./PreferenceCard";
import {
  Typography,
  Switch,
  Checkbox,
  toast,
  Spinner,
  Input,
  InputGroup,
  TextArea,
  Label,
  FieldError,
  Button,
  Chip,
} from "@heroui/react";
import { useCareerPreferences } from "@/hooks/use-career-preferences";
import { type UpdateCareerPreferenceRequest } from "@/types/profile.types";
import { useProfileStore } from "@/stores/use-profile-store";
import {
  isDeepEqual,
  UnsavedChangesBar,
} from "@/components/ui/unsaved-changes-bar";

// Taxonomy options
const ROLES_OPTIONS = [
  "Frontend Engineer",
  "Backend Engineer",
  "Fullstack Engineer",
  "DevOps Engineer",
  "Data Engineer",
  "AI/ML Engineer",
  "Mobile Engineer",
  "QA Engineer",
  "Security Engineer",
  "System Architect",
  "Tech Lead",
  "Engineering Manager",
];

const COMPANY_STAGE_OPTIONS = [
  "Bootstrap",
  "Seed",
  "Series A",
  "Series B",
  "Scaleup",
  "Enterprise",
];

const INDUSTRIES_OPTIONS = [
  "Fintech",
  "Edtech",
  "Healthtech",
  "E-commerce",
  "AI/ML",
  "SaaS",
  "Blockchain",
  "Cybersecurity",
  "GameDev",
  "DevOps",
];

const WORK_ENVIRONMENT_OPTIONS = [
  "Professional environment",
  "Supportive workplace",
  "Growth-oriented environment",
  "Dynamic and fast-paced environment",
  "Creative environment",
  "International environment",
  "Remote-friendly environment",
  "Collaborative workplace",
  "Structured and process-driven workplace",
  "Mentorship-focused environment",
];

const WORK_STYLE_OPTIONS = [
  "Team-oriented",
  "Independent",
  "Responsible",
  "Detail-oriented",
  "Problem-solving focused",
  "Result-oriented",
  "Creative",
  "Self-learning",
  "Feedback-oriented",
  "Organized",
  "Proactive",
  "Flexible",
];

const COMPANY_VALUES_OPTIONS = [
  "Employee growth",
  "Transparency",
  "Innovation",
  "Teamwork",
  "Professionalism",
  "Work-life balance",
  "Customer focus",
  "Product quality",
  "Continuous improvement",
  "Respectful culture",
  "Knowledge sharing",
];

const CURRENCY_OPTIONS = [
  { value: "VND", label: "VND" },
  { value: "USD", label: "USD" },
];

const SALARY_TYPE_OPTIONS = [
  { value: "Monthly", label: "Monthly" },
  { value: "Hourly", label: "Hourly" },
  { value: "Project-based", label: "Project-based" },
];

const WORK_STATUS_OPTIONS = [
  { value: "active", label: "Active Search" },
  { value: "casual", label: "Casual Browsing" },
  { value: "closed", label: "Not Open to Work" },
];

const REMOTE_PREFERENCE_OPTIONS = [
  { value: "remote", label: "Remote Only" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "Onsite Only" },
  { value: "any", label: "Open to Any" },
];

const LEADERSHIP_TRACK_OPTIONS = [
  { value: "ic", label: "Individual Contributor" },
  { value: "management", label: "Engineering Management" },
  { value: "undecided", label: "Undecided" },
];

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


const salarySchema = z.preprocess((val) => {
  if (val === "" || val === null || val === undefined) return null;
  const num = Number(val);
  return isNaN(num) ? null : num;
}, z.number().nonnegative().nullable().optional());

// Form validation schema
const careerSchema = z
  .object({
    availableForHire: z.boolean(),
    openToWorkStatus: z.string(),
    preferredLanguage: z.enum(["en", "vi", "ja", "ko", "zh"]),
    remotePreference: z.enum(["remote", "hybrid", "onsite", "any"]),
    openToRelocation: z.boolean(),
    preferredLocations: z.array(z.string()),
    employmentPreferences: z
      .array(z.string())
      .min(1, "Select at least one employment preference"),
    expectedSalaryMin: salarySchema,
    expectedSalaryMax: salarySchema,
    expectedSalaryCurrency: z.enum(["VND", "USD"]),
    expectedSalaryType: z.enum(["Monthly", "Hourly", "Project-based"]),
    expectedSalaryNegotiable: z.boolean(),
    isExpectedSalaryVisible: z.boolean(),
    desiredJobPositions: z.array(z.string()),
    targetSkills: z.array(z.string()),
    leadershipTrack: z.string(),
    companyStagePreferences: z.array(z.string()),
    preferredIndustries: z.array(z.string()),
    preferredWorkEnvironments: z.array(z.string()),
    workStyles: z.array(z.string()),
    companyValues: z.array(z.string()),
    workPreferenceNotes: z
      .string()
      .max(500, "Notes must be under 500 characters")
      .nullable()
      .optional()
      .or(z.literal("")),
    version: z.number(),
  })
  .refine(
    (data) => {
      if (
        data.expectedSalaryMin !== null &&
        data.expectedSalaryMin !== undefined &&
        data.expectedSalaryMax !== null &&
        data.expectedSalaryMax !== undefined
      ) {
        return data.expectedSalaryMax >= data.expectedSalaryMin;
      }
      return true;
    },
    {
      message: "Max salary must be greater than or equal to min salary.",
      path: ["expectedSalaryMax"],
    }
  )
  .refine(
    (data) => {
      if (data.isExpectedSalaryVisible && !data.expectedSalaryNegotiable) {
        const hasMin =
          data.expectedSalaryMin !== null && data.expectedSalaryMin !== undefined;
        const hasMax =
          data.expectedSalaryMax !== null && data.expectedSalaryMax !== undefined;
        return hasMin || hasMax;
      }
      return true;
    },
    {
      message:
        "Please enter expected salary or mark it as negotiable before showing it publicly.",
      path: ["isExpectedSalaryVisible"],
    }
  );

type CareerFormValues = z.infer<typeof careerSchema>;

interface CareerTabProps {
  onDirtyChange: (isDirty: boolean) => void;
  onSaveSuccess: () => void;
}

export const CareerTab: React.FC<CareerTabProps> = ({
  onDirtyChange,
  onSaveSuccess,
}) => {
  const {
    career,
    isLoading,
    isUpdating,
    isAcceptingSuggestions,
    updateCareer,
    acceptAiSuggestions,
  } = useCareerPreferences();

  // Input states for custom tags
  const [newSkill, setNewSkill] = useState("");
  const [newLocation, setNewLocation] = useState("");

  const methods = useForm<CareerFormValues>({
    resolver: zodResolver(careerSchema) as any,
    defaultValues: {
      availableForHire: true,
      openToWorkStatus: "casual",
      preferredLanguage: "en",
      remotePreference: "any",
      openToRelocation: false,
      preferredLocations: [],
      employmentPreferences: ["full_time"],
      expectedSalaryMin: null,
      expectedSalaryMax: null,
      expectedSalaryCurrency: "USD",
      expectedSalaryType: "Monthly",
      expectedSalaryNegotiable: false,
      isExpectedSalaryVisible: false,
      desiredJobPositions: [],
      targetSkills: [],
      leadershipTrack: "undecided",
      companyStagePreferences: [],
      preferredIndustries: [],
      preferredWorkEnvironments: [],
      workStyles: [],
      companyValues: [],
      workPreferenceNotes: "",
      version: 0,
    },
    mode: "onChange",
  });

  const {
    setValue,
    control,
    reset,
    formState: { errors },
  } = methods;

  const currentValues = useWatch({ control });

  const isVND = currentValues.expectedSalaryCurrency === "VND";
  const currencySymbol = isVND ? "₫" : "$";
  const currencyCode = isVND ? "VND" : "USD";
  const salaryPlaceholderMin = isVND ? "e.g. 50,000,000" : "e.g. 3000";
  const salaryPlaceholderMax = isVND ? "e.g. 100,000,000" : "e.g. 5000";

  const hasChanges = !isDeepEqual(
    currentValues,
    methods.formState.defaultValues
  );

  // Load backend data into React Hook Form
  useEffect(() => {
    if (career && !methods.formState.isDirty) {
      const declared = career.declaredPreferences;
      reset({
        availableForHire: declared.availableForHire,
        openToWorkStatus: declared.openToWorkStatus || "casual",
        preferredLanguage: (declared.preferredLanguage as any) || "en",
        remotePreference: (declared.remotePreference as any) || "any",
        openToRelocation: declared.openToRelocation ?? false,
        preferredLocations: declared.preferredLocations || [],
        employmentPreferences: declared.employmentPreferences || [],
        expectedSalaryMin: declared.expectedSalaryMin ?? null,
        expectedSalaryMax: declared.expectedSalaryMax ?? null,
        expectedSalaryCurrency: (declared.expectedSalaryCurrency as any) || "USD",
        expectedSalaryType: (declared.expectedSalaryType as any) || "Monthly",
        expectedSalaryNegotiable: declared.expectedSalaryNegotiable ?? false,
        isExpectedSalaryVisible: declared.isExpectedSalaryVisible ?? false,
        desiredJobPositions: declared.desiredJobPositions || [],
        targetSkills: declared.targetSkills || [],
        leadershipTrack: declared.leadershipTrack || "undecided",
        companyStagePreferences: declared.companyStagePreferences || [],
        preferredIndustries: declared.preferredIndustries || [],
        preferredWorkEnvironments: declared.preferredWorkEnvironments || [],
        workStyles: declared.workStyles || [],
        companyValues: declared.companyValues || [],
        workPreferenceNotes: declared.workPreferenceNotes || "",
        version: declared.version || 0,
      });
    }
  }, [career, reset, methods.formState.isDirty]);

  // Track dirty changes to inform parent page navigation guard
  useEffect(() => {
    onDirtyChange(hasChanges);
  }, [hasChanges, onDirtyChange]);

  const handleReset = () => {
    if (career) {
      const declared = career.declaredPreferences;
      reset({
        availableForHire: declared.availableForHire,
        openToWorkStatus: declared.openToWorkStatus || "casual",
        preferredLanguage: (declared.preferredLanguage as any) || "en",
        remotePreference: (declared.remotePreference as any) || "any",
        openToRelocation: declared.openToRelocation ?? false,
        preferredLocations: declared.preferredLocations || [],
        employmentPreferences: declared.employmentPreferences || [],
        expectedSalaryMin: declared.expectedSalaryMin ?? null,
        expectedSalaryMax: declared.expectedSalaryMax ?? null,
        expectedSalaryCurrency: (declared.expectedSalaryCurrency as any) || "USD",
        expectedSalaryType: (declared.expectedSalaryType as any) || "Monthly",
        expectedSalaryNegotiable: declared.expectedSalaryNegotiable ?? false,
        isExpectedSalaryVisible: declared.isExpectedSalaryVisible ?? false,
        desiredJobPositions: declared.desiredJobPositions || [],
        targetSkills: declared.targetSkills || [],
        leadershipTrack: declared.leadershipTrack || "undecided",
        companyStagePreferences: declared.companyStagePreferences || [],
        preferredIndustries: declared.preferredIndustries || [],
        preferredWorkEnvironments: declared.preferredWorkEnvironments || [],
        workStyles: declared.workStyles || [],
        companyValues: declared.companyValues || [],
        workPreferenceNotes: declared.workPreferenceNotes || "",
        version: declared.version || 0,
      });
    } else {
      reset();
    }
  };

  const handleSaveChanges = async () => {
    const isValid = await methods.trigger();
    if (!isValid) {
      console.log("[Save Changes] Validation failed");
      return;
    }

    try {
      const { version, ...restValues } = methods.getValues();
      const request: UpdateCareerPreferenceRequest = {
        ...restValues,
        version:
          useProfileStore.getState().career?.declaredPreferences?.version ??
          career?.declaredPreferences?.version ??
          version ??
          0,
      };

      const updated = await updateCareer(request);
      onSaveSuccess();

      // Reset the form with the new values and updated version to lock them as new default values
      const nextDefaultValues = {
        ...methods.getValues(),
        version: updated.declaredPreferences.version,
      } as CareerFormValues;
      reset(nextDefaultValues);
    } catch (error: unknown) {
      console.error("[Save Changes] Failed to save career preferences:", error);
      const axiosError = error as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      const errMsg =
        axiosError.response?.data?.message ||
        axiosError.message ||
        "Failed to save career settings.";
      toast.danger(errMsg);
    }
  };

  // Accept Recommendations click
  const handleAcceptSuggestions = async () => {
    try {
      await acceptAiSuggestions(true, true);
      toast.success("Successfully merged AI suggestions into your profile preferences!");
    } catch (error: unknown) {
      console.error("Failed to accept recommendations:", error);
      toast.danger("Failed to merge recommendations.");
    }
  };

  // Custom Tag / Location handlers
  const handleAddSkill = () => {
    const trimmed = newSkill.trim();
    if (!trimmed) return;
    const current = currentValues.targetSkills || [];
    if (!current.includes(trimmed)) {
      const updated = [...current, trimmed];
      setValue("targetSkills", updated, { shouldDirty: true });
    }
    setNewSkill("");
  };

  const handleRemoveSkill = (skill: string) => {
    const current = currentValues.targetSkills || [];
    const updated = current.filter((s) => s !== skill);
    setValue("targetSkills", updated, { shouldDirty: true });
  };

  const handleAddLocation = () => {
    const trimmed = newLocation.trim();
    if (!trimmed) return;
    const current = currentValues.preferredLocations || [];
    if (!current.includes(trimmed)) {
      const updated = [...current, trimmed];
      setValue("preferredLocations", updated, { shouldDirty: true });
    }
    setNewLocation("");
  };

  const handleRemoveLocation = (loc: string) => {
    const current = currentValues.preferredLocations || [];
    const updated = current.filter((l) => l !== loc);
    setValue("preferredLocations", updated, { shouldDirty: true });
  };

  const handleCheckboxChange = (value: string, isSelected: boolean) => {
    const current = currentValues.employmentPreferences || [];
    let updated;
    if (isSelected) {
      updated = [...current, value];
    } else {
      updated = current.filter((v) => v !== value);
    }
    setValue("employmentPreferences", updated, { shouldDirty: true });
  };

  if (isLoading && !career) {
    return (
      <div className="flex items-center justify-center py-20 w-full h-full">
        <Spinner size="lg" color="accent" />
      </div>
    );
  }

  if (!career) return null;

  // Recommendations logic
  const inferredRole = career.aiInferredPreferences?.inferredPrimaryRole;
  const userRoles = currentValues.desiredJobPositions || [];
  const suggestedRole =
    inferredRole && !userRoles.some((r) => r.toLowerCase() === inferredRole.toLowerCase())
      ? inferredRole
      : null;

  const inferredSkills = career.aiInferredPreferences?.inferredSkills || [];
  const userSkills = currentValues.targetSkills || [];
  const suggestedSkills = inferredSkills.filter(
    (s) => !userSkills.some((us) => us.toLowerCase() === s.toLowerCase())
  );

  const showSuggestions = !!(suggestedRole || suggestedSkills.length > 0);

  return (
    <FormProvider {...methods}>
      <div className="space-y-8">
        {/* High-level AI Insights & Career Direction Panel */}
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column: AI-Inferred Career Trajectory */}
            <Card className="flex flex-col gap-4 h-full">
              <div className="flex items-center gap-2 border-b border-border/40 pb-3">
                <svg
                  className="w-5 h-5 text-accent"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                <Typography type="body-sm" className="font-bold font-outfit uppercase">
                  AI-Inferred Career Trajectory
                </Typography>
              </div>

              {career.aiInferredPreferences ? (
                <div className="flex flex-col gap-4 flex-1">
                  <div className="flex flex-wrap gap-1.5 mb-1">
                    <Chip size="sm" variant="soft" color="success" className="font-bold text-[9px] uppercase">
                      Repository skill evidence available
                    </Chip>
                    <Chip size="sm" variant="soft" color="success" className="font-bold text-[9px] uppercase">
                      Skills detected from analyzed repositories
                    </Chip>
                    <Chip size="sm" variant="soft" color="default" className="font-bold text-[9px] uppercase">
                      No AI career match score available yet
                    </Chip>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col bg-surface-secondary/10 border border-border/40 p-4 rounded-xl justify-center text-left">
                      <span className="text-[10px] text-muted uppercase font-bold tracking-wider">
                        Primary Role & Seniority
                      </span>
                      <span className="text-sm font-bold mt-1 text-foreground">
                        {career.aiInferredPreferences.inferredSeniority || "Unknown"}{" "}
                        {career.aiInferredPreferences.inferredPrimaryRole || "Not analyzed"}
                      </span>
                    </div>

                    <div className="flex flex-col bg-surface-secondary/10 border border-border/40 p-4 rounded-xl justify-center text-left">
                      <span className="text-[10px] text-muted uppercase font-bold tracking-wider">
                        Market Value Range
                      </span>
                      <span className="text-sm font-bold mt-1 text-foreground">
                        {career.aiInferredPreferences.inferredSalaryMin ? (
                          `${career.aiInferredPreferences.inferredSalaryMin.toLocaleString()} - ${career.aiInferredPreferences.inferredSalaryMax?.toLocaleString()} ${career.aiInferredPreferences.inferredSalaryCurrency}`
                        ) : (
                          "Insufficient data"
                        )}
                      </span>
                    </div>

                    <div className="flex flex-col bg-surface-secondary/10 border border-border/40 p-4 rounded-xl sm:col-span-2 justify-center text-left">
                      <span className="text-[10px] text-muted uppercase font-bold tracking-wider">
                        Inferred Skill Core
                      </span>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {career.aiInferredPreferences.inferredSkills &&
                          career.aiInferredPreferences.inferredSkills.length > 0 ? (
                          career.aiInferredPreferences.inferredSkills.map((s) => (
                            <Chip
                              key={s}
                              size="sm"
                              variant="soft"
                              color="default"
                              className="text-[11px] font-bold"
                            >
                              {s}
                            </Chip>
                          ))
                        ) : (
                          <span className="text-xs text-muted">No skills inferred</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted py-4 flex-1 flex flex-col items-center justify-center gap-2">
                  <span className="font-semibold text-foreground">No repository analysis available yet</span>
                  <span className="text-[11px] text-center max-w-[280px]">
                    Analyze a repository to generate AI-based trust and skill evidence. AI-based score will appear after repository analysis.
                  </span>
                </div>
              )}
            </Card>

            {/* Right Column: Discoverability Score Widget */}
            <Card className="flex flex-col items-center justify-center text-center p-6 gap-4 h-full">
              <div className="relative w-24 h-24">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    className="stroke-separator"
                    strokeWidth="8"
                    fill="transparent"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    className="stroke-accent"
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray={2 * Math.PI * 40}
                    strokeDashoffset={
                      2 * Math.PI * 40 * (1 - (career.readinessReport?.discoverabilityScore ?? 0) / 100)
                    }
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-black font-outfit">
                    {career.readinessReport?.discoverabilityScore ?? 0}%
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1 mt-1">
                <span className="text-[10px] text-muted uppercase font-bold tracking-wider">
                  Discoverability
                </span>
                <Chip
                  size="sm"
                  color={
                    career.readinessReport?.discoverabilityStatus === "High"
                      ? "success"
                      : career.readinessReport?.discoverabilityStatus === "Medium"
                        ? "warning"
                        : "danger"
                  }
                  variant="soft"
                  className="font-extrabold uppercase text-[10px]"
                >
                  {career.readinessReport?.discoverabilityStatus || "Low"}
                </Chip>
              </div>

              {/* Discoverability action items */}
              {career.readinessReport?.actionItems &&
                career.readinessReport.actionItems.length > 0 && (
                  <div className="w-full border-t border-border/40 pt-4 mt-2 flex flex-col gap-2.5 text-left">
                    <span className="text-[9px] text-muted uppercase font-bold tracking-wider">
                      Action Items to Boost Score
                    </span>
                    <div className="flex flex-col gap-2">
                      {career.readinessReport.actionItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex gap-2 items-start bg-surface-secondary/5 p-2 rounded-lg border border-border/20 text-[11px]"
                        >
                          <span className="text-accent font-bold mt-0.5 font-outfit">
                            +{item.impactScore}
                          </span>
                          <span className="text-muted leading-tight">{item.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </Card>
          </div>

          {/* AI Suggestions / Recommendations Alert */}
          {showSuggestions && (
            <Card className="border-warning/40 bg-warning/5 flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-warning"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <Typography
                  type="body-sm"
                  className="font-bold text-warning font-outfit uppercase"
                >
                  AI Preference Recommendations
                </Typography>
              </div>

              <div className="text-xs leading-relaxed text-foreground/80">
                Our AI analysis of your source code has identified matching profiles that are not
                in your manual preferences. Would you like to merge these recommendations?
                <div className="mt-3 flex flex-col gap-2">
                  {suggestedRole && (
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-warning" />
                      <span>
                        Add desired role:{" "}
                        <strong className="text-foreground">{suggestedRole}</strong>
                      </span>
                    </div>
                  )}
                  {suggestedSkills.length > 0 && (
                    <div className="flex items-start gap-2">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-warning mt-1.5" />
                      <span>
                        Add target skills:{" "}
                        <strong className="text-foreground">
                          {suggestedSkills.join(", ")}
                        </strong>
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-1 border-t border-border/20 pt-3">
                <Button
                  size="sm"
                  onPress={handleAcceptSuggestions}
                  isDisabled={isAcceptingSuggestions}
                  className="font-bold text-xs bg-warning text-black cursor-pointer hover:bg-warning/90 border-none flex items-center gap-1.5"
                >
                  {isAcceptingSuggestions && <Spinner size="sm" color="current" />}
                  Accept Recommendations
                </Button>
              </div>
            </Card>
          )}
        </div>

        {/* Section 1: Availability & Search Status */}
        <SettingsSection
          title="Search Status & Roles"
          description="Signal your hire availability and specify the target career positions you are seeking."
        >
          <Card className="flex flex-col gap-6 p-6">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <Typography type="body-sm" className="font-bold text-foreground font-outfit uppercase">
                Availability & Roles
              </Typography>
            </div>

            <div className="flex flex-col gap-6">
              {/* Available for Hire Switch */}
              <div className="flex items-center justify-between gap-6 py-2 select-none">
                <div className="flex flex-col gap-0.5">
                  <Typography type="body-sm" className="font-bold text-foreground font-outfit">
                    Available for Hire
                  </Typography>
                  <Typography type="body-xs" className="text-muted max-w-md">
                    Toggle your visibility to allow recruiters to view your open status badge.
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
                  {({ isSelected: _isSelected }) => (
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                  )}
                </Switch>
              </div>

              {/* Open to Work Status dropdown */}
              <div className="flex flex-col gap-1.5 w-full md:max-w-md text-left">
                <SelectDropdown
                  label="Search Status"
                  value={currentValues.openToWorkStatus || "casual"}
                  onChange={(val: string) => {
                    setValue("openToWorkStatus", val, { shouldDirty: true });
                  }}
                  options={WORK_STATUS_OPTIONS}
                  placeholder="Select status"
                />
              </div>

              {/* Desired Job Positions Chip list */}
              <div className="flex flex-col gap-1.5 text-left">
                <Controller
                  control={control}
                  name="desiredJobPositions"
                  render={({ field: { value, onChange } }) => (
                    <TagChipMultiSelect
                      label="Desired Job Positions"
                      description="Select one or more standardized roles that you are qualified for and wish to target next."
                      options={ROLES_OPTIONS}
                      value={value || []}
                      onChange={onChange}
                      error={errors.desiredJobPositions?.message}
                    />
                  )}
                />
              </div>
            </div>
          </Card>
        </SettingsSection>

        {/* Section 2: Work Arrangements & Mobility */}
        <SettingsSection
          title="Work Arrangements & Mobility"
          description="Define your workplace structure preferences, relocation availability, and geographic locations."
        >
          <Card className="flex flex-col gap-6 p-6">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <Typography type="body-sm" className="font-bold text-foreground font-outfit uppercase">
                Work Models & Arrangements
              </Typography>
            </div>

            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                {/* Remote Preference dropdown */}
                <div className="flex flex-col gap-1.5 w-full text-left">
                  <SelectDropdown
                    label="Work Model Preference"
                    value={currentValues.remotePreference || "any"}
                    onChange={(val: string) => {
                      setValue("remotePreference", val as any, { shouldDirty: true });
                    }}
                    options={REMOTE_PREFERENCE_OPTIONS}
                    placeholder="Select preference"
                  />
                </div>

                {/* Open to Relocation Switch */}
                <div className="flex items-center justify-between gap-6 py-2 select-none border border-border/40 bg-surface-secondary/5 rounded-xl px-4 h-10 w-full">
                  <div className="flex flex-col">
                    <Typography type="body-xs" className="font-bold text-foreground font-outfit">
                      Open to Relocation
                    </Typography>
                  </div>
                  <Switch
                    isSelected={currentValues.openToRelocation ?? false}
                    onChange={(isSelected: boolean) => {
                      setValue("openToRelocation", isSelected, { shouldDirty: true });
                    }}
                    aria-label="Open to relocation toggle"
                    className="cursor-pointer"
                  >
                    {({ isSelected }) => (
                      <Switch.Control>
                        <Switch.Thumb
                        />
                      </Switch.Control>
                    )}
                  </Switch>
                </div>
              </div>

              {/* Preferred Locations Chip Input */}
              <div className="flex flex-col gap-2 text-left">
                <Label htmlFor="preferredLocations">Preferred Locations</Label>
                <div className="flex items-center gap-2 max-w-sm">
                  <Input
                    id="preferredLocations"
                    aria-label="Add preferred location"
                    placeholder="e.g. Singapore, Hanoi, Ho Chi Minh City"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddLocation();
                      }
                    }}
                  />
                  <Button
                    size="md"
                    onPress={handleAddLocation}
                    className={
                      !newLocation.trim()
                        ? "bg-white dark:bg-surface border border-border text-muted font-bold shrink-0 opacity-60 cursor-not-allowed disabled:bg-white dark:disabled:bg-surface data-[disabled=true]:bg-white dark:data-[disabled=true]:bg-surface data-[disabled=true]:text-muted data-[disabled=true]:border-border data-[disabled=true]:opacity-60"
                        : "bg-accent text-accent-foreground font-bold shrink-0 hover:bg-accent/90 cursor-pointer"
                    }
                    isDisabled={!newLocation.trim()}
                  >
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(currentValues.preferredLocations || []).map((loc) => (
                    <Chip
                      key={loc}
                      variant="soft"
                      color="accent"
                      className="text-xs flex items-center gap-1.5 pr-1.5"
                    >
                      <span>{loc}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveLocation(loc)}
                        className="hover:bg-foreground/10 rounded-full p-0.5 inline-flex items-center justify-center cursor-pointer text-muted-foreground hover:text-foreground shrink-0"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </Chip>
                  ))}
                </div>
                <span className="text-[11px] text-muted">
                  Press Enter or click Add to append a location where you are willing to work.
                </span>
              </div>

              {/* Preferred Arrangements checkbox group */}
              <div className="flex flex-col gap-4 text-left border-t border-border/40 pt-4">
                <Typography type="body-sm" className="font-bold text-foreground font-outfit select-none">
                  Preferred Contract Arrangements
                </Typography>
                <div className="flex flex-col gap-3">
                  {employmentOptions.map((option) => {
                    const isSelected = (currentValues.employmentPreferences || []).includes(
                      option.value
                    );
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
                        <span className="text-foreground/90 font-semibold">{option.label}</span>
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
              </div>
            </div>
          </Card>
        </SettingsSection>

        {/* Section 3: Compensation & Employment */}
        <SettingsSection
          title="Compensation & Visibility"
          description="Update your base expected salary ranges, type, currency, and configure profile visibility rules."
        >
          <Card className="flex flex-col gap-6 p-6">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <Typography type="body-sm" className="font-bold text-foreground font-outfit uppercase">
                Expected Compensation
              </Typography>
            </div>

            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end text-left">
                {/* Min Salary */}
                <div className="flex flex-col gap-2">
                  <Label htmlFor="expectedSalaryMin">Min Salary ({currencyCode})</Label>
                  <Controller
                    control={control}
                    name="expectedSalaryMin"
                    render={({ field: { value, onChange } }) => (
                      <InputGroup>
                        <InputGroup.Prefix>{currencySymbol}</InputGroup.Prefix>
                        <InputGroup.Input
                          id="expectedSalaryMin"
                          aria-label="Minimum Expected Salary"
                          type="number"
                          placeholder={salaryPlaceholderMin}
                          value={value === null || value === undefined ? "" : value.toString()}
                          onChange={onChange}
                        />
                        <InputGroup.Suffix>{currencyCode}</InputGroup.Suffix>
                      </InputGroup>
                    )}
                  />
                  {errors.expectedSalaryMin && (
                    <FieldError className="text-danger text-xs mt-1 block">
                      {errors.expectedSalaryMin.message}
                    </FieldError>
                  )}
                </div>

                {/* Max Salary */}
                <div className="flex flex-col gap-2">
                  <Label htmlFor="expectedSalaryMax">Max Salary ({currencyCode})</Label>
                  <Controller
                    control={control}
                    name="expectedSalaryMax"
                    render={({ field: { value, onChange } }) => (
                      <InputGroup>
                        <InputGroup.Prefix>{currencySymbol}</InputGroup.Prefix>
                        <InputGroup.Input
                          id="expectedSalaryMax"
                          aria-label="Maximum Expected Salary"
                          type="number"
                          placeholder={salaryPlaceholderMax}
                          value={value === null || value === undefined ? "" : value.toString()}
                          onChange={onChange}
                        />
                        <InputGroup.Suffix>{currencyCode}</InputGroup.Suffix>
                      </InputGroup>
                    )}
                  />
                  {errors.expectedSalaryMax && (
                    <FieldError className="text-danger text-xs mt-1 block">
                      {errors.expectedSalaryMax.message}
                    </FieldError>
                  )}
                </div>

                {/* Currency Select */}
                <div className="flex flex-col gap-2">
                  <Controller
                    control={control}
                    name="expectedSalaryCurrency"
                    render={({ field: { value, onChange } }) => (
                      <SelectDropdown
                        label="Currency"
                        value={value || "USD"}
                        onChange={onChange}
                        options={CURRENCY_OPTIONS}
                      />
                    )}
                  />
                </div>

                {/* Salary Type Select */}
                <div className="flex flex-col gap-2">
                  <Controller
                    control={control}
                    name="expectedSalaryType"
                    render={({ field: { value, onChange } }) => (
                      <SelectDropdown
                        label="Salary Type"
                        value={value || "Monthly"}
                        onChange={onChange}
                        options={SALARY_TYPE_OPTIONS}
                      />
                    )}
                  />
                </div>
              </div>

              {/* Salary Toggles */}
              <div className="flex flex-col md:flex-row gap-4 mt-2">
                {/* Negotiable Toggle */}
                <div className="flex items-center justify-between gap-4 py-2 border border-border/40 bg-surface-secondary/5 rounded-xl px-4 flex-1 select-none">
                  <div className="flex flex-col gap-0.5">
                    <Typography type="body-xs" className="font-bold text-foreground font-outfit">
                      Salary Negotiable
                    </Typography>
                    <Typography type="body-xs" className="text-muted max-w-[200px]">
                      Indicate if you are open to salary negotiations.
                    </Typography>
                  </div>
                  <Controller
                    control={control}
                    name="expectedSalaryNegotiable"
                    render={({ field: { value, onChange } }) => (
                      <Switch
                        isSelected={value}
                        onChange={onChange}
                        aria-label="Salary Negotiable Toggle"
                        className="cursor-pointer"
                      >
                        {({ isSelected }) => (
                          <Switch.Control>
                            <Switch.Thumb />
                          </Switch.Control>
                        )}
                      </Switch>
                    )}
                  />
                </div>

                {/* Salary Visibility Toggle */}
                <div className="flex items-center justify-between gap-4 py-2 border border-border/40 bg-surface-secondary/5 rounded-xl px-4 flex-1 select-none">
                  <div className="flex flex-col gap-0.5">
                    <Typography type="body-xs" className="font-bold text-foreground font-outfit">
                      Show expected salary on public profile
                    </Typography>
                    <Typography type="body-xs" className="text-muted max-w-[250px]">
                      Your expected salary may be visible on your public developer card.
                    </Typography>
                  </div>
                  <Controller
                    control={control}
                    name="isExpectedSalaryVisible"
                    render={({ field: { value, onChange } }) => (
                      <Switch
                        isSelected={value}
                        onChange={onChange}
                        aria-label="Salary Visibility Toggle"
                        className="cursor-pointer"
                      >
                        {({ isSelected }) => (
                          <Switch.Control>
                            <Switch.Thumb />
                          </Switch.Control>
                        )}
                      </Switch>
                    )}
                  />
                </div>
              </div>
              {errors.isExpectedSalaryVisible && (
                <FieldError className="text-danger text-xs mt-1 block">
                  {errors.isExpectedSalaryVisible.message}
                </FieldError>
              )}
            </div>
          </Card>
        </SettingsSection>

        {/* Section 4: Targeted Skills & Growth */}
        <SettingsSection
          title="Targeted Skills & Growth"
          description="List the specific technical skills you want to work with and indicate your preferred leadership career track."
        >
          <Card className="flex flex-col gap-6 p-6">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <Typography type="body-sm" className="font-bold text-foreground font-outfit uppercase">
                Skills & Target Track
              </Typography>
            </div>

            <div className="flex flex-col gap-6">
              {/* Target Skills Chip Input */}
              <div className="flex flex-col gap-2 text-left">
                <Label htmlFor="targetSkills">Target Technology Skills</Label>
                <div className="flex items-center gap-2 max-w-sm">
                  <Input
                    id="targetSkills"
                    aria-label="Add target skill"
                    placeholder="e.g. Rust, Go, Python, React, AWS"
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddSkill();
                      }
                    }}
                  />
                  <Button
                    size="md"
                    onPress={handleAddSkill}
                    className={
                      !newSkill.trim()
                        ? "bg-white dark:bg-surface border border-border text-muted font-bold shrink-0 opacity-60 cursor-not-allowed disabled:bg-white dark:disabled:bg-surface data-[disabled=true]:bg-white dark:data-[disabled=true]:bg-surface data-[disabled=true]:text-muted data-[disabled=true]:border-border data-[disabled=true]:opacity-60"
                        : "bg-accent text-accent-foreground font-bold shrink-0 hover:bg-accent/90 cursor-pointer"
                    }
                    isDisabled={!newSkill.trim()}
                  >
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(currentValues.targetSkills || []).map((skill) => (
                    <Chip
                      key={skill}
                      variant="soft"
                      color="accent"
                      className="text-xs flex items-center gap-1.5 pr-1.5"
                    >
                      <span>{skill}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSkill(skill)}
                        className="hover:bg-foreground/10 rounded-full p-0.5 inline-flex items-center justify-center cursor-pointer text-muted-foreground hover:text-foreground shrink-0"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </Chip>
                  ))}
                </div>
                <span className="text-[11px] text-muted">
                  Press Enter or click Add to list frameworks, programming languages, or developer tools.
                </span>
              </div>

              {/* Leadership Track dropdown */}
              <div className="flex flex-col gap-1.5 w-full md:max-w-md text-left border-t border-border/40 pt-4">
                <SelectDropdown
                  label="Leadership Track"
                  value={currentValues.leadershipTrack || "undecided"}
                  onChange={(val: string) => {
                    setValue("leadershipTrack", val, { shouldDirty: true });
                  }}
                  options={LEADERSHIP_TRACK_OPTIONS}
                  placeholder="Select track"
                />
              </div>
            </div>
          </Card>
        </SettingsSection>

        {/* Section 5: Company & Culture Fit */}
        <SettingsSection
          title="Company & Culture Fit"
          description="Outline your target work environment preferences, company stages, team cultures, and written summary preferences."
        >
          <Card className="flex flex-col gap-6 p-6">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <Typography type="body-sm" className="font-bold text-foreground font-outfit uppercase">
                Workplace Preferences
              </Typography>
            </div>

            <div className="flex flex-col gap-6">
              {/* Company Stage Preferences */}
              <div className="flex flex-col gap-1.5 text-left">
                <Controller
                  control={control}
                  name="companyStagePreferences"
                  render={({ field: { value, onChange } }) => (
                    <TagChipMultiSelect
                      label="Preferred Company Stages"
                      description="Select the business stages that suit your risk profile and operational strengths."
                      options={COMPANY_STAGE_OPTIONS}
                      value={value || []}
                      onChange={onChange}
                      error={errors.companyStagePreferences?.message}
                    />
                  )}
                />
              </div>

              {/* Preferred Industries */}
              <div className="flex flex-col gap-1.5 text-left border-t border-border/40 pt-4">
                <Controller
                  control={control}
                  name="preferredIndustries"
                  render={({ field: { value, onChange } }) => (
                    <TagChipMultiSelect
                      label="Preferred Domains & Industries"
                      description="Select target industries where you have professional experience or high personal interest."
                      options={INDUSTRIES_OPTIONS}
                      value={value || []}
                      onChange={onChange}
                      error={errors.preferredIndustries?.message}
                    />
                  )}
                />
              </div>

              {/* Work Environments */}
              <div className="flex flex-col gap-1.5 text-left border-t border-border/40 pt-4">
                <Controller
                  control={control}
                  name="preferredWorkEnvironments"
                  render={({ field: { value, onChange } }) => (
                    <TagChipMultiSelect
                      label="Preferred Work Environments"
                      description="Choose the environments where you collaborate best."
                      options={WORK_ENVIRONMENT_OPTIONS}
                      value={value || []}
                      onChange={onChange}
                      error={errors.preferredWorkEnvironments?.message}
                    />
                  )}
                />
              </div>

              {/* Work Styles */}
              <div className="flex flex-col gap-1.5 text-left border-t border-border/40 pt-4">
                <Controller
                  control={control}
                  name="workStyles"
                  render={({ field: { value, onChange } }) => (
                    <TagChipMultiSelect
                      label="Collaboration Work Styles"
                      description="Select keywords that capture your professional collaboration modes."
                      options={WORK_STYLE_OPTIONS}
                      value={value || []}
                      onChange={onChange}
                      error={errors.workStyles?.message}
                    />
                  )}
                />
              </div>

              {/* Company Values */}
              <div className="flex flex-col gap-1.5 text-left border-t border-border/40 pt-4">
                <Controller
                  control={control}
                  name="companyValues"
                  render={({ field: { value, onChange } }) => (
                    <TagChipMultiSelect
                      label="Core Values Match"
                      description="Select values that you align with in a company culture."
                      options={COMPANY_VALUES_OPTIONS}
                      value={value || []}
                      onChange={onChange}
                      error={errors.companyValues?.message}
                    />
                  )}
                />
              </div>

              {/* Work Preference Notes */}
              <div className="flex flex-col gap-2 text-left border-t border-border/40 pt-4">
                <Controller
                  control={control}
                  name="workPreferenceNotes"
                  render={({ field: { value, onChange } }) => (
                    <div className="flex flex-col gap-1 w-full">
                      <TextArea
                        id="workPreferenceNotes"
                        aria-label="Work Preference Notes"
                        placeholder="Seek to summarize your workspace requirements, ideal team, or specific technical preferences..."
                        value={value || ""}
                        onChange={(e) => {
                          const val = e.target.value.slice(0, 500);
                          onChange(val);
                        }}
                        rows={4}
                        maxLength={500}
                      />
                      <span className="text-muted text-[10px] flex justify-end">
                        {(value || "").length}/500 characters
                      </span>
                    </div>
                  )}
                />
                {errors.workPreferenceNotes && (
                  <FieldError className="text-danger text-xs mt-1 block">
                    {errors.workPreferenceNotes.message}
                  </FieldError>
                )}
              </div>
            </div>
          </Card>
        </SettingsSection>

        {/* Section 6: Localization Settings */}
        <SettingsSection
          title="Localization Preferences"
          description="Manage primary spoken language settings for notifications and recruiter searches."
        >
          <Card className="flex flex-col gap-6 p-6">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <Typography type="body-sm" className="font-bold text-foreground font-outfit uppercase">
                Language Settings
              </Typography>
            </div>

            <div className="flex flex-col gap-1.5 w-full md:max-w-md text-left">
              <SelectDropdown
                label="Primary Spoken Language"
                value={currentValues.preferredLanguage || "en"}
                onChange={(val: string) => {
                  setValue("preferredLanguage", val as any, { shouldDirty: true });
                }}
                options={languageOptions}
                placeholder="Select language"
              />
            </div>
          </Card>
        </SettingsSection>

        <UnsavedChangesBar
          message="You have unsaved career preference changes."
          onReset={handleReset}
          onSave={handleSaveChanges}
          isSubmitting={isUpdating}
        />
      </div>
    </FormProvider>
  );
};

export default CareerTab;
