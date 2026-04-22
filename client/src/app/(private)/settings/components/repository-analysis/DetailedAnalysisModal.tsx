import React, { useState, useEffect, useRef, useMemo } from "react";
import { Modal, Typography, Button, Spinner, Chip, ProgressBar, toast } from "@heroui/react";
import {
  X,
  LayoutDashboard,
  Terminal,
  AlertTriangle,
  Crown,
  Sparkles,
  Clock,
  Coins,
  Activity,
  CheckCircle2
} from "lucide-react";
import type {
  RepositoryAnalysis,
  AnalysisJob,
  AnalysisTask,
  AnalysisTaskEvent,
  ConfidenceMetadata,
  ContributorDistributionItem
} from "@/types/repository-analysis.types";
import { repositoryAnalysisApi } from "@/services/repository-analysis.service";
import { AnalysisTaskTimeline } from "./AnalysisTaskTimeline";
import { AIStreamViewer } from "./AIStreamViewer";

interface ProgressEventData {
  taskId?: string;
  taskStatus?: string;
  taskProgress?: number;
  taskDurationMs?: number;
  taskErrorMessage?: string;
  promptTokens?: number;
  completionTokens?: number;
  estimatedCostUsd?: number;
  modelName?: string;
  resultData?: string;
  progress?: number;
  status?: string;
  step?: string;
  taskType?: string;
  message?: string;
  id?: string;
  timestamp?: string;
  level?: string;
  eventType?: string;
  metadata?: string;
}

interface DetailedAnalysisModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  analysis: RepositoryAnalysis | null;
  jobId: string | null;
  repoId: string;
  onAnalysisComplete?: (report: RepositoryAnalysis) => void;
}

const FRIENDLY_NAMES: Record<string, string> = {
  RepoStructure: "Workspace Setup & Provenance Scan",
  CommitIntelligence: "Commit Ownership & Git Trust",
  SkillExtraction: "Technical Skills Scan",
  ArchitectureAnalysis: "Architecture Design Pattern Scan",
  CodeQuality: "Code Quality & Styling Inspection",
  SecurityAnalysis: "Vulnerability & Security Audit",
  RepositoryClassification: "Repository Semantic Classification",
  RepositorySummary: "Recruiter Summary & Narrative",
};

export const getTaskConfidenceMeta = (task: AnalysisTask | undefined): ConfidenceMetadata | undefined => {
  if (!task || !task.resultData) return undefined;
  try {
    const parsed = JSON.parse(task.resultData);
    return parsed.confidence_meta;
  } catch {
    return undefined;
  }
};

