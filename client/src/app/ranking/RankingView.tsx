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
  CheckboxGroup,
  Accordion,
  toast,
  Skeleton,
  SearchField,
  Label,
  TagGroup,
  Tag
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
import { PodiumSection } from "./components/PodiumSection";
import { UserStatsBanner } from "./components/UserStatsBanner";
import { LeaderboardTable } from "./components/LeaderboardTable";

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
  { value: "HighTrust", label: "High Trust", subLabel: "(Score >= 85)" },
  { value: "EvidenceVerified", label: "Evidence Verified", subLabel: "(Score >= 60)" },
  { value: "BasicVerified", label: "Basic Verified", subLabel: "(Score >= 30)" },
  { value: "Unverified", label: "Unverified", subLabel: "(Score < 30)" }
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
  const { isAuthenticated, user } = useAuth();

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

  // Note: renderRankDelta and renderPodium have been extracted to modular components

  const renderLeaderboardSkeletons = () => {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="grid grid-cols-1 md:grid-cols-[80px_2fr_2fr_1.5fr_0.8fr_1fr_180px] items-center gap-4 p-4 md:px-6 md:py-4 rounded-2xl border border-border/40 bg-surface select-none"
          >
            <div className="flex md:flex-col items-center justify-center gap-1">
              <Skeleton className="h-6 w-8 rounded-md" />
              <Skeleton className="h-3 w-6 rounded-md" />
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="size-11 rounded-xl shrink-0" />
              <div className="flex flex-col gap-1 w-full">
                <Skeleton className="h-4 w-28 rounded-md" />
                <Skeleton className="h-3 w-16 rounded-md" />
              </div>
            </div>
            <div className="flex gap-1.5">
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-24 rounded-md" />
              <Skeleton className="h-3 w-20 rounded-md" />
            </div>
            <div className="flex justify-center">
              <Skeleton className="h-6 w-10 rounded-md" />
            </div>
            <div className="flex justify-center">
              <Skeleton className="size-12 rounded-full" />
            </div>
            <div className="flex gap-2 justify-end">
              <Skeleton className="h-8 w-20 rounded-xl" />
              <Skeleton className="h-8 w-8 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    );
  };



  return (
    <div className="w-full flex flex-col gap-6 select-none pb-12 relative">
      {/* Top Ambient Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-accent/5 blur-[120px] rounded-full pointer-events-none -z-10" />
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

              <Accordion className="pt-1" aria-label="Filter options">
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
                      <CheckboxGroup
                        aria-label="Rank categories"
                        value={selectedCategories}
                        onChange={(newValues) => {
                          const hadGlobal = selectedCategories.includes("Global");
                          const hasGlobal = newValues.includes("Global");
                          let finalCats: string[] = [];

                          if (hasGlobal && !hadGlobal) {
                            finalCats = ["Global"];
                          } else if (hasGlobal && newValues.length > 1) {
                            finalCats = newValues.filter((c) => c !== "Global");
                          } else {
                            finalCats = newValues;
                          }

                          if (finalCats.length === 0) {
                            finalCats = ["Global"];
                          }

                          pushFiltersToUrl({ category: finalCats.join(",") });
                        }}
                      >
                        <div className="flex flex-col gap-2">
                          {CATEGORIES.map((cat) => (
                            <Checkbox
                              key={cat.value}
                              value={cat.value}
                              className="text-xs font-medium cursor-pointer"
                            >
                              <Checkbox.Content>
                                <Checkbox.Control className="border-2 border-border data-[selected=true]:bg-accent data-[selected=true]:border-accent rounded size-4 before:rounded">
                                  <Checkbox.Indicator className="text-accent-foreground size-3" />
                                </Checkbox.Control>
                                {cat.label}
                              </Checkbox.Content>
                            </Checkbox>
                          ))}
                        </div>
                      </CheckboxGroup>
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
                      <CheckboxGroup
                        aria-label="Trust tiers"
                        value={selectedTrustTiers}
                        onChange={(newTiers) => {
                          pushFiltersToUrl({ trustTiers: newTiers, page: 1 });
                        }}
                      >
                        <div className="flex flex-col gap-2">
                          {TRUST_TIERS.map((tier) => (
                            <Checkbox
                              key={tier.value}
                              value={tier.value}
                              className="text-xs font-medium cursor-pointer"
                            >
                              <Checkbox.Content>
                                <Checkbox.Control className="border-2 border-border data-[selected=true]:bg-accent data-[selected=true]:border-accent rounded size-4 before:rounded mt-0.5">
                                  <Checkbox.Indicator className="text-accent-foreground size-3" />
                                </Checkbox.Control>
                                <div className="flex flex-col text-left">
                                  <span>{tier.label}</span>
                                  <span className="text-[10px] text-muted-foreground font-normal leading-none">{tier.subLabel}</span>
                                </div>
                              </Checkbox.Content>
                            </Checkbox>
                          ))}
                        </div>
                      </CheckboxGroup>
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
                      <CheckboxGroup
                        aria-label="Experience levels"
                        value={selectedExperienceLevels}
                        onChange={(newLevels) => {
                          pushFiltersToUrl({ experienceLevels: newLevels, page: 1 });
                        }}
                      >
                        <div className="flex flex-col gap-2">
                          {EXPERIENCE_LEVELS.map((level) => (
                            <Checkbox
                              key={level.value}
                              value={level.value}
                              className="text-xs font-medium cursor-pointer"
                            >
                              <Checkbox.Content>
                                <Checkbox.Control className="border-2 border-border data-[selected=true]:bg-accent data-[selected=true]:border-accent rounded size-4 before:rounded">
                                  <Checkbox.Indicator className="text-accent-foreground size-3" />
                                </Checkbox.Control>
                                {level.label}
                              </Checkbox.Content>
                            </Checkbox>
                          ))}
                        </div>
                      </CheckboxGroup>
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
                          aria-label="Add skill filter"
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
                          aria-label="Add skill"
                          onClick={handleAddSkill}
                          className="rounded-lg h-[40px] w-10 shrink-0 border border-border"
                        >
                          <Plus className="size-4" />
                        </Button>
                      </div>

                      {selectedSkills.filter((s) => !POPULAR_SKILLS.includes(s)).length > 0 && (
                        <TagGroup
                          aria-label="Selected Skills"
                          onRemove={(keys) => {
                            const newSkills = selectedSkills.filter(s => !keys.has(s));
                            pushFiltersToUrl({ skills: newSkills, page: 1 });
                          }}
                        >
                          <TagGroup.List className="flex flex-wrap gap-1.5">
                            {selectedSkills.filter((s) => !POPULAR_SKILLS.includes(s)).map((s) => (
                              <Tag key={s} id={s} textValue={s}>
                                {s}
                              </Tag>
                            ))}
                          </TagGroup.List>
                        </TagGroup>
                      )}

                      <div className="border-t border-border/20 pt-2">
                        <TagGroup
                          aria-label="Popular Skills"
                          selectionMode="multiple"
                          selectedKeys={new Set(selectedSkills.filter(s => POPULAR_SKILLS.includes(s)))}
                          onSelectionChange={(keys) => {
                            if (keys === "all") return;
                            const popularSelected = Array.from(keys) as string[];
                            const customSelected = selectedSkills.filter(s => !POPULAR_SKILLS.includes(s));
                            pushFiltersToUrl({ skills: [...customSelected, ...popularSelected], page: 1 });
                          }}
                        >
                          <TagGroup.List className="flex flex-wrap gap-1">
                            {POPULAR_SKILLS.map((skill) => (
                              <Tag key={skill} id={skill} textValue={skill}>
                                {skill}
                              </Tag>
                            ))}
                          </TagGroup.List>
                        </TagGroup>
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
                            aria-label="Location filter"
                            placeholder="e.g. Vietnam, Remote"
                            value={location}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                              setLocation(e.target.value);
                            }}
                            className="pl-2 text-xs font-semibold"
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
                        <Checkbox.Content>
                          <Checkbox.Control className="border-2 border-border data-[selected=true]:bg-accent data-[selected=true]:border-accent rounded size-4 before:rounded">
                            <Checkbox.Indicator className="text-accent-foreground size-3" />
                          </Checkbox.Control>
                          Active For Hire
                        </Checkbox.Content>
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
          <PodiumSection
            candidates={candidates}
            loading={loading}
            category={category}
            page={page}
          />

          {/* User stats summary/highlight banner */}
          {!loading && candidates.length > 0 && (
            <UserStatsBanner
              totalCount={totalCount}
              user={user}
              candidates={candidates}
            />
          )}

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
            <LeaderboardTable
              candidates={
                page === 1 && ["Global", "TopContributors", "TopVerified", "HighestTrust", "TopAi"].includes(category) && candidates.length >= 3
                  ? candidates.slice(3)
                  : candidates
              }
              user={user}
              followLoading={followLoading}
              handleFollowToggle={handleFollowToggle}
              selectedSkills={selectedSkills}
              pushFiltersToUrl={pushFiltersToUrl}
            />
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
