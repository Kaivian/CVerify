import { axiosClient } from "./axios-client";

export interface BusinessOutcome {
  id: string;
  text: string;
}

export interface Responsibility {
  id: string;
  text: string;
  priority: "MustHave" | "ShouldHave" | "NiceToHave";
  ownershipLevel: "Awareness" | "Contributor" | "Owner" | "Leader";
  isLeadership: boolean;
}

export interface RequirementCapability {
  id: string;
  capabilityId: string;
  name: string;
  category: string;
  priority: "MustHave" | "ShouldHave" | "NiceToHave";
  ownershipLevel: "Awareness" | "Contributor" | "Owner" | "Leader";
  expectedProficiency: number;
}

export interface TechnologyRequirement {
  id: string;
  name: string;
  priority: "MustHave" | "ShouldHave" | "NiceToHave";
  sfiaLevel: number;
}

export interface HiringRequirement {
  id: string;
  organizationId: string;
  workspaceId: string;
  title: string;
  department: string;
  seniority: string;
  workplaceType: string;
  city?: string;
  employmentType: string;
  salaryMin?: number;
  salaryMax?: number;
  currency?: string;
  salaryPeriod?: number; // 1 = Monthly, 2 = Yearly
  isSalaryNegotiable: boolean;
  timezoneRange?: string;
  degreeRequirement?: string;
  benefits: string[];
  languageRequirements: string[];
  headcount: number;
  startDate?: string;
  endDate?: string;
  autoCloseRule?: number; // 0 = None, 1 = CloseOnEndDate, 2 = CloseOnHiringTarget, 3 = Either
  candidatesNeededCount?: number;
  isManuallyClosed: boolean;
  lifecycleStatus: string;
  status: "Draft" | "Published" | "Archived";
  version: number;
  hiringReason?: string;
  businessProblem?: string;
  createdAt: string;
  updatedAt: string;
  businessOutcomes: BusinessOutcome[];
  responsibilities: Responsibility[];
  capabilities: RequirementCapability[];
  technologyRequirements: TechnologyRequirement[];
  snapshots?: any[];
  evaluationRubrics?: any[];
  jobDescriptions?: any[];
}

export type JobPostStatus = "Draft" | "Published" | "Archived";
export type AcquisitionStrategy = "ManualOnly" | "AiMatchingOnly" | "Hybrid";

export interface CandidateDiscoveryProfile {
  keyKeywords: string[];
  minimumYearsOfExperience: number;
  priorityWeights: Record<string, number>;
  trustRequirements: {
    minimumTrustScore: number;
    requireVerifiedEmail: boolean;
    [key: string]: any;
  };
}

export interface JobVacancyDto {
  id: string;
  organizationId: string;
  title: string;
  department: string;
  workplaceType: string;
  city: string;
  type: string;
  salary: string;
  salaryMinMax: string;
  headcount: number;
  gender: string;
  experience: string;
  degree: string;
  category: string;
  description: string[];
  requirements: string[];
  benefits: string[];
  tags: string[];
  skills: string[];
  coverUrl: string;
  images: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  status: JobPostStatus;
  acquisitionStrategy: AcquisitionStrategy;
  discoveryProfileJson?: string;
  requirementSnapshotId?: string;
  hiringRequirementId?: string;
  metadata?: string;
}

export interface UpdateJobVacancyDto {
  title: string;
  department: string;
  workplaceType: string;
  city: string;
  type: string;
  salary: string;
  salaryMinMax: string;
  headcount: number;
  gender: string;
  experience: string;
  degree: string;
  category: string;
  description: string[];
  requirements: string[];
  benefits: string[];
  tags: string[];
  skills: string[];
  coverUrl: string;
  acquisitionStrategy: AcquisitionStrategy;
  discoveryProfileJson: string;
}

export interface CapabilityCatalogItem {
  capabilityId: string;
  displayName: string;
  category: string;
  description: string;
  skills: string[];
  expectedEvidence: string[];
}

