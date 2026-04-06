import { axiosClient } from './axios-client';
import { SystemHealthResponse, SystemPingResponse, SystemVersionResponse } from '../types/system.types';

// Central helper for development mode logging
const logDev = (message: string, ...optionalParams: unknown[]) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`%c[System Telemetry Service]%c ${message}`, 'color: #06b6d4; font-weight: bold;', 'color: inherit;', ...optionalParams);
  }
};

export const systemApi = {
  /**
   * Pings the backend to check basic connectivity and calculate exact request latency.
   */
  ping: async (): Promise<{ response: SystemPingResponse; latency: number }> => {
    const startTime = performance.now();
    logDev('Triggering system connection ping...');
    try {
      const response = await axiosClient.get<SystemPingResponse>('/system/ping');
      const endTime = performance.now();
      const latency = Math.round(endTime - startTime);
      logDev(`Ping success. Latency measured: ${latency}ms`, response.data);
      return { response: response.data, latency };
    } catch (error) {
      const endTime = performance.now();
      const latency = Math.round(endTime - startTime);
      logDev(`Ping failed after ${latency}ms:`, error);
      throw error;
    }
  },

  /**
   * Fetches the detailed health checklist of backend dependencies.
   * Utilizes a custom validateStatus handler so that 503 (degraded status) is successfully
   * resolved, allowing the UI to read and render specific service breakdowns.
   */
  fetchHealth: async (): Promise<SystemHealthResponse> => {
    logDev('Requesting database, auth, and cache health status...');
    try {
      const response = await axiosClient.get<SystemHealthResponse>('/system/health', {
        validateStatus: (status) => (status >= 200 && status < 300) || status === 503,
      });
      logDev('Health statuses resolved:', response.data);
      return response.data;
    } catch (error) {
      logDev('Failed to query health statuses:', error);
      throw error;
    }
  },

  /**
   * Queries server version and active builds information.
   */
  fetchVersion: async (): Promise<SystemVersionResponse> => {
    logDev('Querying server version metadata...');
    try {
      const response = await axiosClient.get<SystemVersionResponse>('/system/version');
      logDev('Version metadata resolved:', response.data);
      return response.data;
    } catch (error) {
      logDev('Failed to query version metadata:', error);
      throw error;
    }
  },
};
