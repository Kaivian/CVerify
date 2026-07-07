import {
  type PublicProfileResponse,
  type ProfileResponse,
  type EducationEntryResponse,
  type WorkExperienceResponse,
  type AcademicAchievementResponse,
  type CareerPreferencesDashboardResponse,
  type ProjectEntryResponse
} from "@/types/profile.types";
import { type CvDraftState } from "../components/types";

export interface CvMappedProps {
  basic: Record<string, any>;
  summary: Record<string, any>;
  skills: Record<string, any>;
  experience: Record<string, any>[];
  education: Record<string, any>[];
  achievements: Record<string, any>[];
  preferences: Record<string, any>;
  projects?: Record<string, any>[];
  templateId?: string;
  avatarUrl?: string | null;
}

/**
 * Maps the candidate's active editor/draft state (private details) to the layout preview parameters.
 */
export function mapDraftStateToCvProps(
  drafts: CvDraftState,
  avatarUrl?: string | null,
  templateId?: string
): CvMappedProps {
  return {
    basic: drafts["basic-info"],
    summary: { bio: drafts["basic-info"].bio },
    skills: drafts["skills"],
    experience: drafts["experience"],
    education: drafts["education"],
    achievements: drafts["achievements"],
    preferences: drafts["preferences"],
    projects: drafts["projects"],
    templateId,
    avatarUrl,
  };
}

/**
 * Maps the public profile response to the layout preview parameters for public rendering.
 */
export function mapPublicProfileToCvProps(
  profile: PublicProfileResponse
): CvMappedProps {
  // Map experiences to draft layout shape
  const experience = (profile.experiences || []).map((exp) => ({
    id: exp.id,
    jobTitle: exp.jobTitle,
    company: exp.company,
    experienceCategory: exp.experienceCategory,
    employmentType: exp.employmentType,
    location: exp.location || "",
    startDate: exp.startDate ? exp.startDate.split("T")[0] : "",
    endDate: exp.endDate ? exp.endDate.split("T")[0] : null,
    isCurrentlyWorking: exp.isCurrentlyWorking,
    description: exp.description || "",
    technologies: exp.technologies || [],
    achievements: exp.achievements || [],
    links: exp.links || [],
    isLeadership: exp.isLeadership || false,
  }));

  // Map education to draft layout shape
  const education = (profile.educations || []).map((edu) => ({
    id: edu.id,
    label: edu.label,
    school: edu.schoolName,
    degree: edu.degree || "",
    major: edu.major || "",
    description: edu.description || "",
    isCurrentlyStudying: edu.isCurrentlyStudying,
    startDate: edu.startDate ? edu.startDate.split("T")[0] : "",
    endDate: edu.endDate ? edu.endDate.split("T")[0] : null,
    gpa: edu.gpa,
    gpaScale: edu.gpaScale,
  }));

  // Map achievements to draft layout shape
  const achievements = (profile.achievements || []).map((ach) => ({
    id: ach.id,
    title: ach.title,
    issuer: ach.issuer,
    issueDate: ach.issueDate ? ach.issueDate.split("T")[0] : "",
    description: ach.description || "",
    credentialUrl: ach.credentialUrl || "",
    attachmentId: ach.attachment?.id || null,
    attachmentName: ach.attachment?.fileName,
    attachmentSize: ach.attachment?.fileSize,
    attachmentUrl: ach.attachment?.fileUrl,
  }));

  // Map projects to draft layout shape
  const projects = (profile.projects || []).map((p) => ({
    id: p.id,
    name: p.name,
    role: p.role || "",
    description: p.description || "",
    startDate: p.startDate ? p.startDate.split("T")[0] : "",
    endDate: p.endDate ? p.endDate.split("T")[0] : null,
    isCurrentlyWorking: p.isCurrentlyWorking,
    verificationLevel: p.verificationLevel,
    verificationStatus: p.verificationStatus,
    verifiedAt: p.verifiedAt,
    verificationMetadataJson: p.verificationMetadataJson,
    repositoryLinks: p.repositoryLinks || [],
    technologies: p.technologies || [],
    contributions: p.contributions || [],
  }));

  const careerPref = profile.careerPreference;

  return {
    basic: {
      fullName: profile.fullName || "Untitled",
      username: profile.username || "",
      headline: profile.headline || "",
      bio: profile.bio || "",
      publicEmail: profile.publicEmail || "",
      phoneNumber: profile.phoneNumber || "",
      location: profile.location || "",
      socialLinks: profile.socialLinks || [],
      aiSuggestionsJson: profile.aiSuggestionsJson || null,
    },
    summary: { bio: profile.bio || "" },
    skills: {
      targetSkills: careerPref?.targetSkills || [],
    },
    experience,
    education,
    achievements,
    preferences: {
      availableForHire: careerPref?.availableForHire ?? true,
      openToWorkStatus: careerPref?.openToWorkStatus || "casual",
      preferredLanguage: careerPref?.preferredLanguage || "en",
      remotePreference: careerPref?.remotePreference || "any",
      openToRelocation: careerPref?.openToRelocation ?? false,
      preferredLocations: careerPref?.preferredLocations || [],
      employmentPreferences: careerPref?.employmentPreferences || [],
      expectedSalaryMin: careerPref?.expectedSalaryMin ?? null,
      expectedSalaryMax: careerPref?.expectedSalaryMax ?? null,
      expectedSalaryCurrency: careerPref?.expectedSalaryCurrency || "USD",
      expectedSalaryType: careerPref?.expectedSalaryType || "Monthly",
      expectedSalaryNegotiable: careerPref?.expectedSalaryNegotiable ?? false,
      isExpectedSalaryVisible: careerPref?.isExpectedSalaryVisible ?? false,
      desiredJobPositions: careerPref?.desiredJobPositions || [],
      leadershipTrack: careerPref?.leadershipTrack || "undecided",
      companyStagePreferences: careerPref?.companyStagePreferences || [],
      preferredIndustries: careerPref?.preferredIndustries || [],
      preferredWorkEnvironments: careerPref?.preferredWorkEnvironments || [],
      workStyles: careerPref?.workStyles || [],
      companyValues: careerPref?.companyValues || [],
      workPreferenceNotes: careerPref?.workPreferenceNotes || "",
    },
    projects,
    templateId: profile.cvTemplateId || "professional",
    avatarUrl: profile.avatarUrl,
  };
}
