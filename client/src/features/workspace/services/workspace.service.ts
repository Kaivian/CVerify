import { axiosClient } from '@/services/axios-client';
import { type WorkspaceDetails, type PaginatedWorkspaceMembers, type LinkedOrganization, type Post, type Job } from '../types/workspace.types';

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
      publicOnly?: boolean;
    }
  ): Promise<PaginatedWorkspaceMembers> {
    const response = await axiosClient.get<PaginatedWorkspaceMembers>(`/workspace/${organizationSlug}/members`, {
      params
    });
    return response.data;
  },

  async uploadBanner(organizationSlug: string, file: File): Promise<{ avatarUrl: string }> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await axiosClient.post<{ avatarUrl: string }>(
      `/workspace/${organizationSlug}/banner`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  },

  async uploadAvatar(organizationSlug: string, file: File): Promise<{ avatarUrl: string }> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await axiosClient.post<{ avatarUrl: string }>(
      `/workspace/${organizationSlug}/avatar`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  },

  async updateWorkspaceDetails(
    organizationSlug: string,
    updates: Partial<WorkspaceDetails>
  ): Promise<WorkspaceDetails> {
    const response = await axiosClient.patch<WorkspaceDetails>(
      `/workspace/${organizationSlug}`,
      updates
    );
    return response.data;
  },

  async toggleFollowWorkspace(
    organizationSlug: string
  ): Promise<{ followerCount: number; isFollowing: boolean }> {
    const response = await axiosClient.post<{ followerCount: number; isFollowing: boolean }>(
      `/workspace/${organizationSlug}/follow`
    );
    return response.data;
  },

  async uploadWorkspaceMedia(organizationSlug: string, files: File[]): Promise<string[]> {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    const response = await axiosClient.post<string[]>(
      `/workspace/${organizationSlug}/media/upload`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  },

  async getWorkspacePosts(organizationSlug: string): Promise<Post[]> {
    const response = await axiosClient.get<Post[]>(`/workspace/${organizationSlug}/posts`);
    return response.data;
  },

  async createWorkspacePost(
    organizationSlug: string,
    post: { category: string; content: string; images?: string[]; imageUrls?: string[] }
  ): Promise<Post> {
    const response = await axiosClient.post<Post>(`/workspace/${organizationSlug}/posts`, post);
    return response.data;
  },

  async getWorkspaceJobs(organizationSlug: string): Promise<Job[]> {
    const response = await axiosClient.get<Job[]>(`/workspace/${organizationSlug}/jobs`);
    return response.data;
  },

  async createWorkspaceJob(organizationSlug: string, job: Partial<Job>): Promise<Job> {
    const response = await axiosClient.post<Job>(`/workspace/${organizationSlug}/jobs`, job);
    return response.data;
  }
};
