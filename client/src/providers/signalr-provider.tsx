"use client";

import React, { createContext, useContext, useEffect, useRef } from 'react';
import { HubConnectionBuilder, HttpTransportType, type HubConnection } from '@microsoft/signalr';
import { useAuthStore } from '../features/auth/store/use-auth-store';
import { useNotificationStore } from '../stores/use-notification-store';
import { type NotificationItem } from '../types/notifications.types';
import { NotificationHub as ClientToastHub } from '../infrastructure/notifications/orchestrator';
import { API_URL } from '../infrastructure/http/axios-client';
import i18n from '../lib/i18n';

const SignalRContext = createContext<HubConnection | null>(null);

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
        const title = i18n.t(`notifications:types.${item.notificationType}`, {
          defaultValue: item.notificationType.replace(/_/g, ' ')
        });

        // Translate Description
        let description = '';
        const actorName = item.payload?.actors[0]?.fullName || '';
        const count = item.payload?.count || 1;

        if (item.payload) {
          if (count > 1) {
            description = i18n.t(`notifications:messages.${item.notificationType}_multiple`, {
              actor: actorName,
              count: count - 1,
              defaultValue: `${actorName} and ${count - 1} others performed this action.`
            });
          } else {
            description = i18n.t(`notifications:messages.${item.notificationType}_single`, {
              actor: actorName,
              defaultValue: i18n.t(`notifications:messages.${item.notificationType}`, {
                actor: actorName,
                defaultValue: `${actorName} performed this action.`
              })
            });
          }
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

    const startConnection = async () => {
      try {
        await connection.start();
        console.log('[SignalR] Connected successfully.');
        
        // Fetch initial notification list and unread count upon successful connection
        fetchNotifications();
      } catch (err) {
        console.error('[SignalR] Connection establishment failed:', err);
      }
    };

    startConnection();

    return () => {
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
