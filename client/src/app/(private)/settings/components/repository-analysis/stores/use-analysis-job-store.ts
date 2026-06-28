import { create } from "zustand";
import { toast } from "@heroui/react";
import { repositoryAnalysisApi } from "@/services/repository-analysis.service";
import type { AnalysisStatus, RepositoryAnalysis, AnalysisTaskEvent } from "@/types/repository-analysis.types";
import { useStreamingStore } from "@/modules/streaming";

export interface RepoJobState {
  repoId: string;
  jobId: string | null;
  status: AnalysisStatus;
  progress: number;
  currentStep: string;
  logs: string[];
  taskEvents: (AnalysisTaskEvent & {
    taskType?: string;
    taskStatus?: string;
    taskProgress?: number;
    taskDurationMs?: number;
    promptTokens?: number;
    completionTokens?: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
    estimatedCostUsd?: number;
    modelName?: string;
  })[];
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
  resetRepositoryAnalysis: (repoId: string) => Promise<void>;
}

// Map to track active store subscriptions in the module scope
const activeSubscriptions: Record<string, () => void> = {};

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
    if (activeSubscriptions[repoId]) {
      activeSubscriptions[repoId]();
      delete activeSubscriptions[repoId];
    }



    let lastCompletedStagesCount = 0;
    const unsubscribe = useStreamingStore.subscribe((streamingState: any) => {
      const activeSession = streamingState.activeSession;
      if (activeSession && activeSession.id === jobId) {
        let mappedStatus: AnalysisStatus = "idle";
        if (activeSession.status === "Pending") mappedStatus = "QUEUED";
        else if (activeSession.status === "Running") mappedStatus = "ANALYZING";
        else if (activeSession.status === "Completed") mappedStatus = "COMPLETED";
        else if (activeSession.status === "Failed") mappedStatus = "FAILED";
        else if (activeSession.status === "Cancelled") mappedStatus = "CANCELLED";

        const localLogs = streamingState.logs.map((l: any) => l.message);

        const localTaskEvents = streamingState.stages.map((s: any) => ({
          id: s.id,
          taskId: s.id,
          timestamp: s.completedAt || s.startedAt || new Date().toISOString(),
          level: s.status === "Failed" ? "Error" : s.status === "Completed" ? "Success" : "Info",
          eventType: s.status === "Failed" ? "AI_TASK_FAILED" : s.status === "Completed" ? "AI_TASK_COMPLETED" : "ProgressUpdate",
          message: s.description || "",
          taskType: s.stageId,
          taskStatus: s.status,
          taskProgress: s.progress,
          taskDurationMs: s.durationMs,
        }));

        set((storeState) => {
          const prevState = storeState.repoStates[repoId] || getOrInitState(repoId);
          return {
            repoStates: {
              ...storeState.repoStates,
              [repoId]: {
                ...prevState,
                jobId,
                status: mappedStatus,
                progress: activeSession.progress,
                currentStep: activeSession.currentStep || "",
                logs: localLogs,
                taskEvents: localTaskEvents,
                lastUpdated: Date.now(),
              }
            }
          };
        });

        // Trigger snapshot fetch only when a new stage completes (not on every state update)
        const completedStagesCount = streamingState.stages.filter((s: any) => s.status === "Completed").length;
        if (completedStagesCount > lastCompletedStagesCount) {
          lastCompletedStagesCount = completedStagesCount;
          repositoryAnalysisApi
            .getJobSnapshot(jobId)
            .then((snapshot) => {
              if (snapshot) {
                set((storeState) => {
                  const s = storeState.repoStates[repoId] || getOrInitState(repoId);
                  if (s.status === "COMPLETED" || s.status === "CANCELLED" || s.status === "CANCELLED_PARTIAL") {
                    return {};
                  }
                  return {
                    repoStates: {
                      ...storeState.repoStates,
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

        if (activeSession.status === "Failed") {
          toast.danger("Analysis Failed", {
            description: activeSession.errorMessage || "An unexpected error occurred during analysis.",
          });
          unsubscribe();
          if (activeSubscriptions[repoId] === unsubscribe) {
            delete activeSubscriptions[repoId];
          }
        } else if (activeSession.status === "Completed") {
          // Retry with delay to handle the race condition where the SSE fires
          // "Completed" before the backend has finished persisting the report.
          const fetchWithRetry = async (retriesLeft: number, delayMs: number): Promise<RepositoryAnalysis> => {
            try {
              return await repositoryAnalysisApi.getLatestReport(repoId);
            } catch (err: any) {
              const is404 = err?.response?.status === 404 || err?.status === 404;
              if (is404 && retriesLeft > 0) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
                return fetchWithRetry(retriesLeft - 1, delayMs * 2);
              }
              throw err;
            }
          };

          fetchWithRetry(3, 1000).then((report) => {
            set((storeState) => ({
              repoStates: {
                ...storeState.repoStates,
                [repoId]: {
                  ...(storeState.repoStates[repoId] || getOrInitState(repoId)),
                  status: "COMPLETED",
                  progress: 100,
                  currentStep: "Completed",
                  latestReport: report,
                  partialSnapshot: null,
                  lastUpdated: Date.now(),
                }
              }
            }));
          }).catch(err => {
            console.error("Failed to load completed report after retries:", err);
            // Fallback: use the last snapshot if available
            const currentJobState = get().repoStates[repoId];
            set((storeState) => ({
              repoStates: {
                ...storeState.repoStates,
                [repoId]: {
                  ...(storeState.repoStates[repoId] || getOrInitState(repoId)),
                  status: "COMPLETED",
                  progress: 100,
                  currentStep: "Completed",
                  latestReport: currentJobState?.partialSnapshot || null,
                  partialSnapshot: null,
                  lastUpdated: Date.now(),
                }
              }
            }));
          });
          unsubscribe();
          if (activeSubscriptions[repoId] === unsubscribe) {
            delete activeSubscriptions[repoId];
          }
        } else if (activeSession.status === "Cancelled") {
          unsubscribe();
          if (activeSubscriptions[repoId] === unsubscribe) {
            delete activeSubscriptions[repoId];
          }
        }
      }
    });

    activeSubscriptions[repoId] = unsubscribe;
    useStreamingStore.getState().connectSession("repository-analysis", jobId, undefined, repoId);
  };

  return {
    repoStates: {},

    initializeRepoStates: (repos) => {
      set((state) => {
        const newRepoStates = { ...state.repoStates };
        repos.forEach((repo) => {
          let status: AnalysisStatus = "idle";
          if (repo.latestAnalysisStatus === "Completed") status = "COMPLETED";
          else if (repo.latestAnalysisStatus === "Failed") status = "FAILED";
          else if (repo.latestAnalysisStatus === "Pending") status = "QUEUED";
          else if (repo.latestAnalysisStatus === "Cancelled") status = "CANCELLED";

          const existing = newRepoStates[repo.id];

          if (!existing) {
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
          } else if (!activeSubscriptions[repo.id]) {
            existing.status = status;
            if (status === "COMPLETED") {
              existing.progress = 100;
              existing.currentStep = "Completed";
            } else if (status === "FAILED") {
              existing.currentStep = "Analysis failed";
            } else if (status === "CANCELLED") {
              existing.currentStep = "Cancelled";
            } else if (status === "QUEUED") {
              existing.progress = 0;
              existing.currentStep = "Queued for analysis...";
            } else {
              existing.progress = 0;
              existing.currentStep = "Never Analyzed";
            }
            existing.lastUpdated = Date.now();
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

      if (activeSubscriptions[repoId]) {
        activeSubscriptions[repoId]();
        delete activeSubscriptions[repoId];
      }

      useStreamingStore.getState().disconnect();

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
          const isAlreadyMonitoring = activeSubscriptions[repoId] && current?.jobId === jobId;
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

    resetRepositoryAnalysis: async (repoId) => {
      if (activeSubscriptions[repoId]) {
        activeSubscriptions[repoId]();
        delete activeSubscriptions[repoId];
      }

      useStreamingStore.getState().disconnect();

      try {
        await repositoryAnalysisApi.resetAnalysis(repoId);
        set((state) => ({
          repoStates: {
            ...state.repoStates,
            [repoId]: {
              repoId,
              jobId: null,
              status: "idle",
              progress: 0,
              currentStep: "Never Analyzed",
              logs: [],
              taskEvents: [],
              latestReport: null,
              partialSnapshot: null,
              lastUpdated: Date.now(),
            },
          },
        }));
      } catch (err) {
        console.error(`Failed to reset repository analysis for ${repoId}:`, err);
        throw err;
      }
    },
  };
});
