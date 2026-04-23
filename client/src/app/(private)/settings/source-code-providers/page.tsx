"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Card,
  Typography,
  Button,
  Spinner,
  Separator,
  toast,
  Chip,
  Avatar,
  InputGroup,
  Label,
  Select,
  ListBox,
  Skeleton,
  Link,
  AlertDialog,
} from "@heroui/react";
import { Github, Gitlab } from "@thesvg/react";
import {
  Search,
  RefreshCw,
  Lock,
  Globe,
  Star,
  GitFork,
  CheckCircle2,
  AlertCircle,
  Info,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { sourceCodeProviderApi } from "@/services/source-code-provider.service";
import type {
  SourceCodeProvider,
  SourceCodeRepository,
} from "@/types/source-code-provider.types";
import { useDebounce } from "@/hooks/use-debounce";
import type { AnalysisStatus, RepositoryAnalysis } from "@/types/repository-analysis.types";
import { repositoryAnalysisApi } from "@/services/repository-analysis.service";
import { AnalysisStatusBadge } from "../components/repository-analysis/AnalysisStatusBadge";
import { DetailedAnalysisModal } from "../components/repository-analysis/DetailedAnalysisModal";
import { motion, AnimatePresence } from "framer-motion";

const POPULAR_LANGUAGES = [
  "TypeScript",
  "JavaScript",
  "Python",
  "Go",
  "Rust",
  "C#",
  "Java",
  "C++",
  "PHP",
  "Ruby",
  "HTML",
  "CSS",
];


export default function SourceCodeProvidersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialProviderId = searchParams.get("providerId") || "all";

  // Data State
  const [providers, setProviders] = useState<SourceCodeProvider[]>([]);
  const [repositories, setRepositories] = useState<SourceCodeRepository[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [loadingRepositories, setLoadingRepositories] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Filters State
  const [selectedProviderId, setSelectedProviderId] = useState<string>(initialProviderId);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [visibilityFilter, setVisibilityFilter] = useState("all");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [sortBy, setSortBy] = useState("updated");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [categories, setCategories] = useState<string[]>([]);

  // Pagination / Infinite Scroll State
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  // Repository Analysis States
  const [analysisStatuses, setAnalysisStatuses] = useState<Record<string, AnalysisStatus>>({});
  const [analysisResults, setAnalysisResults] = useState<Record<string, RepositoryAnalysis>>({});
  const [analysisProgress, setAnalysisProgress] = useState<Record<string, number>>({});
  const [analysisSteps, setAnalysisSteps] = useState<Record<string, string>>({});
  const [analysisLogs, setAnalysisLogs] = useState<Record<string, string[]>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState<RepositoryAnalysis | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedRepoId, setSelectedRepoId] = useState<string>("");
  const [repoToReanalyze, setRepoToReanalyze] = useState<{ id: string; name: string; owner: string } | null>(null);
  const [isReanalyzeConfirmOpen, setIsReanalyzeConfirmOpen] = useState(false);
  const activeJobsRef = useRef<Record<string, string>>({});
  const lastJobIdsRef = useRef<Record<string, string>>({});
  const eventSourcesRef = useRef<Record<string, EventSource>>({});
  const loadedReportsRef = useRef<Record<string, boolean>>({});



  // Active Sync States (Polling)
  const [activeSyncJobs, setActiveSyncJobs] = useState<Record<string, { providerId: string | null; progress: number }>>({});
  const pollingIntervals = useRef<Record<string, NodeJS.Timeout>>({});

  // Sentinel ref for infinite scroll IntersectionObserver
  const observerRef = useRef<HTMLDivElement | null>(null);

  // Load provider accounts
  const loadProviders = useCallback(async (silent = false) => {
    if (!silent) setLoadingProviders(true);
    try {
      const data = await sourceCodeProviderApi.fetchProviders();
      setProviders(data);
    } catch (err) {
      console.error("Failed to load source code providers:", err);
      toast.danger("Failed to load connected provider accounts.");
    } finally {
      if (!silent) setLoadingProviders(false);
    }
  }, []);

  const loadCategories = useCallback(async () => {
    try {
      const data = await sourceCodeProviderApi.fetchCategories();
      setCategories(data);
    } catch (err) {
      console.error("Failed to load repository categories:", err);
    }
  }, []);

  // Fetch repositories with pagination / infinite scroll appending support
  const fetchRepos = useCallback(async (pageNum: number, isInitial: boolean) => {
    if (isInitial) {
      setLoadingRepositories(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const params = {
        providerId: selectedProviderId === "all" ? undefined : selectedProviderId,
        search: debouncedSearchQuery.trim() || undefined,
        visibility: visibilityFilter === "all" ? undefined : visibilityFilter,
        language: languageFilter === "all" ? undefined : languageFilter,
        sort: sortBy,
        category: categoryFilter === "all" ? undefined : categoryFilter,
        page: pageNum,
        pageSize,
      };
      const result = await sourceCodeProviderApi.fetchRepositories(params);

      setRepositories((prev) => {
        if (isInitial) {
          return result.items;
        } else {
          const existingIds = new Set(prev.map((r) => r.id));
          const newItems = result.items.filter((r) => !existingIds.has(r.id));
          return [...prev, ...newItems];
        }
      });
      setTotalCount(result.totalCount);
    } catch (err) {
      console.error("Failed to load repositories:", err);
      toast.danger("Failed to load repositories list.");
    } finally {
      setLoadingRepositories(false);
      setLoadingMore(false);
    }
  }, [selectedProviderId, debouncedSearchQuery, visibilityFilter, languageFilter, sortBy, categoryFilter, pageSize]);

  // Compatibility alias for manual sync or reload operations
  const loadRepositories = useCallback(() => {
    loadCategories();
    return fetchRepos(1, true);
  }, [fetchRepos, loadCategories]);

  const connectToProgressStream = useCallback((repoId: string, jobId: string) => {
    if (eventSourcesRef.current[repoId]) {
      eventSourcesRef.current[repoId].close();
    }

    activeJobsRef.current[repoId] = jobId;
    lastJobIdsRef.current[repoId] = jobId;

    const sseUrl = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"}/repository-analyses/jobs/${jobId}/progress-stream`;
    const eventSource = new EventSource(sseUrl, { withCredentials: true });
    eventSourcesRef.current[repoId] = eventSource;

    eventSource.onmessage = async (event) => {
      const dataStr = event.data;
      if (dataStr === "[DONE]") {
        eventSource.close();
        delete eventSourcesRef.current[repoId];
        delete activeJobsRef.current[repoId];

        try {
          const report = await repositoryAnalysisApi.getLatestReport(repoId);
          setAnalysisResults((prev) => ({ ...prev, [repoId]: report }));
          setAnalysisStatuses((prev) => ({ ...prev, [repoId]: "success" }));
          toast.success("Repository analysis completed successfully!");
          loadRepositories();
        } catch (err: unknown) {
          console.error("Failed to load completed analysis report:", err);
          setAnalysisStatuses((prev) => ({ ...prev, [repoId]: "error" }));
        }
        return;
      }

      try {
        const payload = JSON.parse(dataStr);
        if (payload.status) {
          const isAnalyzing = [
            "Queued", "Preparing", "CloningRepository", "DetectingTechnologyStack",
            "SamplingCode", "RunningAgents", "AggregatingResults", "SavingReport", "analyzing"
          ].includes(payload.status);

          const isError = [
            "Failed", "Cancelled", "TimedOut", "error"
          ].includes(payload.status);

          const status: AnalysisStatus = isError
            ? "error"
            : isAnalyzing
              ? "analyzing"
              : payload.status === "Completed" || payload.status === "success"
                ? "success"
                : "idle";
          const step = payload.step || status;
          const progress = payload.progress || 0;
          const message = payload.message || step;

          setAnalysisStatuses((prev) => ({ ...prev, [repoId]: status }));
          setAnalysisProgress((prev) => ({ ...prev, [repoId]: progress }));
          setAnalysisSteps((prev) => ({ ...prev, [repoId]: step }));
          if (message) {
            setAnalysisLogs((prev) => {
              const current = prev[repoId] || [];
              if (current.includes(message)) return prev;
              return { ...prev, [repoId]: [...current, message] };
            });
          }

          if (payload.status === "error" || payload.status === "Failed" || payload.status === "Cancelled" || payload.status === "TimedOut") {
            eventSource.close();
            delete eventSourcesRef.current[repoId];
            delete activeJobsRef.current[repoId];
            setAnalysisStatuses((prev) => ({ ...prev, [repoId]: "error" }));
            toast.danger(`Analysis failed: ${message}`);
          }
        }
      } catch (err) {
        console.error("Error parsing progress stream chunk:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error(`EventSource error for repository ${repoId}:`, err);
    };
  }, [loadRepositories]);

  const handleAnalyzeRepository = async (repoId: string, _repoName: string, _repoOwner: string) => {
    setAnalysisStatuses((prev) => ({ ...prev, [repoId]: "analyzing" }));
    setAnalysisProgress((prev) => ({ ...prev, [repoId]: 0 }));
    setAnalysisSteps((prev) => ({ ...prev, [repoId]: "Initializing..." }));
    setAnalysisLogs((prev) => ({ ...prev, [repoId]: [] }));

    toast.info("Repository analysis started...");
    try {
      const response = await repositoryAnalysisApi.triggerAnalysis(repoId);
      const jobId = response.jobId;
      lastJobIdsRef.current[repoId] = jobId;

      try {
        const history = await repositoryAnalysisApi.getJobEvents(jobId);
        if (history && history.length > 0) {
          const messages = history.map(h => h.message);
          setAnalysisLogs((prev) => ({ ...prev, [repoId]: messages }));
          const latest = history[history.length - 1];
          setAnalysisProgress((prev) => ({ ...prev, [repoId]: latest.progress }));
          setAnalysisSteps((prev) => ({ ...prev, [repoId]: latest.step }));
        }
      } catch (err) {
        console.error("Failed to fetch historical job events:", err);
      }

      connectToProgressStream(repoId, jobId);
    } catch (err: unknown) {
      console.error("Repository analysis trigger failed:", err);
      const axiosError = err as { response?: { data?: { message?: string } }; message?: string };
      setAnalysisStatuses((prev) => ({ ...prev, [repoId]: "error" }));
      toast.danger("Repository analysis failed", {
        description: axiosError.response?.data?.message || axiosError.message || "An unexpected error occurred during AI analysis."
      });
    }
  };

  const handleCancelAnalysis = async (repoId: string) => {
    const jobId = activeJobsRef.current[repoId];
    if (!jobId) return;
    try {
      await repositoryAnalysisApi.cancelJob(jobId);
      toast.success("Analysis cancellation requested.");
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } }; message?: string };
      toast.danger("Failed to cancel analysis", {
        description: axiosError.response?.data?.message || axiosError.message
      });
    }
  };

  const handleAnalysisComplete = useCallback((report: RepositoryAnalysis) => {
    if (!selectedRepoId) return;
    setAnalysisResults((prev) => ({ ...prev, [selectedRepoId]: report }));
    setAnalysisStatuses((prev) => ({ ...prev, [selectedRepoId]: "success" }));
    loadRepositories();
  }, [selectedRepoId, loadRepositories]);

  // Check and restore active jobs on page load
  useEffect(() => {
    const checkActiveJobs = async () => {
      try {
        const activeJobs = await repositoryAnalysisApi.getActiveJobs();
        for (const job of activeJobs) {
          const repoId = job.repositoryId;
          const jobId = job.id;
          lastJobIdsRef.current[repoId] = jobId;

          setAnalysisStatuses((prev) => ({ ...prev, [repoId]: "analyzing" }));
          setAnalysisProgress((prev) => ({ ...prev, [repoId]: job.progress }));
          setAnalysisSteps((prev) => ({ ...prev, [repoId]: job.currentStep || "Running..." }));

          try {
            const history = await repositoryAnalysisApi.getJobEvents(jobId);
            if (history && history.length > 0) {
              const messages = history.map(h => h.message);
              setAnalysisLogs((prev) => ({ ...prev, [repoId]: messages }));
            }
          } catch (hErr) {
            console.error("Failed to fetch historical events for active job:", jobId, hErr);
          }

          connectToProgressStream(repoId, jobId);
        }
      } catch (err) {
        console.error("Failed to check active analysis jobs:", err);
      }
    };

    checkActiveJobs();

    const currentEventSources = eventSourcesRef.current;
    return () => {
      Object.values(currentEventSources).forEach((es) => es.close());
    };
  }, [connectToProgressStream]);

  // Background load reports for completed analyses
  useEffect(() => {
    if (repositories.length === 0) return;

    repositories.forEach(async (repo) => {
      if (repo.latestAnalysisStatus === "Completed" && !loadedReportsRef.current[repo.id] && !activeJobsRef.current[repo.id]) {
        loadedReportsRef.current[repo.id] = true;
        try {
          const report = await repositoryAnalysisApi.getLatestReport(repo.id);
          setAnalysisResults((prev) => ({ ...prev, [repo.id]: report }));
          setAnalysisStatuses((prev) => ({ ...prev, [repo.id]: "success" }));
        } catch (err) {
          loadedReportsRef.current[repo.id] = false;
          console.error(`Failed to load report for repository ${repo.id}:`, err);
          setAnalysisStatuses((prev) => ({ ...prev, [repo.id]: "error" }));
        }
      }
    });
  }, [repositories]);

  // Load initial data
  useEffect(() => {
    const timer = setTimeout(() => {
      loadProviders();
      loadCategories();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadProviders, loadCategories]);

  // Trigger initial fetch when filters change (always resets to page 1)
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchRepos(1, true);
    }, 0);
    return () => clearTimeout(timer);
  }, [selectedProviderId, debouncedSearchQuery, visibilityFilter, languageFilter, sortBy, categoryFilter, fetchRepos]);

  // Infinite Scroll page fetching action
  const hasMore = repositories.length < totalCount;

  const loadNextPage = useCallback(() => {
    if (loadingRepositories || loadingMore || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchRepos(nextPage, false);
  }, [page, loadingRepositories, loadingMore, hasMore, fetchRepos]);

  // Attach IntersectionObserver sentinel trigger hook
  useEffect(() => {
    if (!hasMore || loadingRepositories || loadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadNextPage();
        }
      },
      { threshold: 0.1 }
    );

    const currentSentinel = observerRef.current;
    if (currentSentinel) {
      observer.observe(currentSentinel);
    }

    return () => {
      if (currentSentinel) {
        observer.unobserve(currentSentinel);
      }
    };
  }, [loadNextPage, hasMore, loadingRepositories, loadingMore]);

  // Handle sync job polling
  const startPollingJob = useCallback((jobId: string, providerId: string | null) => {
    if (pollingIntervals.current[jobId]) return;

    setActiveSyncJobs((prev) => ({
      ...prev,
      [jobId]: { providerId, progress: 0 },
    }));

    const interval = setInterval(async () => {
      try {
        const status = await sourceCodeProviderApi.fetchSyncStatus(jobId);
        if (status.status === "Completed") {
          clearInterval(interval);
          delete pollingIntervals.current[jobId];
          setActiveSyncJobs((prev) => {
            const next = { ...prev };
            delete next[jobId];
            return next;
          });
          toast.success("Repository sync completed successfully!");
          loadProviders(true);
          loadRepositories();
        } else if (status.status === "Failed") {
          clearInterval(interval);
          delete pollingIntervals.current[jobId];
          setActiveSyncJobs((prev) => {
            const next = { ...prev };
            delete next[jobId];
            return next;
          });
          toast.danger("Repository sync failed", {
            description: status.error || "An unexpected error occurred during synchronization.",
          });
          loadProviders(true);
        } else {
          setActiveSyncJobs((prev) => ({
            ...prev,
            [jobId]: { providerId, progress: status.progress },
          }));
        }
      } catch (err) {
        console.error(`Error polling sync status for job ${jobId}:`, err);
      }
    }, 2000);

    pollingIntervals.current[jobId] = interval;
  }, [loadProviders, loadRepositories]);

  // Clean up intervals on unmount
  useEffect(() => {
    const currentIntervals = pollingIntervals.current;
    return () => {
      Object.values(currentIntervals).forEach(clearInterval);
    };
  }, []);

  // Trigger individual sync
  const handleSyncProvider = async (providerId: string, providerName: string) => {
    try {
      const response = await sourceCodeProviderApi.syncProvider(providerId);
      toast.info(`Sync queued for ${providerName === "github" ? "GitHub" : "GitLab"}.`);
      startPollingJob(response.jobId, providerId);
    } catch (err: unknown) {
      console.error(err);
      toast.danger("Could not initiate sync. Rate limit cooldown may be active.");
    }
  };

  // Trigger global sync
  const handleSyncAll = async () => {
    try {
      const response = await sourceCodeProviderApi.syncAll();
      toast.info("Global sync job initiated.");
      startPollingJob(response.jobId, null);
    } catch (err: unknown) {
      console.error(err);
      toast.danger("Could not initiate global sync. Cooldown may be active.");
    }
  };

  // Check if a specific provider is currently syncing
  const isProviderSyncing = (providerId: string) => {
    return Object.values(activeSyncJobs).some(
      (job) => job.providerId === providerId || job.providerId === null
    );
  };

  const isGlobalSyncing = Object.keys(activeSyncJobs).length > 0;

  const renderSkeletonCard = (isWide = false, key?: string) => (
    <div
      key={key}
      className={`flex flex-col justify-between border border-border/40 rounded-2xl p-6 bg-surface relative w-full gap-4 ${isWide ? "col-span-1 md:col-span-2 min-h-[320px]" : "col-span-1 min-h-[220px]"
        }`}
    >
      {isWide ? (
        <div className="flex flex-col gap-5 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
            <div className="lg:col-span-5 flex flex-col justify-between h-full gap-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <Skeleton className="h-5.5 w-2/3 rounded-lg" />
                  <Skeleton className="h-5 w-16 rounded-md" />
                </div>
                <Skeleton className="h-3 w-1/3 rounded-md" />
                <div className="space-y-2">
                  <Skeleton className="h-3.5 w-full rounded-lg" />
                  <Skeleton className="h-3.5 w-4/5 rounded-lg" />
                </div>
              </div>
              <div className="space-y-3 mt-4">
                <Skeleton className="h-8 w-24 rounded-xl" />
                <div className="flex gap-2 pt-2 border-t border-border/10">
                  <Skeleton className="h-8 w-20 rounded-xl" />
                  <Skeleton className="h-8 w-20 rounded-xl" />
                </div>
              </div>
            </div>
            <div className="lg:col-span-7 flex flex-col gap-4 lg:border-l lg:border-border/10 lg:pl-6 pt-4 lg:pt-0">
              <div className="flex justify-between items-center">
                <Skeleton className="h-4 w-20 rounded-md" />
                <Skeleton className="h-5 w-16 rounded-md" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-12 rounded-xl" />
                <Skeleton className="h-12 rounded-xl" />
                <Skeleton className="h-12 rounded-xl" />
                <Skeleton className="h-12 rounded-xl" />
              </div>
              <Skeleton className="h-14 rounded-xl" />
            </div>
          </div>
          <Skeleton className="h-16 w-full rounded-xl mt-2" />
        </div>
      ) : (
        <>
          <div className="space-y-3">
            <div className="flex justify-between items-start gap-3">
              <Skeleton className="h-5 w-2/3 rounded-lg" />
              <Skeleton className="h-5 w-16 rounded-md" />
            </div>
            <Skeleton className="h-3.5 w-full rounded-lg" />
          </div>
          <Skeleton className="h-10 rounded-xl" />
          <div className="flex items-center justify-between pt-3 border-t border-border/10">
            <Skeleton className="h-6 w-16 rounded-md" />
            <Skeleton className="h-8 w-20 rounded-xl" />
          </div>
        </>
      )}
    </div>
  );

  const renderRiskFactors = (factorsJson: string | null) => {
    if (!factorsJson) return null;
    try {
      const factors = JSON.parse(factorsJson);
      if (!Array.isArray(factors) || factors.length === 0) return null;
      return (
        <div className="mt-2 text-[10px] text-muted-foreground flex flex-wrap gap-1">
          {factors.map((factor: string) => (
            <span key={factor} className="bg-surface-secondary px-1.5 py-0.5 rounded-md border border-border/10">• {factor}</span>
          ))}
        </div>
      );
    } catch (e) {
      return null;
    }
  };

  const renderRepositoryCard = (repo: SourceCodeRepository) => {
    const status = analysisStatuses[repo.id] || "idle";
    const analysisResult = analysisResults[repo.id];
    const provider = providers.find((p) => p.id === repo.authProviderId);
    const providerName = provider?.providerName;

    if (repo.latestAnalysisStatus === "Completed") {
      if (!analysisResult) {
        if (status === "error") {
          return (
            <div
              key={repo.id}
              className="col-span-1 md:col-span-2 flex flex-col border border-danger/30 rounded-2xl p-6 bg-surface relative w-full"
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
                {/* Left Compartment: Core Details & Repo Stats */}
                <div className="lg:col-span-5 flex flex-col justify-between text-left">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="shrink-0 text-foreground/80">
                          {providerName === "github" ? <Github className="size-5" /> : <Gitlab className="size-5 text-[#FC6D26]" />}
                        </span>
                        <Link href={repo.htmlUrl || "#"} target="_blank" rel="noopener noreferrer" className="min-w-0">
                          <Typography.Heading level={4} className="font-extrabold truncate text-foreground hover:text-accent transition-colors">
                            {repo.name}
                          </Typography.Heading>
                        </Link>
                      </div>
                      <Chip size="sm" color="default" variant="soft" className="h-5 px-1.5 text-[8.5px] font-extrabold uppercase rounded-md">
                        Corrupted Data
                      </Chip>
                    </div>
                    <span className="text-[10px] text-muted block">
                      Owner: <strong className="text-foreground">{repo.owner}</strong>
                    </span>
                    <p className="text-xs text-muted leading-relaxed">
                      {repo.description || "No description provided."}
                    </p>
                  </div>
                  <div className="space-y-3 mt-4">
                    <div className="flex items-center gap-2 pt-2.5 border-t border-border/15">
                      <Button
                        size="sm"
                        variant="danger"
                        className="text-xs font-bold rounded-xl"
                        onClick={() => {
                          setRepoToReanalyze({ id: repo.id, name: repo.name, owner: repo.owner });
                          setIsReanalyzeConfirmOpen(true);
                        }}
                      >
                        <RefreshCw size={12} className="shrink-0" />
                        <span>Reanalyze</span>
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Right Compartment: Corrupted Warning */}
                <div className="lg:col-span-7 flex flex-col items-center justify-center border-l border-border/20 pl-6 text-center gap-3">
                  <AlertTriangle className="size-8 text-danger animate-pulse" />
                  <span className="text-xs font-bold text-foreground">Analysis Data Corrupted</span>
                  <span className="text-[10px] text-muted-foreground max-w-xs leading-normal">
                    The AI snapshot response failed to satisfy the strict V2 contract validation checks.
                  </span>
                </div>
              </div>
            </div>
          );
        }
        return renderSkeletonCard(true, repo.id);
      }

      const totalEvidence = analysisResult.sections?.reduce((sum, s) => sum + s.items.length, 0) ?? 0;
      const trustScorePct = ((analysisResult.classification?.trustScore ?? 0) * 100).toFixed(0);
      const primaryDomain = analysisResult.classification?.primaryDomain || "Unclassified";
      const riskLevel = analysisResult.risk?.level ?? "low";

      return (
        <div
          key={repo.id}
          className={`col-span-1 md:col-span-2 flex flex-col border border-border/60 rounded-2xl p-6 transition-all duration-300 bg-surface relative hover:shadow-lg hover:border-accent/40 w-full ${!repo.isAccessible ? "opacity-60 border-dashed" : ""
            }`}
        >
          {/* Access Warning Bar */}
          {!repo.isAccessible && (
            <div className="absolute top-0 inset-x-0 bg-warning-soft/80 backdrop-blur-xs text-[10px] text-warning font-bold py-1 px-3 rounded-t-2xl flex items-center gap-1 border-b border-warning/15">
              <AlertCircle className="size-3 shrink-0" />
              <span>Inaccessible on provider account</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
            {/* Left Compartment: Core Details & Repo Stats & Actions */}
            <div className="lg:col-span-5 flex flex-col justify-between text-left">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="shrink-0 text-foreground/80">
                      {providerName === "github" ? (
                        <Github className="size-5" />
                      ) : (
                        <Gitlab className="size-5 text-[#FC6D26]" />
                      )}
                    </span>
                    <Link href={repo.htmlUrl || "#"} target="_blank" rel="noopener noreferrer" className="min-w-0">
                      <Typography.Heading level={4} className="font-extrabold truncate text-foreground hover:text-accent transition-colors">
                        {repo.name}
                      </Typography.Heading>
                    </Link>
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5">
                    {repo.isPrivate ? (
                      <Chip size="sm" color="default" variant="primary">
                        <Lock className="size-2.5 mr-0.5" />
                        <span className="text-[8.5px] uppercase tracking-wider font-extrabold mt-0.5">Private</span>
                      </Chip>
                    ) : (
                      <Chip size="sm" color="accent" variant="soft">
                        <Globe className="size-3 mr-0.5" />
                        <span className="text-[8.5px] uppercase tracking-wider font-extrabold mt-px">Public</span>
                      </Chip>
                    )}
                    <Chip size="sm" color="default" variant="soft" className="h-5 px-1.5 text-[8.5px] font-extrabold uppercase rounded-md">
                      {repo.classification || "Pending Analysis"}
                    </Chip>
                    {repo.authenticityType && (
                      <Chip size="sm" color="warning" variant="soft" className="h-5 px-1.5 text-[8.5px] font-extrabold uppercase rounded-md">
                        {repo.authenticityType.replace(/_/g, " ")}
                      </Chip>
                    )}
                  </div>
                </div>

                <span className="text-[10px] text-muted block">
                  Owner: <strong className="text-foreground">{repo.owner}</strong>
                </span>

                <p className="text-xs text-muted leading-relaxed">
                  {repo.description || "No description provided."}
                </p>
              </div>

              <div className="space-y-3 mt-4">
                {/* Repo Meta Stats Pill */}
                <div className="flex flex-wrap items-center gap-2 bg-surface-secondary/40 border border-border/20 px-3 py-2 rounded-xl text-[11px] text-muted font-mono w-fit">
                  {repo.primaryLanguage && (
                    <span className="font-bold text-foreground pr-2 border-r border-border/30">
                      {repo.primaryLanguage}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Star className="size-3 text-yellow-500 fill-yellow-500/10 shrink-0" />
                    <span className="font-black text-foreground">{repo.starsCount}</span>
                  </span>
                  <span className="flex items-center gap-1 pl-1">
                    <GitFork className="size-3 text-muted shrink-0" />
                    <span className="font-black text-foreground">{repo.forksCount}</span>
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2.5 border-t border-border/15">
                  <Button
                    size="sm"
                    className="text-xs font-bold rounded-xl bg-accent text-accent-foreground"
                    onClick={() => {
                      setSelectedAnalysis(analysisResult);
                      setSelectedJobId(analysisResult.jobId || lastJobIdsRef.current[repo.id] || activeJobsRef.current[repo.id] || null);
                      setSelectedRepoId(repo.id);
                      setIsModalOpen(true);
                    }}
                  >
                    <span>View Details</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="text-xs font-bold rounded-xl flex items-center gap-1 border-border/40"
                    onClick={() => {
                      setRepoToReanalyze({ id: repo.id, name: repo.name, owner: repo.owner });
                      setIsReanalyzeConfirmOpen(true);
                    }}
                  >
                    <RefreshCw size={12} className="shrink-0" />
                    <span>Reanalyze</span>
                  </Button>
                </div>
              </div>
            </div>

            {/* Right Compartment: Bento AI findings */}
            <div className="lg:col-span-7 flex flex-col gap-4 text-left lg:border-l lg:border-border/20 lg:pl-6 pt-4 lg:pt-0">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-accent">
                  <Sparkles className="size-4" /> AI Analysis
                </span>
                <AnalysisStatusBadge status="success" />
              </div>

              {/* Nested 2x2 Grid of Bento Blocks */}
              <div className="grid grid-cols-2 gap-3">
                {/* Block 1: Evidence Coverage */}
                <div className="flex flex-col justify-between p-3 rounded-xl border border-border/40 bg-surface-secondary/30">
                  <span className="text-[9.5px] text-muted uppercase tracking-wider font-extrabold">Evidence Strength</span>
                  <span className="text-sm font-black text-foreground font-mono mt-1">
                    {totalEvidence} <span className="text-[10px] text-muted font-normal">Signals</span>
                  </span>
                </div>

                {/* Block 2: Trust Confidence */}
                <div className="flex flex-col justify-between p-3 rounded-xl border border-border/40 bg-surface-secondary/30">
                  <span className="text-[9.5px] text-muted uppercase tracking-wider font-extrabold">Trust Level</span>
                  <span className="text-sm font-black text-foreground font-mono mt-1">
                    {trustScorePct}%
                  </span>
                </div>

                {/* Block 3: Classification */}
                <div className="flex flex-col justify-between p-3 rounded-xl border border-border/40 bg-surface-secondary/30">
                  <span className="text-[9.5px] text-muted uppercase tracking-wider font-extrabold">Classification</span>
                  <span className="text-sm font-bold text-foreground truncate block mt-1">
                    {primaryDomain}
                  </span>
                </div>

                {/* Block 4: Risk Profile */}
                <div className="flex flex-col justify-between p-3 rounded-xl border border-border/40 bg-surface-secondary/30">
                  <span className="text-[9.5px] text-muted uppercase tracking-wider font-extrabold mb-1">Risk Level</span>
                  <div>
                    {(() => {
                      const getRiskColor = (level: string) => {
                        switch (level.toLowerCase()) {
                          case "high": return "danger";
                          case "medium": return "warning";
                          case "low":
                          default: return "success";
                        }
                      };
                      return (
                        <Chip size="sm" color={getRiskColor(riskLevel)} variant="soft" className="h-5.5 px-2 text-[9px] font-extrabold uppercase">
                          {riskLevel} Risk
                        </Chip>
                      );
                    })()}
                  </div>
                  {analysisResult.risk?.reasons && analysisResult.risk.reasons.length > 0 && (
                    <div className="mt-2 text-[10px] text-muted-foreground flex flex-wrap gap-1">
                      {analysisResult.risk.reasons.slice(0, 2).map((reason: string) => (
                        <span key={reason} className="bg-surface-secondary px-1.5 py-0.5 rounded-md border border-border/10 truncate max-w-[120px]">• {reason}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Skills Highlights */}
              {analysisResult.narrative?.top_strengths && analysisResult.narrative.top_strengths.length > 0 && (
                <div className="p-3 rounded-xl border border-border/40 bg-surface-secondary/15 flex flex-col gap-2">
                  <span className="text-[9.5px] text-muted uppercase tracking-wider font-extrabold">Top Skills</span>
                  <div className="flex flex-wrap gap-1.5">
                    {analysisResult.narrative.top_strengths.slice(0, 3).map((strengthItem, idx) => (
                      <Chip key={idx} size="sm" variant="soft" className="text-[9.5px] font-bold">
                        {strengthItem.strength}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* AI Summary Compartment - moved outside the grid to span full-width and balance layout */}
          <div className="p-4 rounded-xl border border-border/40 bg-surface-secondary/15 mt-5 text-left">
            <span className="text-[9.5px] text-muted uppercase tracking-wider font-extrabold block mb-1">AI Summary</span>
            <p className="text-[11.5px] text-muted leading-relaxed">
              {analysisResult.narrative?.recruiter_summary || (analysisResult.risk?.reasons && analysisResult.risk.reasons.join(", ")) || "No summary available."}
            </p>
          </div>
        </div>
      );
    }

    return (
      <div
        key={repo.id}
        className={`col-span-1 flex flex-col justify-between border border-border/60 rounded-2xl p-6 transition-all duration-300 bg-surface relative hover:shadow-lg hover:border-accent/40 w-full min-h-[190px] ${!repo.isAccessible ? "opacity-60 border-dashed" : ""
          }`}
      >
        {/* Access Warning Bar if not accessible anymore */}
        {!repo.isAccessible && (
          <div className="absolute top-0 inset-x-0 bg-warning-soft/80 backdrop-blur-xs text-[10px] text-warning font-bold py-1 px-3 rounded-t-2xl flex items-center gap-1 border-b border-warning/15">
            <AlertCircle className="size-3 shrink-0" />
            <span>Inaccessible on provider account</span>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex justify-between items-start gap-3 mt-1">
            <div className="flex items-center gap-2 min-w-0 text-left">
              <span className="shrink-0 text-foreground/80">
                {providerName === "github" ? (
                  <Github className="size-5" />
                ) : (
                  <Gitlab className="size-5 text-[#FC6D26]" />
                )}
              </span>
              <Link href={repo.htmlUrl || "#"} target="_blank" rel="noopener noreferrer" className="min-w-0">
                <Typography.Heading level={5} className="font-extrabold truncate text-foreground hover:text-accent transition-colors">
                  {repo.name}
                </Typography.Heading>
              </Link>
            </div>

            <div className="flex items-center shrink-0 gap-1.5">
              {repo.isPrivate ? (
                <Chip size="sm" color="default" variant="primary">
                  <Lock className="size-2.5 mr-0.5" />
                  <span className="text-[8.5px] uppercase tracking-wider font-extrabold mt-0.5">Private</span>
                </Chip>
              ) : (
                <Chip size="sm" color="accent" variant="soft">
                  <Globe className="size-3 mr-0.5" />
                  <span className="text-[8.5px] uppercase tracking-wider font-extrabold mt-px">Public</span>
                </Chip>
              )}
              <Chip size="sm" color="default" variant="soft" className="h-5 px-1.5 text-[8.5px] font-extrabold uppercase rounded-md">
                {repo.classification || "Pending Analysis"}
              </Chip>
              {repo.authenticityType && (
                <Chip size="sm" color="warning" variant="soft" className="h-5 px-1.5 text-[8.5px] font-extrabold uppercase rounded-md">
                  {repo.authenticityType.replace(/_/g, " ")}
                </Chip>
              )}
            </div>
          </div>

          <div className="text-left">
            <span className="text-[10px] text-muted block mb-1">
              Owner: <strong className="text-foreground">{repo.owner}</strong>
            </span>
            <p className="text-xs text-muted leading-relaxed line-clamp-2">
              {repo.description || "No description provided."}
            </p>
          </div>

          {/* Repo Meta Stats Row (Language, Stars, Forks) */}
          {(repo.primaryLanguage || repo.starsCount > 0 || repo.forksCount > 0) && (
            <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted mt-1.5">
              {repo.primaryLanguage && (
                <Chip size="sm" variant="soft" className="rounded-md text-[9px] font-bold h-5 px-1.5">
                  {repo.primaryLanguage}
                </Chip>
              )}
              <div className="flex gap-2 bg-surface-secondary/40 border border-border/20 px-2 py-0.5 rounded-md h-5 items-center font-mono">
                <span className="flex items-center gap-0.5">
                  <Star className="size-3 text-yellow-500 fill-yellow-500/10 shrink-0" />
                  <span className="font-bold text-foreground">{repo.starsCount}</span>
                </span>
                <span className="flex items-center gap-0.5">
                  <GitFork className="size-3 text-muted shrink-0" />
                  <span className="font-bold text-foreground">{repo.forksCount}</span>
                </span>
              </div>
            </div>
          )}

          {repo.latestRiskFactorsJson && (
            <div className="mt-2 text-left">
              <span className="text-[9.5px] text-muted uppercase tracking-wider font-extrabold block mb-1">Risk Factors</span>
              {renderRiskFactors(repo.latestRiskFactorsJson)}
            </div>
          )}
        </div>

        {/* Verification and Trust Indicators / Status Display (only for active loading/error states) */}
        {(status === "analyzing" || status === "error") && (
          <div className="my-3">
            {status === "error" ? (
              <div className="p-3 rounded-xl border border-danger/20 bg-danger/5 flex items-center justify-between text-left transition-all">
                <div className="flex items-center gap-1.5">
                  <Chip size="sm" color="danger" variant="soft" className="h-5 px-1.5">
                    <span className="text-[8.5px] uppercase tracking-wider font-extrabold">Error</span>
                  </Chip>
                  <AnalysisStatusBadge status="error" />
                </div>
                <span className="text-[10px] text-danger max-w-[150px] truncate font-medium">
                  Analysis failed. Click retry.
                </span>
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-warning/15 bg-surface-secondary/20 text-left">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Spinner size="sm" color="warning" />
                    <span className="text-xs font-bold text-warning">
                      {analysisSteps[repo.id] || "Initializing..."}
                    </span>
                  </div>
                  <span className="text-xs font-mono font-black text-warning">
                    {Math.round(analysisProgress[repo.id] || 0)}%
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-surface-tertiary rounded-full h-1.5 overflow-hidden mt-2 border border-border/10">
                  <div
                    className="bg-warning h-full rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${analysisProgress[repo.id] || 0}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Stats footer & actions */}
        <div className="flex items-center justify-between pt-3 border-t border-border/15 mt-auto">
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted">
            {/* Verification and Status Badges tucked in footer for idle state */}
            {status === "idle" && (
              <>
                <Chip size="sm" variant="soft" color="default" className="h-5 px-1.5 text-[8.5px] font-extrabold uppercase rounded-md">
                  Unverified
                </Chip>
                <AnalysisStatusBadge status="idle" className="h-5 px-1.5 rounded-md" />
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {repo.isAccessible && (
              <>
                {status === "analyzing" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="text-xs font-bold rounded-xl flex items-center gap-1 border-border/40"
                    onClick={() => {
                      setSelectedAnalysis(null);
                      setSelectedJobId(lastJobIdsRef.current[repo.id] || activeJobsRef.current[repo.id] || null);
                      setSelectedRepoId(repo.id);
                      setIsModalOpen(true);
                    }}
                  >
                    <RefreshCw size={12} className="shrink-0 animate-spin" />
                    <span>Progress</span>
                  </Button>
                )}
                {status === "error" && (
                  <>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="text-xs font-bold rounded-xl border-border/40"
                      onClick={() => {
                        setSelectedAnalysis(null);
                        setSelectedJobId(lastJobIdsRef.current[repo.id] || activeJobsRef.current[repo.id] || null);
                        setSelectedRepoId(repo.id);
                        setIsModalOpen(true);
                      }}
                    >
                      <span>Logs</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      className="text-xs font-bold rounded-xl"
                      onClick={() => handleAnalyzeRepository(repo.id, repo.name, repo.owner)}
                    >
                      <span>Retry</span>
                    </Button>
                  </>
                )}
                {status === "idle" && (
                  <Button
                    size="sm"
                    className="text-xs font-bold rounded-xl bg-accent text-accent-foreground"
                    onClick={() => handleAnalyzeRepository(repo.id, repo.name, repo.owner)}
                  >
                    <span>Analyze</span>
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col w-full text-left relative mx-auto font-sans">
      {/* Header and Back Action */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex flex-col text-left">
            <Typography.Heading level={2} className="font-extrabold">
              Source Code Repositories
            </Typography.Heading>
            <Typography
              type="body-sm"
              className="text-muted mt-1 max-w-xl"
            >
              Browse and manage repositories synchronized from your connected accounts. Use these repos for analytics, proof of contributions, and developer intelligence.
            </Typography>
          </div>

          <div className="flex items-center shrink-0">
            {providers.length > 0 && (
              <Button
                onClick={handleSyncAll}
                isDisabled={isGlobalSyncing}
                isPending={isGlobalSyncing}
                className="rounded-xl"
              >
                <RefreshCw className={`${isGlobalSyncing ? "animate-spin" : ""}`} />
                <span>Sync All Accounts</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      <Separator variant="tertiary" className="mb-6" />

      {loadingProviders ? (
        <div className="flex-1 flex items-center justify-center p-12">
          <Spinner size="lg" color="accent" />
        </div>
      ) : providers.length === 0 ? (
        // Empty state redirecting users to link accounts
        <Card className="flex flex-col items-center justify-center text-center p-12 border border-border/60 max-w-xl mx-auto rounded-3xl mt-8">
          <Info className="size-12 text-muted/60 mb-4" />
          <Typography.Heading level={4} className="font-extrabold mb-2">
            No Connected Provider Accounts
          </Typography.Heading>
          <Typography type="body-sm" className="text-muted mb-6 max-w-sm text-center">
            To import and manage your repositories, you need to connect your GitHub or GitLab credentials first.
          </Typography>
          <Button
            onClick={() => router.push("/settings?tab=account")}
            className="rounded-xl bg-accent text-accent-foreground font-semibold text-xs h-10 px-5"
          >
            Connect Account Now
          </Button>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Connected Providers List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ">
            {providers.map((prov) => {
              const syncing = isProviderSyncing(prov.id);
              const activeJob = Object.values(activeSyncJobs).find(
                (job) => job.providerId === prov.id || job.providerId === null
              );

              return (
                <div
                  key={prov.id}
                  className={`flex flex-col p-4 border rounded-2xl bg-surface transition-all ${syncing ? "border-accent/40 bg-accent/5" : "border-border/60"
                    }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="size-10 border border-border shrink-0">
                        {prov.providerAvatarUrl && (
                          <Avatar.Image
                            src={prov.providerAvatarUrl}
                            alt={prov.providerDisplayName || prov.providerUsername || ""}
                          />
                        )}
                        <Avatar.Fallback>
                          {(prov.providerDisplayName || prov.providerUsername || "?")
                            .slice(0, 2)
                            .toUpperCase()}
                        </Avatar.Fallback>
                      </Avatar>
                      <div className="flex flex-col min-w-0 text-left">
                        <span className="font-bold text-sm truncate text-foreground flex items-center gap-1.5">
                          {prov.providerName === "github" ? (
                            <Github className="size-4 text-foreground/80" />
                          ) : (
                            <Gitlab className="size-4 text-[#FC6D26]" />
                          )}
                          {prov.providerDisplayName || prov.providerUsername}
                        </span>
                        <span className="text-[11px] text-muted truncate">
                          @{prov.providerUsername}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center shrink-0">
                      <Button
                        size="sm"
                        variant={syncing ? "ghost" : "outline"}
                        onClick={() => handleSyncProvider(prov.id, prov.providerName)}
                        isDisabled={syncing}
                        className="rounded-xl h-8 text-xs font-semibold border-border/40"
                      >
                        {syncing ? (
                          <span className="flex items-center gap-1">
                            <Spinner size="sm" color="accent" />
                            <span>{activeJob?.progress ? `${Math.round(activeJob.progress)}%` : "Syncing"}</span>
                          </span>
                        ) : (
                          "Sync Now"
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-[10px] text-muted pt-2 border-t border-border/20">
                    <span>
                      Last Synced:{" "}
                      <strong>
                        {prov.lastProviderSyncAt
                          ? new Date(prov.lastProviderSyncAt).toLocaleString()
                          : "Never"}
                      </strong>
                    </span>
                    {prov.syncStatus === "Failed" && prov.syncError && (
                      <Chip size="sm" color="danger" variant="soft" className="h-4 px-1 font-bold text-[8.5px] uppercase">
                        Failed
                      </Chip>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <Separator variant="tertiary" />

          {/* Search, Sort and Filters toolbar */}
          <div className="flex flex-col gap-3 border bg-surface rounded-2xl p-4 ">
            <div className="flex flex-wrap gap-3 items-end">
              {/* Left Column (2/5 width): Search input */}
              <div className="flex flex-col gap-1 flex-1 text-left">
                <Label htmlFor="search-repo" className="text-xs text-muted">
                  Search
                </Label>
                <InputGroup className="w-full border border-border shadow-none">
                  <InputGroup.Prefix>
                    <Search className="size-3.5 text-muted shrink-0 mr-1" />
                  </InputGroup.Prefix>
                  <InputGroup.Input
                    id="search-repo"
                    type="text"
                    placeholder="Search repository..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="text-[11px]"
                  />
                </InputGroup>
              </div>

              {/* Right Column (3/5 width): Filters */}
              <div className="flex flex-wrap gap-3 items-end">
                {/* Account selector */}
                <div className="flex flex-col gap-1 text-left">
                  <Label className="text-xs text-muted">Account</Label>
                  <Select
                    value={selectedProviderId}
                    onChange={(val) => {
                      setSelectedProviderId(val as string);
                      setPage(1);
                    }}
                    className="w-auto"
                    variant="secondary"
                    aria-label="Account"
                  >
                    <Select.Trigger className="bg-surface border border-border text-xs">
                      <Select.Value className="text-xs" />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover className="rounded-xl z-50">
                      <ListBox
                        aria-label="Account Options"
                      >
                        <ListBox.Item
                          id="all"
                          textValue="All Accounts"
                          className="flex items-center justify-between px-3 py-2 text-xs font-medium text-foreground hover:bg-surface-secondary rounded-lg cursor-pointer transition-colors outline-hidden focus:bg-surface-secondary"
                        >
                          <span>All Accounts</span>
                          <ListBox.ItemIndicator className="size-3 text-accent" />
                        </ListBox.Item>
                        {providers.map((p) => {
                          const label = `${p.providerName === "github" ? "GitHub" : "GitLab"} - @${p.providerUsername}`;
                          return (
                            <ListBox.Item
                              key={p.id}
                              id={p.id}
                              textValue={label}
                              className="flex items-center justify-between px-3 py-2 text-xs font-medium text-foreground hover:bg-surface-secondary rounded-lg cursor-pointer transition-colors outline-hidden focus:bg-surface-secondary"
                            >
                              <span>{label}</span>
                              <ListBox.ItemIndicator className="size-3 text-accent" />
                            </ListBox.Item>
                          );
                        })}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>

                {/* Language filter */}
                <div className="flex flex-col gap-1 text-left">
                  <Label className="text-xs text-muted">Language</Label>
                  <Select
                    value={languageFilter}
                    onChange={(val) => {
                      setLanguageFilter(val as string);
                      setPage(1);
                    }}
                    className="w-auto"
                    variant="secondary"
                    aria-label="Language"
                  >
                    <Select.Trigger className="bg-surface border border-border">
                      <Select.Value className="text-xs" />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover className="rounded-xl z-50">
                      <ListBox
                        aria-label="Language Options"
                        className="p-1 max-h-60 overflow-y-auto outline-hidden focus:outline-hidden"
                      >
                        <ListBox.Item
                          id="all"
                          textValue="All Languages"
                          className="flex items-center justify-between px-3 py-2 text-xs font-medium text-foreground hover:bg-surface-secondary rounded-lg cursor-pointer transition-colors outline-hidden focus:bg-surface-secondary"
                        >
                          <span>All Languages</span>
                          <ListBox.ItemIndicator className="size-3 text-accent" />
                        </ListBox.Item>
                        {POPULAR_LANGUAGES.map((lang) => (
                          <ListBox.Item
                            key={lang}
                            id={lang}
                            textValue={lang}
                            className="flex items-center justify-between px-3 py-2 text-xs font-medium text-foreground hover:bg-surface-secondary rounded-lg cursor-pointer transition-colors outline-hidden focus:bg-surface-secondary"
                          >
                            <span>{lang}</span>
                            <ListBox.ItemIndicator className="size-3 text-accent" />
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>

                {/* Category filter */}
                <div className="flex flex-col gap-1 text-left">
                  <Label className="text-xs text-muted">Category</Label>
                  <Select
                    value={categoryFilter}
                    onChange={(val) => {
                      setCategoryFilter(val as string);
                      setPage(1);
                    }}
                    className="w-auto"
                    variant="secondary"
                    aria-label="Category"
                  >
                    <Select.Trigger className="bg-surface border border-border">
                      <Select.Value className="text-xs" />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover className="rounded-xl z-50">
                      <ListBox
                        aria-label="Category Options"
                        className="p-1 max-h-60 overflow-y-auto outline-hidden focus:outline-hidden"
                      >
                        <ListBox.Item
                          id="all"
                          textValue="All Categories"
                          className="flex items-center justify-between px-3 py-2 text-xs font-medium text-foreground hover:bg-surface-secondary rounded-lg cursor-pointer transition-colors outline-hidden focus:bg-surface-secondary"
                        >
                          <span>All Categories</span>
                          <ListBox.ItemIndicator className="size-3 text-accent" />
                        </ListBox.Item>
                        {categories.map((cat) => (
                          <ListBox.Item
                            key={cat}
                            id={cat}
                            textValue={cat}
                            className="flex items-center justify-between px-3 py-2 text-xs font-medium text-foreground hover:bg-surface-secondary rounded-lg cursor-pointer transition-colors outline-hidden focus:bg-surface-secondary"
                          >
                            <span>{cat}</span>
                            <ListBox.ItemIndicator className="size-3 text-accent" />
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>

                {/* Visibility Filter */}
                <div className="flex flex-col gap-1 text-left">
                  <Label className="text-xs text-muted">Visibility</Label>
                  <Select
                    value={visibilityFilter}
                    onChange={(val) => {
                      setVisibilityFilter(val as string);
                      setPage(1);
                    }}
                    className="w-auto"
                    variant="secondary"
                    aria-label="Visibility"
                  >
                    <Select.Trigger className="bg-surface border border-border">
                      <Select.Value className="text-xs" />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover className="rounded-xl z-50">
                      <ListBox
                        aria-label="Visibility Options"
                        className="p-1 max-h-60 overflow-y-auto outline-hidden focus:outline-hidden"
                      >
                        <ListBox.Item
                          id="all"
                          textValue="All Visibilities"
                          className="flex items-center justify-between px-3 py-2 text-xs font-medium text-foreground hover:bg-surface-secondary rounded-lg cursor-pointer transition-colors outline-hidden focus:bg-surface-secondary"
                        >
                          <span>All Visibilities</span>
                          <ListBox.ItemIndicator className="size-3 text-accent" />
                        </ListBox.Item>
                        <ListBox.Item
                          id="public"
                          textValue="Public"
                          className="flex items-center justify-between px-3 py-2 text-xs font-medium text-foreground hover:bg-surface-secondary rounded-lg cursor-pointer transition-colors outline-hidden focus:bg-surface-secondary"
                        >
                          <span>Public</span>
                          <ListBox.ItemIndicator className="size-3 text-accent" />
                        </ListBox.Item>
                        <ListBox.Item
                          id="private"
                          textValue="Private"
                          className="flex items-center justify-between px-3 py-2 text-xs font-medium text-foreground hover:bg-surface-secondary rounded-lg cursor-pointer transition-colors outline-hidden focus:bg-surface-secondary"
                        >
                          <span>Private</span>
                          <ListBox.ItemIndicator className="size-3 text-accent" />
                        </ListBox.Item>
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>

                {/* Sorting Filter */}
                <div className="flex flex-col gap-1 text-left">
                  <Label className="text-xs text-muted">Sort By</Label>
                  <Select
                    value={sortBy}
                    onChange={(val) => {
                      setSortBy(val as string);
                      setPage(1);
                    }}
                    className="w-auto"
                    variant="secondary"
                    aria-label="Sort By"
                  >
                    <Select.Trigger className="bg-surface border border-border">
                      <Select.Value className="text-xs" />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover className="rounded-xl z-50">
                      <ListBox
                        aria-label="Sort Options"
                        className="p-1 max-h-60 overflow-y-auto outline-hidden focus:outline-hidden"
                      >
                        <ListBox.Item
                          id="updated"
                          textValue="Recently Updated"
                          className="flex items-center justify-between px-3 py-2 text-xs font-medium text-foreground hover:bg-surface-secondary rounded-lg cursor-pointer transition-colors outline-hidden focus:bg-surface-secondary"
                        >
                          <span>Recently Updated</span>
                          <ListBox.ItemIndicator className="size-3 text-accent" />
                        </ListBox.Item>
                        <ListBox.Item
                          id="stars"
                          textValue="Most Stars"
                          className="flex items-center justify-between px-3 py-2 text-xs font-medium text-foreground hover:bg-surface-secondary rounded-lg cursor-pointer transition-colors outline-hidden focus:bg-surface-secondary"
                        >
                          <span>Most Stars</span>
                          <ListBox.ItemIndicator className="size-3 text-accent" />
                        </ListBox.Item>
                        <ListBox.Item
                          id="name_asc"
                          textValue="Name (A-Z)"
                          className="flex items-center justify-between px-3 py-2 text-xs font-medium text-foreground hover:bg-surface-secondary rounded-lg cursor-pointer transition-colors outline-hidden focus:bg-surface-secondary"
                        >
                          <span>Name (A-Z)</span>
                          <ListBox.ItemIndicator className="size-3 text-accent" />
                        </ListBox.Item>
                        <ListBox.Item
                          id="name_desc"
                          textValue="Name (Z-A)"
                          className="flex items-center justify-between px-3 py-2 text-xs font-medium text-foreground hover:bg-surface-secondary rounded-lg cursor-pointer transition-colors outline-hidden focus:bg-surface-secondary"
                        >
                          <span>Name (Z-A)</span>
                          <ListBox.ItemIndicator className="size-3 text-accent" />
                        </ListBox.Item>
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {/* Repositories Cards Grid */}
          {(() => {
            if (loadingRepositories) {
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 grid-flow-row-dense gap-5 w-full">
                  {renderSkeletonCard(true, "ske-1")}
                  {renderSkeletonCard(false, "ske-2")}
                  {renderSkeletonCard(false, "ske-3")}
                  {renderSkeletonCard(true, "ske-4")}
                </div>
              );
            }

            if (repositories.length === 0) {
              return (
                <Card className="flex items-center justify-center py-16 text-muted gap-2 w-full">
                  <AlertCircle className="size-6 text-muted" />
                  <Typography.Paragraph className="text-muted text-xs">No repositories found matching the search criteria.</Typography.Paragraph>
                </Card>
              );
            }

            return (
              <div className="flex flex-col gap-3 w-full">
                <div className="grid grid-cols-1 md:grid-cols-2 grid-flow-row-dense gap-5 w-full">
                  {repositories.map((repo) => renderRepositoryCard(repo))}
                </div>

                {/* Infinite Scroll Sentinel element */}
                <div ref={observerRef} className="h-4 w-full" />

                {/* Loading More Indicator Skeletons */}
                {loadingMore && (
                  <div className="grid grid-cols-1 md:grid-cols-2 grid-flow-row-dense gap-5 w-full mt-4">
                    {renderSkeletonCard(false, "ske-more-1")}
                    {renderSkeletonCard(true, "ske-more-2")}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Detailed Analysis Modal */}
      <DetailedAnalysisModal
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        analysis={selectedAnalysis}
        jobId={selectedJobId}
        repoId={selectedRepoId}
        onAnalysisComplete={handleAnalysisComplete}
      />

      {/* Reanalyze Confirmation Modal */}
      <AlertDialog.Backdrop
        isOpen={isReanalyzeConfirmOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsReanalyzeConfirmOpen(false);
            setRepoToReanalyze(null);
          }
        }}
      >
        <AlertDialog.Container>
          <AlertDialog.Dialog className="sm:max-w-[400px]">
            {(renderProps) => (
              <>
                <AlertDialog.CloseTrigger />
                <AlertDialog.Header>
                  <AlertDialog.Icon status="warning">
                    <AlertTriangle className="size-5 text-warning" />
                  </AlertDialog.Icon>
                  <AlertDialog.Heading>
                    Confirm Reanalysis
                  </AlertDialog.Heading>
                </AlertDialog.Header>
                <AlertDialog.Body className="text-sm font-sans font-light leading-relaxed">
                  <p>
                    Are you sure you want to re-analyze the repository{" "}
                    <strong>{repoToReanalyze?.owner}/{repoToReanalyze?.name}</strong>?
                  </p>
                  <p className="mt-2 text-xs text-muted">
                    This will re-run the entire AI analysis pipeline and generate new career intelligence data.
                  </p>
                </AlertDialog.Body>
                <AlertDialog.Footer>
                  <Button
                    variant="tertiary"
                    onPress={() => {
                      setIsReanalyzeConfirmOpen(false);
                      setRepoToReanalyze(null);
                      renderProps.close();
                    }}
                    className="rounded-xl"
                  >
                    Cancel
                  </Button>
                  <Button
                    onPress={() => {
                      if (repoToReanalyze) {
                        handleAnalyzeRepository(repoToReanalyze.id, repoToReanalyze.name, repoToReanalyze.owner);
                      }
                      setIsReanalyzeConfirmOpen(false);
                      setRepoToReanalyze(null);
                      renderProps.close();
                    }}
                    className="bg-warning-soft text-warning rounded-xl font-semibold"
                  >
                    Reanalyze
                  </Button>
                </AlertDialog.Footer>
              </>
            )}
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </div>
  );
}
