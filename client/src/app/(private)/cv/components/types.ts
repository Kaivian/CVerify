import {
  type ProfileResponse,
  type EducationEntryResponse,
  type AcademicAchievementResponse,
  type WorkExperienceResponse,
  type DeclaredCareerPreference,
} from "@/types/profile.types";

export interface BasicInfoDraft {
  fullName: string;
  username: string;
  headline: string;
  publicEmail: string;
  phoneNumber: string;
  location: string;
  pronouns: string;
  customPronouns: string;
  company: string;
  birthDate: string;
  socialLinks: string[];
}

export interface CareerSummaryDraft {
  bio: string;
}

export interface SkillsDraft {
  targetSkills: string[];
}

export type ProjectsDraft = Record<string, never>;

export interface ExperienceDraftItem {
  id: string; // temp-id or DB uuid
  jobTitle: string;
  company: string;
  experienceCategory: number;
  employmentType: number;
  location: string;
  startDate: string;
  endDate: string | null;
  isCurrentlyWorking: boolean;
  description: string;
  technologies: string[];
  achievements: { title: string; description: string }[];
  links: { linkType: number; url: string }[];
  isLeadership: boolean;
}

export interface EducationDraftItem {
  id: string; // temp-id or DB uuid
  label: string;
  schoolName: string;
  degree: string;
  major: string;
  gpa: number | null;
  gpaScale: number | null;
  description: string;
  startDate: string;
  endDate: string | null;
  isCurrentlyStudying: boolean;
}

export interface AchievementsDraftItem {
  id: string; // temp-id or DB uuid
  title: string;
  issuer: string;
  issueDate: string;
  description: string;
  credentialUrl: string;
  attachmentId: string | null;
  attachmentName?: string;
  attachmentSize?: number;
  attachmentUrl?: string;
}

export interface PreferencesDraft {
  availableForHire: boolean;
  openToWorkStatus: string;
  preferredLanguage: string;
  remotePreference: string;
  openToRelocation: boolean;
  preferredLocations: string[];
  employmentPreferences: string[];
  expectedSalaryMin: number | null;
  expectedSalaryMax: number | null;
  expectedSalaryCurrency: string;
  expectedSalaryType: string;
  expectedSalaryNegotiable: boolean;
  isExpectedSalaryVisible: boolean;
  desiredJobPositions: string[];
  leadershipTrack: string;
  companyStagePreferences: string[];
  preferredIndustries: string[];
  preferredWorkEnvironments: string[];
  workStyles: string[];
  companyValues: string[];
  workPreferenceNotes: string;
}

export interface CvDraftState {
  "basic-info": BasicInfoDraft;
  "career-summary": CareerSummaryDraft;
  "skills": { targetSkills: string[] };
  "projects": ProjectsDraft;
  "experience": ExperienceDraftItem[];
  "education": EducationDraftItem[];
  "achievements": AchievementsDraftItem[];
  "preferences": PreferencesDraft;
}

export type CvSectionId = keyof CvDraftState;