export const DetailedAnalysisModal: React.FC<DetailedAnalysisModalProps> = ({
  isOpen,
  onOpenChange,
  analysis,
  jobId,
  repoId,
  onAnalysisComplete,
}) => {
  const [viewMode, setViewMode] = useState<"report" | "logs">("report");
  const [job, setJob] = useState<AnalysisJob | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskEvents, setTaskEvents] = useState<(AnalysisTaskEvent & { taskType?: string })[]>([]);
  const [liveTaskEvents, setLiveTaskEvents] = useState<(AnalysisTaskEvent & { taskType?: string })[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [isRetryingTaskId, setIsRetryingTaskId] = useState<string | null>(null);
  const [localAnalysis, setLocalAnalysis] = useState<RepositoryAnalysis | null>(analysis);
  const [elapsedTime, setElapsedTime] = useState<string>("00:00");

  const onAnalysisCompleteRef = useRef(onAnalysisComplete);
  useEffect(() => {
    onAnalysisCompleteRef.current = onAnalysisComplete;
  }, [onAnalysisComplete]);

  const eventBuffer = useRef<ProgressEventData[]>([]);

  // Previous values for render-time state synchronization
  const [prevAnalysis, setPrevAnalysis] = useState<RepositoryAnalysis | null>(analysis);
  const [prevJobId, setPrevJobId] = useState<string | null>(jobId);
  const [prevIsOpen, setPrevIsOpen] = useState<boolean>(isOpen);

  // Sync analysis when prop updates
  if (analysis !== prevAnalysis) {
    setPrevAnalysis(analysis);
    setLocalAnalysis(analysis);
    if (analysis) {
      setViewMode("report");
    } else {
      setViewMode("logs");
    }
  }

  // Clear job/task state when modal closes or jobId changes
  const inputsChanged = jobId !== prevJobId || isOpen !== prevIsOpen;
  if (inputsChanged) {
    setPrevJobId(jobId);
    setPrevIsOpen(isOpen);
    if (!jobId || !isOpen) {
      setJob(null);
      setLiveTaskEvents([]);
      setElapsedTime("00:00");
    }
  }

  // Auto-switch view modes based on job status
  const isJobRunning = useMemo(() => {
    return !!(
      job &&
      [
        "Queued",
        "Preparing",
        "CloningRepository",
        "DetectingTechnologyStack",
        "SamplingCode",
        "RunningAgents",
        "SavingReport",
        "AggregatingResults"
      ].includes(job.status)
    );
  }, [job]);

  const activeViewMode = isJobRunning ? "logs" : viewMode;

  // Load snapshot on mount for instant recovery
  useEffect(() => {
    if (!jobId || !isOpen) return;

    const loadSnapshot = async () => {
      try {
        const snapshot = await repositoryAnalysisApi.getJobSnapshot(jobId);
        if (snapshot) {
          setLocalAnalysis(snapshot);
        }
      } catch (err) {
        console.error("Failed to load job snapshot:", err);
      }
    };

    loadSnapshot();
  }, [jobId, isOpen]);

  // Fetch initial job status and all events on mount
  useEffect(() => {
    if (!jobId || !isOpen) return;

    const loadInitialJob = async () => {
      try {
        const jobData = await repositoryAnalysisApi.getJobStatus(jobId);
        setJob(jobData);

        const tasks = jobData.tasks;
        if (tasks && tasks.length > 0) {
          // Fetch events for all tasks in parallel
          const promises = tasks.map(async (t) => {
            try {
              const events = await repositoryAnalysisApi.getTaskEvents(jobId, t.id);
              return events.map(e => ({
                ...e,
                taskType: t.taskType
              }));
            } catch (err) {
              console.error(`Failed to fetch events for task ${t.id}:`, err);
              return [];
            }
          });
          const results = await Promise.all(promises);
          const flatSorted = results
            .flat()
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          setTaskEvents(flatSorted);

          setSelectedTaskId((prev) => {
            if (prev && tasks.some((t) => t.id === prev)) {
              return prev;
            }
            const activeOrFailed = tasks.find(
              (t) => t.status === "Running" || t.status === "Failed" || t.status === "Retrying"
            );
            return activeOrFailed?.id || tasks[0].id;
          });
        }
      } catch (err) {
        console.error("Failed to load initial job status & events:", err);
      }
    };

    loadInitialJob();
  }, [jobId, isOpen]);

  // Debouncing: 250ms batching interval for progress updates
  useEffect(() => {
    if (!jobId || !isOpen) return;

    const intervalId = setInterval(() => {
      if (eventBuffer.current.length === 0) return;

      const eventsToProcess = [...eventBuffer.current];
      eventBuffer.current = [];

      setJob((prevJob) => {
        if (!prevJob) return prevJob;

        let updatedTasks = prevJob.tasks ? [...prevJob.tasks] : [];
        let latestJobProgress = prevJob.progress;
        let latestJobStatus = prevJob.status;
        let latestJobStep = prevJob.currentStep;

        eventsToProcess.forEach((data) => {
          if (data.taskId) {
            updatedTasks = updatedTasks.map((t) => {
              if (t.id === data.taskId) {
                return {
                  ...t,
                  status: data.taskStatus || t.status,
                  progress: data.taskProgress !== undefined ? data.taskProgress : t.progress,
                  durationMs: data.taskDurationMs !== undefined ? data.taskDurationMs : t.durationMs,
                  errorMessage: data.taskErrorMessage !== undefined ? data.taskErrorMessage : t.errorMessage,
                  promptTokens: data.promptTokens !== undefined ? data.promptTokens : t.promptTokens,
                  completionTokens: data.completionTokens !== undefined ? data.completionTokens : t.completionTokens,
                  estimatedCostUsd: data.estimatedCostUsd !== undefined ? data.estimatedCostUsd : t.estimatedCostUsd,
                  modelName: data.modelName || t.modelName,
                  resultData: data.resultData || t.resultData,
                };
              }
              return t;
            });
          }
          if (data.progress !== undefined) latestJobProgress = data.progress;
          if (data.status) latestJobStatus = data.status;
          if (data.step) latestJobStep = data.step;
        });

        return {
          ...prevJob,
          status: latestJobStatus,
          progress: latestJobProgress,
          currentStep: latestJobStep,
          tasks: updatedTasks,
        };
      });
    }, 250);

    return () => {
      clearInterval(intervalId);
    };
  }, [jobId, isOpen]);

  // SSE Subscription for real-time updates (Stays open without tearing down)
  useEffect(() => {
    if (!jobId || !isOpen) return;

    const sseUrl = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"}/repository-analyses/jobs/${jobId}/progress-stream`;
    const eventSource = new EventSource(sseUrl, { withCredentials: true });

    eventSource.onmessage = async (event) => {
      if (event.data === "[DONE]") {
        eventSource.close();

        // Final sync: load complete report, final job status, and all final task events
        try {
          const [report, finalJob] = await Promise.all([
            repositoryAnalysisApi.getLatestReport(repoId),
            repositoryAnalysisApi.getJobStatus(jobId)
          ]);
          setLocalAnalysis(report);
          setJob(finalJob);

          const allTasks = finalJob.tasks || [];
          const promises = allTasks.map(async (t) => {
            try {
              const events = await repositoryAnalysisApi.getTaskEvents(jobId, t.id);
              return events.map(e => ({
                ...e,
                taskType: t.taskType
              }));
            } catch (err) {
              console.error(`Failed to fetch events for task ${t.id}:`, err);
              return [];
            }
          });
          const results = await Promise.all(promises);
          const flatSorted = results
            .flat()
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          setTaskEvents(flatSorted);

          if (onAnalysisCompleteRef.current) {
            onAnalysisCompleteRef.current(report);
          }
        } catch (err) {
          console.error("Failed to load completed final data:", err);
        }
        return;
      }

      try {
        const data = JSON.parse(event.data);
        eventBuffer.current.push(data);

        // Capture real-time log messages
        if (data.taskType && data.message) {
          const newEvent: AnalysisTaskEvent & { taskType?: string } = {
            id: data.id || `live-${Date.now()}-${Math.random()}`,
            taskId: data.taskId || "",
            timestamp: data.timestamp || new Date().toISOString(),
            level: data.level || "Info",
            eventType: data.eventType || "ProgressUpdate",
            message: data.message,
            metadata: data.metadata,
            taskType: data.taskType
          };

          setLiveTaskEvents((prev) => {
            if (prev.some((e) => e.message === newEvent.message && e.timestamp === newEvent.timestamp)) {
              return prev;
            }
            return [...prev, newEvent];
          });
        }

        // If a task completed, fetch job snapshot to get latest resultData/findings
        if (data.taskStatus === "Completed") {
          repositoryAnalysisApi
            .getJobSnapshot(jobId)
            .then((snapshot) => {
              if (snapshot) {
                setLocalAnalysis(snapshot);
              }
            })
            .catch(() => { });
        }
      } catch (err) {
        console.error("Failed to parse SSE message:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("EventSource error in modal:", err);
    };

    return () => {
      eventSource.close();
    };
  }, [jobId, isOpen, repoId]);

  // Live Runtime Clock
  const formatDuration = (ms: number): string => {
    if (ms < 0) ms = 0;
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, "0")}m ${secs.toString().padStart(2, "0")}s`;
  };

  const displayElapsedTime = useMemo(() => {
    if (job && !isJobRunning && job.startedAt && job.completedAt) {
      const diff = new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime();
      return formatDuration(diff);
    }
    return elapsedTime;
  }, [job, isJobRunning, elapsedTime]);

  useEffect(() => {
    if (!job || !isJobRunning) return;

    const interval = setInterval(() => {
      const start = job.startedAt
        ? new Date(job.startedAt).getTime()
        : new Date(job.createdAtUtc).getTime();
      const diff = Date.now() - start;
      setElapsedTime(formatDuration(diff));
    }, 1000);

    return () => clearInterval(interval);
  }, [isJobRunning, job?.startedAt, job?.createdAtUtc, job]);

  useEffect(() => {
    if (!jobId || !isOpen || !job?.tasks) return;

    let isSubscribed = true;
    const fetchAllEvents = async () => {
      setLoadingEvents(true);
      try {
        const allTasks = job.tasks || [];
        const promises = allTasks.map(async (t) => {
          try {
            const events = await repositoryAnalysisApi.getTaskEvents(jobId, t.id);
            return events.map(e => ({
              ...e,
              taskType: t.taskType
            }));
          } catch (err) {
            console.error(`Failed to fetch events for task ${t.id}:`, err);
            return [];
          }
        });
        const results = await Promise.all(promises);
        if (isSubscribed) {
          const flatSorted = results
            .flat()
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          setTaskEvents(flatSorted);
        }
      } catch (err) {
        console.error("Failed to fetch task events:", err);
      } finally {
        if (isSubscribed) setLoadingEvents(false);
      }
    };

    fetchAllEvents();

    const hasRunningTasks = job.tasks.some(
      (t) => t.status === "Running" || t.status === "Retrying" || t.status === "Queued"
    );

    let intervalId: NodeJS.Timeout | null = null;
    if (hasRunningTasks) {
      intervalId = setInterval(() => {
        if (isSubscribed) fetchAllEvents();
      }, 4000);
    }

    return () => {
      isSubscribed = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [jobId, isOpen, job?.tasks?.length, job?.status]);

  const handleRetryTask = async (taskId: string) => {
    setIsRetryingTaskId(taskId);
    try {
      if (!jobId) return;
      await repositoryAnalysisApi.retryTask(jobId, taskId);
      toast.success("Task retry initiated!");

      setJob((prev) => {
        if (!prev || !prev.tasks) return prev;
        return {
          ...prev,
          status: "Queued",
          progress: 0,
          tasks: prev.tasks.map((t) =>
            t.id === taskId
              ? { ...t, status: "Queued", progress: 0, retryCount: t.retryCount + 1 }
              : t.taskType === "RepositorySummary"
                ? { ...t, status: "Queued", progress: 0 }
                : t
          ),
        };
      });
    } catch (err) {
      console.error("Failed to retry task:", err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      toast.danger("Failed to retry task: " + errorMsg);
    } finally {
      setIsRetryingTaskId(null);
    }
  };

  // Sum up telemetry metrics from all completed tasks
  const tasks = job?.tasks;
  const telemetry = useMemo(() => {
    if (!tasks) {
      return {
        promptTokens: 0,
        completionTokens: 0,
        estimatedCostUsd: 0,
        cacheReadTokens: 0,
        cacheTotalTokens: 0,
        durationMs: 0,
        models: new Set<string>()
      };
    }
    return tasks.reduce(
      (acc, t) => {
        acc.promptTokens += t.promptTokens || 0;
        acc.completionTokens += t.completionTokens || 0;
        acc.estimatedCostUsd += t.estimatedCostUsd || 0;
        acc.cacheReadTokens += t.promptTokens && t.cacheReadTokens ? t.cacheReadTokens : 0;
        acc.cacheTotalTokens += t.promptTokens ? t.promptTokens : 0;
        acc.durationMs += t.durationMs || 0;
        if (t.modelName) {
          acc.models.add(t.modelName);
        }
        return acc;
      },
      {
        promptTokens: 0,
        completionTokens: 0,
        estimatedCostUsd: 0,
        cacheReadTokens: 0,
        cacheTotalTokens: 0,
        durationMs: 0,
        models: new Set<string>()
      }
    );
  }, [tasks]);

  const repoName = localAnalysis?.repo.full_name || job?.currentStep || "Repository Analysis";
  const commitsCount = localAnalysis?.ownership.total_commits ?? localAnalysis?.facts?.git_metrics?.total_commits ?? 0;
  const contributorsCount = localAnalysis?.facts?.git_metrics?.active_contributors ?? 1;

  // Merge database logs with real-time SSE logs
  const combinedLogs = useMemo(() => {
    const dbEvents = taskEvents;
    const liveEvents = liveTaskEvents;
    const combined = [...dbEvents];

    liveEvents.forEach((liveEv) => {
      const isDuplicate = combined.some(
        (dbEv) => dbEv.message === liveEv.message && dbEv.timestamp === liveEv.timestamp
      );
      if (!isDuplicate) {
        combined.push(liveEv);
      }
    });

    return combined.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [taskEvents, liveTaskEvents]);

  // Bento Grid Report Render Method
  const renderBentoGrid = () => {
    if (!localAnalysis) return null;

    const classification = localAnalysis.classification || {
      primary_type: "Unclassified",
      complexity: "low",
      benchmark_group: "unclassified"
    };

    const findings = localAnalysis.findings || [];
    const securityFindings = findings.filter((f) => f.category?.toLowerCase() === "security");

    const risk = localAnalysis.ai_conclusions?.risk_assessment || {
      risk_level: "Low",
      explanation: "Low risk profile. No significant security or code quality issues detected."
    };

    const getRiskClasses = (level: string) => {
      switch (level.toLowerCase()) {
        case "high":
          return "text-danger border-danger/30 bg-danger/5";
        case "medium":
          return "text-warning border-warning/30 bg-warning/5";
        case "low":
        default:
          return "text-success border-success/30 bg-success/5";
      }
    };

    const getEvidenceStrength = (ep: number) => {
      if (ep <= 5) return `Minimal (${ep} Signals)`;
      if (ep <= 15) return `Standard (${ep} Signals)`;
      if (ep <= 35) return `Strong (${ep} Signals)`;
      return `Exceptional (${ep} Signals)`;
    };

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-left font-sans select-none items-start">
        {/* Column 1 (Left) */}
        <div className="flex flex-col gap-5">
          {/* Tier 1: Score & Verdict Card (Large) */}
          <div className="p-5 border border-border/80 bg-surface rounded-2xl flex flex-col gap-4 min-h-[220px]">
            <div className="flex justify-between items-start gap-4">
              <div className="space-y-1">
                <span className="text-[9px] text-muted uppercase font-extrabold tracking-wider block">
                  Verification Verdict
                </span>
                <h3 className="text-lg font-black text-foreground capitalize flex items-center gap-1.5">
                  <Crown className="size-4.5 text-warning shrink-0" />
                  {localAnalysis.trust?.classification?.replace(/_/g, " ") || "Authentic Workspace"}
                </h3>
                <p className="text-xs text-muted leading-relaxed font-light mt-1">
                  {localAnalysis.narrative?.recruiter_summary || localAnalysis.trust?.explanation}
                </p>
                {risk.explanation && (
                  <p className="text-[10px] text-muted-foreground/80 leading-relaxed font-light mt-1.5 border-l-2 border-border/40 pl-2">
                    <strong>Risk Assessment:</strong> {risk.explanation}
                  </p>
                )}
              </div>
              {/* Risk Rating Badge */}
              <div
                className={`px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider shrink-0 ${getRiskClasses(
                  risk.risk_level
                )}`}
              >
                {risk.risk_level} Risk
              </div>
            </div>

            <div className="flex gap-8 border-t border-border/30 pt-4 mt-auto">
              <div className="flex flex-col items-start justify-center gap-2">
                <span className="text-[9px] text-muted uppercase font-bold">Evidence Strength:</span>
                <strong className="text-sm text-foreground font-extrabold font-mono">
                  {getEvidenceStrength(localAnalysis.evidence_points?.total ?? 0)}
                </strong>
              </div>
              <div className="flex flex-col items-start justify-center gap-2">
                <span className="text-[9px] text-muted uppercase font-bold">Trust Confidence:</span>
                <strong className="text-sm text-foreground font-extrabold font-mono">
                  {localAnalysis.trust?.confidence ?? 100}%
                </strong>
              </div>
              <div className="flex flex-col items-start justify-center gap-2">
                <span className="text-[9px] text-muted uppercase font-bold">Complexity:</span>
                <strong className="text-sm text-foreground font-extrabold capitalize font-sans">
                  {classification.complexity || "Medium"}
                </strong>
              </div>
            </div>
          </div>

          {/* Tier 2: Skills & Technologies (Medium - Moved from Right) */}
          <div className="p-5 border border-border/80 bg-surface rounded-2xl flex flex-col gap-3 min-h-[220px]">
            <span className="text-[9px] text-muted uppercase font-extrabold tracking-wider block">
              Skills & Stack Matrix
            </span>
            <div className="space-y-3 pr-1">
              <div className="space-y-1">
                <span className="text-[8px] text-muted uppercase font-bold block">Languages</span>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(localAnalysis.repo.languages || {}).map(([lang, pct]) => (
                    <span
                      key={lang}
                      className="text-[10px] border border-border/60 bg-surface-secondary text-foreground px-2 py-0.5 rounded-md font-medium"
                    >
                      {lang} <span className="opacity-60 font-mono text-[9px]">{pct}%</span>
                    </span>
                  ))}
                </div>
              </div>

              {Object.entries(localAnalysis.profile?.skills || {}).map(([cat, list]) => (
                <div key={cat} className="space-y-1">
                  <span className="text-[8px] text-accent uppercase font-extrabold block">
                    {cat} Technologies
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {(list as string[]).map((skillName) => (
                      <span
                        key={skillName}
                        className="text-[10.5px] border border-border/60 bg-surface-secondary text-foreground px-2 py-0.5 rounded-md font-semibold"
                      >
                        {skillName}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tier 2: Code Quality & Practices (Medium) */}
          <div className="p-5 border border-border/80 bg-surface rounded-2xl flex flex-col gap-3 min-h-[220px]">
            <span className="text-[9px] text-muted uppercase font-extrabold tracking-wider block">
              Engineering Practices & Integrations
            </span>
            {(() => {
              const practices = localAnalysis.profile?.engineering_practices || {
                testing: { frameworks: [], has_tests: false, detail: "" },
                observability: { logging_configured: false, metrics_configured: false, detail: "" },
                cicd: { configured: false, providers: [] }
              };
              return (
                <div className="space-y-3.5">
                  {/* Testing */}
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-1 px-2.5 rounded-lg border text-xs font-bold shrink-0 ${practices.testing.has_tests
                        ? "text-success border-success/20 bg-success/5"
                        : "text-muted border-border bg-surface-secondary"
                        }`}
                    >
                      Testing
                    </div>
                    <div className="space-y-0.5 text-left">
                      <span className="text-xs font-bold text-foreground block">
                        {practices.testing.has_tests
                          ? `Configured (${practices.testing.frameworks?.join(", ") || "N/A"})`
                          : "Not Configured"}
                      </span>
                      <span className="text-[10px] text-muted leading-relaxed block font-light">
                        {practices.testing.detail || "No testing infrastructure detected."}
                      </span>
                    </div>
                  </div>

                  {/* Observability */}
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-1 px-2.5 rounded-lg border text-xs font-bold shrink-0 ${practices.observability.logging_configured ||
                        practices.observability.metrics_configured
                        ? "text-success border-success/20 bg-success/5"
                        : "text-muted border-border bg-surface-secondary"
                        }`}
                    >
                      Monitor
                    </div>
                    <div className="space-y-0.5 text-left">
                      <span className="text-xs font-bold text-foreground block">
                        {practices.observability.logging_configured ||
                          practices.observability.metrics_configured
                          ? "Configured Logs & Metrics"
                          : "No Diagnostics"}
                      </span>
                      <span className="text-[10px] text-muted leading-relaxed block font-light">
                        {practices.observability.detail || "No logging configuration details found."}
                      </span>
                    </div>
                  </div>

                  {/* CI/CD */}
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-1 px-2.5 rounded-lg border text-xs font-bold shrink-0 ${practices.cicd.configured
                        ? "text-success border-success/20 bg-success/5"
                        : "text-muted border-border bg-surface-secondary"
                        }`}
                    >
                      CI/CD
                    </div>
                    <div className="space-y-0.5 text-left">
                      <span className="text-xs font-bold text-foreground block">
                        {practices.cicd.configured
                          ? `Configured (${practices.cicd.providers?.join(", ") || "N/A"})`
                          : "Not Configured"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Tier 3: Security Findings (Compact) */}
          <div className="p-5 border border-border/80 bg-surface rounded-2xl flex flex-col gap-3 min-h-[180px]">
            <span className="text-[9px] uppercase font-extrabold tracking-wider block text-danger">
              Security Findings
            </span>
            <div className="flex flex-col gap-2">
              {securityFindings.length === 0 ? (
                <div className="text-xs text-muted-foreground italic font-light py-2">
                  No high-risk secrets leaks or security violations detected.
                </div>
              ) : (
                <div className="space-y-2 pr-1">
                  {securityFindings.map((f, idx) => (
                    <div
                      key={idx}
                      className="p-2 border border-danger/10 bg-danger/5 text-danger text-[10.5px] rounded-lg"
                    >
                      <strong className="font-bold block">{f.finding}</strong>
                      <span className="text-muted text-[9px] leading-relaxed block mt-0.5">
                        {f.explanation}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Tier 3: Metadata & Quality Stats (Compact - Moved from Right) */}
          <div className="p-5 border border-border/80 bg-surface rounded-2xl flex flex-col gap-3 min-h-[180px]">
            <span className="text-[9px] text-muted uppercase font-extrabold tracking-wider block">
              Scope & Quality Metrics
            </span>
            {(() => {
              const q = localAnalysis.facts?.quality_metrics || {
                files_scanned: 0,
                files_sampled: 0,
                skipped_files: 0,
                coverage_pct: 100.0,
                prompt_cache_efficiency: 0.0
              };
              return (
                <div className="space-y-2.5 text-xs text-muted-foreground">
                  <div className="flex justify-between items-center py-1 border-b border-border/20">
                    <span className="font-semibold text-foreground">Files Scanned</span>
                    <strong className="font-mono text-foreground font-extrabold">{q.files_scanned}</strong>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-border/20">
                    <span className="font-semibold text-foreground">Files Sampled</span>
                    <strong className="font-mono text-foreground font-extrabold">{q.files_sampled}</strong>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="font-semibold text-foreground">Cache Efficiency</span>
                    <strong className="font-mono text-foreground font-extrabold">
                      {(q.prompt_cache_efficiency * 100).toFixed(0)}%
                    </strong>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Column 2 (Right) */}
        <div className="flex flex-col gap-5">
          {/* Tier 1: AI Reasoning & Talent Insights (Large) */}
          <div className="p-5 border border-border/80 bg-surface rounded-2xl flex flex-col gap-3 min-h-[220px]">
            <span className="text-[9px] text-muted uppercase font-extrabold tracking-wider block">
              AI Talent Insights & Strengths
            </span>
            <div className="space-y-3 pr-1">
              {localAnalysis.narrative?.top_strengths?.map((s, idx) => (
                <div key={idx} className="space-y-0.5">
                  <span className="text-xs font-extrabold text-foreground flex items-center gap-1">
                    <Sparkles className="size-3 text-accent shrink-0" />
                    {s.strength}
                  </span>
                  <p className="text-[10.5px] text-muted-foreground leading-relaxed font-light pl-4">
                    {s.rationale}
                  </p>
                </div>
              ))}
              {(!localAnalysis.narrative?.top_strengths || localAnalysis.narrative.top_strengths.length === 0) && (
                <span className="text-xs text-muted italic font-light">No specific highlights recorded.</span>
              )}
            </div>
          </div>

          {/* Tier 1: Architecture & Directory Layout (Large - Moved from Left) */}
          <div className="p-5 border border-border/80 bg-surface rounded-2xl flex flex-col gap-3 min-h-[200px]">
            <span className="text-[9px] text-muted uppercase font-extrabold tracking-wider block">
              Codebase Architecture & Structure
            </span>
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {localAnalysis.profile?.architecture?.patterns?.map((pattern, idx) => (
                  <Chip
                    key={pattern || idx}
                    size="sm"
                    variant="soft"
                    color="accent"
                    className="h-6.5 text-xs font-semibold px-2"
                  >
                    {pattern}
                  </Chip>
                ))}
                {(!localAnalysis.profile?.architecture?.patterns ||
                  localAnalysis.profile.architecture.patterns.length === 0) && (
                    <Chip size="sm" variant="soft" className="h-6.5 text-xs font-medium">
                      Standard Architecture
                    </Chip>
                  )}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed font-light mt-1">
                {localAnalysis.profile?.architecture?.explanation ||
                  "Workspace contains standard design layouts."}
              </p>
            </div>
          </div>

          {/* Tier 2: Contributor Distributions (Medium) */}
          <div className="p-5 border border-border/80 bg-surface rounded-2xl flex flex-col gap-3.5 min-h-[200px]">
            <div className="flex justify-between items-center border-b border-border/20 pb-2">
              <span className="text-[9px] text-muted uppercase font-extrabold tracking-wider block">
                Contributor Distributions
              </span>
              <span className="text-[10px] text-muted font-light">
                Bus Factor: <strong>{localAnalysis.facts?.git_metrics?.bus_factor ?? 1}</strong>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-0.5 bg-surface-secondary/20 p-2.5 rounded-xl border border-border/40">
                <span className="text-[8.5px] text-muted uppercase font-bold block">Total Commits</span>
                <strong className="text-lg text-foreground font-black font-mono">
                  {localAnalysis.ownership?.total_commits ?? 0}
                </strong>
              </div>
              <div className="space-y-0.5 bg-surface-secondary/20 p-2.5 rounded-xl border border-border/40">
                <span className="text-[8.5px] text-muted uppercase font-bold block">User Commits</span>
                <strong className="text-lg text-foreground font-black font-mono">
                  {((localAnalysis.ownership?.user_commit_ratio ?? 1) * 100).toFixed(0)}%
                </strong>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[8px] text-muted uppercase font-extrabold block">Top Commit Authors</span>
              <div className="space-y-1.5 pr-1">
                {(localAnalysis.facts?.git_metrics?.contributor_distribution || []).slice(0, 3).map((item: ContributorDistributionItem & { username?: string; commit_ratio?: number }, idx: number) => (
                  <div key={idx} className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-foreground truncate max-w-[150px]">
                      {item.author || item.username}
                    </span>
                    <span className="font-mono text-muted text-[10px]">
                      {item.commits || 0} commits (
                      {(item.pct || (item.commit_ratio ? item.commit_ratio * 100 : 0)).toFixed(1)}%)
                    </span>
                  </div>
                ))}
                {(!localAnalysis.facts?.git_metrics?.contributor_distribution ||
                  localAnalysis.facts.git_metrics.contributor_distribution.length === 0) && (
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-foreground">Target Developer</span>
                      <span className="font-mono text-muted text-[10px]">100.0% contribution ratio</span>
                    </div>
                  )}
              </div>
            </div>
          </div>

          {/* Tier 3: Reliability Index (Compact) */}
          <div className="p-5 border border-border/80 bg-surface rounded-2xl flex flex-col gap-3 min-h-[180px]">
            <span className="text-[9px] text-muted uppercase font-extrabold tracking-wider block">
              Reliability & Citations
            </span>
            {(() => {
              const task = job?.tasks?.find((t) => t.taskType === "RepoStructure");
              const meta = getTaskConfidenceMeta(task);
              const score = meta?.confidence_score ?? localAnalysis.trust?.confidence ?? 100;
              const completeness =
                meta?.completeness_ratio ??
                (localAnalysis.facts?.quality_metrics?.files_sampled
                  ? localAnalysis.facts.quality_metrics.files_sampled /
                  Math.max(1, localAnalysis.facts.quality_metrics.files_scanned)
                  : 1.0);
              const citations = meta?.evidence_coverage_count ?? localAnalysis.findings?.length ?? 0;
              return (
                <div className="space-y-2.5 text-xs text-muted-foreground">
                  <div className="flex justify-between items-center py-1 border-b border-border/20">
                    <span className="font-semibold text-foreground">Reliability Score</span>
                    <strong
                      className={`font-mono font-extrabold ${score >= 80 ? "text-success" : score >= 50 ? "text-warning" : "text-danger"
                        }`}
                    >
                      {score}%
                    </strong>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-border/20">
                    <span className="font-semibold text-foreground">Completeness</span>
                    <strong className="font-mono text-foreground font-extrabold">
                      {(completeness * 100).toFixed(0)}%
                    </strong>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="font-semibold text-foreground">Citations Count</span>
                    <strong className="font-mono text-foreground font-extrabold">
                      {citations} refs
                    </strong>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Tier 3: Warnings & observations (Compact - Moved from Left) */}
          <div className="p-5 border border-border/80 bg-surface rounded-2xl flex flex-col gap-3 min-h-[180px]">
            <span className="text-[9px] uppercase font-extrabold tracking-wider block text-warning">
              Anomalies & Warnings
            </span>
            <div className="flex flex-col gap-2">
              {localAnalysis.trust?.rule_flags.length === 0 &&
                localAnalysis.trust?.ai_findings.length === 0 ? (
                <div className="text-xs text-muted-foreground italic font-light py-2">
                  No warnings or stylistic flags recorded.
                </div>
              ) : (
                <div className="space-y-2 pr-1">
                  {localAnalysis.trust?.rule_flags.map((flag, idx) => (
                    <div
                      key={`rule-${idx}`}
                      className="p-2 border border-danger/10 bg-danger/5 text-danger text-[10.5px] rounded-lg"
                    >
                      <strong className="font-bold">Violated:</strong> {flag}
                    </div>
                  ))}
                  {localAnalysis.trust?.ai_findings.map((finding, idx) => (
                    <div
                      key={`ai-${idx}`}
                      className="p-2 border border-warning/10 bg-warning/5 text-warning text-[10.5px] rounded-lg"
                    >
                      <strong className="font-bold">Warning:</strong> {finding}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      className="bg-overlay/5 backdrop-blur-md animate-in fade-in duration-200 z-100"
    >
      <Modal.Container placement="center" scroll="inside">
        <Modal.Dialog className="w-full max-w-6xl bg-overlay border border-border rounded-2xl shadow-modal p-6 text-left relative focus-visible:outline-hidden focus:outline-hidden max-h-[95vh] flex flex-col justify-between animate-in zoom-in-95 duration-200">
          {/* Close Trigger */}
          <Modal.CloseTrigger
            aria-label="Close dialog"
            className="absolute right-6 top-6 p-1.5 rounded-full hover:bg-surface-secondary text-muted hover:text-foreground cursor-pointer transition-colors z-10"
          >
            <X size={16} />
          </Modal.CloseTrigger>

          {/* Modal Header */}
          <Modal.Header className="mb-4 pr-10 flex flex-col items-start gap-3 border-b border-border/20 pb-4">
            <Modal.Heading className="outline-hidden text-left w-full flex items-center justify-between gap-4">
              <div>
                <span className="text-[10px] text-accent uppercase font-extrabold tracking-wider block mb-1">
                  AI Repository Intelligence Dashboard
                </span>
                <span className="font-extrabold text-foreground font-display select-all text-xl block">
                  {repoName}
                </span>
              </div>

              {/* View mode toggle (only shown when job is completed) */}
              {job?.status === "Completed" && (
                <div className="flex gap-1 bg-surface-secondary border border-border/80 rounded-xl p-1 shrink-0 font-sans select-none">
                  <Button
                    size="sm"
                    onClick={() => setViewMode("report")}
                    className={`rounded-lg px-3.5 py-1 text-xs font-bold ${activeViewMode === "report"
                      ? "bg-background text-foreground shadow-sm"
                      : "bg-transparent text-muted hover:text-foreground"
                      }`}
                  >
                    <LayoutDashboard size={13} className="mr-1" />
                    Dashboard
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setViewMode("logs")}
                    className={`rounded-lg px-3.5 py-1 text-xs font-bold ${activeViewMode === "logs"
                      ? "bg-background text-foreground shadow-sm"
                      : "bg-transparent text-muted hover:text-foreground"
                      }`}
                  >
                    <Terminal size={13} className="mr-1" />
                    Traces & Logs
                  </Button>
                </div>
              )}
            </Modal.Heading>

            {/* Top Summary Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 w-full bg-surface-secondary/40 border border-border/40 rounded-2xl p-3 text-[11px] font-mono text-muted-foreground select-none">
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] text-muted font-bold uppercase tracking-wider font-sans">
                  Status
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {isJobRunning ? (
                    <>
                      <Spinner size="sm" color="warning" className="scale-65 shrink-0" />
                      <span className="text-warning font-extrabold capitalize text-[10px]">Running</span>
                    </>
                  ) : job?.status === "Completed" || (localAnalysis && !job) ? (
                    <>
                      <CheckCircle2 size={12} className="text-success shrink-0" />
                      <span className="text-success font-extrabold capitalize text-[10px]">Complete</span>
                    </>
                  ) : job?.status === "Failed" ? (
                    <>
                      <AlertTriangle size={12} className="text-danger shrink-0" />
                      <span className="text-danger font-extrabold capitalize text-[10px]">Failed</span>
                    </>
                  ) : (
                    <span className="text-foreground/80 font-bold capitalize text-[10px]">
                      {job?.status || "Idle"}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] text-muted font-bold uppercase tracking-wider font-sans">
                  Current Stage
                </span>
                <span className="text-foreground font-bold truncate block mt-0.5 text-[10px]">
                  {isJobRunning
                    ? FRIENDLY_NAMES[job?.currentStep || ""] || job?.currentStep || "Running"
                    : job?.status === "Completed"
                      ? "Report persited"
                      : "Idle"}
                </span>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] text-muted font-bold uppercase tracking-wider font-sans">
                  Elapsed Time
                </span>
                <div className="flex items-center gap-1 mt-0.5 text-foreground font-bold text-[10px]">
                  <Clock size={11} className="text-muted shrink-0" />
                  <span>{displayElapsedTime}</span>
                </div>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] text-muted font-bold uppercase tracking-wider font-sans">
                  Git Metrics
                </span>
                <span className="text-foreground font-bold mt-0.5 text-[10px]">
                  {commitsCount} commits / {contributorsCount} auths
                </span>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] text-muted font-bold uppercase tracking-wider font-sans">
                  Total Cost
                </span>
                <div className="flex items-center gap-1 mt-0.5 text-success font-bold text-[10px]">
                  <Coins size={11} className="text-success shrink-0" />
                  <span>${telemetry.estimatedCostUsd.toFixed(4)}</span>
                </div>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] text-muted font-bold uppercase tracking-wider font-sans">
                  Total Tokens
                </span>
                <span className="text-foreground font-bold mt-0.5 text-[10px]">
                  {(telemetry.promptTokens + telemetry.completionTokens).toLocaleString()}
                </span>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] text-muted font-bold uppercase tracking-wider font-sans">
                  AI Models
                </span>
                <span className="text-foreground font-bold truncate block mt-0.5 text-[10px] capitalize">
                  {telemetry.models.size > 0
                    ? Array.from(telemetry.models)
                      .map((m) => m.replace("claude-3-", ""))
                      .join(", ")
                    : "Claude Sonnet"}
                </span>
              </div>
            </div>

            {/* Overall Job Progress Ticker */}
            {isJobRunning && job && (
              <div className="w-full space-y-1 mt-1 font-mono text-[10px] select-none text-muted-foreground">
                <div className="flex justify-between items-center">
                  <span>Pipeline Execution Progress</span>
                  <span className="text-accent font-bold">{Math.round(job.progress)}%</span>
                </div>
                <ProgressBar
                  aria-label="Job progress"
                  value={job.progress}
                  color="accent"
                  size="sm"
                  className="w-full"
                >
                  <ProgressBar.Track>
                    <ProgressBar.Fill />
                  </ProgressBar.Track>
                </ProgressBar>
              </div>
            )}
          </Modal.Header>

          {/* Modal Body */}
          <Modal.Body className="flex-1 overflow-y-auto space-y-6 select-text py-2 max-h-[60vh]">
            {!localAnalysis && !job ? (
              <div className="flex flex-col items-center justify-center h-[300px] gap-4">
                <Spinner size="lg" />
                <Typography className="text-muted text-xs">
                  Initializing repository analysis monitor...
                </Typography>
              </div>
            ) : activeViewMode === "report" && localAnalysis ? (
              renderBentoGrid()
            ) : (
              /* Observability split logs view mode */
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[450px]">
                {/* Left timeline */}
                <div className="lg:col-span-5 space-y-4">
                  {job?.tasks && job.tasks.length > 0 ? (
                    <AnalysisTaskTimeline
                      tasks={job.tasks}
                      selectedTaskId={selectedTaskId}
                      onSelectTask={(id) => setSelectedTaskId(id)}
                      onRetryTask={handleRetryTask}
                      isRetryingTaskId={isRetryingTaskId}
                      isJobRunning={isJobRunning}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-48 border border-border bg-background/40 rounded-xl p-4 text-muted text-xs font-sans">
                      <Activity className="size-5 mb-2 opacity-50" />
                      <span>Pipeline tasks have not been instantiated yet.</span>
                    </div>
                  )}
                </div>

                {/* Right streaming terminal */}
                <div className="lg:col-span-7">
                  <AIStreamViewer
                    events={combinedLogs}
                    isLoading={loadingEvents}
                    taskName="Pipeline Console"
                    taskStatus={
                      !job
                        ? "Running"
                        : job.status === "Completed"
                          ? "Completed"
                          : job.status === "Failed" || job.status === "Cancelled" || job.status === "TimedOut"
                            ? "Failed"
                            : "Running"
                    }
                  />
                </div>
              </div>
            )}
          </Modal.Body>

          {/* Modal Footer */}
          <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-separator select-none">
            <Button
              onClick={() => onOpenChange(false)}
              className="rounded-xl text-xs font-semibold px-4 h-9"
            >
              Close
            </Button>
          </div>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
};

export default DetailedAnalysisModal;
