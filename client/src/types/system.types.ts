/**
 * Status values for core services.
 */
export type ServiceStatus = 'healthy' | 'unhealthy';

export interface HealthServices {
  database: ServiceStatus;
  auth: ServiceStatus;
  redis: ServiceStatus;
}

/**
 * Enterprise standard health diagnostics response structure.
 */
export interface SystemHealthResponse {
  success: boolean;
  message: string;
  timestamp: string;
  environment: string;
  services: HealthServices;
}

/**
 * Standard simple ping-pong response structure.
 */
export interface SystemPingResponse {
  success: boolean;
  message: string;
  timestamp: string;
}

/**
 * Standard build and software versioning response structure.
 */
export interface SystemVersionResponse {
  success: boolean;
  version: string;
  environment: string;
  buildDate: string;
  timestamp: string;
}

/**
 * Bundled frontend telemetry UI state.
 */
export interface SystemTelemetryData {
  health: SystemHealthResponse | null;
  ping: SystemPingResponse | null;
  version: SystemVersionResponse | null;
  latency: number | null; // in milliseconds
  lastChecked: string | null;
}
