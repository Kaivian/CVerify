import {
  type ProfileResponse,
  type EducationEntryResponse,
  type AcademicAchievementResponse,
  type WorkExperienceResponse,
  type DeclaredCareerPreference,
  type ProjectVerificationLevel,
  type ProjectVerificationStatus,
  type ProjectRepositoryLinkResponse,
} from "@/types/profile.types";

export interface BasicInfoDraft {
  fullName: string;
  username: string;
  headline: string;
  bio: string;
  publicEmail: string;
  phoneNumber: string;
  location: string;
  pronouns: string;
  customPronouns: string;
  company: string;
  birthDate: string;
  socialLinks: string[];
  aiSuggestionsJson?: string | null;
}

export interface SkillsDraft {
  targetSkills: string[];
}

export interface ProjectDraftItem {
  id: string; // temp-id or DB uuid
  name: string;
  role: string | null;
  description: string;
  startDate: string | null;
  endDate: string | null;
  isCurrentlyWorking: boolean;
  verificationLevel: ProjectVerificationLevel;
  verificationStatus: ProjectVerificationStatus;
  verifiedAt: string | null;
  verificationMetadataJson: string | null;
  repositoryLinks: ProjectRepositoryLinkResponse[];
  technologies: string[];
  contributions: string[];
}

export type ProjectsDraft = ProjectDraftItem[];

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
  school: string;
  degree?: string | null;
  major?: string | null;
  description?: string | null;
  isCurrentlyStudying: boolean;
  period?: {
    start: any;
    end: any;
  } | null;
  gpa: number | null;
  gpaScale: number | null;
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
  "skills": { targetSkills: string[] };
  "projects": ProjectsDraft;
  "experience": ExperienceDraftItem[];
  "education": EducationDraftItem[];
  "achievements": AchievementsDraftItem[];
  "preferences": PreferencesDraft;
}

export type CvSectionId = keyof CvDraftState;
