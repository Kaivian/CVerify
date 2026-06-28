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
  aiSuggestionsJson?: string | null;
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
  aiSuggestionsJson?: string | null;
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

export interface PublicRepository {
  id: string;
  name: string;
  owner: string;
  description: string | null;
  htmlUrl: string | null;
  primaryLanguage: string | null;
  trustScore: number;
  classification: string | null;
  latestAnalysisStatus: string;
  latestAnalysisCompletedAtUtc: string | null;
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
  trustScore?: number | null;
  repositories?: PublicRepository[] | null;
  projects?: PublicProject[] | null;
  experiences?: WorkExperienceResponse[] | null;
  educations?: EducationEntryResponse[] | null;
  achievements?: AcademicAchievementResponse[] | null;
  hasCompletedAssessment: boolean;
  lastAssessmentDate: string | null;
  vacancies?: any[];
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
  isLeadership?: boolean;
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
  isLeadership: boolean;
}


export interface MissingFieldDto {
  fieldKey: string;
  displayLabel: string;
  recommendationMessage: string;
  isRequired: boolean;
}

export interface CandidateReadinessDto {
  isReady: boolean;
  missingFields: MissingFieldDto[];
  completenessScore: number;
  requiresReassessment: boolean;
  lastAssessmentAt: string | null;
  lastProfileUpdateAt: string;
  lastRepositoryAnalysisAt: string;
}

export interface CandidateAssessmentResponse {
  id: string;
  userId: string;
  status: string;
  overallScore: number;
  careerLevel: string | null;
  careerLevelLabel: string | null;
  primaryTendency: string | null;
  primaryWorkingStyle: string | null;
  summaryHeadline: string | null;
  summaryParagraph: string | null;
  pipelineVersion: string;
  assessmentSchemaVersion: string;
  cvId: string | null;
  promptVersion: string | null;
  modelVersion: string | null;
  lastProfileUpdateAt: string;
  lastRepositoryAnalysisAt: string;
  lastAssessmentAt: string | null;
  failedStage: string | null;
  failureReason: string | null;
  createdAtUtc: string;
  completedAtUtc: string | null;
}

export interface CandidateAssessmentArtifactDto {
  id: string;
  artifactType: string;
  jsonData: string;
  createdAtUtc: string;
}

export interface CandidateAssessmentDetailResponse {
  assessment: CandidateAssessmentResponse;
  artifacts: CandidateAssessmentArtifactDto[];
}

export interface AssessmentStageDto {
  id: string;
  name: string;
  description: string;
}

export enum ProjectVerificationLevel {
  AiAnalyzed = 1,
  RepositoryLinked = 2,
  Independent = 3,
}

export enum ProjectVerificationStatus {
  Verified = 1,
  Outdated = 2,
  Disconnected = 3,
  Unverified = 4,
}

export interface ProjectRepositoryLinkResponse {
  id: string;
  sourceCodeRepositoryId: string;
  name: string;
  owner: string;
  htmlUrl: string | null;
}

export interface ProjectEntryRequest {
  name: string;
  role: string | null;
  description: string;
  startDate: string | null;
  endDate: string | null;
  isCurrentlyWorking: boolean;
  verificationLevel: ProjectVerificationLevel;
  linkedRepositoryIds: string[] | null;
  technologies: string[] | null;
  contributions: string[] | null;
}

export interface ProjectEntryResponse {
  id: string;
  userId: string;
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
  displayOrder: number;
  repositoryLinks: ProjectRepositoryLinkResponse[];
  technologies: string[];
  contributions: string[];
}

export interface PublicProjectRepositoryLink {
  id: string;
  sourceCodeRepositoryId: string;
  name: string;
  owner: string;
  htmlUrl: string | null;
}

export interface PublicProject {
  id: string;
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
  displayOrder: number;
  repositoryLinks: PublicProjectRepositoryLink[];
  technologies: string[];
  contributions: string[];
}

export interface RankingQueryParams {
  search?: string;
  category?: string;
  trustTiers?: string[];
  experienceLevels?: string[];
  skills?: string[];
  location?: string;
  availableForHire?: boolean;
  page?: number;
  pageSize?: number;
}

export interface CapabilityInfo {
  name: string;
  score: number;
}

export interface RankingResponseItem {
  candidateId: string;
  fullName: string;
  username: string | null;
  bio: string | null;
  headline: string | null;
  location: string | null;
  avatarUrl: string | null;
  compositeScore: number;
  aiScore: number;
  trustScore: number;
  profileCompleteness: number;
  evidenceTrustScore: number;
  verifiedRepoCount: number;
  totalStarsCount: number;
  totalForksCount: number;
  verifiedContributionCount: number;
  topCapabilities: CapabilityInfo[];
  primaryDomain: string | null;
  careerLevelLabel: string | null;
  followersCount: number;
  followingCount: number;
  availableForHire: boolean;
  openToWorkStatus: string;
  globalRankPosition: number;
  previousGlobalRankPosition: number;
  isFollowedByCurrentUser: boolean;
  lastUpdatedAt: string;
}

export interface PaginatedRankingResponse {
  items: RankingResponseItem[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface TrendingEngineer {
  candidateId: string;
  fullName: string;
  username: string | null;
  avatarUrl: string | null;
  compositeScore: number;
  globalRankPosition: number;
  previousGlobalRankPosition: number;
  rankDelta: number;
}

export interface RankingStats {
  totalTalents: number;
  totalRepositories: number;
  totalCountries: number;
  topTechnologies: string[];
  fastestRisingSkills: string[];
  trendingEngineers: TrendingEngineer[];
  averageTrustScore: number;
  averageCapabilityScore: number;
  averageRepositoryImpact: number;
  verificationRate: number;
  averageCompositeScore: number;
}

export interface CandidateSkillTreeNodeResponse {
  id: string;
  parentId: string | null;
  displayName: string;
  category: 'Domain' | 'Subdomain' | 'Technology' | 'Framework' | 'Library' | 'Tool' | 'Methodology';
  proficiencyLevel: string;
  confidenceScore: number;
  estimatedExperienceMonths: number;
  supportingEvidence?: string; // Serialized JSON string
  children: CandidateSkillTreeNodeResponse[];
}


