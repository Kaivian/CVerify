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

export interface CareerPreferenceResponse {
  userId: string;
  availableForHire: boolean;
  preferredLanguage: string;
  jobTitlePreferences: string | null;
  salaryExpectations: number | null;
  remotePreference: string | null;
  openToWorkStatus: string | null;
  skills: string[];
  preferredLocations: string[];
  employmentPreferences: string[];
  version: number;
}

export interface UpdateCareerPreferenceRequest {
  availableForHire: boolean;
  preferredLanguage: string;
  jobTitlePreferences: string | null;
  salaryExpectations: number | null;
  remotePreference: string | null;
  openToWorkStatus: string | null;
  skills: string[];
  preferredLocations: string[];
  employmentPreferences: string[];
  version: number;
}

export interface ReorderItemsRequest {
  orderedIds: string[];
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
}
