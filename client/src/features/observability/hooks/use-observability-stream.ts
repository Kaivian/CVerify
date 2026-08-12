'use client';

import { useEffect, useRef, useState } from 'react';
import { HubConnectionBuilder, HttpTransportType, LogLevel, HubConnection } from '@microsoft/signalr';
import { useAuthStore } from '@/features/auth/store/use-auth-store';
import { useObservabilityStore } from '../store/use-observability-store';
import { ObservabilityLogEntry, SystemMetricsResponse } from '@/types/observability.types';
import { API_URL, axiosClient } from '@/infrastructure/http/axios-client';

export function useObservabilityStream(serviceFilter: 'ALL' | 'Frontend' | 'Backend' | 'AI Backend' = 'ALL') {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);

  const { setMetrics, addLog, addLogs } = useObservabilityStore();
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connectionRef = useRef<HubConnection | null>(null);

  useEffect(() => {
    // 1. Fetch initial historical logs immediately via REST API
    const fetchInitialLogs = async () => {
      try {
        const response = await axiosClient.get(`/admin/observability/logs?service=${encodeURIComponent(serviceFilter)}&count=200`);
        if (response.data && Array.isArray(response.data)) {
          addLogs(response.data);
        }
      } catch (err) {
        console.warn('[ObservabilityStream] Initial REST log fetch warning:', err);
      }
    };

    fetchInitialLogs();

    // Emits a synthetic Frontend Heartbeat/Navigation Log when on Frontend tab
    if (serviceFilter === 'Frontend' || serviceFilter === 'ALL') {
      const initLog: ObservabilityLogEntry = {
        id: `fe-init-${Date.now()}`,
        timestamp: new Date().toISOString(),
        severity: 'INFO',
        service: 'Frontend',
        source: 'PageRouter',
        message: `Connected to Frontend Log Stream (${window.location.pathname})`,
        metadata: {
          userAgent: navigator.userAgent,
          screenWidth: window.innerWidth,
          screenHeight: window.innerHeight,
        },
      };
      addLog(initLog);
    }

    const hubUrl = API_URL.replace(/\/api$/, '') + '/hubs/admin';

    const connection = new HubConnectionBuilder()
      .withUrl(hubUrl, {
        withCredentials: true,
        transport: HttpTransportType.WebSockets | HttpTransportType.LongPolling,
        accessTokenFactory: async () => {
          try {
            await axiosClient.get('/auth/me');
          } catch {}
          return '';
        },
      })
      .configureLogging(process.env.NODE_ENV === 'development' ? LogLevel.Information : LogLevel.Warning)
      .withAutomaticReconnect()
      .build();

    connection.on('ReceiveSystemMetrics', (metrics: SystemMetricsResponse) => {
      setMetrics(metrics);
    });

    connection.on('ReceiveLogEntry', (entry: ObservabilityLogEntry) => {
      if (serviceFilter === 'ALL' || entry.service === serviceFilter) {
        addLog(entry);
      }
    });

    connection.onreconnecting(() => {
      setIsConnected(false);
    });

    connection.onreconnected(async () => {
      setIsConnected(true);
      try {
        const logs: ObservabilityLogEntry[] = await connection.invoke('GetRecentLogs', serviceFilter, 200);
        if (logs) addLogs(logs);
      } catch (err) {
        console.warn('[ObservabilityStream] Failed to refresh recent logs after reconnect:', err);
      }
    });

    const startStream = async () => {
      try {
        await connection.start();
        connectionRef.current = connection;
        setIsConnected(true);
        setError(null);

        // Fetch initial metrics & logs
        try {
          const metrics: SystemMetricsResponse = await connection.invoke('GetInitialMetrics');
          if (metrics) setMetrics(metrics);
        } catch (mErr) {
          console.warn('[ObservabilityStream] Metric fetch fallback', mErr);
        }

        try {
          const logs: ObservabilityLogEntry[] = await connection.invoke('GetRecentLogs', serviceFilter, 200);
          if (logs && logs.length > 0) addLogs(logs);
        } catch (lErr) {
          console.warn('[ObservabilityStream] Recent log fetch fallback', lErr);
        }
      } catch (err: any) {
        console.error('[ObservabilityStream] Connection failed:', err);
        setIsConnected(false);
        setError(err?.message || 'Failed to connect to observability hub');
      }
    };

    startStream();

    // Frontend Client Console & Unhandled Exception Interceptor
    const handleGlobalError = (event: ErrorEvent) => {
      const clientLog: ObservabilityLogEntry = {
        id: `fe-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toISOString(),
        severity: 'ERROR',
        service: 'Frontend',
        source: 'Window.OnError',
        message: event.message || 'Unhandled Window Error',
        metadata: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error?.stack,
        },
      };
      addLog(clientLog);
      if (connectionRef.current && connectionRef.current.state === 'Connected') {
        connectionRef.current.invoke('SubmitFrontendLog', clientLog).catch(() => {});
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const clientLog: ObservabilityLogEntry = {
        id: `fe-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toISOString(),
        severity: 'ERROR',
        service: 'Frontend',
        source: 'UnhandledRejection',
        message: String(event.reason?.message || event.reason || 'Unhandled Promise Rejection'),
        metadata: {
          reason: String(event.reason),
          stack: event.reason?.stack,
        },
      };
      addLog(clientLog);
      if (connectionRef.current && connectionRef.current.state === 'Connected') {
        connectionRef.current.invoke('SubmitFrontendLog', clientLog).catch(() => {});
      }
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      if (connectionRef.current) {
        connectionRef.current.stop();
        connectionRef.current = null;
      }
    };
  }, [isAuthenticated, serviceFilter, addLog, addLogs, setMetrics]);

  return { isConnected, error };
}
