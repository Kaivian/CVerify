import { axiosClient } from './axios-client';
import { type PaginatedResult } from '../types/admin.types';
import {
  type NotificationItem,
  type NotificationPreference,
  type UpdatePreferencePayload
} from '../types/notifications.types';

export const notificationsService = {
  async getNotifications(params?: {
    page?: number;
    pageSize?: number;
    unreadOnly?: boolean;
  }): Promise<PaginatedResult<NotificationItem>> {
    const response = await axiosClient.get<PaginatedResult<NotificationItem>>('/notifications', {
      params
    });
    return response.data;
  },

  async markAsRead(id: string): Promise<void> {
    await axiosClient.put(`/notifications/${id}/read`);
  },

  async markAllAsRead(): Promise<void> {
    await axiosClient.put('/notifications/read-all');
  },

  async deleteNotification(id: string): Promise<void> {
    await axiosClient.delete(`/notifications/${id}`);
  },

  async getPreferences(): Promise<NotificationPreference[]> {
    const response = await axiosClient.get<NotificationPreference[]>('/notifications/preferences');
    return response.data;
  },

  async updatePreference(payload: UpdatePreferencePayload): Promise<void> {
    await axiosClient.put('/notifications/preferences', payload);
  }
};
