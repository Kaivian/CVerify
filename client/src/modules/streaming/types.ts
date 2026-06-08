import React from "react";

export type StreamingStatus = "Pending" | "Connecting" | "Running" | "Completed" | "Failed" | "Cancelled" | "Waiting";

export type StreamingLogLevel = "Info" | "Success" | "Warning" | "Error" | "Debug";

export type StreamingEventType =
  | "SESSION_STARTED"
  | "STAGE_STARTED"
  | "STAGE_PROGRESS"
  | "STAGE_COMPLETED"
  | "STAGE_FAILED"
  | "METRIC_UPDATED"
  | "TOKEN_UPDATED"
  | "COST_UPDATED"
  | "LOG_EVENT"
  | "WARNING"
  | "ERROR"
  | "SUMMARY"
  | "SESSION_COMPLETED";

export interface StreamingLog {
  id: string;
  sessionId: string;
  stageId?: string;
  logLevel: StreamingLogLevel;
  component?: string;
  message: string;
  timestamp: string;
}

export interface StreamingMetric {
  id: string;
  sessionId: string;
  stageId?: string;
  metricName: string;
  metricValue: number;
  timestamp: string;
}

export interface StreamingStage {
  id: string;
  sessionId: string;
  stageId: string;
  stageName: string;
  parentStageId?: string;
  status: "Pending" | "Running" | "Completed" | "Failed" | "Skipped";
  progress: number;
  description?: string;
  details?: string; // JSON payload
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  retryCount: number;
  subStages?: StreamingStage[];
}

export interface StreamingSession {
  id: string;
  pipelineId: string;
  userId?: string;
  workspaceId?: string;
  status: StreamingStatus;
  progress: number;
  currentStep?: string;
  modelName?: string;
  provider?: string;
  startedAt?: string;
  completedAt?: string;
  totalCostUsd?: number;
  totalInputTokens?: number;
  totalOutputTokens?: number;
  errorMessage?: string;
  summaryData?: string; // JSON string
  expectedOutputs?: string; // JSON string list
  pipelineVersion: string;
  createdAtUtc: string;
  lastUpdatedUtc: string;
}

export interface StandardizedStreamingEvent {
  sessionId: string;
  pipelineId: string;
  eventType: StreamingEventType;
  status: StreamingStatus;
  timestamp: string;
  progress?: number;
  message?: string;
  stageId?: string;
  parentStageId?: string;
  
  // Telemetry
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  durationMs?: number;
  modelName?: string;
  provider?: string;
  
  // Logs
  logLevel?: StreamingLogLevel;
  logComponent?: string;
  
  chunk?: string;
  jsonData?: string;
}

export interface PipelineDefinition<TReport = any, TSnapshot = any> {
  pipelineId: string;
  displayName: string;
  description: string;
  gitMetricsSupported?: boolean;
  reanalyzeSupported?: boolean;
  stages: {
    id: string;
    name: string;
    description: string;
    parentStageId?: string;
  }[];
  enabledTabs: ("dashboard" | "graph" | "logs" | "costs" | "cv")[];
  renderers: {
    Dashboard?: React.ComponentType<{ report: TReport; isLive?: boolean }>;
    TrustGraph?: React.ComponentType<{ report: TReport }>;
    CvSummary?: React.ComponentType<{ report: TReport }>;
  };
  actions: {
    fetchReport: (targetId: string) => Promise<TReport>;
    fetchSnapshot?: (sessionId: string) => Promise<TSnapshot>;
    fetchCosts?: (sessionId: string) => Promise<any>;
    retryStage?: (sessionId: string, stageId: string) => Promise<any>;
    cancelSession?: (sessionId: string) => Promise<any>;
    triggerReanalyze?: (targetId: string) => Promise<string>;
  };
  mappers?: {
    mapRawEvent?: (raw: any, defaultPipelineId: string, defaultSessionId: string) => StandardizedStreamingEvent;
  };
}

export type PipelineConfig = PipelineDefinition;
