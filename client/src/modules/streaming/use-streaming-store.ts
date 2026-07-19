import { create } from "zustand";
import { 
  type StreamingSession, 
  type StreamingStage, 
  type StreamingLog, 
  type StreamingStatus, 
  type StandardizedStreamingEvent,
} from "./types";
import { pipelineRegistry } from "./registry";
import { streamingHistoryApi } from "./history-service";

interface StreamingState {
  activeSession: StreamingSession | null;
  stages: StreamingStage[];
  logs: StreamingLog[];
  elapsedMs: number;
  isModalOpen: boolean;
  isConnecting: boolean;
  logsSearchQuery: string;
  logsLevelFilter: string;
  autoScroll: boolean;
  errorMessage: string | null;
  latestTextChunk: string | null;

  // Platform State Additions
  viewMode: "report" | "graph" | "logs" | "costs" | "cv";
  targetId: string | null;
  costs: any | null;
  validationError: string | null;
  partialSnapshot: any | null;
  isRetryingTaskId: string | null;

  // Actions
  openModal: (pipelineId: string, sessionId: string, targetId?: string) => void;
  closeModal: () => void;
  connectSession: (pipelineId: string, sessionId: string, customSseUrl?: string, targetId?: string) => void;
  disconnect: () => void;
  loadHistorySession: (sessionId: string, targetId?: string) => Promise<void>;
  retryStage: (stageId: string) => Promise<void>;
  triggerReanalyze: () => Promise<void>;
  setLogsSearchQuery: (query: string) => void;
  setLogsLevelFilter: (filter: string) => void;
  setAutoScroll: (autoScroll: boolean) => void;
  setViewMode: (mode: "report" | "graph" | "logs" | "costs" | "cv") => void;
}

let eventSource: EventSource | null = null;
let timerInterval: NodeJS.Timeout | null = null;
let logBuffer: StreamingLog[] = [];
let bufferInterval: NodeJS.Timeout | null = null;
const processedEventIds = new Set<string>();
let lastSequenceNumber = 0;

// Canonical State Machine Transition Rules
export const isValidSessionTransition = (current: StreamingStatus, target: StreamingStatus): boolean => {
  if (current === target) return true;
  const terminal = ["Completed", "Failed", "Cancelled"];
  if (terminal.includes(current)) return false;
  if (current === "Pending" && (target === "Running" || target === "Connecting")) return true;
  if (current === "Connecting" && (target === "Running" || target === "Pending")) return true;
  if (current === "Running" && terminal.includes(target)) return true;
  return false;
};

export const isValidStageTransition = (current: StreamingStage["status"], target: StreamingStage["status"], isRetry: boolean = false): boolean => {
  if (current === target) return true;
  if (current === "Pending" && (target === "Running" || target === "Completed" || target === "Failed" || target === "Skipped")) return true;
  if (current === "Running" && (target === "Completed" || target === "Failed" || target === "Skipped")) return true;
  if (current === "Failed" && target === "Running" && isRetry) return true;
  if ((current === "Completed" || current === "Skipped") && target === "Running" && isRetry) return true;
  return false;
};