export interface CreateHiringRequirementRequest {
  organizationSlug: string;
  title: string;
  department: string;
  seniority: string;
  workplaceType: string;
  city?: string;
  employmentType: string;
  headcount: number;
}

export interface UpdateHiringRequirementRequest {
  hiringReason?: string;
  businessProblem?: string;
  outcomes?: string[];
  responsibilities?: Array<{
    text: string;
    priority: "MustHave" | "ShouldHave" | "NiceToHave";
    ownershipLevel: "Awareness" | "Contributor" | "Owner" | "Leader";
    isLeadership: boolean;
  }>;
  capabilities?: Array<{
    capabilityId: string;
    name: string;
    category: string;
    priority: "MustHave" | "ShouldHave" | "NiceToHave";
    ownershipLevel: "Awareness" | "Contributor" | "Owner" | "Leader";
    expectedProficiency: number;
  }>;
  skills?: Array<{
    name: string;
    priority: "MustHave" | "ShouldHave" | "NiceToHave";
    sfiaLevel: number;
  }>;
  salaryMin?: number;
  salaryMax?: number;
  currency?: string;
  salaryPeriod?: number;
  isSalaryNegotiable?: boolean;
  timezoneRange?: string;
  degreeRequirement?: string;
  benefits?: string[];
  languageRequirements?: string[];
  startDate?: string;
  endDate?: string;
  autoCloseRule?: number;
  candidatesNeededCount?: number;
  isManuallyClosed?: boolean;
  headcount?: number;
}

export interface RequirementArtifact {
  id: string;
  artifactType: string;
  markdownContent: string;
  structuredContent?: any;
  status: "Not Generated" | "Generating" | "Generated" | "Failed" | "Cancelled" | "Regenerating";
  modelInfo?: string;
  promptTemplateId?: string;
  promptVersion?: string;
  promptHash?: string;
  generationTimestamp?: string;
  generationMetadata?: {
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
    durationMs: number;
  };
  regenerationHistory?: Array<{
    timestamp: string;
    markdownContent: string;
    structuredContent?: any;
    modelInfo?: string;
    promptTemplateId?: string;
    promptVersion?: string;
    promptHash?: string;
    generationMetadata?: any;
  }>;
  updatedAt: string;
}

export interface GeneratedArtifacts {
  requirementId: string;
  generatedJd?: RequirementArtifact;
  artifacts?: RequirementArtifact[];
  rubric?: {
    capabilityWeights: Record<string, number>;
    scoringRules: {
      minimumMaturityThreshold: string;
      selfDeclaredMatchCeiling: number;
    };
    evidenceRequirements: Array<{
      signalType: string;
      expectedMetric: string;
    }>;
  };
  interviewBlueprint?: {
    questions: Array<{
      capabilityId: string;
      questionText: string;
      gradingRubric: string;
    }>;
    dimensions: string[];
  };
}

interface ApiCapabilityCatalogItem extends Omit<CapabilityCatalogItem, "skills"> {
  recommendedSkills?: string[];
  skills?: string[];
}

export interface PaginatedList<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface CreateCapabilityCatalogItemDto {
  workspaceId: string;
  displayName: string;
  category: string;
  description: string;
  skills: string[];
  expectedEvidence: string[];
}

export interface UpdateCapabilityCatalogItemDto {
  displayName: string;
  category: string;
  description: string;
  skills: string[];
  expectedEvidence: string[];
}

