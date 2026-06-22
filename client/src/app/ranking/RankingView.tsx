"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { profileApi } from "@/services/profile.service";
import {
  type RankingResponseItem,
  type RankingQueryParams,
  type RankingStats
} from "@/types/profile.types";
import {
  Input,
  InputGroup,
  Button,
  Chip,
  Spinner,
  Checkbox,
  Accordion,
  toast,
  Skeleton,
  SearchField,
  Label
} from "@heroui/react";
import { Card } from "@/components/ui/card";
import {
  Search,
  MapPin,
  Users,
  GitFork,
  CheckCircle,
  Trophy,
  ArrowUp,
  ArrowDown,
  Minus,
  Sparkles,
  Shield,
  Briefcase,
  Layers,
  Filter,
  RefreshCw,
  Plus,
  Check
} from "lucide-react";
import { TrustScoreBadge, TrustScoreDial } from "@/components/ui/cverify/trust-score-indicator";

const CATEGORIES = [
  { value: "Global", label: "Global Ranking", description: "All candidates ranked by composite intelligence score." },
  { value: "Trending", label: "Trending Talent", description: "Top rising stars based on active follows and assessments." },
  { value: "TopContributors", label: "Top Contributors", description: "Ranked by verified open-source contributions and repository impact." },
  { value: "TopVerified", label: "Top Verified", description: "Candidates with highest security verifications and KYC validation." },
  { value: "MostFollowed", label: "Most Followed", description: "Most popular developers based on social following." },
  { value: "HighestTrust", label: "Highest Trust", description: "Ranked by aggregate CVerify security and code authorship score." },
  { value: "TopAi", label: "Top AI-Analyzed", description: "Ranked by overall deep-learning capability assessment score." }
];

const TRUST_TIERS = [
  { value: "HighTrust", label: "High Trust (Score >= 85)" },
  { value: "EvidenceVerified", label: "Evidence Verified (Score >= 60)" },
  { value: "BasicVerified", label: "Basic Verified (Score >= 30)" },
  { value: "Unverified", label: "Unverified (Score < 30)" }
];

const EXPERIENCE_LEVELS = [
  { value: "Junior", label: "Junior Developer" },
  { value: "Mid", label: "Mid-Level Developer" },
  { value: "Senior", label: "Senior Developer" },
  { value: "Lead", label: "Lead / Staff Engineer" },
  { value: "Principal", label: "Principal Architect" }
];

const POPULAR_SKILLS = ["C#", "TypeScript", "JavaScript", "Python", "React", "Go", "Docker", "PostgreSQL", "Next.js", "Kubernetes"];

