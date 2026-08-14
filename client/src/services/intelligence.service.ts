import { axiosClient } from './axios-client';

export interface SearchProfileSummary {
  candidateId: string;
  fullName: string;
  headline?: string;
  location?: string;
  trustScore: number;
  trustTier: string;
  capabilitiesJson: string;
  lastProjectedAt: string;
}

export interface CandidateCapabilityDto {
  id: string;
  capabilityName: string;
  slug: string;
  category: string;
  score?: {
    expertiseLevel: string;
    proficiencyScore: number;
    recencyIndex: number;
  };
  evidenceCount: number;
}

export interface CandidateEvidenceDto {
  id: string;
  assertionType: string;
  confidenceScore: number;
  artifact: {
    id: string;
    artifactType: string;
    externalIdentifier: string;
    payload: string;
  };
  verifications: Array<{
    verificationType: string;
    status: string;
    verifiedAt?: string;
  }>;
}

export interface CandidateIntelligenceProfile {
  candidateId: string;
  fullName: string;
  headline?: string;
  location?: string;
  trustScore: number;
  trustTier: string;
  capabilities: CandidateCapabilityDto[];
  evidence: CandidateEvidenceDto[];
  trustComponents?: Array<{
    componentName: string;
    componentScore: number;
    weight: number;
  }>;
}

export interface MatchEvaluationDto {
  id: string;
  jobVacancyId: string;
  candidateId: string;
  aggregateScore: number;
  confidenceLevel: string;
  factors: Array<{
    factorName: string;
    factorScore: number;
    weight: number;
  }>;
  explanations: Array<{
    explanationType: string;
    assertionText: string;
    capabilityNodeId?: string;
  }>;
}

export const intelligenceApi = {
  searchCandidates: async (
    query?: string,
    location?: string,
    minTrustScore = 0,
    sortBy = 'highest_trust',
    page = 1,
    pageSize = 12
  ): Promise<{ items: SearchProfileSummary[]; totalCount: number; page: number; pageSize: number }> => {
    const params = new URLSearchParams();
    if (query) params.append('query', query);
    if (location) params.append('location', location);
    if (minTrustScore > 0) params.append('minTrustScore', minTrustScore.toString());
    if (sortBy) params.append('sortBy', sortBy);
    params.append('page', page.toString());
    params.append('pageSize', pageSize.toString());

    const response = await axiosClient.get<{ items: SearchProfileSummary[]; totalCount: number; page: number; pageSize: number }>(
      `/v1/intelligence/search?${params.toString()}`
    );
    return response.data;
  },

  fetchCandidateProfile: async (id: string): Promise<CandidateIntelligenceProfile> => {
    const response = await axiosClient.get<CandidateIntelligenceProfile>(`/v1/intelligence/candidate/${id}`);
    return response.data;
  },

  evaluateMatch: async (jobVacancyId: string, candidateId: string): Promise<MatchEvaluationDto> => {
    const response = await axiosClient.get<MatchEvaluationDto>(`/v1/intelligence/match/${jobVacancyId}/${candidateId}`);
    return response.data;
  },
};
