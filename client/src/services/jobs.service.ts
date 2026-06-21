import { axiosClient } from './axios-client';

export interface PublicJobDto {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  organizationLogoUrl?: string;
  title: string;
  department: string;
  workplaceType: string;
  city: string;
  type: string;
  salary?: string;
  experience?: string;
  degree?: string;
  category?: string;
  description: string[];
  requirements: string[];
  benefits: string[];
  tags: string[];
  skills: string[];
  coverUrl?: string;
  images: string[];
  isActive: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface EligibilityCheckDto {
  name: string;
  description: string;
  passed: boolean;
  requiredValue: string;
  actualValue: string;
}

export interface ExplainableMatchReportDto {
  isEligible: boolean;
  isPartiallyEligible: boolean;
  aggregateScore: number;
  confidenceLevel: string;
  capabilityFit: {
    score: number;
    matchedCapabilities: string[];
    explanation: string;
  };
  trustFit: {
    score: number;
    explanation: string;
  };
  checks: EligibilityCheckDto[];
  explanation: string;
}

export interface JobApplicationDto {
  id: string;
  jobVacancyId: string;
  job: PublicJobDto;
  status: string;
  createdAt: string;
}

export interface JobApplicantDto {
  id: string;
  candidateId: string;
  fullName: string;
  email: string;
  status: string;
  createdAt: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const jobsApi = {
  searchJobs: async (params: {
    query?: string;
    location?: string;
    workplaceType?: string;
    employmentType?: string;
    seniority?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PaginatedResult<PublicJobDto>> => {
    const queryParams = new URLSearchParams();
    if (params.query) queryParams.append('query', params.query);
    if (params.location) queryParams.append('location', params.location);
    if (params.workplaceType) queryParams.append('workplaceType', params.workplaceType);
    if (params.employmentType) queryParams.append('employmentType', params.employmentType);
    if (params.seniority) queryParams.append('seniority', params.seniority);
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.pageSize) queryParams.append('pageSize', params.pageSize.toString());

    const response = await axiosClient.get<PaginatedResult<PublicJobDto>>(`/v1/public/jobs?${queryParams.toString()}`);
    return response.data;
  },

  getDetails: async (id: string): Promise<PublicJobDto> => {
    const response = await axiosClient.get<PublicJobDto>(`/v1/public/jobs/${id}`);
    return response.data;
  },

  getEligibility: async (id: string): Promise<ExplainableMatchReportDto> => {
    const response = await axiosClient.get<ExplainableMatchReportDto>(`/v1/public/jobs/${id}/eligibility`);
    return response.data;
  },

  apply: async (id: string): Promise<PublicJobDto> => {
    const response = await axiosClient.post<PublicJobDto>(`/v1/public/jobs/${id}/apply`);
    return response.data;
  },

  interact: async (id: string, type: 'Saved' | 'Dismissed' | 'Shared'): Promise<{ success: boolean }> => {
    const response = await axiosClient.post<{ success: boolean }>(`/v1/public/jobs/${id}/interact?type=${type}`);
    return response.data;
  },

  getInteractions: async (type: 'Saved' | 'Dismissed' | 'Shared'): Promise<PublicJobDto[]> => {
    const response = await axiosClient.get<PublicJobDto[]>(`/v1/public/jobs/interactions?type=${type}`);
    return response.data;
  },

  getApplications: async (): Promise<JobApplicationDto[]> => {
    const response = await axiosClient.get<JobApplicationDto[]>('/v1/public/jobs/applications');
    return response.data;
  },

  getRecommendations: async (): Promise<PublicJobDto[]> => {
    const response = await axiosClient.get<PublicJobDto[]>('/v1/public/jobs/recommendations');
    return response.data;
  },

  // Recruiter actions
  getApplicants: async (id: string): Promise<JobApplicantDto[]> => {
    const response = await axiosClient.get<JobApplicantDto[]>(`/v1/public/jobs/${id}/applicants`);
    return response.data;
  },

  updateStatus: async (id: string, status: string, isActive: boolean): Promise<PublicJobDto> => {
    const response = await axiosClient.put<PublicJobDto>(`/v1/public/jobs/${id}/status`, { status, isActive });
    return response.data;
  },

  duplicate: async (id: string): Promise<PublicJobDto> => {
    const response = await axiosClient.post<PublicJobDto>(`/v1/public/jobs/${id}/duplicate`);
    return response.data;
  },
};
