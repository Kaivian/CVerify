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
} from "@heroui/react";
import { PaginationWrapper } from "@/components/ui/pagination-wrapper";
import { Github, Gitlab } from "@thesvg/react";
import {
  ArrowLeft,
  Search,
  RefreshCw,
  ExternalLink,
  Lock,
  Globe,
  Star,
  GitFork,
  CheckCircle2,
  AlertCircle,
  Info,
  FolderTree,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { sourceCodeProviderApi } from "@/services/source-code-provider.service";
import {
  SourceCodeProvider,
  SourceCodeRepository,
} from "@/types/source-code-provider.types";
import { useDebounce } from "@/hooks/use-debounce";
import { AnalysisStatus, RepositoryAnalysis } from "@/types/repository-analysis.types";
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

const getRiskLevel = (multiplier: number) => {
  if (multiplier >= 0.8) return { label: "Low Risk", color: "success" as const };
  if (multiplier >= 0.5) return { label: "Medium Risk", color: "warning" as const };
  return { label: "High Risk", color: "danger" as const };
};

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

  // Pagination / Infinite Scroll State
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  // Repository Analysis States
  const [analysisStatuses, setAnalysisStatuses] = useState<Record<string, AnalysisStatus>>({});
  const [analysisResults, setAnalysisResults] = useState<Record<string, RepositoryAnalysis>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState<RepositoryAnalysis | null>(null);

  const handleAnalyzeRepository = async (repoId: string, repoName: string, repoOwner: string) => {
    setAnalysisStatuses((prev) => ({ ...prev, [repoId]: "analyzing" }));
    toast.info(`Repository analysis started...`);
    try {
      const result = await repositoryAnalysisApi.analyzeRepository(repoId, repoName, repoOwner);
      setAnalysisResults((prev) => ({ ...prev, [repoId]: result }));
      setAnalysisStatuses((prev) => ({ ...prev, [repoId]: "success" }));
      toast.success("Repository analysis completed.");
    } catch (err: any) {
      console.error("Repository analysis failed:", err);
      setAnalysisStatuses((prev) => ({ ...prev, [repoId]: "error" }));
      toast.danger("Repository analysis failed", {
        description: err.message || "An unexpected error occurred during AI analysis."
      });
    }
  };

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
  }, [selectedProviderId, debouncedSearchQuery, visibilityFilter, languageFilter, sortBy, pageSize]);

  // Compatibility alias for manual sync or reload operations
  const loadRepositories = useCallback(() => {
    return fetchRepos(1, true);
  }, [fetchRepos]);

  // Load initial data
  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  // Trigger initial fetch when filters change (always resets to page 1)
  useEffect(() => {
    setPage(1);
    fetchRepos(1, true);
  }, [selectedProviderId, debouncedSearchQuery, visibilityFilter, languageFilter, sortBy, fetchRepos]);

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
    return () => {
      Object.values(pollingIntervals.current).forEach(clearInterval);
    };
  }, []);

  // Trigger individual sync
  const handleSyncProvider = async (providerId: string, providerName: string) => {
    try {
      const response = await sourceCodeProviderApi.syncProvider(providerId);
      toast.info(`Sync queued for ${providerName === "github" ? "GitHub" : "GitLab"}.`);
      startPollingJob(response.jobId, providerId);
    } catch (err: any) {
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
    } catch (err: any) {
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

  const totalPages = Math.ceil(totalCount / pageSize);

  const renderRepositoryCard = (repo: SourceCodeRepository) => {
    const provider = providers.find((p) => p.id === repo.authProviderId);
    const status = analysisStatuses[repo.id] || "idle";
    const analysisResult = analysisResults[repo.id];

    return (
      <div
        key={repo.id}
        className={`flex flex-col border rounded-xl pt-3 px-5 pb-5 transition-all duration-300 bg-surface relative  hover:shadow-lg h-fit w-full ${!repo.isAccessible ? "opacity-60 border-dashed" : "hover:border-accent/40"
          }`}
      >
        {/* Access Warning Bar if not accessible anymore */}
        {!repo.isAccessible && (
          <div className="absolute top-0 inset-x-0 bg-warning-soft/80 backdrop-blur-xs text-[10px] text-warning font-bold py-1 px-3 rounded-t-2xl flex items-center gap-1 border-b border-warning/15">
            <AlertCircle className="size-3 shrink-0" />
            <span>Inaccessible on provider account</span>
          </div>
        )}

        <div className="flex justify-between items-start gap-3 mt-1.5">
          <div className="flex flex-col text-left min-w-0">
            <Link href={repo.htmlUrl || "#"} target="_blank" rel="noopener noreferrer">
              <Typography.Heading level={5} className="font-extrabold truncate">
                {repo.name}
              </Typography.Heading>
            </Link>
            <span className="text-[10px] text-muted truncate">
              Owner: <strong>{repo.owner}</strong>
            </span>
          </div>

          <div className="flex items-center shrink-0">
            {repo.isPrivate ? (
              <Chip size="sm" color="default" variant="primary">
                <Lock className="size-2.5 mr-0.5" />
                <span className="text-[8.5px] uppercase tracking-wider font-extrabold mt-0.5 mr-px">Private</span>
              </Chip>
            ) : (
              <Chip size="sm" color="accent" variant="soft">
                <Globe className="size-3 mr-0.5" />
                <span className="text-[8.5px] uppercase tracking-wider font-extrabold mt-px">Public</span>
              </Chip>
            )}
          </div>
        </div>

        <div className="flex-1 mt-3 text-left">
          <Typography type="body-xs" className="text-muted leading-relaxed">
            {repo.description || "No description provided."}
          </Typography>
        </div>

        {/* Verification and Trust Indicators */}
        {status === "error" ? (
          <div className="mt-3 p-3 rounded-lg border border-danger/20 bg-danger/5 flex items-center justify-between text-left transition-all">
            <div className="flex items-center gap-1.5">
              <Chip size="sm" color="danger" variant="soft" className="h-5 px-1.5">
                <span className="text-[8.5px] uppercase tracking-wider font-extrabold">Error</span>
              </Chip>
              <AnalysisStatusBadge status="error" />
            </div>
            <span className="text-[10px] text-danger max-w-[150px] truncate">
              Analysis failed. Click retry.
            </span>
          </div>
        ) : status === "success" ? null : (
          <div className="mt-3 p-3 rounded-lg border border-border/60 bg-surface-secondary/40 flex items-center justify-between text-left">
            <div className="flex items-center">
              {repo.isVerified ? (
                <Chip size="sm" color="success" variant="soft" className="items-center justify-center">
                  <CheckCircle2 className="size-3.5 text-success shrink-0" />
                  <span className="text-[10px] uppercase tracking-wider font-extrabold mr-px">Verified</span>
                </Chip>
              ) : (
                <Chip size="sm" color="default" variant="soft" className="items-center justify-center">
                  <span className="text-[10px] uppercase tracking-wider font-extrabold mr-px">Unverified</span>
                </Chip>
              )}
              <AnalysisStatusBadge status={status} />
            </div>
          </div>
        )}

        {/* Rich Analysis Summary Section (Animated) */}
        <AnimatePresence initial={false}>
          {status === "success" && analysisResult && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: "auto", marginTop: 16 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <Separator variant="tertiary" />

              <div className="flex items-center justify-between my-4">
                <span className="flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider text-accent">
                  <Sparkles className="size-3.5" /> AI Analysis
                </span>
                <div className="flex items-center gap-2">
                  <AnalysisStatusBadge status="success" band={analysisResult.scoring.band} />
                </div>
              </div>

              {/* 2x2 Grid of indicators */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-surface-secondary/30 border border-border/40 rounded-lg text-left mb-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] text-muted uppercase tracking-wider font-medium">Overall Score</span>
                  <span className="text-xs font-black text-foreground font-mono">
                    {analysisResult.scoring.final_score} <span className="text-[10px] text-muted font-normal">/ 100</span>
                  </span>
                </div>

                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] text-muted uppercase tracking-wider font-medium">Trust Score</span>
                  <span className="text-xs font-black text-foreground font-mono">
                    {(analysisResult.fraud_multiplier * 100).toFixed(0)}%
                  </span>
                </div>

                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] text-muted uppercase tracking-wider font-medium">Verification</span>
                  <div>
                    {analysisResult.fraud_multiplier >= 0.8 ? (
                      <Chip size="sm" color="success" variant="soft" className="h-4.5 px-1.5 text-[8.5px] font-extrabold uppercase">
                        Verified
                      </Chip>
                    ) : (
                      <Chip size="sm" color="default" variant="soft" className="h-4.5 px-1.5 text-[8.5px] font-extrabold uppercase bg-foreground/5 text-muted-foreground">
                        Unverified
                      </Chip>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] text-muted uppercase tracking-wider font-medium">Risk Level</span>
                  <div>
                    {(() => {
                      const risk = getRiskLevel(analysisResult.fraud_multiplier);
                      return (
                        <Chip size="sm" color={risk.color} variant="soft" className="h-4.5 px-1.5 text-[8.5px] font-extrabold uppercase">
                          {risk.label}
                        </Chip>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Skill Highlights */}
              {analysisResult.scoring.top_strengths.length > 0 && (
                <div className="flex flex-col gap-1.5 mb-3 text-left">
                  <span className="text-[9px] text-muted uppercase tracking-wider font-extrabold ">Top Skills</span>
                  <div className="flex flex-wrap gap-1">
                    {analysisResult.scoring.top_strengths.slice(0, 3).map((skill, idx) => (
                      <Chip key={idx} size="sm" variant="soft" className="text-[9px] font-bold">
                        {skill}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}

              {/* Recruiter / AI Summary */}
              <div className="flex flex-col gap-1 text-left">
                <span className="text-[9px] text-muted uppercase tracking-wider font-extrabold ">AI Summary</span>
                <p className="text-[11px] text-muted leading-relaxed">
                  {analysisResult.scoring.recruiter_summary}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <Separator variant="tertiary" className="my-4" />

        {/* Stats footer & actions */}
        <div className="flex items-end justify-between">
          <div className="flex items-center gap-3 text-[10px] text-muted">
            {repo.primaryLanguage && (
              <Chip size="sm" variant="soft" className="rounded-md text-[9px] font-bold">{repo.primaryLanguage}</Chip>
            )}
            <div className="mb-0.5 flex gap-3">
              <span className="flex items-center gap-0.5">
                <Star className="size-3 text-yellow-500 fill-yellow-500/10 shrink-0 mb-px" />
                <span>{repo.starsCount}</span>
              </span>
              <span className="flex items-center gap-0.5">
                <GitFork className="size-3 text-muted shrink-0" />
                <span>{repo.forksCount}</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {repo.isAccessible && (
              <Button
                size="sm"
                variant={
                  status === "success"
                    ? "secondary"
                    : status === "error"
                      ? "danger"
                      : "primary"
                }
                className="text-xs font-bold rounded-xl"
                onClick={() => {
                  if (status === "success") {
                    setSelectedAnalysis(analysisResult);
                    setIsModalOpen(true);
                  } else {
                    handleAnalyzeRepository(repo.id, repo.name, repo.owner);
                  }
                }}
                isDisabled={status === "analyzing"}
              >
                {status === "analyzing" ? (
                  <>
                    <Spinner size="sm" color="current" className="mr-1" />
                    <span>Analyzing...</span>
                  </>
                ) : status === "success" ? (
                  <span>View Details</span>
                ) : status === "error" ? (
                  <span>Retry Analysis</span>
                ) : (
                  <span>Analyze</span>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full w-full text-left relative overflow-y-auto mx-auto font-sans">
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
            // Dynamic height-based bento layout partition logic
            const col1: SourceCodeRepository[] = [];
            const col2: SourceCodeRepository[] = [];
            let h1 = 0;
            let h2 = 0;

            repositories.forEach((repo) => {
              const status = analysisStatuses[repo.id] || "idle";
              const analysisResult = analysisResults[repo.id];

              let height = 180; // base height
              if (repo.description) height += 40;

              if (status === "analyzing") {
                height += 60;
              } else if (status === "error") {
                height += 50;
              } else if (status === "success" && analysisResult) {
                height += 200; // grade details and grid
                if (analysisResult.scoring?.top_strengths?.length > 0) {
                  height += 60;
                }
                if (analysisResult.scoring?.recruiter_summary) {
                  height += 50;
                }
              } else {
                height += 50; // unverified/verified indicator & trust score
              }

              if (h1 <= h2) {
                col1.push(repo);
                h1 += height;
              } else {
                col2.push(repo);
                h2 += height;
              }
            });

            const renderSkeletonCard = () => (
              <div className="flex flex-col border border-border/40 rounded-2xl p-6 bg-surface relative  w-full gap-3">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4.5 w-2/3 rounded-lg" />
                    <Skeleton className="h-3 w-1/3 rounded-lg" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-md" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-3.5 w-full rounded-lg" />
                  <Skeleton className="h-3.5 w-5/6 rounded-lg" />
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-border/10">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-4 w-12 rounded-md" />
                    <Skeleton className="h-3 w-6 rounded-md" />
                    <Skeleton className="h-3 w-6 rounded-md" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-14 rounded-xl" />
                    <Skeleton className="h-8 w-20 rounded-xl" />
                  </div>
                </div>
              </div>
            );

            if (loadingRepositories) {
              return (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start w-full">
                  <div className="flex flex-col gap-6 w-full">
                    {renderSkeletonCard()}
                    {renderSkeletonCard()}
                  </div>
                  <div className="flex flex-col gap-6 w-full">
                    {renderSkeletonCard()}
                    {renderSkeletonCard()}
                  </div>
                </div>
              );
            }

            if (repositories.length === 0) {
              return (
                <Card className="flex items-center justify-center py-16 text-muted gap-2">
                  <AlertCircle className="size-6 text-muted" />
                  <Typography.Paragraph className="text-muted text-xs">No repositories found matching the search criteria.</Typography.Paragraph>
                </Card>
              );
            }

            return (
              <div className="flex flex-col gap-3 w-full">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start w-full">
                  {/* Column 1 (Left) */}
                  <div className="flex flex-col gap-4 w-full">
                    {col1.map((repo) => renderRepositoryCard(repo))}
                  </div>

                  {/* Column 2 (Right) */}
                  <div className="flex flex-col gap-4 w-full">
                    {col2.map((repo) => renderRepositoryCard(repo))}
                  </div>
                </div>

                {/* Infinite Scroll Sentinel element */}
                <div ref={observerRef} className="h-4 w-full" />

                {/* Loading More Indicator Skeletons */}
                {loadingMore && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start w-full mt-2">
                    <div className="w-full">{renderSkeletonCard()}</div>
                    <div className="w-full">{renderSkeletonCard()}</div>
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
      />
    </div>
  );
}