export const hiringRequirementService = {
  async getCatalog(workspaceId?: string): Promise<CapabilityCatalogItem[]> {
    const response = await axiosClient.get<ApiCapabilityCatalogItem[]>("/v1/hiring-requirements/catalog", {
      params: { workspaceId }
    });
    return response.data.map(item => ({
      capabilityId: item.capabilityId,
      displayName: item.displayName,
      category: item.category,
      description: item.description,
      expectedEvidence: item.expectedEvidence,
      skills: item.recommendedSkills || item.skills || []
    }));
  },

  async createDraft(request: CreateHiringRequirementRequest): Promise<{ id: string; status: string; version: number; createdAt: string }> {
    const response = await axiosClient.post<{ id: string; status: string; version: number; createdAt: string }>("/v1/hiring-requirements", request);
    return response.data;
  },

  async updateDraft(id: string, request: UpdateHiringRequirementRequest): Promise<HiringRequirement> {
    const response = await axiosClient.put<HiringRequirement>(`/v1/hiring-requirements/${id}`, request);
    return response.data;
  },

  async getById(id: string): Promise<HiringRequirement> {
    const response = await axiosClient.get<HiringRequirement>(`/v1/hiring-requirements/${id}`);
    return response.data;
  },

  async getByWorkspaceId(
    workspaceId: string,
    search?: string,
    department?: string,
    status?: string,
    sortBy?: string,
    sortOrder?: string,
    page?: number,
    pageSize?: number
  ): Promise<PaginatedList<HiringRequirement>> {
    const response = await axiosClient.get<PaginatedList<HiringRequirement>>(`/v1/hiring-requirements/workspace/${workspaceId}`, {
      params: {
        search,
        department,
        status,
        sortBy,
        sortOrder,
        page,
        pageSize
      }
    });
    return response.data;
  },

  async triggerArtifactGeneration(id: string): Promise<{ jobId: string; status: string }> {
    const response = await axiosClient.post<{ jobId: string; status: string }>(`/v1/hiring-requirements/${id}/generate-artifacts`);
    return response.data;
  },

  async generateArtifact(id: string, artifactType: string): Promise<{ jobId: string; status: string }> {
    const response = await axiosClient.post<{ jobId: string; status: string }>(`/v1/hiring-requirements/${id}/artifacts/generate`, { artifactType });
    return response.data;
  },

  async cancelArtifactGeneration(id: string, artifactType: string): Promise<{ status: string }> {
    const response = await axiosClient.post<{ status: string }>(`/v1/hiring-requirements/${id}/artifacts/cancel`, { artifactType });
    return response.data;
  },

  async getArtifacts(id: string): Promise<GeneratedArtifacts> {
    const response = await axiosClient.get<GeneratedArtifacts>(`/v1/hiring-requirements/${id}/artifacts`);
    return response.data;
  },

  async publish(id: string): Promise<{ snapshotId: string; version: number; publishedAt: string }> {
    const response = await axiosClient.post<{ snapshotId: string; version: number; publishedAt: string }>(`/v1/hiring-requirements/${id}/publish`);
    return response.data;
  },

  async getCandidateMatches(id: string): Promise<CandidateMatch[]> {
    const response = await axiosClient.get<CandidateMatch[]>(`/v1/hiring-requirements/${id}/candidate-matches`);
    return response.data;
  },

  async createCustomCapability(request: CreateCapabilityCatalogItemDto): Promise<CapabilityCatalogItem> {
    const response = await axiosClient.post<ApiCapabilityCatalogItem>("/v1/hiring-requirements/catalog", request);
    const item = response.data;
    return {
      capabilityId: item.capabilityId,
      displayName: item.displayName,
      category: item.category,
      description: item.description,
      expectedEvidence: item.expectedEvidence,
      skills: item.recommendedSkills || item.skills || []
    };
  },

  async updateCustomCapability(capabilityId: string, request: UpdateCapabilityCatalogItemDto): Promise<CapabilityCatalogItem> {
    const response = await axiosClient.put<ApiCapabilityCatalogItem>(`/v1/hiring-requirements/catalog/${capabilityId}`, request);
    const item = response.data;
    return {
      capabilityId: item.capabilityId,
      displayName: item.displayName,
      category: item.category,
      description: item.description,
      expectedEvidence: item.expectedEvidence,
      skills: item.recommendedSkills || item.skills || []
    };
  },

  async deleteCustomCapability(capabilityId: string): Promise<void> {
    await axiosClient.delete(`/v1/hiring-requirements/catalog/${capabilityId}`);
  },

  async delete(id: string): Promise<void> {
    await axiosClient.delete(`/v1/hiring-requirements/${id}`);
  },

  async bulkDelete(ids: string[]): Promise<void> {
    await axiosClient.post("/v1/hiring-requirements/bulk-delete", { ids });
  },

  async bulkArchive(ids: string[]): Promise<void> {
    await axiosClient.post("/v1/hiring-requirements/bulk-archive", { ids });
  },

  async getJobPosting(requirementId: string): Promise<JobVacancyDto> {
    const response = await axiosClient.get<JobVacancyDto>(`/v1/job-vacancies/requirement/${requirementId}`);
    return response.data;
  },

  async createJobPostingDraft(requirementId: string): Promise<JobVacancyDto> {
    const response = await axiosClient.post<JobVacancyDto>(`/v1/job-vacancies/requirement/${requirementId}/create-draft`);
    return response.data;
  },

  async updateJobPosting(id: string, data: UpdateJobVacancyDto): Promise<JobVacancyDto> {
    const response = await axiosClient.put<JobVacancyDto>(`/v1/job-postings/${id}`, data);
    return response.data;
  },

  async publishJobPosting(id: string, notes?: string): Promise<JobVacancyDto> {
    const response = await axiosClient.post<JobVacancyDto>(`/v1/job-postings/${id}/publish`, { notes });
    return response.data;
  },

  async createNewVersion(id: string): Promise<{ id: string; status: string; version: number; createdAt: string }> {
    const response = await axiosClient.post<{ id: string; status: string; version: number; createdAt: string }>(`/v1/hiring-requirements/${id}/new-version`);
    return response.data;
  },

  async triggerDiscovery(id: string): Promise<TriggerDiscoveryResponse> {
    const response = await axiosClient.post<TriggerDiscoveryResponse>(`/v1/hiring-requirements/${id}/candidate-matches/discover`);
    return response.data;
  },

  async getDiscoveryRuns(id: string): Promise<CandidateDiscoveryRun[]> {
    const response = await axiosClient.get<CandidateDiscoveryRun[]>(`/v1/hiring-requirements/${id}/candidate-matches/discover/runs`);
    return response.data;
  },

  async cancelDiscovery(id: string): Promise<{ status: string }> {
    const response = await axiosClient.post<{ status: string }>(`/v1/hiring-requirements/${id}/candidate-matches/discover/cancel`);
    return response.data;
  }
};

