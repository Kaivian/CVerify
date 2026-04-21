import { axiosClient } from "./axios-client";
import { RepositoryAnalysis, AnalysisJob, AnalysisJobEvent } from "../types/repository-analysis.types";

export const repositoryAnalysisApi = {
  getActiveJobs: async (): Promise<Array<{ id: string; repositoryId: string; status: string; progress: number; currentStep?: string }>> => {
    const response = await axiosClient.get<Array<{ id: string; repositoryId: string; status: string; progress: number; currentStep?: string }>>("/repository-analyses/active");
    return response.data;
  },

  triggerAnalysis: async (repositoryId: string): Promise<{ jobId: string; status: string }> => {
    const response = await axiosClient.post<{ jobId: string; status: string }>(`/repositories/${repositoryId}/analyses`);
    return response.data;
  },

  getJobStatus: async (jobId: string): Promise<AnalysisJob> => {
    const response = await axiosClient.get<AnalysisJob>(`/repository-analyses/jobs/${jobId}`);
    return response.data;
  },

  getJobEvents: async (jobId: string): Promise<AnalysisJobEvent[]> => {
    const response = await axiosClient.get<AnalysisJobEvent[]>(`/repository-analyses/jobs/${jobId}/events`);
    return response.data;
  },

  cancelJob: async (jobId: string): Promise<{ message: string }> => {
    const response = await axiosClient.post<{ message: string }>(`/repository-analyses/jobs/${jobId}/cancel`);
    return response.data;
  },

  getLatestReport: async (repositoryId: string): Promise<RepositoryAnalysis> => {
    const response = await axiosClient.get<RepositoryAnalysis>(`/repositories/${repositoryId}/analyses/latest`);
    return response.data;
  }
};
