import { create } from "zustand";
import { repositoryAnalysisApi } from "@/services/repository-analysis.service";
import type { AnalysisStatus, RepositoryAnalysis, AnalysisTaskEvent } from "@/types/repository-analysis.types";

export interface RepoJobState {
  repoId: string;
  jobId: string | null;
  status: AnalysisStatus;
  progress: number;
  currentStep: string;
  logs: string[];
  taskEvents: (AnalysisTaskEvent & { taskType?: string })[];
  latestReport: RepositoryAnalysis | null;
  partialSnapshot: RepositoryAnalysis | null;
  lastUpdated: number;
}

export interface DerivedUIState {
  status: AnalysisStatus;
  label: string;
  description: string;
  color: "default" | "warning" | "success" | "danger";
  progress: number;
  renderSource: "report" | "snapshot" | "none";
}

export function getDerivedUIState(
  repo: { latestAnalysisStatus?: string | null; classification?: string | null } | null,
  repoState?: RepoJobState
): DerivedUIState {
  if (repoState) {
    const hasReport = !!repoState.latestReport;
    const hasSnapshot = !!repoState.partialSnapshot;

    switch (repoState.status) {
      case "QUEUED":
        return {
          status: "QUEUED",
          label: "Queued",
          description: "Queued for analysis...",
          color: "warning",
          progress: 0,
          renderSource: "none",
        };
      case "ANALYZING":
        return {
          status: "ANALYZING",
          label: "Analyzing",
          description: repoState.currentStep || "Initializing...",
          color: "warning",
          progress: repoState.progress,
          renderSource: "none",
        };
      case "COMPLETED":
        return {
          status: "COMPLETED",
          label: "Analyzed",
          description: "Completed",
          color: "success",
          progress: 100,
          renderSource: hasReport ? "report" : "none",
        };
      case "CANCELLED_PARTIAL":
        return {
          status: "CANCELLED_PARTIAL",
          label: "Cancelled (Partial)",
          description: repoState.currentStep || "Stopped by user",
          color: "warning",
          progress: repoState.progress || 0,
          renderSource: hasSnapshot ? "snapshot" : "none",
        };
      case "CANCELLED":
        return {
          status: "CANCELLED",
          label: "Cancelled",
          description: "Analysis cancelled",
          color: "danger",
          progress: repoState.progress || 0,
          renderSource: hasReport ? "report" : "none",
        };
      case "FAILED":
        return {
          status: "FAILED",
          label: "Failed",
          description: repoState.currentStep || "Analysis failed",
          color: "danger",
          progress: repoState.progress || 0,
          renderSource: hasReport ? "report" : "none",
        };
      case "idle":
      default:
        break;
    }
  }

  const rawStatus = repo?.latestAnalysisStatus;
  const hasCompletedReport = repo?.latestAnalysisStatus === "Completed";
  switch (rawStatus) {
    case "Pending":
      return {
        status: "QUEUED",
        label: "Queued",
        description: "Queued for analysis...",
        color: "warning",
        progress: 0,
        renderSource: "none",
      };
    case "Initializing":
    case "Running":
      return {
        status: "ANALYZING",
        label: "Analyzing",
        description: "Initializing...",
        color: "warning",
        progress: 0,
        renderSource: "none",
      };
    case "Completed":
      return {
        status: "COMPLETED",
        label: "Analyzed",
        description: "Completed",
        color: "success",
        progress: 100,
        renderSource: "report",
      };
    case "Failed":
      return {
        status: "FAILED",
        label: "Failed",
        description: "Analysis failed",
        color: "danger",
        progress: 0,
        renderSource: "none",
      };
    case "Cancelled":
      return {
        status: "CANCELLED",
        label: "Cancelled",
        description: "Analysis cancelled",
        color: "danger",
        progress: 0,
        renderSource: "none",
      };
    default:
      return {
        status: "idle",
        label: "Unanalyzed",
        description: "Never Analyzed",
        color: "default",
        progress: 0,
        renderSource: "none",
      };
  }
}

interface AnalysisJobStore {
  repoStates: Record<string, RepoJobState>;
  initializeRepoStates: (repos: { id: string; latestAnalysisStatus: string }[]) => void;
  triggerReanalyze: (repoId: string) => Promise<string>;
  cancelReanalyze: (repoId: string) => Promise<void>;
  checkActiveJobs: () => Promise<void>;
  loadLatestReport: (repoId: string) => Promise<void>;
  updateJobStateDirectly: (repoId: string, updates: Partial<RepoJobState>) => void;
}

