import { axiosClient } from '@/services/axios-client';
import { type WorkspaceDetails, type PaginatedWorkspaceMembers, type LinkedOrganization, type LinkedWorkspace, type Post, type Job, type OrganizationListItem, type OrganizationStats, type PaginatedOrganizations } from '../types/workspace.types';

export const workspaceService = {
  async createWorkspace(
    organizationSlug: string,
    workspace: { displayName: string; slug: string; description?: string }
  ): Promise<LinkedWorkspace> {
    const response = await axiosClient.post<LinkedWorkspace>(
      `/organizations/${organizationSlug}/workspaces`,
      workspace
    );
    return response.data;
  },

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
  },

  async getOrganizations(params?: {
    search?: string;
    industry?: string;
    companySize?: string;
    isVerified?: boolean;
    location?: string;
    sortBy?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PaginatedOrganizations> {
    const response = await axiosClient.get<PaginatedOrganizations>('/workspace/organizations', {
      params
    });
    return response.data;
  },

  async getOrganizationStats(): Promise<OrganizationStats> {
    const response = await axiosClient.get<OrganizationStats>('/workspace/organizations/stats');
    return response.data;
  },

  async getWorkspaces(
    organizationSlug: string,
    params?: {
      search?: string;
      status?: string;
      sortBy?: string;
      page?: number;
      pageSize?: number;
    }
  ): Promise<{ items: any[]; totalCount: number; page: number; pageSize: number }> {
    const response = await axiosClient.get<{ items: any[]; totalCount: number; page: number; pageSize: number }>(
      `/organizations/${organizationSlug}/workspaces`,
      { params }
    );
    return response.data;
  },

  async updateWorkspace(
    organizationSlug: string,
    workspaceId: string,
    updates: { displayName: string; slug: string; description?: string; status: string }
  ): Promise<any> {
    const response = await axiosClient.patch<any>(
      `/organizations/${organizationSlug}/workspaces/${workspaceId}`,
      updates
    );
    return response.data;
  },

  async deleteWorkspace(organizationSlug: string, workspaceId: string): Promise<void> {
    await axiosClient.delete(`/organizations/${organizationSlug}/workspaces/${workspaceId}`);
  },

  async archiveWorkspace(organizationSlug: string, workspaceId: string): Promise<void> {
    await axiosClient.post(`/organizations/${organizationSlug}/workspaces/${workspaceId}/archive`);
  },

  async restoreWorkspace(organizationSlug: string, workspaceId: string): Promise<void> {
    await axiosClient.post(`/organizations/${organizationSlug}/workspaces/${workspaceId}/restore`);
  },

  async transferWorkspaceOwnership(
    organizationSlug: string,
    workspaceId: string,
    payload: { newOwnerId: string }
  ): Promise<void> {
    await axiosClient.post(`/organizations/${organizationSlug}/workspaces/${workspaceId}/transfer-ownership`, payload);
  },

  async getWorkspaceLevelMembers(organizationSlug: string, workspaceId: string): Promise<any[]> {
    const response = await axiosClient.get<any[]>(
      `/organizations/${organizationSlug}/workspaces/${workspaceId}/members`
    );
    return response.data;
  },

  async addWorkspaceLevelMember(
    organizationSlug: string,
    workspaceId: string,
    member: { userId: string; role: string }
  ): Promise<void> {
    await axiosClient.post(`/organizations/${organizationSlug}/workspaces/${workspaceId}/members`, member);
  },

  async updateWorkspaceLevelMemberRole(
    organizationSlug: string,
    workspaceId: string,
    targetUserId: string,
    payload: { role: string }
  ): Promise<void> {
    await axiosClient.patch(
      `/organizations/${organizationSlug}/workspaces/${workspaceId}/members/${targetUserId}`,
      payload
    );
  },

  async removeWorkspaceLevelMember(
    organizationSlug: string,
    workspaceId: string,
    targetUserId: string
  ): Promise<void> {
    await axiosClient.delete(`/organizations/${organizationSlug}/workspaces/${workspaceId}/members/${targetUserId}`);
  }
};
