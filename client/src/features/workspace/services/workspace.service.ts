import { axiosClient } from '@/services/axios-client';
import { type WorkspaceDetails, type PaginatedWorkspaceMembers, type LinkedOrganization } from '../types/workspace.types';

export const workspaceService = {
  async getUserOrganizations(): Promise<LinkedOrganization[]> {
    const response = await axiosClient.get<LinkedOrganization[]>('/workspace/my-organizations');
    return response.data;
  },

  async getWorkspaceDetails(organizationSlug: string): Promise<WorkspaceDetails> {
    const response = await axiosClient.get<WorkspaceDetails>(`/workspace/${organizationSlug}`);
    return response.data;
  },

  async getWorkspaceMembers(
    organizationSlug: string,
    params: {
      page?: number;
      pageSize?: number;
      search?: string;
    }
  ): Promise<PaginatedWorkspaceMembers> {
    const response = await axiosClient.get<PaginatedWorkspaceMembers>(`/workspace/${organizationSlug}/members`, {
      params
    });
    return response.data;
  }
};