// Map to track active EventSources in the module scope
const activeEventSources: Record<string, EventSource> = {};

export const useAnalysisJobStore = create<AnalysisJobStore>((set, get) => {
  const getOrInitState = (repoId: string): RepoJobState => {
    const state = get().repoStates[repoId];
    if (state) return state;
    return {
      repoId,
      jobId: null,
      status: "idle",
      progress: 0,
      currentStep: "Pending",
      logs: [],
      taskEvents: [],
      latestReport: null,
      partialSnapshot: null,
      lastUpdated: Date.now(),
    };
  };

  const connectToProgressStream = (repoId: string, jobId: string) => {
    if (activeEventSources[repoId]) {
      activeEventSources[repoId].close();
      delete activeEventSources[repoId];
    }

    const sseUrl = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"}/repository-analyses/jobs/${jobId}/progress-stream`;
    const eventSource = new EventSource(sseUrl, { withCredentials: true });
    activeEventSources[repoId] = eventSource;

    eventSource.onmessage = async (event) => {
      // Discard messages if this stream is no longer the active EventSource for the repo
      if (activeEventSources[repoId] !== eventSource) {
        eventSource.close();
        return;
      }

      const currentRepoState = get().repoStates[repoId];
      // Discard messages if this stream is for an older or different job (Race Condition Protection)
      if (currentRepoState && currentRepoState.jobId !== jobId) {
        eventSource.close();
        if (activeEventSources[repoId] === eventSource) {
          delete activeEventSources[repoId];
        }
        return;
      }

      const dataStr = event.data;
      if (dataStr === "[DONE]") {
        eventSource.close();
        if (activeEventSources[repoId] === eventSource) {
          delete activeEventSources[repoId];
        }

        try {
          const report = await repositoryAnalysisApi.getLatestReport(repoId);
          set((state) => ({
            repoStates: {
              ...state.repoStates,
              [repoId]: {
                ...getOrInitState(repoId),
                jobId,
                status: "COMPLETED",
                progress: 100,
                currentStep: "Completed",
                latestReport: report,
                partialSnapshot: null,
                lastUpdated: Date.now(),
              },
            },
          }));
        } catch (err) {
          console.error("Failed to load completed report from SSE stream:", err);
          set((state) => ({
            repoStates: {
              ...state.repoStates,
              [repoId]: {
                ...getOrInitState(repoId),
                jobId,
                status: "FAILED",
                currentStep: "Failed to load report",
                lastUpdated: Date.now(),
              },
            },
          }));
        }
        return;
      }

      try {
        const payload = JSON.parse(dataStr);
        if (payload && (payload.status || payload.taskStatus || payload.jobId)) {
          set((state) => {
            const prevState = getOrInitState(repoId);
            const jobStatus = payload.status || prevState.status || "ANALYZING";

            const isQueued = ["Queued", "QUEUED"].includes(jobStatus);
            const isAnalyzing = [
              "Preparing", "CloningRepository", "DetectingTechnologyStack",
              "SamplingCode", "RunningAgents", "AggregatingResults", "SavingReport", "Running", "analyzing", "ANALYZING"
            ].includes(jobStatus);

            const isError = [
              "Failed", "TimedOut", "error", "FAILED"
            ].includes(jobStatus);

            const isCancelled = [
              "Cancelled", "Cancelled", "CANCELLED"
            ].includes(jobStatus);

            let status: AnalysisStatus = "idle";
            if (isError) {
              status = "FAILED";
            } else if (isQueued) {
              status = "QUEUED";
            } else if (isAnalyzing) {
              status = "ANALYZING";
            } else if (isCancelled) {
              status = prevState.latestReport ? "CANCELLED" : "CANCELLED_PARTIAL";
            } else if (jobStatus === "Completed" || jobStatus === "success" || jobStatus === "COMPLETED") {
              status = "COMPLETED";
            } else {
              status = prevState.status;
            }

            const step = payload.step || payload.taskType || status;
            const progress = payload.progress !== undefined ? payload.progress : prevState.progress;
            const message = payload.message || step;

            const currentLogs = prevState.logs;
            const updatedLogs = message && !currentLogs.includes(message)
              ? [...currentLogs, message]
              : currentLogs;

            let updatedTaskEvents = prevState.taskEvents;
            if (payload.taskType && payload.message) {
              const newEvent: AnalysisTaskEvent & { taskType?: string } = {
                id: payload.id || `live-${Date.now()}-${Math.random()}`,
                taskId: payload.taskId || "",
                timestamp: payload.timestamp || new Date().toISOString(),
                level: payload.level || "Info",
                eventType: payload.eventType || "ProgressUpdate",
                message: payload.message,
                metadata: payload.metadata,
                taskType: payload.taskType,
              };

              if (!updatedTaskEvents.some((e) => e.message === newEvent.message && e.timestamp === newEvent.timestamp)) {
                updatedTaskEvents = [...updatedTaskEvents, newEvent];
              }
            }

            return {
              repoStates: {
                ...state.repoStates,
                [repoId]: {
                  ...prevState,
                  status,
                  progress,
                  currentStep: step,
                  logs: updatedLogs,
                  taskEvents: updatedTaskEvents,
                  lastUpdated: Date.now(),
                },
              },
            };
          });

          if (payload.taskStatus === "Completed") {
            repositoryAnalysisApi
              .getJobSnapshot(jobId)
              .then((snapshot) => {
                if (snapshot) {
                  set((state) => {
                    const s = getOrInitState(repoId);
                    if (s.status === "COMPLETED" || s.status === "CANCELLED" || s.status === "CANCELLED_PARTIAL") {
                      return {};
                    }
                    return {
                      repoStates: {
                        ...state.repoStates,
                        [repoId]: {
                          ...s,
                          partialSnapshot: snapshot,
                          lastUpdated: Date.now(),
                        },
                      },
                    };
                  });
                }
              })
              .catch((err: any) => {
                console.error("Failed to load intermediate job snapshot in store:", err);
              });
          }

          const isTerminalState = [
            "Failed", "Cancelled", "TimedOut", "error", "Completed", "success"
          ].includes(payload.status || "");

          if (isTerminalState) {
            eventSource.close();
            if (activeEventSources[repoId] === eventSource) {
              delete activeEventSources[repoId];
            }
          }
        }
      } catch (err) {
        console.error("Error parsing progress stream chunk in store:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error(`EventSource error in store for repository ${repoId}:`, err);
      eventSource.close();
      if (activeEventSources[repoId] === eventSource) {
        delete activeEventSources[repoId];
      }
    };
  };

  return {
    repoStates: {},

    initializeRepoStates: (repos) => {
      set((state) => {
        const newRepoStates = { ...state.repoStates };
        repos.forEach((repo) => {
          if (!newRepoStates[repo.id]) {
            let status: AnalysisStatus = "idle";
            if (repo.latestAnalysisStatus === "Completed") status = "COMPLETED";
            else if (repo.latestAnalysisStatus === "Failed") status = "FAILED";
            else if (repo.latestAnalysisStatus === "Pending") status = "QUEUED";
            else if (repo.latestAnalysisStatus === "Cancelled") status = "CANCELLED";

            newRepoStates[repo.id] = {
              repoId: repo.id,
              jobId: null,
              status,
              progress: status === "COMPLETED" ? 100 : 0,
              currentStep: status === "COMPLETED" ? "Completed" : "Never Analyzed",
              logs: [],
              taskEvents: [],
              latestReport: null,
              partialSnapshot: null,
              lastUpdated: Date.now(),
            };
          }
        });
        return { repoStates: newRepoStates };
      });
    },

    triggerReanalyze: async (repoId) => {
      const optimisticJobId = `optimistic-${Date.now()}`;
      set((state) => {
        const prevState = getOrInitState(repoId);
        return {
          repoStates: {
            ...state.repoStates,
            [repoId]: {
              ...prevState,
              jobId: optimisticJobId,
              status: "QUEUED",
              progress: 0,
              currentStep: "Initializing...",
              logs: [],
              taskEvents: [],
              partialSnapshot: null, // Reset partial snapshot for new run
              lastUpdated: Date.now(),
            },
          },
        };
      });

      try {
        const response = await repositoryAnalysisApi.triggerAnalysis(repoId);
        const actualJobId = response.jobId;

        // Update with the actual jobId and start the progress stream
        set((state) => {
          const currentState = getOrInitState(repoId);
          // Protection: if state was changed in the meantime (e.g. cancelled), ignore.
          if (currentState.jobId !== optimisticJobId) {
            return {};
          }
          return {
            repoStates: {
              ...state.repoStates,
              [repoId]: {
                ...currentState,
                jobId: actualJobId,
                lastUpdated: Date.now(),
              },
            },
          };
        });

        connectToProgressStream(repoId, actualJobId);
        return actualJobId;
      } catch (err) {
        console.error("Repository analysis trigger failed in store:", err);
        set((state) => ({
          repoStates: {
            ...state.repoStates,
            [repoId]: {
              ...getOrInitState(repoId),
              jobId: null,
              status: "FAILED",
              currentStep: "Trigger failed",
              lastUpdated: Date.now(),
            },
          },
        }));
        throw err;
      }
    },

    cancelReanalyze: async (repoId) => {
      const currentState = get().repoStates[repoId];
      if (!currentState || !currentState.jobId) return;

      if (activeEventSources[repoId]) {
        activeEventSources[repoId].close();
        delete activeEventSources[repoId];
      }

      try {
        await repositoryAnalysisApi.cancelJob(currentState.jobId);
        set((state) => {
          const status: AnalysisStatus = currentState.latestReport ? "CANCELLED" : "CANCELLED_PARTIAL";
          return {
            repoStates: {
              ...state.repoStates,
              [repoId]: {
                ...currentState,
                status,
                currentStep: "Cancelled",
                lastUpdated: Date.now(),
              },
            },
          };
        });
      } catch (err) {
        console.error("Failed to cancel job:", err);
        throw err;
      }
    },

    checkActiveJobs: async () => {
      try {
        const activeJobs = await repositoryAnalysisApi.getActiveJobs();
        for (const job of activeJobs) {
          const repoId = job.repositoryId;
          const jobId = job.id;

          const current = get().repoStates[repoId];
          // If we already have a live monitor session for the same jobId, skip
          const isAlreadyMonitoring = activeEventSources[repoId] && current?.jobId === jobId;
          if (isAlreadyMonitoring) continue;

          // If current state is analyzing a newer or different active job, skip
          if (current && (current.status === "ANALYZING" || current.status === "QUEUED") && current.jobId && current.jobId !== jobId) {
            continue;
          }

          set((state) => ({
            repoStates: {
              ...state.repoStates,
              [repoId]: {
                ...getOrInitState(repoId),
                jobId,
                status: job.status === "Queued" ? "QUEUED" : "ANALYZING",
                progress: job.progress,
                currentStep: job.currentStep || "Running...",
                lastUpdated: Date.now(),
              },
            },
          }));

          // Fetch historical task events in parallel
          try {
            const history = await repositoryAnalysisApi.getJobEvents(jobId);
            if (history && history.length > 0) {
              const messages = history.map((h) => h.message);
              set((state) => ({
                repoStates: {
                  ...state.repoStates,
                  [repoId]: {
                    ...getOrInitState(repoId),
                    logs: messages,
                    lastUpdated: Date.now(),
                  },
                },
              }));
            }
          } catch (hErr) {
            console.error("Failed to fetch historical events for active job:", jobId, hErr);
          }

          connectToProgressStream(repoId, jobId);
        }
      } catch (err) {
        console.error("Failed to check active analysis jobs:", err);
      }
    },

    loadLatestReport: async (repoId) => {
      try {
        const report = await repositoryAnalysisApi.getLatestReport(repoId);
        const jobId = report.jobId || (report as any).job_id || null;
        set((state) => ({
          repoStates: {
            ...state.repoStates,
            [repoId]: {
              ...getOrInitState(repoId),
              jobId,
              status: "COMPLETED",
              latestReport: report,
              lastUpdated: Date.now(),
            },
          },
        }));
      } catch (err) {
        console.error(`Failed to load report for repository ${repoId}:`, err);
        set((state) => ({
          repoStates: {
            ...state.repoStates,
            [repoId]: {
              ...getOrInitState(repoId),
              status: "FAILED",
              lastUpdated: Date.now(),
            },
          },
        }));
      }
    },

    updateJobStateDirectly: (repoId, updates) => {
      set((state) => ({
        repoStates: {
          ...state.repoStates,
          [repoId]: {
            ...getOrInitState(repoId),
            ...updates,
            lastUpdated: Date.now(),
          },
        },
      }));
    },
  };
});