export interface MatchBreakdown {
  capabilitiesScore: number;
  skillsScore: number;
  responsibilitiesScore: number;
  salaryScore: number;
  cosineSimilarity: number;
  gapScore: number;
}

export interface EvidenceTrace {
  capabilityId: string;
  capabilityName: string;
  confidence: number;
  matchStatus: "Verified" | "Self-Declared" | "Missing";
  metric: string;
  targetFile: string;
  rationale: string;
}

export interface CandidateMatch {
  candidateId: string;
  fullName: string;
  avatarUrl?: string;
  headline?: string;
  careerLevel?: string;
  careerLevelLabel?: string;
  matchScore: number;
  trustLevel: number;
  breakdown: MatchBreakdown;
  traces: EvidenceTrace[];
}

export interface CandidateDiscoveryRun {
  id: string;
  hiringRequirementId: string;
  triggeredById?: string;
  startedAt: string;
  completedAt?: string;
  status: number; // 1 = Pending, 2 = Searching, 3 = Matching, 4 = Ranking, 5 = Completed, 6 = Failed
  candidatesFoundCount: number;
  matchQualitySummary?: string;
  errorMessage?: string;
  matches?: CandidateMatch[];
}

export interface TriggerDiscoveryResponse {
  runId: string;
  status: number;
}
