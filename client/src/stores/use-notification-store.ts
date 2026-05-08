"use client";

import { create } from 'zustand';
import { type NotificationItem } from '../types/notifications.types';
import { notificationsService } from '../services/notifications.service';

interface NotificationState {
  notifications: NotificationItem[];
  unreadCount: number;
  isLoading: boolean;
  page: number;
  pageSize: number;
  totalCount: number;
  unreadOnly: boolean;

  fetchNotifications: () => Promise<void>;
  addNotification: (item: NotificationItem) => void;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  setUnreadOnly: (unreadOnly: boolean) => void;
  setPage: (page: number) => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  page: 1,
  pageSize: 10,
  totalCount: 0,
  unreadOnly: false,

  fetchNotifications: async () => {
    set({ isLoading: true });
    try {
      const { page, pageSize, unreadOnly } = get();
      const result = await notificationsService.getNotifications({ page, pageSize, unreadOnly });
      
      // Fetch unread count to keep the badge accurate
      const unreadResult = await notificationsService.getNotifications({
        page: 1,
        pageSize: 1,
        unreadOnly: true
      });

      set({
        notifications: result.items,
        totalCount: result.totalCount,
        unreadCount: unreadResult.totalCount,
        isLoading: false
      });
    } catch (error) {
      console.error('Failed to fetch notifications', error);
      set({ isLoading: false });
    }
  },

  addNotification: (item) => {
    const { notifications, unreadCount } = get();
    const updatedNotifications = [...notifications];
    let countChange = 1;

    if (item.aggregateKey) {
      // Find if we have an existing unread aggregated notification with the same key
      const index = updatedNotifications.findIndex(
        (n) => n.aggregateKey === item.aggregateKey && !n.isRead
      );

      if (index !== -1) {
        // Replace it (aggregate window slides)
        updatedNotifications[index] = item;
        countChange = 0; // Already counted as unread
      } else {
        updatedNotifications.unshift(item);
      }
    } else {
      updatedNotifications.unshift(item);
    }

    set({
      notifications: updatedNotifications,
      unreadCount: unreadCount + countChange,
      totalCount: get().totalCount + countChange
    });
  },

  markAsRead: async (id) => {
    try {
      await notificationsService.markAsRead(id);
      
      const { notifications, unreadCount } = get();
      const updated = notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n
      );
      
      set({
        notifications: updated,
        unreadCount: Math.max(0, unreadCount - 1)
      });
    } catch (error) {
      console.error('Failed to mark notification as read', error);
    }
  },

  markAllAsRead: async () => {
    try {
      await notificationsService.markAllAsRead();
      
      const { notifications } = get();
      const updated = notifications.map((n) => ({ ...n, isRead: true }));
      
      set({
        notifications: updated,
        unreadCount: 0
      });
    } catch (error) {
      console.error('Failed to mark all notifications as read', error);
    }
  },

  deleteNotification: async (id) => {
    try {
      await notificationsService.deleteNotification(id);
      
      const { notifications, unreadCount } = get();
      const deleted = notifications.find((n) => n.id === id);
      const updated = notifications.filter((n) => n.id !== id);
      
      set({
        notifications: updated,
        unreadCount: deleted && !deleted.isRead ? Math.max(0, unreadCount - 1) : unreadCount,
        totalCount: Math.max(0, get().totalCount - 1)
      });
    } catch (error) {
      console.error('Failed to delete notification', error);
    }
  },

  setUnreadOnly: (unreadOnly) => {
    set({ unreadOnly, page: 1 });
    get().fetchNotifications();
  },

  setPage: (page) => {
    set({ page });
    get().fetchNotifications();
  }
}));
