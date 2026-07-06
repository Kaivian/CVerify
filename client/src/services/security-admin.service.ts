import { axiosClient } from './axios-client';
import { type PaginatedResult } from '../types/admin.types';
import {
  type SecurityEventListItem,
  type SecurityEventDetail,
  type SecurityRule,
  type SecurityDashboardData
} from '../types/security.types';

export const securityAdminService = {
  async getSecurityEvents(params?: {
    search?: string;
    severity?: string;
    status?: string;
    category?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PaginatedResult<SecurityEventListItem>> {
    const response = await axiosClient.get<PaginatedResult<SecurityEventListItem>>('/admin/security/events', {
      params
    });
    return response.data;
  },

  async getSecurityEventDetails(id: string): Promise<SecurityEventDetail> {
    const response = await axiosClient.get<SecurityEventDetail>(`/admin/security/events/${id}`);
    return response.data;
  },

  async updateEventStatus(
    id: string,
    payload: { status: string; commentText?: string }
  ): Promise<{ message: string }> {
    const response = await axiosClient.post<{ message: string }>(`/admin/security/events/${id}/status`, payload);
    return response.data;
  },

  async assignEvent(id: string, payload: { assignedToUserId: string | null }): Promise<{ message: string }> {
    const response = await axiosClient.post<{ message: string }>(`/admin/security/events/${id}/assign`, payload);
    return response.data;
  },

  async addEventComment(id: string, payload: { commentText: string }): Promise<{ message: string }> {
    const response = await axiosClient.post<{ message: string }>(`/admin/security/events/${id}/comment`, payload);
    return response.data;
  },

  async triggerContainment(id: string, actionType: 'UserSuspend' | 'IpBlock'): Promise<{ message: string }> {
    const response = await axiosClient.post<{ message: string }>(
      `/admin/security/events/${id}/contain`,
      {},
      {
        params: { actionType }
      }
    );
    return response.data;
  },

  async getDashboardData(): Promise<SecurityDashboardData> {
    const response = await axiosClient.get<SecurityDashboardData>('/admin/security/dashboard');
    return response.data;
  },

  async getSecurityRules(): Promise<SecurityRule[]> {
    const response = await axiosClient.get<SecurityRule[]>('/admin/security/rules');
    return response.data;
  },

  async updateSecurityRule(
    id: string,
    payload: { isEnabled: boolean; severity: string; configurationJson: string }
  ): Promise<{ message: string }> {
    const response = await axiosClient.put<{ message: string }>(`/admin/security/rules/${id}`, payload);
    return response.data;
  }
};
