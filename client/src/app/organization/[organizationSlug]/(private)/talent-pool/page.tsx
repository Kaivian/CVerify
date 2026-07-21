"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Typography, Chip, Button } from "@heroui/react";
import {
  Bookmark,
  Search,
  MapPin,
  User,
  Compass,
  Filter,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Edit3,
  Users,
  Briefcase,
  GraduationCap,
  ShieldCheck,
  Clock,
  SlidersHorizontal,
  X,
  Loader2,
  AlertTriangle,
  FolderOpen
} from "lucide-react";
import { Github } from "@thesvg/react";
import { TrustScoreBadge } from "@/components/ui/cverify/trust-score-indicator";
import { useTalentPoolStore } from "@/stores/use-talent-pool-store";
import { profileApi } from "@/services/profile.service";
import { membersService } from "@/features/workspace/services/members.service";

const HIRING_STAGES = [
  "Sourced",
  "Screening",
  "Interviewing",
  "Offer",
  "Hired",
  "Rejected",
  "Archived"
];

const SORT_OPTIONS = [
  { value: "highest_trust", label: "Highest Trust Score" },
  { value: "ai_score", label: "Highest AI Score" },
  { value: "recently_added", label: "Recently Saved" },
  { value: "alphabetical", label: "Alphabetical" }
];