const mergeDbStages = (
  pipelineId: string,
  sessionId: string,
  dbStages: Partial<StreamingStage & { detailsJson?: string }>[]
): StreamingStage[] => {
  const config = pipelineRegistry.get(pipelineId);
  const registryStages: StreamingStage[] = config
    ? config.stages.map(s => ({
        id: s.id,
        sessionId,
        stageId: s.id,
        stageName: s.name,
        parentStageId: s.parentStageId,
        status: "Pending",
        progress: 0,
        description: s.description,
        retryCount: 0
      }))
    : [];

  if (!dbStages || dbStages.length === 0) {
    return registryStages;
  }

  const dbMap = new Map<string, Partial<StreamingStage & { detailsJson?: string }>>();
  dbStages.forEach(s => {
    const key = (s.stageId || s.id || "").toLowerCase();
    if (key) dbMap.set(key, s);
  });

  const merged = registryStages.map(r => {
    const dbStage = dbMap.get(r.stageId.toLowerCase());
    if (dbStage) {
      dbMap.delete(r.stageId.toLowerCase());
      const stageStatus = dbStage.status as StreamingStage["status"] | undefined;
      return {
        ...r,
        status: stageStatus || r.status,
        progress: dbStage.progress !== undefined ? dbStage.progress : r.progress,
        description: dbStage.description || r.description,
        details: dbStage.details || dbStage.detailsJson || r.details,
        retryCount: dbStage.retryCount || r.retryCount,
        durationMs: dbStage.durationMs || r.durationMs,
        startedAt: dbStage.startedAt || r.startedAt,
        completedAt: dbStage.completedAt || r.completedAt,
      };
    }
    return r;
  });

  // Append any extra stages that were in the DB but not in the registry
  dbMap.forEach((dbStage) => {
    const stageId = dbStage.stageId || dbStage.id || "";
    const stageStatus = (dbStage.status as StreamingStage["status"]) || "Pending";
    merged.push({
      id: dbStage.id || stageId,
      sessionId,
      stageId,
      stageName: dbStage.stageName || stageId,
      parentStageId: dbStage.parentStageId,
      status: stageStatus,
      progress: dbStage.progress || 0,
      description: dbStage.description || "",
      details: dbStage.details || dbStage.detailsJson,
      retryCount: dbStage.retryCount || 0,
      durationMs: dbStage.durationMs,
      startedAt: dbStage.startedAt,
      completedAt: dbStage.completedAt,
    });
  });

  return merged;
};

