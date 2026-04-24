export interface ProfileResponse {
  userId: string;
  username: string | null;
  fullName: string | null;
  bio: string | null;
  location: string | null;
  phoneNumber: string | null;
  birthDate: string | null;
  headline: string | null;
  company: string | null;
  pronouns: string | null;
  customPronouns: string | null;
  publicEmail: string | null;
  profileVisibility: string;
  recruiterVisibility: boolean;
  aiTalentDiscovery: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  socialLinks: string[];
}

export interface UpdateProfileRequest {
  fullName?: string | null;
  bio: string | null;
  location: string | null;
  phoneNumber: string | null;
  birthDate: string | null;
  headline: string | null;
  company: string | null;
  pronouns: string | null;
  customPronouns: string | null;
  publicEmail: string | null;
  profileVisibility: string;
  recruiterVisibility: boolean;
  aiTalentDiscovery: string;
  socialLinks: string[];
  version: number;
}

export interface UpdateUsernameRequest {
  newUsername: string;
}

export interface EducationEntryResponse {
  id: string;
  userId: string;
  label: string;
  schoolName: string;
  degree: string | null;
  major: string | null;
  gpa: number | null;
  gpaScale: number | null;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  isCurrentlyStudying: boolean;
  displayOrder: number;
}

export interface EducationEntryRequest {
  label: string;
  schoolName: string;
  degree: string | null;
  major: string | null;
  gpa: number | null;
  gpaScale: number | null;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  isCurrentlyStudying: boolean;
}

export interface AcademicAchievementResponse {
  id: string;
  userId: string;
  title: string;
  issuer: string;
  issueDate: string;
  description: string;
  credentialUrl: string | null;
  displayOrder: number;
  attachment: AttachmentResponse | null;
}

export interface AcademicAchievementRequest {
  title: string;
  issuer: string;
  issueDate: string;
  description: string;
  credentialUrl: string | null;
  attachmentId: string | null;
}

export interface AttachmentResponse {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  fileUrl: string;
  createdAt: string;
}

export interface DeclaredCareerPreference {
  userId: string;
  availableForHire: boolean;
  preferredLanguage: string;
  jobTitlePreferences: string | null;
  salaryExpectations: number | null;
  remotePreference: string | null;
  openToWorkStatus: string;
  openToRelocation: boolean;
  leadershipTrack: string;
  companyStagePreferences: string[];
  preferredIndustries: string[];
  targetSkills: string[];
  preferredWorkEnvironments: string[];
  workStyles: string[];
  companyValues: string[];
  expectedSalaryMin?: number | null;
  expectedSalaryMax?: number | null;
  expectedSalaryCurrency?: string | null;
  expectedSalaryType?: string | null;
  expectedSalaryNegotiable: boolean;
  isExpectedSalaryVisible: boolean;
  workPreferenceNotes?: string | null;
  desiredJobPositions: string[];
  skills: string[];
  preferredLocations: string[];
  employmentPreferences: string[];
  version: number;
}

// Retain alias for backward compatibility
export type CareerPreferenceResponse = DeclaredCareerPreference;

export interface AiInferredPreference {
  inferredPrimaryRole: string | null;
  inferredSeniority: string | null;
  inferredSkills: string[];
  inferredSalaryMin: number | null;
  inferredSalaryMax: number | null;
  inferredSalaryCurrency: string | null;
  inferredIndustries: string[];
  confidenceScore: number;
  synthesisRationale: string | null;
  lastAnalyzedAt: string;
}

export interface CareerReadinessActionItem {
  id: string;
  message: string;
  impactScore: number;
}

export interface CareerReadinessReport {
  discoverabilityScore: number;
  discoverabilityStatus: string;
  completenessPercent: number;
  actionItems: CareerReadinessActionItem[];
}

export interface CareerPreferencesDashboardResponse {
  declaredPreferences: DeclaredCareerPreference;
  aiInferredPreferences: AiInferredPreference | null;
  readinessReport: CareerReadinessReport;
}

export interface UpdateCareerPreferenceRequest {
  availableForHire?: boolean;
  preferredLanguage?: string;
  jobTitlePreferences?: string | null;
  salaryExpectations?: number | null;
  remotePreference?: string | null;
  openToWorkStatus?: string;
  openToRelocation?: boolean;
  leadershipTrack?: string;
  companyStagePreferences?: string[];
  preferredIndustries?: string[];
  targetSkills?: string[];
  preferredWorkEnvironments?: string[];
  workStyles?: string[];
  companyValues?: string[];
  desiredJobPositions?: string[];
  skills?: string[];
  preferredLocations?: string[];
  employmentPreferences?: string[];
  expectedSalaryMin?: number | null;
  expectedSalaryMax?: number | null;
  expectedSalaryCurrency?: string | null;
  expectedSalaryType?: string | null;
  expectedSalaryNegotiable?: boolean;
  isExpectedSalaryVisible?: boolean;
  workPreferenceNotes?: string | null;
  version: number;
}

export interface AcceptAiSuggestionsRequest {
  acceptRoles: boolean;
  acceptSkills: boolean;
  version: number;
}

export interface ReorderItemsRequest {
  orderedIds: string[];
}

export interface PublicCareerPreference {
  availableForHire: boolean;
  preferredLanguage: string;
  employmentPreferences: string[];
  preferredWorkEnvironments: string[];
  workStyles: string[];
  companyValues: string[];
  preferredLocations: string[];
  desiredJobPositions: string[];
  expectedSalaryMin?: number | null;
  expectedSalaryMax?: number | null;
  expectedSalaryCurrency?: string | null;
  expectedSalaryType?: string | null;
  expectedSalaryNegotiable: boolean;
  isExpectedSalaryVisible: boolean;
  workPreferenceNotes?: string | null;
}

export interface PublicProfileResponse {
  userId: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
  bio: string | null;
  headline: string | null;
  company: string | null;
  location: string | null;
  socialLinks: string[];
  careerPreference?: PublicCareerPreference | null;
}

export interface WorkExperienceAchievement {
  title: string;
  description: string;
}

export interface WorkExperienceLink {
  linkType: number;
  url: string;
}

export interface WorkExperienceRequest {
  jobTitle: string;
  company: string;
  experienceCategory: number;
  employmentType: number;
  location: string | null;
  startDate: string;
  endDate: string | null;
  isCurrentlyWorking: boolean;
  description: string;
  achievements: WorkExperienceAchievement[];
  technologies: string[];
  links: WorkExperienceLink[];
}

export interface WorkExperienceResponse {
  id: string;
  userId: string;
  jobTitle: string;
  company: string;
  experienceCategory: number;
  employmentType: number;
  location: string | null;
  startDate: string;
  endDate: string | null;
  isCurrentlyWorking: boolean;
  description: string;
  displayOrder: number;
  achievements: WorkExperienceAchievement[];
  technologies: string[];
  links: WorkExperienceLink[];
}

