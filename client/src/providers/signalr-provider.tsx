"use client";

import React, { createContext, useContext, useEffect, useRef } from 'react';
import { HubConnectionBuilder, HttpTransportType, type HubConnection } from '@microsoft/signalr';
import { useAuthStore } from '../features/auth/store/use-auth-store';
import { useNotificationStore } from '../stores/use-notification-store';
import { type NotificationItem } from '../types/notifications.types';
import { NotificationHub as ClientToastHub } from '../infrastructure/notifications/orchestrator';
import { API_URL } from '../infrastructure/http/axios-client';

const SignalRContext = createContext<HubConnection | null>(null);

const NOTIFICATION_TYPES: Record<string, string> = {
  MEMBER_INVITED: "New Member Invited",
  MEMBER_JOINED: "Member Joined",
  MEMBER_LEFT: "Member Left",
  MEMBER_REMOVED: "Member Removed",
  MEMBER_SUSPENDED: "Member Suspended",
  MEMBER_ACTIVATED: "Member Activated",
  ROLE_ASSIGNED: "Role Assigned",
  ROLE_UPDATED: "Role Updated",
  PROJECT_CREATED: "Project Created",
  REPOSITORY_CONNECTED: "Repository Connected",
  REPOSITORY_ANALYZED: "Repository Analysis Completed",
  VERIFICATION_COMPLETED: "Verification Completed",
  VERIFICATION_FAILED: "Verification Failed",
  PASSWORD_CHANGED: "Security Alert: Password Changed",
  IP_VERIFIED: "Security Alert: New IP Verified"
};

const getNotificationDescription = (type: string, actor: string, count: number): string => {
  if (count > 1) {
    switch (type) {
      case 'MEMBER_JOINED':
        return `${actor} and ${count - 1} others joined.`;
      case 'MEMBER_LEFT':
        return `${actor} and ${count - 1} others left.`;
      default:
        return `${actor} and ${count - 1} others performed this action.`;
    }
  } else {
    switch (type) {
      case 'MEMBER_JOINED':
        return `${actor} joined the organization.`;
      case 'MEMBER_LEFT':
        return `${actor} left the organization.`;
      case 'MEMBER_INVITED':
        return `${actor} invited a new member.`;
      case 'ROLE_ASSIGNED':
        return `Role was assigned to ${actor}.`;
      case 'VERIFICATION_COMPLETED':
        return "Verification for organization completed successfully.";
      case 'VERIFICATION_FAILED':
        return "Verification for organization failed.";
      case 'PASSWORD_CHANGED':
        return "Your password was recently changed. If this wasn't you, please secure your account.";
      case 'IP_VERIFIED':
        return "A new IP address was successfully verified for your account.";
      default:
        return `${actor} performed this action.`;
    }
  }
};

export function SignalRProvider({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const addNotification = useNotificationStore((s) => s.addNotification);
  const fetchNotifications = useNotificationStore((s) => s.fetchNotifications);
  const connectionRef = useRef<HubConnection | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      if (connectionRef.current) {
        console.log('[SignalR] Disconnecting due to logout.');
        connectionRef.current.stop();
        connectionRef.current = null;
      }
      return;
    }

    // Derive hub URL from API_URL
    const hubUrl = API_URL.replace(/\/api$/, '') + '/hubs/notifications';
    console.log('[SignalR] Initializing connection to:', hubUrl);

    const connection = new HubConnectionBuilder()
      .withUrl(hubUrl, {
        withCredentials: true,
        transport: HttpTransportType.WebSockets | HttpTransportType.LongPolling
      })
      .withAutomaticReconnect()
      .build();

    connection.on('ReceiveNotification', (messageJson: string) => {
      try {
        const item = JSON.parse(messageJson) as NotificationItem;
        console.log('[SignalR] Received notification:', item);
        
        // Add to Zustand store
        addNotification(item);

        // Map category
        let category: 'info' | 'success' | 'warning' | 'error' = 'info';
        if (item.notificationType.includes('FAILED')) {
          category = 'error';
        } else if (
          item.notificationType.includes('COMPLETED') ||
          item.notificationType.includes('JOINED') ||
          item.notificationType.includes('ASSIGNED')
        ) {
          category = 'success';
        } else if (
          item.notificationType.includes('PASSWORD') ||
          item.notificationType.includes('IP')
        ) {
          category = 'warning';
        }

        // Translate Title
        const title = NOTIFICATION_TYPES[item.notificationType] || item.notificationType.replace(/_/g, ' ');

        // Translate Description
        let description = '';
        const actorName = item.payload?.actors[0]?.fullName || '';
        const count = item.payload?.count || 1;

        if (item.payload) {
          description = getNotificationDescription(item.notificationType, actorName, count);
        }

        // Trigger local toast notification
        ClientToastHub.dispatch({
          category,
          title,
          description
        });
      } catch (err) {
        console.error('[SignalR] Error parsing notification payload', err);
      }
    });

    connectionRef.current = connection;

    let isCancelled = false;

    const startConnection = async () => {
      try {
        await connection.start();
        if (isCancelled) {
          connection.stop();
          return;
        }
        console.log('[SignalR] Connected successfully.');
        
        // Fetch initial notification list and unread count upon successful connection
        fetchNotifications();
      } catch (err) {
        if (!isCancelled) {
          console.error('[SignalR] Connection establishment failed:', err);
        }
      }
    };

    startConnection();

    return () => {
      isCancelled = true;
      if (connectionRef.current) {
        console.log('[SignalR] Cleaning up connection.');
        connectionRef.current.stop();
        connectionRef.current = null;
      }
    };
  }, [isAuthenticated, user, addNotification, fetchNotifications]);

  return (
    <SignalRContext.Provider value={null}>
      {children}
    </SignalRContext.Provider>
  );
}

export const useSignalR = () => useContext(SignalRContext);
