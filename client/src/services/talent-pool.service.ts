import { axiosClient } from './axios-client';

export interface SavedCandidateDto {
  id: string;
  candidateId: string;
  fullName: string;
  username?: string;
  headline?: string;
  bio?: string;
  location?: string;
  avatarUrl?: string;
  trustScore: number;
  trustTier: string;
  aiScore: number;
  careerLevel?: string;
  availableForHire: boolean;
  primarySkills: string[];
  savedTags: string[];
  hiringStage: string;
  assignedRecruiterId?: string;
  assignedRecruiterName?: string;
  recruiterNotes?: string;
  savedAt: string;
}

export interface TalentPoolAnalytics {
  totalCandidates: number;
  verifiedCandidates: number;
  averageTrustScore: number;
  stageDistribution: Record<string, number>;
  skillDistribution: Record<string, number>;
  experienceDistribution: Record<string, number>;
}

export interface PaginatedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export const talentPoolApi = {
  getTalentPool: async (
    orgSlug: string,
    params: {
      query?: string;
      location?: string;
      minTrustScore?: number;
      stage?: string;
      sortBy?: string;
      page?: number;
      pageSize?: number;
      cursor?: string;
    }
  ): Promise<PaginatedResult<SavedCandidateDto>> => {
    const queryParams = new URLSearchParams();
    if (params.query) queryParams.append('query', params.query);
    if (params.location) queryParams.append('location', params.location);
    if (params.minTrustScore !== undefined) queryParams.append('minTrustScore', params.minTrustScore.toString());
    if (params.stage) queryParams.append('stage', params.stage);
    if (params.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.pageSize) queryParams.append('pageSize', params.pageSize.toString());
    if (params.cursor) queryParams.append('cursor', params.cursor);

    const response = await axiosClient.get<PaginatedResult<SavedCandidateDto>>(
      `/v1/organizations/${orgSlug}/talent-pool?${queryParams.toString()}`
    );
    return response.data;
  },

  saveCandidate: async (orgSlug: string, candidateId: string): Promise<any> => {
    const response = await axiosClient.post(`/v1/organizations/${orgSlug}/talent-pool`, {
      candidateId,
    });
    return response.data;
  },

  updateCandidateMeta: async (
    orgSlug: string,
    candidateId: string,
    meta: {
      notes?: string;
      tags?: string[];
      hiringStage?: string;
      recruiterId?: string | null;
    }
  ): Promise<any> => {
    const response = await axiosClient.patch(`/v1/organizations/${orgSlug}/talent-pool/${candidateId}`, meta);
    return response.data;
  },

  removeCandidate: async (orgSlug: string, candidateId: string): Promise<any> => {
    const response = await axiosClient.delete(`/v1/organizations/${orgSlug}/talent-pool/${candidateId}`);
    return response.data;
  },

  bulkAction: async (
    orgSlug: string,
    dto: {
      candidateIds: string[];
      actionType: 'Delete' | 'UpdateStage' | 'AddTags';
      stageValue?: string;
      tagValues?: string[];
    }
  ): Promise<any> => {
    const response = await axiosClient.post(`/v1/organizations/${orgSlug}/talent-pool/bulk`, dto);
    return response.data;
  },

  getAnalytics: async (orgSlug: string): Promise<TalentPoolAnalytics> => {
    const response = await axiosClient.get<TalentPoolAnalytics>(`/v1/organizations/${orgSlug}/talent-pool/analytics`);
    return response.data;
  },
};
