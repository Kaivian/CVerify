export enum WidgetLifecycleState {
  Idle = 'IDLE',
  Loading = 'LOADING',
  Loaded = 'LOADED',
  Refreshing = 'REFRESHING',
  Stale = 'STALE',
  Retrying = 'RETRYING',
  Offline = 'OFFLINE',
  Recovering = 'RECOVERING'
}

export interface WidgetDiagnosticInfo {
  widgetId: string;
  endpointUrl: string;
  correlationId: string;
  statusCode?: number;
  errorMessage?: string;
  failedAttempts: number;
  lastSuccessTimestamp?: string;
  lastAttemptTimestamp: string;
}