export default function TalentPoolPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const organizationSlug = typeof params?.organizationSlug === "string" ? params.organizationSlug : "";

  // Connect Zustand Store
  const {
    candidates,
    totalCount,
    analytics,
    selectedCandidate,
    isLoading,
    error,
    query,
    location,
    minTrustScore,
    stage,
    sortBy,
    page,
    pageSize,
    setFilters,
    fetchTalentPool,
    fetchAnalytics,
    removeCandidate,
    updateCandidateMeta,
    bulkAction,
    setSelectedCandidate,
    resetStore
  } = useTalentPoolStore();

  // Local Recruiter State
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Profile Detail Drawer State
  const [profileDetail, setProfileDetail] = useState<any | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [drawerNotes, setDrawerNotes] = useState("");
  const [drawerStage, setDrawerStage] = useState("Sourced");
  const [drawerRecruiter, setDrawerRecruiter] = useState("");
  const [drawerTags, setDrawerTags] = useState("");
  const [savingMeta, setSavingMeta] = useState(false);

  // Sync URL query params to Zustand filters on mount
  useEffect(() => {
    const q = searchParams.get("q") || "";
    const loc = searchParams.get("location") || "";
    const minTrust = parseInt(searchParams.get("minTrust") || "0", 10);
    const filterStage = searchParams.get("stage") || "";
    const sort = searchParams.get("sortBy") || "highest_trust";
    const p = parseInt(searchParams.get("page") || "1", 10);

    setFilters({
      query: q,
      location: loc,
      minTrustScore: minTrust,
      stage: filterStage,
      sortBy: sort,
      page: p
    });
  }, [searchParams]);

  // Trigger talent pool fetch when filters change
  useEffect(() => {
    if (organizationSlug) {
      fetchTalentPool(organizationSlug);
    }
  }, [organizationSlug, query, location, minTrustScore, stage, sortBy, page]);

  // Load team members and analytics on mount
  useEffect(() => {
    if (organizationSlug) {
      fetchAnalytics(organizationSlug);
      membersService.getMembers(organizationSlug, { page: 1, pageSize: 100 })
        .then(res => {
          setTeamMembers(res.items || []);
        })
        .catch(err => console.error("Failed to load workspace members", err));
    }
    return () => {
      resetStore();
    };
  }, [organizationSlug]);

  // Load detailed profile in drawer when selected candidate changes
  useEffect(() => {
    if (selectedCandidate) {
      setDrawerNotes(selectedCandidate.recruiterNotes || "");
      setDrawerStage(selectedCandidate.hiringStage || "Sourced");
      setDrawerRecruiter(selectedCandidate.assignedRecruiterId || "");
      setDrawerTags(selectedCandidate.savedTags?.join(", ") || "");

      if (selectedCandidate.username) {
        setLoadingProfile(true);
        setProfileDetail(null);
        profileApi.fetchPublicProfile(selectedCandidate.username)
          .then(res => {
            setProfileDetail(res);
          })
          .catch(err => {
            console.error("Failed to fetch full public profile", err);
          })
          .finally(() => {
            setLoadingProfile(false);
          });
      }
    } else {
      setProfileDetail(null);
    }
  }, [selectedCandidate]);

  // Update URL parameters
  const updateUrlParams = (newFilters: any) => {
    const paramsCopy = new URLSearchParams(searchParams.toString());
    Object.entries(newFilters).forEach(([key, val]) => {
      if (val === undefined || val === null || val === "" || val === 0) {
        paramsCopy.delete(key);
      } else {
        paramsCopy.set(key, String(val));
      }
    });
    // Reset page on search trigger
    if (newFilters.page === undefined) {
      paramsCopy.delete("page");
    }
    router.replace(`?${paramsCopy.toString()}`);
  };

  // Toggle selection for bulk actions
  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === candidates.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(candidates.map(c => c.candidateId));
    }
  };

  // Bulk actions handlers
  const handleBulkDelete = async () => {
    if (window.confirm(`Are you sure you want to remove ${selectedIds.length} candidates?`)) {
      try {
        await bulkAction(organizationSlug, selectedIds, "Delete");
        setSelectedIds([]);
      } catch (err) {
        alert("Failed to complete bulk delete.");
      }
    }
  };

  const handleBulkStageChange = async (newStage: string) => {
    if (!newStage) return;
    try {
      await bulkAction(organizationSlug, selectedIds, "UpdateStage", newStage);
      setSelectedIds([]);
    } catch (err) {
      alert("Failed to update candidates stage.");
    }
  };

  // Recruiter drawer metadata updates
  const handleSaveMetadata = async () => {
    if (!selectedCandidate) return;
    setSavingMeta(true);
    try {
      const parsedTags = drawerTags
        .split(",")
        .map(t => t.trim())
        .filter(t => t.length > 0);

      await updateCandidateMeta(organizationSlug, selectedCandidate.candidateId, {
        notes: drawerNotes,
        hiringStage: drawerStage,
        recruiterId: drawerRecruiter || null,
        tags: parsedTags
      });

      // Show temporary success feedback
      alert("Recruiter settings saved successfully!");
    } catch (err) {
      alert("Failed to save changes.");
    } finally {
      setSavingMeta(false);
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  // Search input handler
  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const qVal = formData.get("searchInput") as string;
    updateUrlParams({ query: qVal });
  };

  return (
    <div className="space-y-6 font-outfit max-w-7xl mx-auto text-foreground p-4">

      {/* 1. Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-6 rounded-2xl bg-surface border border-border/80 text-foreground select-none">
        <div className="space-y-1">
          <Typography type="h2" className="text-2xl font-bold flex items-center gap-2 text-foreground font-outfit">
            <Bookmark size={24} className="text-accent" />
            Talent Pool
          </Typography>
          <Typography type="body-xs" className="text-muted font-medium mt-0.5 font-outfit">
            Manage organization-wide saved candidates, hire-ready developer databases, and pipelines.
          </Typography>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Button
            variant="outline"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="font-bold text-xs rounded-xl gap-1.5 cursor-pointer border-border text-foreground hover:bg-default/20"
          >
            <SlidersHorizontal size={14} /> Filters
          </Button>
          <Button
            variant="primary"
            onClick={() => router.push(`/business/${organizationSlug}/intelligence`)}
            className="font-bold text-xs rounded-xl gap-1.5 cursor-pointer"
          >
            <Compass size={14} /> Discover Talent
          </Button>
        </div>
      </div>

      {/* 2. Analytics Summary Bar */}
      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5 rounded-2xl bg-surface-hover/30 border border-border/40 select-none">
          <div className="space-y-1 p-2">
            <span className="text-[10px] uppercase tracking-widest text-muted font-bold flex items-center gap-1">
              <Users size={12} className="text-accent" /> Total Saved
            </span>
            <p className="text-2xl font-black">{analytics.totalCandidates}</p>
          </div>
          <div className="space-y-1 p-2 border-l border-border/40">
            <span className="text-[10px] uppercase tracking-widest text-muted font-bold flex items-center gap-1">
              <ShieldCheck size={12} className="text-success" /> Verified Candidates
            </span>
            <p className="text-2xl font-black text-success">{analytics.verifiedCandidates}</p>
          </div>
          <div className="space-y-1 p-2 border-l border-border/40">
            <span className="text-[10px] uppercase tracking-widest text-muted font-bold flex items-center gap-1">
              <Clock size={12} className="text-warning" /> Avg Trust Score
            </span>
            <p className="text-2xl font-black">{analytics.averageTrustScore.toFixed(0)}%</p>
          </div>
          <div className="space-y-1 p-2 border-l border-border/40">
            <span className="text-[10px] uppercase tracking-widest text-muted font-bold flex items-center gap-1">
              <Clock size={12} className="text-muted-foreground" /> Top Stage
            </span>
            <p className="text-2xl font-black truncate">
              {Object.keys(analytics.stageDistribution).reduce((a, b) =>
                analytics.stageDistribution[a] > analytics.stageDistribution[b] ? a : b, "None"
              )}
            </p>
          </div>
        </div>
      )}

      {/* 3. Main Workspace Container */}
      <div className="flex gap-6 items-start">

        {/* Filter Sidebar */}
        {sidebarOpen && (
          <div className="w-80 shrink-0 bg-surface border border-border/80 rounded-2xl p-5 space-y-6 hidden md:block">
            <div className="flex items-center justify-between border-b border-separator/40 pb-3">
              <span className="font-bold text-sm flex items-center gap-2">
                <Filter size={16} /> Filters
              </span>
              <button
                onClick={() => {
                  updateUrlParams({ query: "", location: "", minTrust: 0, stage: "", sortBy: "highest_trust" });
                }}
                className="text-xs text-accent hover:underline font-semibold bg-transparent border-none cursor-pointer"
              >
                Clear All
              </button>
            </div>

            {/* Stage filter */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-muted tracking-wider">Hiring Stage</label>
              <select
                value={stage}
                onChange={(e) => updateUrlParams({ stage: e.target.value })}
                className="w-full bg-surface-hover/55 border border-border/80 rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent cursor-pointer"
              >
                <option value="">All Stages</option>
                {HIRING_STAGES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Location filter */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-muted tracking-wider">Location</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-2.5 size-3.5 text-muted" />
                <input
                  type="text"
                  placeholder="e.g. Remote, US"
                  value={location}
                  onChange={(e) => updateUrlParams({ location: e.target.value })}
                  className="w-full bg-surface-hover/55 border border-border/80 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-accent text-foreground"
                />
              </div>
            </div>

            {/* Trust Score Slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[10px] font-black uppercase text-muted tracking-wider">
                <span>Min Trust Score</span>
                <span className="text-foreground">{minTrustScore}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={minTrustScore}
                onChange={(e) => updateUrlParams({ minTrust: parseInt(e.target.value, 10) })}
                className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-accent"
              />
            </div>
          </div>
        )}

        {/* Content Column */}
        <div className="flex-1 space-y-6">

          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <form onSubmit={handleSearchSubmit} className="relative w-full sm:max-w-md">
              <Search className="absolute left-3.5 top-2.5 size-4 text-muted" />
              <input
                name="searchInput"
                type="text"
                placeholder="Search candidates by name, bio, tags..."
                defaultValue={query}
                className="w-full bg-surface border border-border/80 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-accent text-foreground"
              />
            </form>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <span className="text-xs text-muted font-bold select-none hidden lg:inline">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => updateUrlParams({ sortBy: e.target.value })}
                className="bg-surface border border-border/80 rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent cursor-pointer min-w-40"
              >
                {SORT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Error Feed */}
          {error && (
            <div className="bg-danger/10 border border-danger/20 text-danger p-4 rounded-xl flex items-center gap-3">
              <AlertTriangle size={18} />
              <p className="text-xs font-semibold">{error}</p>
            </div>
          )}

          {/* Cards Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {Array.from({ length: 6 }).map((_, idx) => (
                <Card key={idx} className="p-6 bg-surface border border-border/80 rounded-2xl space-y-4 animate-pulse select-none">
                  <div className="flex items-center gap-4">
                    <div className="size-12 rounded-full bg-border" />
                    <div className="space-y-2 flex-1">
                      <div className="h-4 bg-border rounded-md w-1/3" />
                      <div className="h-3 bg-border rounded-md w-2/3" />
                    </div>
                  </div>
                  <div className="h-12 bg-border rounded-xl w-full" />
                </Card>
              ))}
            </div>
          ) : candidates.length === 0 ? (
            <Card className="p-16 text-center border border-dashed border-border/80 bg-surface/50 select-none">
              <div className="size-16 rounded-2xl bg-default/20 flex items-center justify-center border border-border mx-auto mb-5 text-muted">
                <FolderOpen size={28} />
              </div>
              <h4 className="font-bold text-foreground text-base mb-1">No Candidates Found</h4>
              <p className="text-muted text-xs max-w-sm mx-auto leading-relaxed mb-6">
                No verified engineers match the selected filters. Expand your parameters or search the global candidate directory.
              </p>
              <Button
                variant="primary"
                onClick={() => router.push(`/business/${organizationSlug}/intelligence`)}
                className="font-bold text-xs rounded-xl cursor-pointer"
              >
                Discover Candidates
              </Button>
            </Card>
          ) : (
            <div className="space-y-4">

              {/* Select All Toggle when list is not empty */}
              <div className="flex items-center gap-2 select-none px-1">
                <input
                  type="checkbox"
                  checked={selectedIds.length === candidates.length && candidates.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded border-border text-accent focus:ring-accent size-4 cursor-pointer"
                />
                <span className="text-xs font-bold text-muted">Select All Candidates ({candidates.length})</span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {candidates.map((candidate) => (
                  <Card
                    key={candidate.candidateId}
                    className={`p-6 bg-surface border rounded-2xl flex flex-col justify-between space-y-4 transition-all duration-300 relative ${selectedIds.includes(candidate.candidateId)
                      ? "border-accent shadow-lg shadow-accent/5 ring-1 ring-accent/30"
                      : "border-border/80 hover:border-border-hover"
                      }`}
                  >
                    {/* Card Checkbox overlay */}
                    <div className="absolute top-4 left-4 z-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(candidate.candidateId)}
                        onChange={() => toggleSelect(candidate.candidateId)}
                        className="rounded border-border text-accent focus:ring-accent size-4 cursor-pointer"
                      />
                    </div>

                    <div className="space-y-3 pl-6">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          {candidate.avatarUrl ? (
                            <img
                              src={candidate.avatarUrl}
                              alt={candidate.fullName}
                              className="size-12 rounded-full object-cover border border-border select-none"
                            />
                          ) : (
                            <div className="size-12 rounded-full bg-default/45 flex items-center justify-center text-muted border border-border select-none">
                              <User size={20} />
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-foreground text-sm leading-snug">{candidate.fullName}</h4>
                              <Chip size="sm" variant="soft" className="text-[9px] uppercase font-bold px-1.5 py-0.5">
                                {candidate.hiringStage}
                              </Chip>
                            </div>
                            <p className="text-muted text-xs font-medium mt-0.5 leading-snug truncate max-w-50 sm:max-w-70">
                              {candidate.headline}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <TrustScoreBadge score={candidate.trustScore} />
                          {candidate.aiScore > 0 && (
                            <span className="text-[9px] bg-accent/15 text-accent border border-accent/20 px-2 py-0.5 rounded-full font-bold select-none">
                              {candidate.aiScore.toFixed(0)}% AI Match
                            </span>
                          )}
                        </div>
                      </div>

                      {candidate.bio && (
                        <p className="text-xs text-muted leading-relaxed line-clamp-2">
                          {candidate.bio}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-[10px] text-muted font-bold select-none pt-1">
                        <span className="flex items-center gap-1">
                          <MapPin size={12} className="text-muted/75" />
                          {candidate.location}
                        </span>
                        {candidate.assignedRecruiterName && (
                          <span className="flex items-center gap-1">
                            <User size={12} className="text-muted/75" />
                            Recruiter: {candidate.assignedRecruiterName}
                          </span>
                        )}
                      </div>

                      {candidate.primarySkills?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1 select-none">
                          {candidate.primarySkills.slice(0, 4).map((skill, index) => (
                            <Chip key={index} size="sm" variant="soft" className="text-[9px] font-bold">
                              {skill}
                            </Chip>
                          ))}
                          {candidate.primarySkills.length > 4 && (
                            <Chip size="sm" variant="soft" className="text-[9px] font-bold">
                              +{candidate.primarySkills.length - 4}
                            </Chip>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between items-center border-t border-separator/40 pt-4 pl-6">
                      <Button
                        variant="danger-soft"
                        size="sm"
                        onClick={() => {
                          if (window.confirm("Remove candidate from talent pool?")) {
                            removeCandidate(organizationSlug, candidate.candidateId);
                          }
                        }}
                        className="text-xs font-bold min-w-0 h-auto p-0 flex items-center gap-1 text-muted hover:text-danger bg-transparent"
                      >
                        <Trash2 size={12} /> Remove
                      </Button>

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedCandidate(candidate)}
                          className="font-bold text-xs rounded-xl cursor-pointer border-border text-foreground hover:bg-default/20 gap-1"
                        >
                          <Edit3 size={12} /> Preview & Edit
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {/* 4. Pagination Footer */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-separator/40 pt-6 select-none">
                  <span className="text-xs text-muted font-bold">
                    Showing Page {page} of {totalPages} ({totalCount} total)
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      isDisabled={page <= 1}
                      onClick={() => updateUrlParams({ page: page - 1 })}
                      className="font-bold text-xs rounded-xl cursor-pointer border-border text-foreground hover:bg-default/20"
                    >
                      <ChevronLeft size={14} /> Prev
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      isDisabled={page >= totalPages}
                      onClick={() => updateUrlParams({ page: page + 1 })}
                      className="font-bold text-xs rounded-xl cursor-pointer border-border text-foreground hover:bg-default/20"
                    >
                      Next <ChevronRight size={14} />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 5. Floating Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-surface border border-border/80 shadow-2xl px-6 py-4 rounded-2xl flex items-center gap-6 animate-slide-up">
          <span className="text-xs font-bold text-foreground">
            {selectedIds.length} candidates selected
          </span>
          <div className="h-4 w-px bg-separator" />
          <div className="flex items-center gap-3">
            <select
              onChange={(e) => handleBulkStageChange(e.target.value)}
              defaultValue=""
              className="bg-surface-hover border border-border rounded-xl px-3 py-1.5 text-xs text-foreground focus:outline-none cursor-pointer"
            >
              <option value="" disabled>Change Stage...</option>
              {HIRING_STAGES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <Button
              size="sm"
              variant="danger-soft"
              onClick={handleBulkDelete}
              className="font-bold text-xs rounded-xl cursor-pointer gap-1"
            >
              <Trash2 size={12} /> Delete
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setSelectedIds([])}
              className="text-xs text-muted hover:underline font-bold bg-transparent min-w-0 h-auto p-0"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* 6. Recruiter Workspace Preview Slider (Right Drawer) */}
      {selectedCandidate && (
        <div className="fixed inset-0 z-50 overflow-hidden font-outfit select-none">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedCandidate(null)}
          />
          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-2xl bg-surface border-l border-border/85 text-foreground flex flex-col shadow-2xl animate-slide-in select-text">

              {/* Drawer Header */}
              <div className="p-6 border-b border-separator/40 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black">{selectedCandidate.fullName}</h3>
                  <p className="text-xs text-muted font-medium mt-0.5">{selectedCandidate.headline}</p>
                </div>
                <Button
                  isIconOnly
                  size="sm"
                  variant="secondary"
                  onClick={() => setSelectedCandidate(null)}
                  className="rounded-xl border border-border text-muted"
                >
                  <X size={16} />
                </Button>
              </div>

              {/* Drawer Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">

                {/* Loader status */}
                {loadingProfile && (
                  <div className="flex flex-col items-center justify-center py-12 space-y-3">
                    <Loader2 className="size-8 text-accent animate-spin" />
                    <span className="text-xs text-muted font-bold">Synchronizing Candidate Ledger...</span>
                  </div>
                )}

                {/* Candidate Overview Card */}
                {!loadingProfile && (
                  <div className="space-y-6">

                    {/* Basic info row */}
                    <div className="flex justify-between items-start bg-default/15 p-4 rounded-xl border border-border/40">
                      <div className="space-y-1">
                        <span className="text-[10px] text-muted font-black uppercase tracking-widest">Metadata</span>
                        <p className="text-xs text-muted flex items-center gap-1.5">
                          <MapPin size={12} className="text-muted/65" /> {selectedCandidate.location}
                        </p>
                        <p className="text-xs text-muted flex items-center gap-1.5">
                          <Clock size={12} className="text-muted/65" /> Saved {new Date(selectedCandidate.savedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <TrustScoreBadge score={selectedCandidate.trustScore} />
                        {profileDetail?.careerPreference?.availableForHire && (
                          <span className="text-[9px] bg-success/10 text-success border border-success/20 px-2 py-0.5 rounded-full font-bold">
                            Available for Hire
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bio */}
                    {selectedCandidate.bio && (
                      <div className="space-y-2">
                        <h5 className="text-xs font-black uppercase text-muted tracking-wider">Candidate Bio</h5>
                        <p className="text-xs leading-relaxed text-foreground bg-surface-hover/20 p-4 rounded-xl border border-border/30">
                          {selectedCandidate.bio}
                        </p>
                      </div>
                    )}

                    {/* Recruiter Workflow Edit Area */}
                    <div className="space-y-4 border-t border-border/40 pt-4">
                      <h5 className="text-xs font-black uppercase text-muted tracking-wider flex items-center gap-1">
                        <SlidersHorizontal size={12} /> Recruiter Settings
                      </h5>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] text-muted font-bold">Pipeline Stage</label>
                          <select
                            value={drawerStage}
                            onChange={(e) => setDrawerStage(e.target.value)}
                            className="w-full bg-surface-hover border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none cursor-pointer"
                          >
                            {HIRING_STAGES.map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] text-muted font-bold">Assigned Recruiter</label>
                          <select
                            value={drawerRecruiter}
                            onChange={(e) => setDrawerRecruiter(e.target.value)}
                            className="w-full bg-surface-hover border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none cursor-pointer"
                          >
                            <option value="">Unassigned</option>
                            {teamMembers.map(m => (
                              <option key={m.userId} value={m.userId}>{m.fullName}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] text-muted font-bold">Tags (Comma-separated)</label>
                        <input
                          type="text"
                          value={drawerTags}
                          onChange={(e) => setDrawerTags(e.target.value)}
                          placeholder="e.g. Frontend, Next.js, Lead"
                          className="w-full bg-surface-hover border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] text-muted font-bold">Internal Recruitment Notes</label>
                        <textarea
                          rows={4}
                          value={drawerNotes}
                          onChange={(e) => setDrawerNotes(e.target.value)}
                          placeholder="Add details on screening call, salary expectations, tech assessment evaluation..."
                          className="w-full bg-surface-hover border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none resize-none"
                        />
                      </div>

                      <Button
                        size="sm"
                        variant="primary"
                        isPending={savingMeta}
                        onClick={handleSaveMetadata}
                        className="font-bold text-xs rounded-xl cursor-pointer gap-1.5"
                      >
                        Save Settings
                      </Button>
                    </div>

                    {/* Detailed Experience Timeline */}
                    {profileDetail?.experiences?.length > 0 && (
                      <div className="space-y-4 border-t border-border/40 pt-4">
                        <h5 className="text-xs font-black uppercase text-muted tracking-wider flex items-center gap-1">
                          <Briefcase size={12} /> Work Experience
                        </h5>
                        <div className="space-y-4 relative pl-3 border-l border-border/60">
                          {profileDetail.experiences.map((exp: any, index: number) => (
                            <div key={index} className="space-y-1 relative">
                              {/* Dot marker */}
                              <div className="absolute -left-4.25 top-1.5 size-2.5 rounded-full bg-accent border-2 border-surface" />
                              <div className="flex justify-between items-start text-xs font-bold">
                                <h6>{exp.jobTitle}</h6>
                                <span className="text-[10px] text-muted">
                                  {new Date(exp.startDate).toLocaleDateString()} - {exp.isCurrentlyWorking ? "Present" : new Date(exp.endDate).toLocaleDateString()}
                                </span>
                              </div>
                              <p className="text-[11px] text-muted">{exp.companyName}</p>
                              {exp.description && (
                                <p className="text-[11px] text-muted leading-relaxed mt-1">
                                  {exp.description}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Detailed Education Timeline */}
                    {profileDetail?.educations?.length > 0 && (
                      <div className="space-y-4 border-t border-border/40 pt-4">
                        <h5 className="text-xs font-black uppercase text-muted tracking-wider flex items-center gap-1">
                          <GraduationCap size={12} /> Education
                        </h5>
                        <div className="space-y-3 relative pl-3 border-l border-border/60">
                          {profileDetail.educations.map((edu: any, index: number) => (
                            <div key={index} className="space-y-1 relative">
                              <div className="absolute -left-4.25 top-1.5 size-2.5 rounded-full bg-border border-2 border-surface" />
                              <div className="flex justify-between items-start text-xs font-bold">
                                <h6>{edu.degree} in {edu.fieldOfStudy}</h6>
                                <span className="text-[10px] text-muted">
                                  {edu.startYear} - {edu.endYear || "Present"}
                                </span>
                              </div>
                              <p className="text-[11px] text-muted">{edu.schoolName}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Repository details */}
                    {profileDetail?.repositories?.length > 0 && (
                      <div className="space-y-4 border-t border-border/40 pt-4">
                        <h5 className="text-xs font-black uppercase text-muted tracking-wider flex items-center gap-1">
                          <Github className="size-3 text-muted/75 shrink-0" /> Top Repositories
                        </h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {profileDetail.repositories.slice(0, 4).map((repo: any) => (
                            <div key={repo.id} className="p-3 bg-default/10 border border-border/40 rounded-xl space-y-2 flex flex-col justify-between">
                              <div>
                                <h6 className="text-xs font-bold truncate">{repo.name}</h6>
                                {repo.description && (
                                  <p className="text-[10px] text-muted line-clamp-2 mt-1">
                                    {repo.description}
                                  </p>
                                )}
                              </div>
                              <div className="flex justify-between items-center text-[10px] font-bold select-none pt-1.5 border-t border-border/20">
                                <span className="bg-default/20 px-2 py-0.5 rounded text-muted">
                                  {repo.primaryLanguage || "Repo"}
                                </span>
                                <span className="text-accent">{repo.trustScore.toFixed(0)}% Trust</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                )}

              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