export const useStreamingStore = create<StreamingState>((set, get) => {
  const cleanupConnection = () => {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    if (bufferInterval) {
      clearInterval(bufferInterval);
      bufferInterval = null;
    }
    logBuffer = [];
    processedEventIds.clear();
    lastSequenceNumber = 0;
    set({ latestTextChunk: null });
  };

  const mapToStandardEvent = (raw: any, defaultPipelineId: string, defaultSessionId: string): StandardizedStreamingEvent => {
    // 1. Query registry mapper if exists
    const registryDef = pipelineRegistry.get(defaultPipelineId);
    if (registryDef?.mappers?.mapRawEvent) {
      return registryDef.mappers.mapRawEvent(raw, defaultPipelineId, defaultSessionId);
    }

    // 2. Check if it's already a standardized event
    if (raw.eventType && raw.sessionId) {
      return raw as StandardizedStreamingEvent;
    }

    // 3. Map candidate assessment legacy progress events
    if (raw.step && raw.status && (raw.percentage !== undefined || raw.progress !== undefined)) {
      const step = raw.step;
      const status = raw.status as StreamingStatus;
      const progress = raw.percentage ?? raw.progress ?? 0;
      const message = raw.message || "";
      
      let eventType: any = "LOG_EVENT";
      if (status === "Completed") eventType = "STAGE_COMPLETED";
      else if (status === "Failed") eventType = "STAGE_FAILED";
      else if (progress > 0) eventType = "STAGE_PROGRESS";
      else eventType = "STAGE_STARTED";

      return {
        sessionId: defaultSessionId,
        pipelineId: defaultPipelineId,
        eventType,
        status,
        timestamp: new Date().toISOString(),
        progress,
        message,
        stageId: step,
        inputTokens: raw.inputTokens,
        outputTokens: raw.outputTokens,
        costUsd: raw.costUsd,
        jsonData: raw.jsonData,
        chunk: raw.chunk,
        modelName: raw.modelName,
        provider: raw.provider,
      };
    }

    // 4. Map repository analysis legacy events
    if (raw.taskType && raw.taskStatus) {
      const taskType = raw.taskType;
      const taskStatus = raw.taskStatus;
      const progress = raw.taskProgress ?? raw.progress ?? 0;
      const message = raw.message || "";

      let eventType: any = "LOG_EVENT";
      if (taskStatus === "Completed") eventType = "STAGE_COMPLETED";
      else if (taskStatus === "Failed") eventType = "STAGE_FAILED";
      else eventType = "STAGE_PROGRESS";

      return {
        sessionId: defaultSessionId,
        pipelineId: defaultPipelineId,
        eventType,
        status: raw.status ?? "Running",
        timestamp: raw.timestamp || new Date().toISOString(),
        progress: raw.progress ?? progress,
        message,
        stageId: taskType,
        inputTokens: raw.promptTokens,
        outputTokens: raw.completionTokens,
        costUsd: raw.estimatedCostUsd,
        modelName: raw.modelName,
        provider: raw.provider,
      };
    }

    // Fallback basic parse
    return {
      sessionId: defaultSessionId,
      pipelineId: defaultPipelineId,
      eventType: "LOG_EVENT",
      status: "Running",
      timestamp: new Date().toISOString(),
      message: typeof raw === "string" ? raw : JSON.stringify(raw),
    };
  };

  const processStreamingEvent = (event: StandardizedStreamingEvent) => {
    const { activeSession, stages, targetId } = get();
    if (!activeSession) return;

    // Idempotency & out-of-order deduplication
    if (event.eventId && processedEventIds.has(event.eventId)) {
      return;
    }
    if (event.sequenceNumber !== undefined && event.sequenceNumber > 0 && event.sequenceNumber <= lastSequenceNumber) {
      return;
    }
    if (event.eventId) {
      processedEventIds.add(event.eventId);
    }
    if (event.sequenceNumber !== undefined && event.sequenceNumber > 0) {
      lastSequenceNumber = event.sequenceNumber;
    }

    if (event.chunk !== undefined) {
      set({ latestTextChunk: event.chunk });
    }

    // 1. Update Session overall metrics & progress
    // Guard: stage-level events must not promote session status to terminal states.
    // Only session-level events (SESSION_COMPLETED, etc.) carry the true session status.
    const isStageEvent = event.eventType?.startsWith("STAGE_") || event.eventType === "TOKEN_UPDATED" || event.eventType === "COST_UPDATED" || event.eventType === "METRIC_UPDATED" || event.eventType === "LOG_EVENT";
    const terminalStatuses = ["Completed", "Failed", "Cancelled"];
    
    let effectiveStatus = activeSession.status;
    if (!isStageEvent && event.status && isValidSessionTransition(activeSession.status, event.status)) {
      effectiveStatus = event.status;
    }

    const updatedSession: StreamingSession = {
      ...activeSession,
      status: effectiveStatus,
      progress: event.progress !== undefined ? Math.max(activeSession.progress, event.progress) : activeSession.progress,
      currentStep: event.stageId || activeSession.currentStep,
      lastUpdatedUtc: new Date().toISOString(),
    };

    if (event.inputTokens) updatedSession.totalInputTokens = (updatedSession.totalInputTokens || 0) + event.inputTokens;
    if (event.outputTokens) updatedSession.totalOutputTokens = (updatedSession.totalOutputTokens || 0) + event.outputTokens;
    if (event.costUsd) updatedSession.totalCostUsd = (updatedSession.totalCostUsd || 0) + event.costUsd;
    if (event.modelName) updatedSession.modelName = event.modelName;
    if (event.provider) updatedSession.provider = event.provider;

    const registryDef = pipelineRegistry.get(activeSession.pipelineId);

    if (effectiveStatus === "Completed" && !isStageEvent) {
      updatedSession.completedAt = new Date().toISOString();
      if (event.jsonData) updatedSession.summaryData = event.jsonData;
      cleanupConnection();
      
      // Load final report if defined — retry with delay to handle the race
      // condition where the SSE fires "Completed" before the backend has
      // finished persisting the analysis report.
      if (registryDef?.actions.fetchReport && targetId) {
        const fetchWithRetry = async (retriesLeft: number, delayMs: number): Promise<unknown> => {
          try {
            return await registryDef.actions.fetchReport!(targetId);
          } catch (err: any) {
            const is404 = err?.response?.status === 404 || err?.status === 404;
            if (is404 && retriesLeft > 0) {
              await new Promise(resolve => setTimeout(resolve, delayMs));
              return fetchWithRetry(retriesLeft - 1, delayMs * 2);
            }
            throw err;
          }
        };

        fetchWithRetry(3, 1000)
          .then(report => {
            set(state => {
              if (state.activeSession) {
                return {
                  activeSession: {
                    ...state.activeSession,
                    summaryData: typeof report === "string" ? report : JSON.stringify(report)
                  }
                };
              }
              return {};
            });
          })
          .catch(err => {
            console.error("Failed to load completed report after retries:", err);
            const msg = err.response?.data?.message || err.message || String(err);
            set({ validationError: msg });
          });
      }
    } else if (effectiveStatus === "Failed" && !isStageEvent) {
      updatedSession.completedAt = new Date().toISOString();
      updatedSession.errorMessage = event.message || "Execution encountered an error";
      cleanupConnection();
      set({ errorMessage: updatedSession.errorMessage });
    } else if (effectiveStatus === "Cancelled" && !isStageEvent) {
      updatedSession.completedAt = new Date().toISOString();
      cleanupConnection();
    }

    // 2. Update timeline stages
    const updatedStages = [...stages];
    if (event.stageId) {
      const stageIndex = updatedStages.findIndex(s => s.stageId === event.stageId);
      if (stageIndex !== -1) {
        const stage = updatedStages[stageIndex];
        let targetStageStatus: StreamingStage["status"] = stage.status;
        if (event.eventType === "STAGE_COMPLETED") {
          targetStageStatus = "Completed";
        } else if (event.eventType === "STAGE_FAILED") {
          targetStageStatus = "Failed";
        } else if (event.eventType === "STAGE_STARTED") {
          targetStageStatus = "Running";
        } else if (event.stageStatus && isValidStageTransition(stage.status, event.stageStatus as StreamingStage["status"])) {
          targetStageStatus = event.stageStatus as StreamingStage["status"];
        } else if (stage.status === "Pending" && (event.eventType === "STAGE_PROGRESS" || (event.stageProgress !== undefined && event.stageProgress > 0))) {
          targetStageStatus = "Running";
        }

        const stageStatus = isValidStageTransition(stage.status, targetStageStatus) ? targetStageStatus : stage.status;

        const updatedStage: StreamingStage = {
          ...stage,
          status: stageStatus,
          progress: event.stageProgress !== undefined 
            ? event.stageProgress 
            : (event.eventType === "STAGE_COMPLETED" ? 100 : event.progress !== undefined ? event.progress : stage.progress),
          description: event.message || stage.description,
          details: event.jsonData || stage.details,
        };

        if (stageStatus === "Running" && !stage.startedAt) {
          updatedStage.startedAt = new Date().toISOString();
        } else if ((stageStatus === "Completed" || stageStatus === "Failed") && !stage.completedAt) {
          updatedStage.completedAt = new Date().toISOString();
          if (updatedStage.startedAt) {
            updatedStage.durationMs = new Date(updatedStage.completedAt).getTime() - new Date(updatedStage.startedAt).getTime();
          }
        }

        updatedStages[stageIndex] = updatedStage;

        // Backend is the single source of truth — auto-completion of preceding stages has been eliminated.

        // Fetch intermediate snapshot only on the actual stage completion event
        if (event.eventType === "STAGE_COMPLETED" && registryDef?.actions.fetchSnapshot) {
          registryDef.actions.fetchSnapshot(activeSession.id)
            .then(snapshot => set({ partialSnapshot: snapshot }))
            .catch(err => console.error("Failed to fetch intermediate snapshot:", err));
        }
      }
    }

    // 3. Buffer logs for batching
    if (event.message) {
      const newLog: StreamingLog = {
        id: Math.random().toString(36).substring(7),
        sessionId: event.sessionId,
        stageId: event.stageId,
        logLevel: event.logLevel || (event.status === "Failed" ? "Error" : event.status === "Completed" ? "Success" : "Info"),
        component: event.logComponent || event.stageId || "Orchestrator",
        message: event.message,
        timestamp: event.timestamp || new Date().toISOString(),
      };
      logBuffer.push(newLog);
    }

    set({ activeSession: updatedSession, stages: updatedStages });
  };

  return {
    activeSession: null,
    stages: [],
    logs: [],
    elapsedMs: 0,
    isModalOpen: false,
    isConnecting: false,
    logsSearchQuery: "",
    logsLevelFilter: "All",
    autoScroll: true,
    errorMessage: null,
    latestTextChunk: null,

    // Platform State Initializers
    viewMode: "logs",
    targetId: null,
    costs: null,
    validationError: null,
    partialSnapshot: null,
    isRetryingTaskId: null,

    openModal: (pipelineId: string, sessionId: string, targetId?: string) => {
      const config = pipelineRegistry.get(pipelineId);
      const initialStages: StreamingStage[] = config
        ? config.stages.map(s => ({
            id: s.id,
            sessionId,
            stageId: s.id,
            stageName: s.name,
            parentStageId: s.parentStageId,
            status: "Pending",
            progress: 0,
            description: s.description,
            retryCount: 0
          }))
        : [];

      const initialSession: StreamingSession = {
        id: sessionId,
        pipelineId,
        status: "Pending",
        progress: 0,
        pipelineVersion: "1.0.0",
        createdAtUtc: new Date().toISOString(),
        lastUpdatedUtc: new Date().toISOString()
      };

      set({
        isModalOpen: true,
        activeSession: initialSession,
        stages: initialStages,
        logs: [],
        elapsedMs: 0,
        errorMessage: null,
        isConnecting: false,
        latestTextChunk: null,
        viewMode: "logs",
        targetId: targetId || null,
        costs: null,
        validationError: null,
        partialSnapshot: null,
        isRetryingTaskId: null
      });
    },

    closeModal: () => {
      const { activeSession } = get();
      const isTerminal = activeSession && ["Completed", "Failed", "Cancelled"].includes(activeSession.status);
      if (isTerminal || !activeSession) {
        cleanupConnection();
        set({ isModalOpen: false, activeSession: null, stages: [], logs: [], targetId: null, costs: null, partialSnapshot: null, validationError: null });
      } else {
        set({ isModalOpen: false });
      }
    },

    connectSession: (pipelineId: string, sessionId: string, customSseUrl?: string, targetId?: string) => {
      const { activeSession } = get();
      if (activeSession && activeSession.id === sessionId && eventSource) {
        set({ isModalOpen: true });
        return;
      }
      cleanupConnection();
      get().openModal(pipelineId, sessionId, targetId);
      set({ isConnecting: true });

      // Determine default SSE urls
      let sseUrl = customSseUrl;
      const sseBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5247/api";

      if (!sseUrl) {
        sseUrl = `${sseBaseUrl}/v1/streaming/sessions/${sessionId}/progress-stream`;
      } else if (sseUrl.startsWith("/")) {
        sseUrl = `${sseBaseUrl}${sseUrl}`;
      }

      if (!sseUrl) {
        set({ isConnecting: false, errorMessage: "No streaming endpoint configured for this pipeline." });
        return;
      }

      // Add auth token if available in localStorage
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const urlWithToken = token ? `${sseUrl}?token=${encodeURIComponent(token)}` : sseUrl;

      eventSource = new EventSource(urlWithToken, { withCredentials: true });
      const startTime = Date.now();

      // Track duration
      timerInterval = setInterval(() => {
        set({ elapsedMs: Date.now() - startTime });
      }, 1000);

      // Buffer incoming logs at 100ms interval to prevent UI layout thrashing
      bufferInterval = setInterval(() => {
        if (logBuffer.length > 0) {
          const buffered = [...logBuffer];
          logBuffer = [];
          set(state => ({ logs: [...state.logs, ...buffered] }));
        }
      }, 100);

      eventSource.onopen = () => {
        set({ isConnecting: false });
        processStreamingEvent({
          sessionId,
          pipelineId,
          eventType: "SESSION_STARTED",
          status: "Running",
          timestamp: new Date().toISOString(),
          message: "Connection to real-time execution stream established successfully."
        });
      };

      eventSource.onmessage = (event) => {
        if (event.data === "[DONE]") {
          processStreamingEvent({
            sessionId,
            pipelineId,
            eventType: "SESSION_COMPLETED",
            status: "Completed",
            timestamp: new Date().toISOString(),
            message: "Stream finished."
          });
          return;
        }

        try {
          const raw = JSON.parse(event.data);
          const parsed = mapToStandardEvent(raw, pipelineId, sessionId);
          processStreamingEvent(parsed);
        } catch (e) {
          console.error("Failed to parse incoming streaming event:", e);
        }
      };

      eventSource.onerror = (e) => {
        console.error("EventSource error:", e);
        set({ isConnecting: false });
        // Attempt immediate status recovery from API in case of premature close
        streamingHistoryApi.fetchSessionDetails(sessionId)
          .then(details => {
            const { session, stages: dbStages } = details;
            const pipelineIdToUse = session.pipelineId || pipelineId;
            set({ 
              activeSession: session,
              stages: mergeDbStages(pipelineIdToUse, sessionId, dbStages)
            });
            if (session.status === "Completed" || session.status === "Failed") {
              cleanupConnection();
            }
          })
          .catch(() => {
            // If API call fails or session is still running, flag connection issue
            processStreamingEvent({
              sessionId,
              pipelineId,
              eventType: "LOG_EVENT",
              status: "Connecting",
              timestamp: new Date().toISOString(),
              logLevel: "Warning",
              message: "Network connection interrupted. Retrying connection..."
            });
          });
      };
    },

    disconnect: async () => {
      const { activeSession } = get();
      if (activeSession && (activeSession.status === "Running" || activeSession.status === "Pending")) {
        const registryDef = pipelineRegistry.get(activeSession.pipelineId);
        if (registryDef?.actions.cancelSession) {
          try {
            // Cancel API
            await registryDef.actions.cancelSession(activeSession.id);
            // Cancellation Acknowledged -> update local status
            set(state => {
              if (state.activeSession) {
                return {
                  activeSession: {
                    ...state.activeSession,
                    status: "Cancelled",
                    completedAt: new Date().toISOString()
                  }
                };
              }
              return {};
            });
          } catch (e) {
            console.error("Cancel run failed:", e);
          }
        }
      }
      // Disconnect Stream
      cleanupConnection();
      // UI Cleanup
      set({ isConnecting: false });
    },

    loadHistorySession: async (sessionId: string, targetId?: string) => {
      cleanupConnection();
      set({ isConnecting: false, isModalOpen: true, logs: [], elapsedMs: 0, targetId: targetId || null });

      try {
        const details = await streamingHistoryApi.fetchSessionDetails(sessionId);
        const { session, stages: dbStages } = details;

        // Fetch logs
        const logs = await streamingHistoryApi.fetchSessionLogs(sessionId);

        // Calculate duration if completed
        let duration = 0;
        if (session.startedAt && session.completedAt) {
          duration = new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime();
        }

        const registryDef = pipelineRegistry.get(session.pipelineId);

        set({
          activeSession: session,
          stages: mergeDbStages(session.pipelineId, sessionId, dbStages),
          logs,
          elapsedMs: duration,
          errorMessage: session.status === "Failed" ? session.errorMessage : null,
          viewMode: session.status === "Completed" ? "report" : "logs",
        });

        // Trigger snapshot / report loads if applicable
        if (session.status === "Completed" && registryDef?.actions.fetchReport && targetId) {
          const fetchWithRetry = async (retriesLeft: number, delayMs: number): Promise<unknown> => {
            try {
              return await registryDef.actions.fetchReport!(targetId);
            } catch (err: any) {
              const is404 = err?.response?.status === 404 || err?.status === 404;
              if (is404 && retriesLeft > 0) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
                return fetchWithRetry(retriesLeft - 1, delayMs * 2);
              }
              throw err;
            }
          };

          try {
            const report = await fetchWithRetry(3, 1000);
            set(state => {
              if (state.activeSession) {
                return {
                  activeSession: {
                    ...state.activeSession,
                    summaryData: typeof report === "string" ? report : JSON.stringify(report)
                  }
                };
              }
              return {};
            });
          } catch (e: any) {
            console.error("Failed to load history report after retries:", e);
            const msg = e.response?.data?.message || e.message || String(e);
            set({ validationError: msg });
          }
        }

        if (registryDef?.actions.fetchSnapshot) {
          try {
            const snapshot = await registryDef.actions.fetchSnapshot(sessionId);
            set({ partialSnapshot: snapshot });
          } catch (e) {
            console.error("Failed to load history snapshot:", e);
          }
        }
      } catch (e: any) {
        set({ errorMessage: e.message || "Failed to load historical session details." });
      }
    },

    retryStage: async (stageId: string) => {
      const { activeSession } = get();
      if (!activeSession) return;
      const sessionId = activeSession.id;

      set(state => ({
        stages: state.stages.map(s => 
          s.stageId === stageId 
            ? { ...s, status: "Running", progress: 0, retryCount: (s.retryCount || 0) + 1 } 
            : s
        ),
        isRetryingTaskId: stageId
      }));

      try {
        const registryDef = pipelineRegistry.get(activeSession.pipelineId);
        if (registryDef?.actions.retryStage) {
          await registryDef.actions.retryStage(sessionId, stageId);
        } else {
          // Fallback generic call
          const sseBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5247/api";
          const token = localStorage.getItem("token") || sessionStorage.getItem("token") || "";
          const res = await fetch(`${sseBaseUrl}/v1/streaming/sessions/${sessionId}/stages/${stageId}/retry`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            }
          });

          if (!res.ok) {
            throw new Error("Failed to trigger stage retry.");
          }
        }
      } catch (e: any) {
        console.error("Retry stage failed:", e);
        set(state => ({
          stages: state.stages.map(s => 
            s.stageId === stageId 
              ? { ...s, status: "Failed", description: e.message || "Retry failed." } 
              : s
          )
        }));
      } finally {
        set({ isRetryingTaskId: null });
      }
    },

    triggerReanalyze: async () => {
      const { activeSession, targetId } = get();
      if (!activeSession || !targetId) return;

      const registryDef = pipelineRegistry.get(activeSession.pipelineId);
      if (registryDef?.actions.triggerReanalyze) {
        set({ validationError: null, isConnecting: true });
        try {
          const newSessionId = await registryDef.actions.triggerReanalyze(targetId);
          get().connectSession(activeSession.pipelineId, newSessionId, undefined, targetId);
        } catch (e: any) {
          console.error("Failed to trigger reanalysis:", e);
          set({ 
            validationError: e.message || String(e), 
            isConnecting: false 
          });
        }
      }
    },

    setLogsSearchQuery: (query: string) => set({ logsSearchQuery: query }),
    setLogsLevelFilter: (filter: string) => set({ logsLevelFilter: filter }),
    setAutoScroll: (autoScroll: boolean) => set({ autoScroll }),
    setViewMode: (viewMode) => {
      set({ viewMode });
      const { activeSession } = get();
      if (viewMode === "costs" && activeSession) {
        const registryDef = pipelineRegistry.get(activeSession.pipelineId);
        if (registryDef?.actions.fetchCosts) {
          set({ costs: null }); // loading state
          registryDef.actions.fetchCosts(activeSession.id)
            .then(costs => set({ costs }))
            .catch(err => console.error("Failed to fetch costs:", err));
        }
      }
    }
  };
});
