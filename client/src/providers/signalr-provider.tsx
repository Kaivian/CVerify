"use client";

import React, { createContext, useContext, useEffect, useRef } from 'react';
import { HubConnectionBuilder, HttpTransportType, LogLevel, type HubConnection } from '@microsoft/signalr';
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
  INVITATION_CREATED: "Invitation Created",
  INVITATION_DISCOVERED: "Pending Invitation Discovered",
  INVITATION_ACCEPTED: "Invitation Accepted",
  INVITATION_DECLINED: "Invitation Declined",
  REPRESENTATIVE_ASSIGNED: "Representative Assigned",
  REPRESENTATIVE_ACTIVATED: "Representative Onboarding Completed",
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
      case 'INVITATION_ACCEPTED':
        return `${actor} and ${count - 1} others joined.`;
      case 'MEMBER_LEFT':
        return `${actor} and ${count - 1} others left.`;
      case 'INVITATION_CREATED':
      case 'MEMBER_INVITED':
        return `${actor} and ${count - 1} others invited new members.`;
      case 'INVITATION_DECLINED':
        return `${actor} and ${count - 1} others declined invitations.`;
      default:
        return `${actor} and ${count - 1} others performed this action.`;
    }
  } else {
    switch (type) {
      case 'MEMBER_JOINED':
      case 'INVITATION_ACCEPTED':
        return `${actor} joined the organization.`;
      case 'MEMBER_LEFT':
        return `${actor} left the organization.`;
      case 'MEMBER_INVITED':
      case 'INVITATION_CREATED':
        return `${actor} invited a new member.`;
      case 'INVITATION_DECLINED':
        return `${actor} declined the invitation.`;
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
      case 'INVITATION_DISCOVERED':
        return "A pending invitation for you was discovered.";
      case 'REPRESENTATIVE_ASSIGNED':
        return "You have been assigned as the representative and owner.";
      case 'REPRESENTATIVE_ACTIVATED':
        return "Onboarding as the company representative completed.";
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
      .configureLogging(LogLevel.Warning)
      .withAutomaticReconnect()
      .build();

    connection.onclose((error) => {
      console.warn('[SignalR] Connection closed:', error?.message || error);
    });

    connection.onreconnecting((error) => {
      console.warn('[SignalR] Connection reconnecting...', error?.message || error);
    });

    connection.onreconnected((connectionId) => {
      console.log('[SignalR] Connection reestablished. ConnectionId:', connectionId);
      try {
        fetchNotifications();
      } catch (err) {
        console.warn('[SignalR] Failed to fetch notifications after reconnect:', err);
      }
    });

    connection.on('ReceiveNotification', (messageJson: string) => {
      try {
        const raw = JSON.parse(messageJson);
        const item: NotificationItem = {
          id: raw.id ?? raw.Id ?? "",
          userId: raw.userId ?? raw.UserId ?? "",
          activityEventId: raw.activityEventId ?? raw.ActivityEventId ?? null,
          notificationType: raw.notificationType ?? raw.NotificationType ?? "",
          resourceType: raw.resourceType ?? raw.ResourceType ?? "",
          resourceId: raw.resourceId ?? raw.ResourceId ?? null,
          payload: raw.payload ?? raw.Payload ?? null,
          isRead: raw.isRead ?? raw.IsRead ?? false,
          isAggregated: raw.isAggregated ?? raw.IsAggregated ?? false,
          aggregateKey: raw.aggregateKey ?? raw.AggregateKey ?? null,
          createdAt: raw.createdAt ?? raw.CreatedAt ?? new Date().toISOString(),
        };

        if (item.payload) {
          const rawPayload = raw.payload ?? raw.Payload;
          item.payload = {
            count: rawPayload.count ?? rawPayload.Count ?? 1,
            actors: (rawPayload.actors ?? rawPayload.Actors ?? []).map((a: any) => ({
              id: a.id ?? a.Id ?? "",
              fullName: a.fullName ?? a.FullName ?? "",
            })),
          };
        }

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
          item.notificationType.includes('ACCEPTED') ||
          item.notificationType.includes('ASSIGNED') ||
          item.notificationType.includes('ACTIVATED')
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
    let startPromise: Promise<void> | null = null;

    const startConnection = async () => {
      try {
        startPromise = connection.start();
        await startPromise;
        if (isCancelled) {
          return;
        }
        console.log('[SignalR] Connected successfully.');
        
        // Fetch initial notification list and unread count upon successful connection
        try {
          fetchNotifications();
        } catch (err) {
          console.warn('[SignalR] Failed to fetch initial notifications:', err);
        }
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
        const conn = connectionRef.current;
        connectionRef.current = null;
        
        if (startPromise) {
          startPromise
            .then(() => {
              conn.stop();
            })
            .catch(() => {
              // Ignore failure since we're disconnecting anyway
            });
        } else {
          conn.stop();
        }
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
