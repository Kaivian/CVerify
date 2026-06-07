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
  Accordion,
} from "@heroui/react";
import { Github, Gitlab } from "@thesvg/react";
import {
  Search,
  RefreshCw,
  Lock,
  Globe,
  Star,
  GitFork,
  AlertCircle,
  Info,
  Sparkles,
  AlertTriangle,
  Terminal,
  XCircle,
} from "lucide-react";
import { parseAndSanitizeMarkdown } from "@/lib/markdown";
import { sourceCodeProviderApi } from "@/services/source-code-provider.service";
import type {
  SourceCodeProvider,
  SourceCodeRepository,
} from "@/types/source-code-provider.types";
import { useDebounce } from "@/hooks/use-debounce";
import { AnalysisStatusBadge } from "../components/repository-analysis/AnalysisStatusBadge";
import { DetailedAnalysisModal } from "../components/repository-analysis/DetailedAnalysisModal";
import { useAnalysisJobStore, getDerivedUIState } from "../components/repository-analysis/stores/use-analysis-job-store";

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

  // Repository Analysis States (Zustand subscribed)
  const repoStates = useAnalysisJobStore((state) => state.repoStates);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRepoId, setSelectedRepoId] = useState<string>("");
  const [repoToReanalyze, setRepoToReanalyze] = useState<{ id: string; name: string; owner: string } | null>(null);
  const [isReanalyzeConfirmOpen, setIsReanalyzeConfirmOpen] = useState(false);
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
      useAnalysisJobStore.getState().initializeRepoStates(result.items);
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

  const handleAnalyzeRepository = async (repoId: string, _repoName: string, _repoOwner: string) => {
    toast.info("Repository analysis started...");
    try {
      await useAnalysisJobStore.getState().triggerReanalyze(repoId);
    } catch (err: unknown) {
      console.error("Repository reanalysis failed:", err);
      const axiosError = err as { response?: { data?: { message?: string } }; message?: string };
      toast.danger("Repository reanalysis failed", {
        description: axiosError.response?.data?.message || axiosError.message || "An unexpected error occurred during AI analysis."
      });
    }
  };



  // Check and restore active jobs on page load
  useEffect(() => {
    useAnalysisJobStore.getState().checkActiveJobs();
  }, []);

  // Background load reports for completed analyses
  useEffect(() => {
    if (repositories.length === 0) return;

    repositories.forEach(async (repo) => {
      const repoState = useAnalysisJobStore.getState().repoStates[repo.id];
      if (repo.latestAnalysisStatus === "Completed" && !repoState?.latestReport && !loadedReportsRef.current[repo.id]) {
        loadedReportsRef.current[repo.id] = true;
        try {
          await useAnalysisJobStore.getState().loadLatestReport(repo.id);
        } catch (err) {
          loadedReportsRef.current[repo.id] = false;
          console.error(`Failed to load report for repository ${repo.id}:`, err);
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
    } catch {
      return null;
    }
  };

  const renderRepositoryCard = (repo: SourceCodeRepository) => {
    const repoState = repoStates[repo.id];
    const derivedState = getDerivedUIState(repo, repoState);
    const status = derivedState.status;
    const analysisResult = repoState?.latestReport || repoState?.partialSnapshot || null;
    const provider = providers.find((p) => p.id === repo.authProviderId);
    const providerName = provider?.providerName;

    if (derivedState.renderSource === "report" || derivedState.renderSource === "snapshot") {
      if (!analysisResult) {
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
              <div className="flex flex-col justify-between gap-2">
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

                <Separator variant="tertiary" />

                {/* AI REPO SUMARRY */}
                {analysisResult.cvSynthesis && (
                  <div className="space-y-2 mt-2 bg-surface-secondary/30 border border-tertiary p-3 rounded-xl text-left">
                    <div className="flex items-center justify-between border-b border-border/10 pb-1.5">
                      <div className="flex items-center gap-1">
                        <Sparkles className="size-3.5 text-accent shrink-0" />
                        <span className="text-[10px] text-foreground uppercase font-black tracking-wider font-sans">
                          AI CV Profile
                        </span>
                      </div>
                      {analysisResult.cvSynthesis.ownershipProfile && (
                        <Chip
                          size="sm"
                          variant="soft"
                          color="default"
                          className="h-4.5 px-1.5 text-[10px] uppercase rounded-md"
                        >
                          {analysisResult.cvSynthesis.ownershipProfile}
                        </Chip>
                      )}
                    </div>
                    {analysisResult.cvSynthesis.title && (
                      <h5 className="text-[11px] font-extrabold text-foreground tracking-wide font-sans">
                        {analysisResult.cvSynthesis.title}
                      </h5>
                    )}
                    <p className="text-[10.5px] text-muted-foreground leading-relaxed font-light whitespace-pre-wrap line-clamp-4">
                      {analysisResult.cvSynthesis.summary}
                    </p>
                    {analysisResult.cvSynthesis.skills && analysisResult.cvSynthesis.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border/10 mt-1">
                        {analysisResult.cvSynthesis.skills.slice(0, 4).map((skill, idx) => (
                          <Chip
                            key={`${skill}-${idx}`}
                            size="sm"
                            variant="soft"
                            color="default"
                            className="h-4.5 px-1.5 text-[8.5px] font-bold rounded-md"
                          >
                            {skill}
                          </Chip>
                        ))}
                        {analysisResult.cvSynthesis.skills.length > 3 && (
                          <span className="text-[8.5px] text-muted font-bold self-center">
                            +{analysisResult.cvSynthesis.skills.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between mt-4">
                <div className="flex flex-wrap items-center gap-2 bg-surface-secondary/30 border border-tertiary px-3 py-2 rounded-xl text-[11px] text-muted font-mono w-fit">
                  {repo.primaryLanguage && (
                    <span className="font-bold text-foreground pr-2 border-r border-tertiary">
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
                <div className="flex items-center gap-2">
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
                  <Button
                    size="sm"
                    className="text-xs font-bold rounded-xl bg-accent text-accent-foreground"
                    onClick={() => {
                      setSelectedRepoId(repo.id);
                      setIsModalOpen(true);
                    }}
                  >
                    <span>View Details</span>
                  </Button>
                </div>
              </div>
            </div>

            {/* Right Compartment: Bento AI findings */}
            <div className="lg:col-span-7 flex flex-col gap-4 text-left lg:border-l lg:border-tertiary lg:pl-6 pt-4 lg:pt-0">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-accent">
                  <Sparkles className="size-4" /> AI Analysis
                </span>
                <AnalysisStatusBadge status={status} />
              </div>

              {/* Nested 2x2 Grid of Bento Blocks */}
              <div className="flex gap-4 items-center justify-between">
                {/* Block 1: Evidence Coverage */}
                <div className="flex flex-col p-3 rounded-xl border border-tertiary bg-surface-secondary/30 w-full">
                  <span className="text-[9.5px] text-muted uppercase tracking-wider font-extrabold">Evidence Strength</span>
                  <span className="text-sm font-black text-foreground font-mono mt-1">
                    {totalEvidence} <span className="text-[10px] text-muted font-normal">Signals</span>
                  </span>
                </div>

                {/* Block 2: Trust Confidence */}
                <div className="flex flex-col p-3 rounded-xl border border-tertiary bg-surface-secondary/30 w-full">
                  <span className="text-[9.5px] text-muted uppercase tracking-wider font-extrabold">Trust Level</span>
                  <span className="text-sm font-black text-foreground font-mono mt-1">
                    {trustScorePct}%
                  </span>
                </div>

                {/* Block 3: Classification */}
                <div className="flex flex-col p-3 rounded-xl border border-tertiary bg-surface-secondary/30 w-full">
                  <span className="text-[9.5px] text-muted uppercase tracking-wider font-extrabold">Classification</span>
                  <span className="text-sm font-bold text-foreground truncate block mt-1">
                    {primaryDomain}
                  </span>
                </div>
              </div>

              {/* Block 4: Risk Profile */}
              <div className="flex flex-col p-3 rounded-xl border border-tertiary bg-surface-secondary/30 w-full">
                <div className="flex items-center justify-between w-full">
                  <span className="text-[9.5px] text-muted uppercase tracking-wider font-extrabold">Risk Level</span>
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
                        <Chip size="sm" color={getRiskColor(riskLevel)} variant="soft" className="h-5.5 px-2 text-[9px] font-extrabold uppercase mb-1 rounded-md">
                          {riskLevel} Risk
                        </Chip>
                      );
                    })()}
                  </div>
                </div>
                {analysisResult.risk?.reasons && analysisResult.risk.reasons.length > 0 && (
                  <div className=" text-[10px] text-muted-foreground flex flex-wrap gap-1">
                    {analysisResult.risk.reasons.map((reason: string) => (
                      <Chip key={reason} color="default" variant="soft" className="h-5.5 px-2 text-[9px] uppercase truncate rounded-md border border-border">{reason}</Chip>
                    ))}
                  </div>
                )}
              </div>

              {/* Skills Highlights */}
              {analysisResult.narrative?.top_strengths && analysisResult.narrative.top_strengths.length > 0 && (
                <div className="flex flex-col gap-2 p-3 rounded-xl border border-tertiary bg-surface-secondary/30 w-full">
                  <span className="text-[9.5px] text-muted uppercase tracking-wider font-extrabold">Top Skills</span>
                  <div className="flex flex-wrap gap-1.5">
                    {analysisResult.narrative.top_strengths.map((strengthItem, idx) => (
                      <Chip key={idx} color="default" variant="soft" className="h-5.5 px-2 text-[9px] uppercase truncate rounded-md border border-border">
                        {strengthItem.strength}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* AI Summary Compartment - moved outside the grid to span full-width and balance layout */}
          <Accordion className="w-full mt-4 border border-tertiary bg-surface-secondary/30 rounded-xl" variant="surface">
            <Accordion.Item key="ai-summary" id="ai-summary" aria-label="AI Summary">
              <Accordion.Heading>
                <Accordion.Trigger className="text-[10.5px] font-bold text-foreground flex items-center justify-between w-full py-2 px-2 cursor-pointer select-none rounded-md transition-all duration-300 hover:bg-surface-secondary/70">
                  <span className="flex items-center gap-2">
                    <Sparkles className="size-3.5 text-accent shrink-0" />
                    AI Detailed Report
                  </span>
                  <Accordion.Indicator />
                </Accordion.Trigger>
              </Accordion.Heading>
              <Accordion.Panel>
                <Accordion.Body className="text-[11.5px] text-muted-foreground leading-relaxed pl-5.5 font-light pt-2 pb-3 select-text markdown-summary">
                  <div dangerouslySetInnerHTML={{ __html: parseAndSanitizeMarkdown(analysisResult.narrative?.recruiter_summary || (analysisResult.risk?.reasons && analysisResult.risk.reasons.join(", ")) || "No summary available.") }} />
                </Accordion.Body>
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
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
        {(status === "QUEUED" || status === "ANALYZING" || status === "FAILED" || status === "CANCELLED") && (
          <div className="my-3">
            {status === "FAILED" || status === "CANCELLED" ? (
              <div className="p-3 rounded-xl border border-danger/20 bg-danger/5 flex items-center justify-between text-left transition-all">
                <div className="flex items-center gap-1.5">
                  <Chip size="sm" color="danger" variant="soft" className="h-5 px-1.5">
                    <span className="text-[8.5px] uppercase tracking-wider font-extrabold">
                      {status === "CANCELLED" ? "Stopped" : "Error"}
                    </span>
                  </Chip>
                  <AnalysisStatusBadge status={status} />
                </div>
                <span className="text-[10px] text-danger max-w-[150px] truncate font-medium">
                  {status === "CANCELLED" ? "Analysis cancelled." : "Analysis failed. Click retry."}
                </span>
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-warning/15 bg-surface-secondary/20 text-left">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Spinner size="sm" color="warning" />
                    <span className="text-xs font-bold text-warning">
                      {derivedState.description}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-black text-warning">
                      {Math.round(derivedState.progress)}%
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 min-w-0 text-[10px] font-extrabold uppercase rounded-md flex items-center gap-1 border-danger/30 hover:bg-danger/10 text-danger cursor-pointer"
                      onClick={() => useAnalysisJobStore.getState().cancelReanalyze(repo.id)}
                    >
                      <XCircle size={12} className="shrink-0" />
                      <span>Stop</span>
                    </Button>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-surface-tertiary rounded-full h-1.5 overflow-hidden mt-2 border border-border/10">
                  <div
                    className="bg-warning h-full rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${derivedState.progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Stats footer & actions */}
        <div className="flex items-center justify-between pt-3 border-t border-border/15 mt-auto">
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted">
            {/* Verification and Status Badges tucked in footer */}
            {status === "idle" && (
              <>
                <Chip size="sm" variant="soft" color="default" className="h-5 px-1.5 text-[8.5px] font-extrabold uppercase rounded-md">
                  Unverified
                </Chip>
                <AnalysisStatusBadge status="idle" className="h-5 px-1.5 rounded-md" />
              </>
            )}
            {(status === "QUEUED" || status === "ANALYZING") && (
              <>
                <AnalysisStatusBadge status={status} className="h-5 px-1.5 rounded-md" />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-5 px-1.5 text-[8.5px] font-extrabold uppercase rounded-md flex items-center gap-1 border-border/40 hover:bg-surface-secondary text-warning"
                  onClick={() => {
                    setSelectedRepoId(repo.id);
                    setIsModalOpen(true);
                  }}
                >
                  <Terminal size={10} className="shrink-0" />
                  <span>Monitor Logs</span>
                </Button>
              </>
            )}
            {(status === "FAILED" || status === "CANCELLED") && (
              <>
                <AnalysisStatusBadge status={status} className="h-5 px-1.5 rounded-md" />
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {repo.isAccessible && (
              <>
                {(status === "FAILED" || status === "CANCELLED") && (
                  <>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="text-xs font-bold rounded-xl border-border/40"
                      onClick={() => {
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
        repoId={selectedRepoId}
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