export function RankingView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();

  const parseArrayParam = useCallback((key: string): string[] => {
    const vals = searchParams.getAll(key);
    if (vals.length === 1 && vals[0].includes(",")) {
      return vals[0].split(",").map(v => v.trim()).filter(Boolean);
    }
    return vals;
  }, [searchParams]);

  // Derived filter state directly from URL query parameters (memoized to prevent infinite rerendering loops)
  const selectedCategories = useMemo(() => {
    const cats = parseArrayParam("category");
    return cats.length > 0 ? cats : ["Global"];
  }, [parseArrayParam]);
  const category = selectedCategories[0] || "Global";
  const page = Number(searchParams.get("page")) || 1;
  const selectedTrustTiers = useMemo(() => parseArrayParam("trustTiers"), [parseArrayParam]);
  const selectedExperienceLevels = useMemo(() => parseArrayParam("experienceLevels"), [parseArrayParam]);
  const selectedSkills = useMemo(() => parseArrayParam("skills"), [parseArrayParam]);
  const hireParam = searchParams.get("availableForHire");
  const availableForHire = hireParam === "true" ? true : hireParam === "false" ? false : null;

  // Local state for responsive input controls only
  const [search, setSearch] = useState(() => searchParams.get("search") || "");
  const [location, setLocation] = useState(() => searchParams.get("location") || "");
  const [skillInput, setSkillInput] = useState("");

  // Pagination & List State
  const [candidates, setCandidates] = useState<RankingResponseItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 10;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Follow Loading States
  const [followLoading, setFollowLoading] = useState<Record<string, boolean>>({});



  // Push filter updates to URL query string
  const pushFiltersToUrl = useCallback((updates: {
    category?: string;
    page?: number;
    search?: string;
    location?: string;
    trustTiers?: string[];
    experienceLevels?: string[];
    skills?: string[];
    availableForHire?: boolean | null;
  }) => {
    const params = new URLSearchParams();
    
    const cat = updates.category !== undefined ? updates.category : selectedCategories.join(",");
    if (cat && cat !== "Global") params.set("category", cat);
    
    const s = updates.search !== undefined ? updates.search : search;
    if (s) params.set("search", s);
    
    const loc = updates.location !== undefined ? updates.location : location;
    if (loc) params.set("location", loc);
    
    const p = updates.page !== undefined ? updates.page : page;
    if (p && p > 1) params.set("page", String(p));
    
    const trust = updates.trustTiers !== undefined ? updates.trustTiers : selectedTrustTiers;
    trust.forEach(t => params.append("trustTiers", t));
    
    const exp = updates.experienceLevels !== undefined ? updates.experienceLevels : selectedExperienceLevels;
    exp.forEach(e => params.append("experienceLevels", e));
    
    const sks = updates.skills !== undefined ? updates.skills : selectedSkills;
    sks.forEach(sk => params.append("skills", sk));
    
    const hire = updates.availableForHire !== undefined ? updates.availableForHire : availableForHire;
    if (hire !== null && hire !== undefined) params.set("availableForHire", String(hire));
    
    router.push(`${pathname}?${params.toString()}`);
  }, [router, pathname, selectedCategories, search, location, page, selectedTrustTiers, selectedExperienceLevels, selectedSkills, availableForHire]);

  // Sync inputs with URL changes (for browser back/forward navigation support)
  useEffect(() => {
    setSearch(searchParams.get("search") || "");
    setLocation(searchParams.get("location") || "");
  }, [searchParams]);

  // Debounce search and location input changes to avoid excessive API hits / URL router pushes
  useEffect(() => {
    const handler = setTimeout(() => {
      const urlSearch = searchParams.get("search") || "";
      const urlLocation = searchParams.get("location") || "";
      if (search !== urlSearch || location !== urlLocation) {
        pushFiltersToUrl({ search, location, page: 1 });
      }
    }, 400);
    return () => clearTimeout(handler);
  }, [search, location, pushFiltersToUrl, searchParams]);

  // Fetch Leaderboard rankings from CVerify ranking endpoints
  const fetchRankings = useCallback(async () => {
    setLoading(true);
    setError(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 10000); // 10-second timeout

    try {
      const params: RankingQueryParams = {
        search: searchParams.get("search") || undefined,
        category,
        trustTiers: selectedTrustTiers.length > 0 ? selectedTrustTiers : undefined,
        experienceLevels: selectedExperienceLevels.length > 0 ? selectedExperienceLevels : undefined,
        skills: selectedSkills.length > 0 ? selectedSkills : undefined,
        location: searchParams.get("location") || undefined,
        availableForHire: availableForHire !== null ? availableForHire : undefined,
        page,
        pageSize
      };

      const fetchPromise = profileApi.fetchRanking(params);
      const timeoutPromise = new Promise<never>((_, reject) => {
        controller.signal.addEventListener("abort", () => {
          reject(new Error("Request timed out. Please try again."));
        });
      });

      const result = await Promise.race([fetchPromise, timeoutPromise]);
      clearTimeout(timeoutId);

      setCandidates(result.items || []);
      setTotalCount(result.totalCount || 0);
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === "AbortError" || err.message === "Request timed out. Please try again.") {
        setError("Request timed out. The ranking service is taking too long to respond.");
      } else {
        console.error("Failed to load leaderboard rankings:", err);
        setError(err?.response?.data?.message || err?.message || "Failed to load rankings.");
      }
    } finally {
      setLoading(false);
    }
  }, [category, selectedTrustTiers, selectedExperienceLevels, selectedSkills, availableForHire, page, searchParams]);

  useEffect(() => {
    fetchRankings();
  }, [fetchRankings]);

  // Reset Filters
  const handleResetFilters = () => {
    setSearch("");
    setLocation("");
    setSkillInput("");
    pushFiltersToUrl({
      category: "Global",
      page: 1,
      search: "",
      location: "",
      trustTiers: [],
      experienceLevels: [],
      skills: [],
      availableForHire: null
    });
  };

  // Follow/Unfollow Handler
  const handleFollowToggle = async (candidate: RankingResponseItem) => {
    if (!isAuthenticated) {
      toast.danger("Please sign in to follow talent.");
      router.push(`/login?callbackUrl=/ranking`);
      return;
    }

    if (!candidate.username) {
      toast.danger("Cannot follow user without a username.");
      return;
    }

    const username = candidate.username;
    setFollowLoading((prev) => ({ ...prev, [candidate.candidateId]: true }));

    try {
      if (candidate.isFollowedByCurrentUser) {
        await profileApi.unfollowUser(username);
        toast.success(`Unfollowed ${candidate.fullName}`);
        setCandidates((prev) =>
          prev.map((c) =>
            c.candidateId === candidate.candidateId
              ? { ...c, isFollowedByCurrentUser: false, followersCount: Math.max(0, c.followersCount - 1) }
              : c
          )
        );
      } else {
        await profileApi.followUser(username);
        toast.success(`Following ${candidate.fullName}`);
        setCandidates((prev) =>
          prev.map((c) =>
            c.candidateId === candidate.candidateId
              ? { ...c, isFollowedByCurrentUser: true, followersCount: c.followersCount + 1 }
              : c
          )
        );
      }
    } catch (err: any) {
      toast.danger(err?.response?.data?.message || err?.message || "Failed to update follow status.");
    } finally {
      setFollowLoading((prev) => ({ ...prev, [candidate.candidateId]: false }));
    }
  };

  const handleAddSkill = () => {
    const trimmed = skillInput.trim();
    if (trimmed && !selectedSkills.includes(trimmed)) {
      pushFiltersToUrl({ skills: [...selectedSkills, trimmed], page: 1 });
      setSkillInput("");
    }
  };

  const handleRemoveSkill = (skill: string) => {
    pushFiltersToUrl({ skills: selectedSkills.filter((s) => s !== skill), page: 1 });
  };

  const handlePopularSkillToggle = (skill: string) => {
    if (selectedSkills.includes(skill)) {
      handleRemoveSkill(skill);
    } else {
      pushFiltersToUrl({ skills: [...selectedSkills, skill], page: 1 });
    }
  };

  // Render Rank Movement (supports NEW rank state)
  const renderRankDelta = (current: number, previous: number) => {
    if (previous === 0) {
      return (
        <span className="bg-success/15 text-success border border-success/35 px-1.5 py-0.5 rounded-md text-[8px] font-black tracking-widest leading-none">
          NEW
        </span>
      );
    }

    if (current === previous) {
      return (
        <div className="flex items-center gap-0.5 text-muted-foreground" title="No change in rank">
          <Minus className="size-3" />
        </div>
      );
    }

    if (current < previous) {
      const diff = previous - current;
      return (
        <div className="flex items-center gap-0.5 text-success font-black text-[10px]" title={`Rank improved by ${diff}`}>
          <ArrowUp className="size-3 stroke-3" />
          <span>{diff}</span>
        </div>
      );
    } else {
      const diff = current - previous;
      return (
        <div className="flex items-center gap-0.5 text-danger font-black text-[10px]" title={`Rank declined by ${diff}`}>
          <ArrowDown className="size-3 stroke-3" />
          <span>{diff}</span>
        </div>
      );
    }
  };



  const renderPodium = () => {
    const supportedCategories = ["Global", "TopContributors", "TopVerified", "HighestTrust", "TopAi"];
    if (page !== 1 || !supportedCategories.includes(category)) {
      return null;
    }

    if (loading && candidates.length === 0) {
      return (
        <div className="grid grid-cols-3 gap-2 md:gap-4 items-end justify-center py-6 border-b border-border/40 mb-6 bg-surface/20 rounded-2xl px-2 md:px-4 min-h-[220px]">
          {/* Second Place (Left) */}
          <div className="flex flex-col items-center justify-end w-full relative">
            <div className="flex flex-col items-center gap-1.5 mb-2 relative z-10 w-full px-2">
              <Skeleton className="size-14 rounded-full" />
              <Skeleton className="h-3.5 w-20 rounded" />
            </div>
            <Skeleton className="w-full rounded-t-2xl h-28" />
          </div>

          {/* First Place (Center) */}
          <div className="flex flex-col items-center justify-end w-full relative">
            <div className="flex flex-col items-center gap-1.5 mb-2 relative z-10 w-full px-2">
              <Skeleton className="size-16 rounded-full" />
              <Skeleton className="h-3.5 w-24 rounded" />
            </div>
            <Skeleton className="w-full rounded-t-2xl h-36" />
          </div>

          {/* Third Place (Right) */}
          <div className="flex flex-col items-center justify-end w-full relative">
            <div className="flex flex-col items-center gap-1.5 mb-2 relative z-10 w-full px-2">
              <Skeleton className="size-12 rounded-full" />
              <Skeleton className="h-3.5 w-16 rounded" />
            </div>
            <Skeleton className="w-full rounded-t-2xl h-24" />
          </div>
        </div>
      );
    }

    if (candidates.length < 3) {
      return null;
    }

    const first = candidates[0];
    const second = candidates[1];
    const third = candidates[2];

    const renderPodiumCard = (candidate: RankingResponseItem, rank: 1 | 2 | 3) => {
      const isFirst = rank === 1;
      const isSecond = rank === 2;
      const isThird = rank === 3;

      const rankBadgeColor = isFirst 
        ? "bg-warning text-warning-foreground border-warning/30" 
        : isSecond 
          ? "bg-slate-300 text-slate-900 border-slate-400/30" 
          : "bg-amber-700 text-amber-50 border-amber-800/30";

      const heightClass = isFirst ? "h-36" : isSecond ? "h-28" : "h-24";
      const borderClass = isFirst 
        ? "border-warning/30 shadow-warning/5" 
        : isSecond 
          ? "border-slate-400/20 shadow-slate-400/5" 
          : "border-amber-800/20 shadow-amber-800/5";

      return (
        <div className={`flex flex-col items-center text-center justify-end w-full group relative`}>
          <div className="flex flex-col items-center gap-1.5 mb-2 relative z-10 w-full px-2">
            <div className="relative cursor-pointer select-none" onClick={() => router.push(`/${candidate.username || candidate.candidateId}`)}>
              {candidate.avatarUrl ? (
                <img
                  src={candidate.avatarUrl}
                  alt={candidate.fullName}
                  className={`rounded-full object-cover border-2 ${isFirst ? "size-16 border-warning" : isSecond ? "size-14 border-slate-400" : "size-12 border-amber-700"}`}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${candidate.fullName}`;
                  }}
                />
              ) : (
                <div className={`rounded-full bg-surface-secondary flex items-center justify-center text-foreground font-black font-outfit border-2 ${isFirst ? "size-16 border-warning text-lg" : isSecond ? "size-14 border-slate-400 text-base" : "size-12 border-amber-700 text-sm"}`}>
                  {candidate.fullName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>
              )}
              <span className={`absolute -top-2 -right-1 text-[10px] font-black rounded-full size-5 flex items-center justify-center border shadow-sm ${rankBadgeColor}`}>
                {rank}
              </span>
            </div>
            
            <div className="flex flex-col items-center min-w-0 w-full">
              <span 
                className={`font-black text-foreground hover:text-accent cursor-pointer truncate w-full text-xs md:text-sm`}
                onClick={() => router.push(`/${candidate.username || candidate.candidateId}`)}
              >
                {candidate.fullName}
              </span>
              <span className="text-[10px] text-muted-foreground font-semibold truncate w-full">
                {candidate.primaryDomain || "Developer"}
              </span>
            </div>
          </div>

          <div className={`w-full bg-surface-secondary/60 border-t border-x rounded-t-2xl flex flex-col items-center justify-center p-3 select-none ${heightClass} ${borderClass} shadow-md`}>
            <div className="text-foreground/90 flex flex-col items-center">
              <span className="text-xl font-black font-outfit">{candidate.compositeScore.toFixed(0)}</span>
              <span className="text-[8px] font-bold text-muted uppercase tracking-wider">Score</span>
            </div>
            <div className="mt-2.5 flex items-center gap-1.5 bg-background/50 px-2 py-0.5 rounded-full border border-border/40">
              <Shield className="size-3 text-accent" />
              <span className="text-[9px] font-black text-foreground">{candidate.trustScore}%</span>
            </div>
          </div>
        </div>
      );
    };

    return (
      <div className="grid grid-cols-3 gap-2 md:gap-4 items-end justify-center py-6 border-b border-border/40 mb-6 bg-surface/20 rounded-2xl px-2 md:px-4">
        {renderPodiumCard(second, 2)}
        {renderPodiumCard(first, 1)}
        {renderPodiumCard(third, 3)}
      </div>
    );
  };

  const renderLeaderboardSkeletons = () => {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i} glow={false} className="border border-border/60 bg-surface rounded-xl p-4 shadow-xs text-left w-full">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 w-full">
              {/* Left Side: Rank, Avatar, Name & Bio details */}
              <div className="flex items-center gap-4 flex-1 min-w-0">
                {/* Rank Position & delta tracker */}
                <div className="flex flex-col items-center justify-center shrink-0 w-10 text-center">
                  <Skeleton className="h-5 w-6 rounded" />
                  <Skeleton className="h-3.5 w-8 rounded mt-1" />
                </div>

                {/* Avatar photo / initials */}
                <Skeleton className="size-12 rounded-xl shrink-0" />

                {/* Details */}
                <div className="flex flex-col min-w-0 flex-1 gap-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Skeleton className="h-4 w-32 rounded" />
                    <Skeleton className="h-4 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-3.5 w-48 rounded" />
                  <Skeleton className="h-3 w-64 rounded" />
                  <div className="flex items-center gap-3 mt-1.5">
                    <Skeleton className="h-3 w-16 rounded" />
                    <Skeleton className="h-3 w-20 rounded" />
                    <Skeleton className="h-3 w-24 rounded" />
                  </div>
                </div>
              </div>

              {/* Right Side: Dials & Actions */}
              <div className="flex items-center justify-end gap-6 shrink-0 w-full md:w-auto mt-2 md:mt-0 border-t md:border-t-0 border-border/20 pt-3 md:pt-0">
                <div className="flex items-center gap-4 select-none shrink-0">
                  <Skeleton className="size-16 rounded-full shrink-0" />
                  <Skeleton className="size-16 rounded-full shrink-0" />
                </div>
                <div className="flex flex-col gap-1.5 shrink-0 w-28 text-center select-none">
                  <Skeleton className="w-full h-8 rounded-xl" />
                  <Skeleton className="w-full h-8 rounded-xl" />
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  };



  return (
    <div className="w-full flex flex-col gap-6 select-none pb-12">
      {/* Banner Title */}
      <div className="flex flex-col gap-2 text-left">
        <h1 className="text-3xl font-extrabold tracking-tight font-outfit text-foreground flex items-center gap-2">
          <Trophy className="text-warning size-8 shrink-0" />
          Verified Talent Leaderboard
        </h1>
        <p className="text-muted text-sm max-w-2xl leading-relaxed">
          Discover the top engineering talent indexed on CVerify. Ranks are precalculated from multi-dimensional proof-of-work signals, AI evaluation depth, and verified source contributions.
        </p>
      </div>

      {/* 2-Column Split-Screen Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start mt-2 relative">

        {/* COLUMN 1: LEFT SIDEBAR FILTERS */}
        <aside className="w-full flex flex-col gap-4 sticky top-6 self-start">
          <Card glow={false} className="border border-border/60 bg-surface rounded-xl p-4 shadow-sm text-left">
            <div className="flex items-center justify-between border-b border-border/40 pb-3 mb-4 select-none">
              <div className="flex items-center gap-2 font-bold text-foreground text-xs uppercase tracking-wider">
                <Filter className="size-3.5" />
                Filters
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="font-semibold text-muted hover:bg-surface-secondary text-[11px] h-7 px-2.5 rounded-lg"
                onClick={handleResetFilters}
              >
                Reset All
              </Button>
            </div>

            <div className="flex flex-col gap-5">
              {/* Search Bar inside Left Filter Card */}
              <div className="flex flex-col gap-1.5 border-b border-border/40 pb-4">
                <SearchField
                  value={search}
                  onChange={setSearch}
                  className="w-full flex flex-col gap-1.5"
                >
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted">
                    Search Developer
                  </Label>
                  <SearchField.Group className="w-full rounded-xl border border-border bg-field-background flex items-center h-10 px-3">
                    <SearchField.SearchIcon className="text-muted-foreground mr-2 size-3.5 shrink-0 flex items-center justify-center">
                      <Search className="size-3.5" />
                    </SearchField.SearchIcon>
                    <SearchField.Input
                      placeholder="Name, bio, headline..."
                      className="w-full text-xs font-semibold bg-transparent border-0 outline-none h-full placeholder:text-field-placeholder"
                    />
                    <SearchField.ClearButton className="text-muted-foreground hover:text-foreground shrink-0 size-4 flex items-center justify-center ml-1" />
                  </SearchField.Group>
                </SearchField>
              </div>

              <Accordion className="pt-1">
                {/* Category Accordion Item (Multi-select) */}
                <Accordion.Item id="category-filter" className="border-none">
                  <Accordion.Heading>
                    <Accordion.Trigger className="w-full flex items-center justify-between py-2 text-[10px] font-bold uppercase tracking-wider text-muted select-none cursor-pointer">
                      <span>Rank Category</span>
                      <Accordion.Indicator />
                    </Accordion.Trigger>
                  </Accordion.Heading>
                  <Accordion.Panel>
                    <Accordion.Body className="flex flex-col gap-2 pt-2 pb-4">
                      {CATEGORIES.map((cat) => (
                        <Checkbox
                          key={cat.value}
                          isSelected={selectedCategories.includes(cat.value)}
                          onChange={(isSelected) => {
                            const newCats = isSelected 
                              ? [...selectedCategories.filter(c => c !== "Global"), cat.value] 
                              : selectedCategories.filter((c) => c !== cat.value);
                            const finalCats = newCats.length === 0 ? ["Global"] : newCats;
                            pushFiltersToUrl({ category: finalCats.join(",") });
                          }}
                          className="text-xs font-medium cursor-pointer"
                        >
                          {cat.label}
                        </Checkbox>
                      ))}
                    </Accordion.Body>
                  </Accordion.Panel>
                </Accordion.Item>

                {/* Trust Tier Accordion */}
                <Accordion.Item id="trust-filter" className="border-t border-border/40">
                  <Accordion.Heading>
                    <Accordion.Trigger className="w-full flex items-center justify-between py-2 text-[10px] font-bold uppercase tracking-wider text-muted select-none cursor-pointer">
                      <span>Trust Tier</span>
                      <Accordion.Indicator />
                    </Accordion.Trigger>
                  </Accordion.Heading>
                  <Accordion.Panel>
                    <Accordion.Body className="flex flex-col gap-2 pt-2 pb-4">
                      {TRUST_TIERS.map((tier) => (
                        <Checkbox
                          key={tier.value}
                          isSelected={selectedTrustTiers.includes(tier.value)}
                          onChange={(isSelected) => {
                            const newTiers = isSelected 
                              ? [...selectedTrustTiers, tier.value] 
                              : selectedTrustTiers.filter((t) => t !== tier.value);
                            pushFiltersToUrl({ trustTiers: newTiers, page: 1 });
                          }}
                          className="text-xs font-medium cursor-pointer"
                        >
                          {tier.label}
                        </Checkbox>
                      ))}
                    </Accordion.Body>
                  </Accordion.Panel>
                </Accordion.Item>

                {/* Experience Accordion */}
                <Accordion.Item id="experience-filter" className="border-t border-border/40">
                  <Accordion.Heading>
                    <Accordion.Trigger className="w-full flex items-center justify-between py-2 text-[10px] font-bold uppercase tracking-wider text-muted select-none cursor-pointer">
                      <span>Experience</span>
                      <Accordion.Indicator />
                    </Accordion.Trigger>
                  </Accordion.Heading>
                  <Accordion.Panel>
                    <Accordion.Body className="flex flex-col gap-2 pt-2 pb-4">
                      {EXPERIENCE_LEVELS.map((level) => (
                        <Checkbox
                          key={level.value}
                          isSelected={selectedExperienceLevels.includes(level.value)}
                          onChange={(isSelected) => {
                            const newLevels = isSelected 
                              ? [...selectedExperienceLevels, level.value] 
                              : selectedExperienceLevels.filter((l) => l !== level.value);
                            pushFiltersToUrl({ experienceLevels: newLevels, page: 1 });
                          }}
                          className="text-xs font-medium cursor-pointer"
                        >
                          {level.label}
                        </Checkbox>
                      ))}
                    </Accordion.Body>
                  </Accordion.Panel>
                </Accordion.Item>

                {/* Skills Accordion */}
                <Accordion.Item id="skills-filter" className="border-t border-border/40">
                  <Accordion.Heading>
                    <Accordion.Trigger className="w-full flex items-center justify-between py-2 text-[10px] font-bold uppercase tracking-wider text-muted select-none cursor-pointer">
                      <span>Skills & Languages</span>
                      <Accordion.Indicator />
                    </Accordion.Trigger>
                  </Accordion.Heading>
                  <Accordion.Panel>
                    <Accordion.Body className="flex flex-col gap-3 pt-2 pb-4">
                      <div className="flex gap-1.5">
                        <Input
                          placeholder="Type and press Enter..."
                          value={skillInput}
                          onChange={(e) => setSkillInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddSkill();
                            }
                          }}
                          className="text-xs font-semibold rounded-lg bg-field-background"
                        />
                        <Button
                          size="sm"
                          isIconOnly
                          variant="ghost"
                          onClick={handleAddSkill}
                          className="rounded-lg h-[40px] w-10 shrink-0 border border-border"
                        >
                          <Plus className="size-4" />
                        </Button>
                      </div>

                      {selectedSkills.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {selectedSkills.map((s) => (
                            <Chip
                              key={s}
                              size="sm"
                              className="bg-accent/15 text-accent border border-accent/25 hover:bg-accent/25 cursor-pointer font-bold flex items-center gap-1"
                            >
                              <Chip.Label>{s}</Chip.Label>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveSkill(s);
                                }}
                                className="hover:opacity-85 cursor-pointer p-0.5 text-xs font-semibold text-accent"
                              >
                                &times;
                              </button>
                            </Chip>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-1 border-t border-border/20 pt-2">
                        {POPULAR_SKILLS.map((skill) => {
                          const isSelected = selectedSkills.includes(skill);
                          return (
                            <button
                              key={skill}
                              onClick={() => handlePopularSkillToggle(skill)}
                              className={`text-[10px] font-bold select-none cursor-pointer px-2 py-0.5 rounded-md border transition-all duration-200 ${isSelected
                                  ? "bg-accent/10 text-accent border-accent/35"
                                  : "bg-surface-secondary text-muted-foreground border-border/40 hover:text-foreground hover:bg-surface-tertiary"
                                }`}
                            >
                              {skill}
                            </button>
                          );
                        })}
                      </div>
                    </Accordion.Body>
                  </Accordion.Panel>
                </Accordion.Item>

                {/* Location & Availability Accordion */}
                <Accordion.Item id="location-filter" className="border-t border-border/40">
                  <Accordion.Heading>
                    <Accordion.Trigger className="w-full flex items-center justify-between py-2 text-[10px] font-bold uppercase tracking-wider text-muted select-none cursor-pointer">
                      <span>Availability</span>
                      <Accordion.Indicator />
                    </Accordion.Trigger>
                  </Accordion.Heading>
                  <Accordion.Panel>
                    <Accordion.Body className="flex flex-col gap-3 pt-2 pb-4">
                      {/* Location Input */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-black text-muted uppercase">Geography</label>
                        <InputGroup className="w-full">
                          <InputGroup.Prefix className="pl-3 pr-1 text-muted-foreground flex items-center justify-center">
                            <MapPin className="size-3.5" />
                          </InputGroup.Prefix>
                          <InputGroup.Input
                            placeholder="e.g. Vietnam, Remote"
                            value={location}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                              setLocation(e.target.value);
                            }}
                            className="w-full text-xs font-semibold rounded-lg border border-border bg-field-background pl-2 h-9"
                          />
                        </InputGroup>
                      </div>

                      {/* Available for hire toggle */}
                      <Checkbox
                        isSelected={availableForHire === true}
                        onChange={(isSelected) => {
                          pushFiltersToUrl({ availableForHire: isSelected ? true : null, page: 1 });
                        }}
                        className="text-xs font-medium cursor-pointer"
                      >
                        Active For Hire
                      </Checkbox>
                    </Accordion.Body>
                  </Accordion.Panel>
                </Accordion.Item>
              </Accordion>
            </div>
          </Card>
        </aside>

        {/* COLUMN 2: CENTER LEADERBOARD FEED */}
        <main className="w-full flex flex-col gap-4">
          {/* Leaderboard Header Details */}
          <div className="flex items-center justify-between text-left select-none border-b border-border/40 pb-2">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-muted uppercase tracking-wider">
                {CATEGORIES.find((c) => c.value === category)?.label}
              </span>
              <span className="text-[11px] text-muted-foreground mt-0.5">
                Showing {page === 1 && ["Global", "TopContributors", "TopVerified", "HighestTrust", "TopAi"].includes(category) && candidates.length >= 3 
                  ? `3 on podium, ${candidates.length - 3} rows` 
                  : `${candidates.length}`} of {totalCount} matching candidates
              </span>
            </div>
            {loading && <Spinner size="sm" color="warning" />}
          </div>

          {/* Olympic Podium Section */}
          {renderPodium()}

          {/* Main Feed Row Renderers */}
          {loading && candidates.length === 0 ? (
            renderLeaderboardSkeletons()
          ) : error ? (
            <Card glow={false} className="border border-border/60 bg-surface rounded-xl p-6 text-center">
              <span className="text-danger font-semibold text-sm block mb-1">Error fetching rankings</span>
              <span className="text-muted text-xs block mb-4">{error}</span>
              <Button
                variant="ghost"
                className="text-danger border border-danger/40 rounded-xl px-4 py-2 text-xs cursor-pointer font-semibold"
                onClick={fetchRankings}
              >
                Retry
              </Button>
            </Card>
          ) : candidates.length === 0 ? (
            <div className="text-center py-20 bg-surface border border-border border-dashed rounded-xl w-full">
              <Trophy size={40} className="text-muted mx-auto mb-3" />
              <h3 className="font-bold text-base text-foreground mb-1">No Candidates Found</h3>
              <p className="text-muted text-xs max-w-sm mx-auto">
                No verified engineers match your specific filter queries. Try resetting or adjusting keywords.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {(page === 1 && ["Global", "TopContributors", "TopVerified", "HighestTrust", "TopAi"].includes(category) && candidates.length >= 3 
                ? candidates.slice(3) 
                : candidates
              ).map((candidate) => {
                return (
                  <Card
                    key={candidate.candidateId}
                    glow={false}
                    className="border border-border/60 bg-surface rounded-xl p-4 shadow-xs text-left hover:border-border transition-colors duration-200"
                  >
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">

                      {/* Left Side: Rank, Avatar, Name & Bio details */}
                      <div className="flex items-center gap-4 flex-1 min-w-0">

                        {/* Rank Position & delta tracker */}
                        <div className="flex flex-col items-center justify-center shrink-0 w-10 text-center">
                          <span className="text-lg font-black font-outfit text-foreground select-none leading-none">
                            #{candidate.globalRankPosition}
                          </span>
                          <div className="mt-1 select-none flex items-center justify-center min-h-[14px]">
                            {renderRankDelta(candidate.globalRankPosition, candidate.previousGlobalRankPosition)}
                          </div>
                        </div>

                        {/* Avatar photo / initials */}
                        <div className="relative shrink-0 select-none">
                          {candidate.avatarUrl ? (
                            <img
                              src={candidate.avatarUrl}
                              alt={candidate.fullName}
                              className="size-12 rounded-xl object-cover border border-border/40"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${candidate.fullName}`;
                              }}
                            />
                          ) : (
                            <div className="size-12 rounded-xl bg-surface-secondary border border-border/40 flex items-center justify-center text-foreground font-black font-outfit text-sm">
                              {candidate.fullName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                            </div>
                          )}

                          {candidate.availableForHire && (
                            <span className="absolute -bottom-1 -right-1 size-3 rounded-full bg-success border-2 border-surface block" title="Available for hire" />
                          )}
                        </div>

                        {/* Details */}
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className="text-sm font-black text-foreground hover:text-accent cursor-pointer truncate"
                              onClick={() => router.push(`/${candidate.username || candidate.candidateId}`)}
                            >
                              {candidate.fullName}
                            </span>
                            {candidate.username && (
                              <span className="text-[10px] text-muted-foreground font-mono">
                                @{candidate.username}
                              </span>
                            )}

                            <TrustScoreBadge score={candidate.trustScore} className="scale-90 origin-left" />
                          </div>

                          <span className="text-xs text-muted-foreground font-semibold mt-0.5 truncate max-w-md">
                            {candidate.headline || "CVerify Engineering Candidate"}
                          </span>

                          {candidate.bio && (
                            <span className="text-[11px] text-muted/80 mt-1 line-clamp-1 max-w-lg leading-normal">
                              {candidate.bio}
                            </span>
                          )}

                          {/* Statistics icons */}
                          <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground font-semibold">
                            {candidate.location && (
                              <div className="flex items-center gap-1">
                                <MapPin className="size-3" />
                                <span>{candidate.location}</span>
                              </div>
                            )}
                            {candidate.verifiedRepoCount > 0 && (
                              <div className="flex items-center gap-1 text-primary">
                                <GitFork className="size-3" />
                                <span>{candidate.verifiedRepoCount} Verified Repos</span>
                              </div>
                            )}
                            {candidate.verifiedContributionCount > 0 && (
                              <div className="flex items-center gap-1 text-success">
                                <CheckCircle className="size-3" />
                                <span>{candidate.verifiedContributionCount} Verifications</span>
                              </div>
                            )}
                            {candidate.totalStarsCount > 0 && (
                              <div className="flex items-center gap-1 text-warning">
                                <Trophy className="size-3" />
                                <span>{candidate.totalStarsCount} Stars</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right Side: Dials & Actions */}
                      <div className="flex items-center justify-end gap-6 shrink-0 w-full md:w-auto mt-2 md:mt-0 border-t md:border-t-0 border-border/20 pt-3 md:pt-0">

                        <div className="flex items-center gap-4 select-none shrink-0">
                          <TrustScoreDial score={candidate.trustScore} className="scale-80" />

                          <div className="flex flex-col items-center gap-1 shrink-0 scale-80">
                            <div className="relative w-20 h-20 flex items-center justify-center">
                              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 112 112">
                                <circle cx="56" cy="56" r="50" className="stroke-border/20 fill-none" strokeWidth="5" />
                                <circle cx="56" cy="56" r="50" className="transition-all duration-500 fill-none stroke-warning" strokeWidth="5" strokeDasharray="314" strokeDashoffset={314 - (314 * candidate.aiScore) / 100} />
                              </svg>
                              <div className="flex flex-col items-center">
                                <span className="text-xl font-black font-outfit leading-none">{candidate.aiScore}</span>
                                <span className="text-[7px] font-bold text-muted uppercase tracking-widest mt-0.5">AI</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-1.5 shrink-0 w-28 text-center select-none">
                          <Button
                            size="sm"
                            className={`w-full font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1 h-8 cursor-pointer ${candidate.isFollowedByCurrentUser
                                ? "bg-surface-secondary text-foreground hover:bg-surface-tertiary border border-border"
                                : "bg-accent text-accent-foreground hover:opacity-90"
                              }`}
                            isDisabled={followLoading[candidate.candidateId]}
                            onClick={() => handleFollowToggle(candidate)}
                          >
                            {followLoading[candidate.candidateId] ? (
                              <Spinner size="sm" color="current" className="size-3.5" />
                            ) : candidate.isFollowedByCurrentUser ? (
                              <>
                                <Check className="size-3 stroke-[2.5]" />
                                Following
                              </>
                            ) : (
                              <>
                                <Plus className="size-3 stroke-[2.5]" />
                                Follow
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="w-full font-semibold border border-border/60 hover:bg-surface-secondary rounded-xl py-2 text-xs h-8 cursor-pointer"
                            onClick={() => router.push(`/${candidate.username || candidate.candidateId}`)}
                          >
                            View Profile
                          </Button>
                        </div>

                      </div>

                    </div>

                    {/* Tags block */}
                    {candidate.topCapabilities && candidate.topCapabilities.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-border/20 select-none">
                        {candidate.topCapabilities.map((cap) => (
                          <Chip
                            key={cap.name}
                            size="sm"
                            className="bg-surface-secondary text-foreground border border-border/40 font-bold hover:border-border/80 cursor-pointer scale-90 origin-left"
                            onClick={() => {
                              if (!selectedSkills.includes(cap.name)) {
                                pushFiltersToUrl({ skills: [...selectedSkills, cap.name], page: 1 });
                              }
                            }}
                          >
                            <Chip.Label>{cap.name} <span className="text-muted ml-0.5">{cap.score}%</span></Chip.Label>
                          </Chip>
                        ))}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}

          {/* Pagination Controls */}
          {totalCount > pageSize && (
            <div className="flex items-center justify-center gap-2 mt-4 select-none">
              <Button
                variant="ghost"
                size="sm"
                isDisabled={page === 1 || loading}
                onClick={() => pushFiltersToUrl({ page: Math.max(1, page - 1) })}
                className="font-semibold text-foreground border border-border/60 rounded-xl px-4 py-2 cursor-pointer h-9 text-xs"
              >
                Previous
              </Button>
              <div className="text-xs font-bold text-foreground bg-surface border border-border/60 rounded-xl px-3.5 py-2">
                Page {page} of {Math.ceil(totalCount / pageSize)}
              </div>
              <Button
                variant="ghost"
                size="sm"
                isDisabled={page * pageSize >= totalCount || loading}
                onClick={() => pushFiltersToUrl({ page: page + 1 })}
                className="font-semibold text-foreground border border-border/60 rounded-xl px-4 py-2 cursor-pointer h-9 text-xs"
              >
                Next
              </Button>
            </div>
          )}
        </main>

      </div>
    </div>
  );
}
