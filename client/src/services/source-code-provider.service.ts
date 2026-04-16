import { axiosClient } from './axios-client';
import { PaginatedResult } from '../types/api.types';
import {
  SourceCodeProvider,
  SourceCodeRepository,
  RepositorySyncJobStatus,
  RepositoryFilterParams
} from '../types/source-code-provider.types';

export const sourceCodeProviderApi = {
  fetchProviders: async (): Promise<SourceCodeProvider[]> => {
    const response = await axiosClient.get<SourceCodeProvider[]>('/source-code-providers');
    return response.data;
  },

  fetchRepositories: async (params: RepositoryFilterParams): Promise<PaginatedResult<SourceCodeRepository>> => {
    const response = await axiosClient.get<PaginatedResult<SourceCodeRepository>>('/source-code-providers/repositories', {
      params
    });
    return response.data;
  },

  syncProvider: async (providerId: string): Promise<{ jobId: string; status: string }> => {
    const response = await axiosClient.post<{ jobId: string; status: string }>(`/source-code-providers/${providerId}/sync`);
    return response.data;
  },

  syncAll: async (): Promise<{ jobId: string; status: string }> => {
    const response = await axiosClient.post<{ jobId: string; status: string }>('/source-code-providers/sync-all');
    return response.data;
  },

  fetchSyncStatus: async (jobId: string): Promise<RepositorySyncJobStatus> => {
    const response = await axiosClient.get<RepositorySyncJobStatus>(`/source-code-providers/sync/status/${jobId}`);
    return response.data;
  }
};
