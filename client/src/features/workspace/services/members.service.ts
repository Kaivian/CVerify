import { axiosClient } from '@/infrastructure/http/axios-client';
import {
  type PaginatedMembers,
  type PaginatedInvitations,
  type PreAssignedRole
} from '../types/workspace.types';

export const membersService = {
  async getMembers(
    orgSlug: string,
    params: {
      page?: number;
      pageSize?: number;
      search?: string;
      status?: string;
      roleId?: string;
    }
  ): Promise<PaginatedMembers> {
    const response = await axiosClient.get<PaginatedMembers>(`/organizations/${orgSlug}/members`, {
      params
    });
    return response.data;
  },

  async updateMember(orgSlug: string, memberId: string, status: string): Promise<void> {
    await axiosClient.put(`/organizations/${orgSlug}/members/${memberId}`, { status });
  },

  async removeMember(orgSlug: string, memberId: string): Promise<void> {
    await axiosClient.delete(`/organizations/${orgSlug}/members/${memberId}`);
  },

  async inviteMembers(
    orgSlug: string,
    dto: { invitees: { email: string; roles: PreAssignedRole[] }[] }
  ): Promise<void> {
    await axiosClient.post(`/organizations/${orgSlug}/invitations`, dto);
  },

  async getInvitations(
    orgSlug: string,
    params: { page?: number; pageSize?: number; status?: string }
  ): Promise<PaginatedInvitations> {
    const response = await axiosClient.get<PaginatedInvitations>(`/organizations/${orgSlug}/invitations`, {
      params
    });
    return response.data;
  },

  async resendInvitation(orgSlug: string, invitationId: string): Promise<void> {
    await axiosClient.post(`/organizations/${orgSlug}/invitations/${invitationId}/resend`);
  },

  async cancelInvitation(orgSlug: string, invitationId: string): Promise<void> {
    await axiosClient.post(`/organizations/${orgSlug}/invitations/${invitationId}/cancel`);
  },

  async acceptInvitation(token: string): Promise<{ orgSlug: string }> {
    const response = await axiosClient.post<{ orgSlug: string }>('/invitations/accept', { token });
    return response.data;
  },

  async declineInvitation(token: string): Promise<{ orgSlug: string }> {
    const response = await axiosClient.post<{ orgSlug: string }>('/invitations/decline', { token });
    return response.data;
  },

  async acceptInvitationById(invitationId: string): Promise<{ orgSlug: string }> {
    const response = await axiosClient.post<{ orgSlug: string }>(`/invitations/${invitationId}/accept`);
    return response.data;
  },

  async declineInvitationById(invitationId: string): Promise<{ orgSlug: string }> {
    const response = await axiosClient.post<{ orgSlug: string }>(`/invitations/${invitationId}/decline`);
    return response.data;
  },

  async getWorkspaceLogs(
    orgSlug: string,
    params: {
      page?: number;
      pageSize?: number;
      search?: string;
      eventType?: string;
      actorEmail?: string;
      startDate?: string;
      endDate?: string;
      sortBy?: string;
      sortOrder?: string;
    }
  ): Promise<{
    items: {
      id: string;
      actorEmail: string;
      eventType: string;
      description: string;
      targetEmail: string | null;
      createdAt: string;
    }[];
    totalItems: number;
    page: number;
    pageSize: number;
  }> {
    const response = await axiosClient.get(`/organizations/${orgSlug}/members/audit-logs`, { params });
    return response.data;
  }
};
