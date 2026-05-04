import { z } from "zod";

// Strongly typed upload status enum
export type UploadStatus = "idle" | "uploading" | "success" | "failed";

// Serializable evidence file schema
export const evidenceFileSchema = z.object({
  id: z.string(),
  name: z.string(),
  size: z.number(),
  type: z.string(),
  progress: z.number(),
  status: z.enum(["idle", "uploading", "success", "failed"]),
  url: z.string().optional(),
});

export type EvidenceFile = z.infer<typeof evidenceFileSchema>;

export const educationEntrySchema = z
  .object({
    id: z.string().optional(),
    label: z.string().min(1, "Label is required"),
    school: z
      .string()
      .min(2, "School/University name must be at least 2 characters"),
    isCurrentlyStudying: z.boolean(),
    period: z.any().nullable().optional(),
    gpa: z
      .number()
      .min(0, "GPA must be at least 0")
      .nullable()
      .optional(),
    gpaScale: z
      .number()
      .min(1, "Scale must be at least 1")
      .max(100, "Scale must be at most 100")
      .nullable()
      .optional(),
  })
  .refine(
    (data) => {
      const start = data.period?.start;
      const end = data.period?.end;
      if (!start) return false;
      if (data.isCurrentlyStudying) {
        return true;
      }
      return !!end;
    },
    {
      message: "Valid study period is required",
      path: ["period"],
    }
  )
  .refine(
    (data) => {
      if (
        data.gpa === null ||
        data.gpa === undefined ||
        data.gpaScale === null ||
        data.gpaScale === undefined
      ) {
        return true;
      }
      return data.gpa <= data.gpaScale;
    },
    {
      message: "GPA cannot exceed the GPA Scale",
      path: ["gpa"],
    }
  );

export type EducationEntry = z.infer<typeof educationEntrySchema>;

// Academic Achievement schema
export const academicAchievementSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  issuer: z.string().min(1, "Issuer/Organization is required"),
  issueDate: z.string().min(1, "Issue date is required"),
  description: z.string().min(5, "Description must be at least 5 characters"),
  credentialUrl: z
    .string()
    .url("Must be a valid URL")
    .or(z.literal(""))
    .optional(),
  evidence: z.array(evidenceFileSchema),
});

export type AcademicAchievement = z.infer<typeof academicAchievementSchema>;

// Work experience validation schemas
export const workExperienceAchievementSchema = z.object({
  title: z.string().min(1, "Achievement title is required"),
  description: z.string().min(1, "Achievement description is required"),
});

export const workExperienceLinkSchema = z.object({
  linkType: z.number(),
  url: z.string().url("Must be a valid URL").or(z.literal("")),
});

/** Cleared dropdown uses `undefined`; require a positive enum id on validate (never use `0` as sentinel). */
const experienceCategoryField = z.union([z.undefined(), z.number()]);
const employmentTypeField = z.union([z.undefined(), z.number()]);

export const workExperienceEntrySchema = z
  .object({
    id: z.string().optional(),
    jobTitle: z.string().min(1, "Job title is required"),
    company: z.string().min(1, "Company/Organization is required"),
    experienceCategory: experienceCategoryField,
    employmentType: employmentTypeField,
    location: z.string().nullable().optional(),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().nullable().optional(),
    isCurrentlyWorking: z.boolean(),
    description: z.string().min(5, "Description must be at least 5 characters"),
    achievements: z.array(workExperienceAchievementSchema),
    technologies: z.array(z.string()),
    links: z.array(workExperienceLinkSchema),
    _links: z.object({
      repo: z.string().url("Must be a valid URL").or(z.literal("")).optional(),
      project: z.string().url("Must be a valid URL").or(z.literal("")).optional(),
      portfolio: z.string().url("Must be a valid URL").or(z.literal("")).optional(),
      demo: z.string().url("Must be a valid URL").or(z.literal("")).optional(),
      article: z.string().url("Must be a valid URL").or(z.literal("")).optional(),
    }).optional(),
  })
  .refine(
    (data) => {
      if (data.isCurrentlyWorking) {
        return !data.endDate;
      }
      return !!data.endDate && new Date(data.endDate) >= new Date(data.startDate);
    },
    {
      message: "End Date must be after Start Date when not currently working here",
      path: ["endDate"],
    }
  )
  .refine(
    (data) =>
      typeof data.experienceCategory === "number" &&
      !Number.isNaN(data.experienceCategory) &&
      data.experienceCategory >= 1,
    { message: "Category is required", path: ["experienceCategory"] }
  )
  .refine(
    (data) =>
      typeof data.employmentType === "number" &&
      !Number.isNaN(data.employmentType) &&
      data.employmentType >= 1,
    { message: "Employment type is required", path: ["employmentType"] }
  );

export type WorkExperienceEntry = z.infer<typeof workExperienceEntrySchema>;

// Unified personal info schema
export const personalInfoSchema = z.object({
  education: z.array(educationEntrySchema),
  achievements: z.array(academicAchievementSchema),
  workExperiences: z.array(workExperienceEntrySchema),
});

export type PersonalInfoFormValues = z.infer<typeof personalInfoSchema>;

