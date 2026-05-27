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

// Education item schema with coerced numeric GPA & Scale
export const educationEntrySchema = z.object({
  label: z.string().min(1, "Label is required"),
  school: z
    .string()
    .min(2, "School/University name must be at least 2 characters"),
  period: z.any().refine((val) => val && val.start && val.end, {
    message: "Valid study period is required",
  }),
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
}).refine(
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

// Unified personal info schema
export const personalInfoSchema = z.object({
  education: z.array(educationEntrySchema),
  achievements: z.array(academicAchievementSchema),
});

export type PersonalInfoFormValues = z.infer<typeof personalInfoSchema>;
