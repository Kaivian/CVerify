"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { workspaceService } from "../../../../features/workspace/services/workspace.service";
import { type OrganizationListItem, type OrganizationStats } from "../../../../features/workspace/types/workspace.types";
import { OrganizationCard } from "./_components/organization-card";
import { FeaturedOrganizationCard } from "./_components/featured-organization-card";
import { PaginationWrapper } from "@/components/ui/pagination-wrapper";
import { Card } from "@/components/ui/card";
import { Button, Chip } from "@heroui/react";
import {
  Building2,
  Sparkles,
  GitFork,
  Briefcase,
  Users,
  Search,
  MapPin,
  SlidersHorizontal,
  RotateCcw,
  CheckCircle2,
  TrendingUp,
  Award,
  ChevronDown,
  X
} from "lucide-react";

export default function OrganizationsDirectoryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // Search, Filter & Sort State (Synchronized with URL params)
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("");
  const [industry, setIndustry] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [verifiedFilter, setVerifiedFilter] = useState("all");
  const [sortBy, setSortBy] = useState("recently_updated");
  const [page, setPage] = useState(1);

  // Advanced Filters toggle state
  const [showFilters, setShowFilters] = useState(true);

  // Data State
  const [organizations, setOrganizations] = useState<OrganizationListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState<OrganizationStats | null>(null);
  const [featuredOrgs, setFeaturedOrgs] = useState<OrganizationListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [featuredLoading, setFeaturedLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Page Size is fixed at 12 for the 4-column/3-column desktop-first grid
  const pageSize = 12;

  // Initialize filters from URL on mount
  useEffect(() => {
    if (!searchParams) return;
    const qVal = searchParams.get("q") || "";
    const locVal = searchParams.get("loc") || "";
    const indVal = searchParams.get("ind") || "";
    const sizeVal = searchParams.get("size") || "";
    const verifiedVal = searchParams.get("verified") || "all";
    const sortVal = searchParams.get("sort") || "recently_updated";
    
    const pageVal = parseInt(searchParams.get("page") || "1", 10);
    const parsedPage = isNaN(pageVal) || pageVal < 1 ? 1 : pageVal;

    Promise.resolve().then(() => {
      setSearch(qVal);
      setLocation(locVal);
      setIndustry(indVal);
      setCompanySize(sizeVal);
      setVerifiedFilter(verifiedVal);
      setSortBy(sortVal);
      setPage(parsedPage);
    });
  }, [searchParams]);

  // Sync state back to URL query parameters
  const updateUrlParams = useCallback((updatedParams: Record<string, string | null | undefined>) => {
    const current = new URLSearchParams(Array.from(searchParams?.entries() || []));
    
    Object.entries(updatedParams).forEach(([key, value]) => {
      if (value === null || value === undefined || value === "") {
        current.delete(key);
      } else {
        current.set(key, value);
      }
    });

    const queryStr = current.toString();
    const query = queryStr ? `?${queryStr}` : "";
    router.replace(`${pathname}${query}`);
  }, [searchParams, pathname, router]);

  // Fetch directory list
  const fetchOrganizations = useCallback(async () => {
    await Promise.resolve();
    setLoading(true);
    setError(null);
    try {
      const isVerified = verifiedFilter === "verified" ? true : verifiedFilter === "unverified" ? false : undefined;
      const result = await workspaceService.getOrganizations({
        search: searchParams?.get("q") || undefined,
        location: searchParams?.get("loc") || undefined,
        industry: searchParams?.get("ind") || undefined,
        companySize: searchParams?.get("size") || undefined,
        isVerified,
        sortBy: searchParams?.get("sort") || "recently_updated",
        page: parseInt(searchParams?.get("page") || "1", 10),
        pageSize,
      });

      setOrganizations(result.items || []);
      setTotalCount(result.totalCount || 0);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to load directory. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [searchParams, verifiedFilter]);

  // Fetch ecosystem statistics
  const fetchStats = useCallback(async () => {
    await Promise.resolve();
    setStatsLoading(true);
    try {
      const data = await workspaceService.getOrganizationStats();
      setStats(data);
    } catch (err) {
      console.error("Failed to load ecosystem statistics:", err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Fetch featured / trending companies
  const fetchFeatured = useCallback(async () => {
    await Promise.resolve();
    setFeaturedLoading(true);
    try {
      const data = await workspaceService.getOrganizations({
        isVerified: true,
        sortBy: "most_repositories",
        page: 1,
        pageSize: 4,
      });
      setFeaturedOrgs(data.items || []);
    } catch (err) {
      console.error("Failed to load featured organizations:", err);
    } finally {
      setFeaturedLoading(false);
    }
  }, []);

  // Load stats and featured lists on mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchStats();
    fetchFeatured();
  }, [fetchStats, fetchFeatured]);

  // Refetch organizations list when URL parameters change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchOrganizations();
  }, [fetchOrganizations]);

  // Trigger search on submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateUrlParams({
      q: search || null,
      loc: location || null,
      ind: industry || null,
      size: companySize || null,
      verified: verifiedFilter !== "all" ? verifiedFilter : null,
      sort: sortBy !== "recently_updated" ? sortBy : null,
      page: "1" // reset to page 1 on new search
    });
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSearch("");
    setLocation("");
    setIndustry("");
    setCompanySize("");
    setVerifiedFilter("all");
    setSortBy("recently_updated");
    
    updateUrlParams({
      q: null,
      loc: null,
      ind: null,
      size: null,
      verified: null,
      sort: null,
      page: "1"
    });
  };

  // Handle page change
  const handlePageChange = (newPage: number) => {
    updateUrlParams({ page: newPage.toString() });
  };

  // Handle direct filter changes (dropdowns)
  const handleFilterChange = (key: string, value: string) => {
    const changes: Record<string, string | null> = { page: "1" };
    
    if (key === "industry") {
      setIndustry(value);
      changes.ind = value || null;
    } else if (key === "companySize") {
      setCompanySize(value);
      changes.size = value || null;
    } else if (key === "verified") {
      setVerifiedFilter(value);
      changes.verified = value !== "all" ? value : null;
    } else if (key === "sort") {
      setSortBy(value);
      changes.sort = value !== "recently_updated" ? value : null;
    }
    
    updateUrlParams(changes);
  };

  // Get active filter count (excluding sorting)
  const getActiveFilterCount = () => {
    let count = 0;
    if (searchParams.get("q")) count++;
    if (searchParams.get("loc")) count++;
    if (searchParams.get("ind")) count++;
    if (searchParams.get("size")) count++;
    const verifiedVal = searchParams.get("verified");
    if (verifiedVal && verifiedVal !== "all") count++;
    return count;
  };

  const getActiveChips = () => {
    const chips = [];
    if (searchParams.get("q")) chips.push({ key: "q", label: `Search: "${searchParams.get("q")}"` });
    if (searchParams.get("loc")) chips.push({ key: "loc", label: `Location: ${searchParams.get("loc")}` });
    if (searchParams.get("ind")) chips.push({ key: "ind", label: `Industry: ${searchParams.get("ind")}` });
    if (searchParams.get("size")) chips.push({ key: "size", label: `Size: ${searchParams.get("size")}` });
    const verifiedVal = searchParams.get("verified");
    if (verifiedVal && verifiedVal !== "all") {
      chips.push({ key: "verified", label: verifiedVal === "verified" ? "Verified Only" : "Unverified Only" });
    }
    return chips;
  };

  const activeChips = getActiveChips();

  // Loading Skeleton Components
  const MetricCardSkeleton = () => (
    <div className="flex flex-col justify-between p-5 h-24 animate-pulse">
      <div className="h-2.5 bg-surface-secondary rounded-sm w-16 mb-2" />
      <div className="flex justify-between items-center mt-auto">
        <div className="h-6 bg-surface-secondary rounded-sm w-12" />
        <div className="size-8 bg-surface-secondary rounded-lg" />
      </div>
    </div>
  );

  const FeaturedCardSkeleton = () => (
    <div className="flex flex-col md:flex-row gap-5 p-5 bg-surface border border-border/50 rounded-2xl animate-pulse h-[140px] items-stretch">
      <div className="w-16 h-16 md:w-20 md:h-20 bg-surface-secondary rounded-xl shrink-0 self-center" />
      <div className="flex-1 flex flex-col justify-between py-1 gap-2">
        <div>
          <div className="h-5 bg-surface-secondary rounded-md w-1/3 mb-1" />
          <div className="h-3.5 bg-surface-secondary rounded-sm w-1/2 mb-2" />
          <div className="h-3 bg-surface-secondary rounded-sm w-3/4" />
        </div>
        <div className="h-4 bg-surface-secondary rounded-sm w-24" />
      </div>
      <div className="w-full md:w-52 md:border-l md:border-border/30 md:pl-5 flex flex-col justify-between shrink-0">
        <div className="h-4 bg-surface-secondary rounded-sm w-16 mb-2" />
        <div className="h-8 bg-surface-secondary rounded-xl w-full" />
      </div>
    </div>
  );

  const ListingCardSkeleton = () => (
    <div className="flex flex-col h-full bg-surface border border-border/50 p-5 rounded-2xl animate-pulse min-h-[250px]">
      {/* Header Row */}
      <div className="flex gap-3 items-center mb-4 shrink-0">
        <div className="size-11 rounded-xl bg-surface-secondary shrink-0" />
        <div className="flex-1 flex flex-col gap-2">
          <div className="h-4 bg-surface-secondary rounded-md w-2/3" />
          <div className="h-3 bg-surface-secondary rounded-md w-1/3" />
        </div>
      </div>
      
      {/* Body Info */}
      <div className="flex-1 flex flex-col gap-2">
        <div className="h-3 bg-surface-secondary rounded-sm w-full" />
        <div className="h-3 bg-surface-secondary rounded-sm w-5/6" />
        <div className="h-3.5 bg-surface-secondary/60 rounded-md w-1/2 mt-2" />
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-2 my-4 py-2 border-y border-border/30 shrink-0">
        <div className="flex flex-col items-center gap-1.5">
          <div className="h-2 bg-surface-secondary rounded-xs w-6" />
          <div className="h-3.5 bg-surface-secondary rounded-sm w-8" />
        </div>
        <div className="flex flex-col items-center gap-1.5 border-x border-border/20">
          <div className="h-2 bg-surface-secondary rounded-xs w-8" />
          <div className="h-3.5 bg-surface-secondary rounded-sm w-6" />
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <div className="h-2 bg-surface-secondary rounded-xs w-6" />
          <div className="h-3.5 bg-surface-secondary rounded-sm w-7" />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-1 shrink-0">
        <div className="h-3 bg-surface-secondary rounded-sm w-16" />
        <div className="h-7 bg-surface-secondary rounded-lg w-12" />
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 w-full select-none pb-8 text-foreground bg-background">
      {/* 1. Page Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-5 text-left select-none relative overflow-hidden">
        <div className="flex flex-col gap-1.5 z-10">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-[9px] font-extrabold tracking-wider uppercase">
              <Sparkles className="size-3 text-accent animate-pulse" />
              <span>AI-Powered Trust Network</span>
            </div>
          </div>
          <h1 className="text-3xl font-black tracking-tight font-outfit text-foreground mt-1" id="page-title">
            Ecosystem Directory
          </h1>
          <p className="text-muted text-xs leading-relaxed max-w-2xl">
            Search, discover and verify ecosystem partners, developers, and repositories in CVerify's cryptographically secured reputation platform.
          </p>
        </div>
        
        {/* Subtle Decorative Header Background */}
        <div className="absolute right-0 top-0 w-44 h-full bg-linear-to-l from-accent/5 via-transparent to-transparent pointer-events-none" />
      </div>

      {/* 2. Ecosystem Statistics Dashboard (Unified Metrics Ribbon) */}
      {statsLoading ? (
        <Card glow={false} className="p-0 bg-surface border border-border/60 rounded-2xl shadow-xs overflow-hidden">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 divide-y sm:divide-y-0 md:divide-x divide-border/40">
            {[...Array(5)].map((_, i) => (
              <MetricCardSkeleton key={i} />
            ))}
          </div>
        </Card>
      ) : stats ? (
        <Card glow={false} className="p-0 bg-surface border border-border/70 rounded-2xl shadow-xs overflow-hidden select-none">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 divide-y sm:divide-y-0 md:divide-x divide-border/40">
            {/* Stat 1: Total Partners */}
            <div className="p-5 flex items-center justify-between min-w-0">
              <div className="flex flex-col gap-0.5 min-w-0 text-left">
                <span className="text-[9px] font-bold text-muted uppercase tracking-wider block">Total Partners</span>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-2xl font-black text-foreground font-outfit leading-none">{stats.totalOrganizations}</span>
                  <span className="inline-flex items-center gap-0.5 text-[8px] font-bold text-success bg-success/5 border border-success/15 px-1 py-0.5 rounded-sm align-middle leading-none">
                    <TrendingUp className="size-2" />
                    <span>+12%</span>
                  </span>
                </div>
                <span className="text-[9px] text-muted/70 font-medium block mt-1">Registered orgs</span>
              </div>
              <div className="flex items-center justify-center size-8 rounded-lg bg-surface-secondary/70 border border-border/30 shrink-0 ml-2">
                <Building2 className="size-4 text-muted/80" />
              </div>
            </div>

            {/* Stat 2: Verified Entities */}
            <div className="p-5 flex items-center justify-between min-w-0">
              <div className="flex flex-col gap-0.5 min-w-0 text-left">
                <span className="text-[9px] font-bold text-muted uppercase tracking-wider block">Verified Entities</span>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-2xl font-black text-foreground font-outfit leading-none">{stats.verifiedOrganizations}</span>
                  <span className="inline-flex items-center text-[8px] font-extrabold text-success bg-success/10 border border-success/20 px-1 py-0.5 rounded-sm align-middle leading-none">
                    {stats.totalOrganizations > 0 
                      ? `${((stats.verifiedOrganizations / stats.totalOrganizations) * 100).toFixed(0)}%`
                      : "0%"
                    }
                  </span>
                </div>
                <span className="text-[9px] text-muted/70 font-medium block mt-1">Verified trust rate</span>
              </div>
              <div className="flex items-center justify-center size-8 rounded-lg bg-success/10 border border-success/20 shrink-0 ml-2">
                <Award className="size-4 text-success" />
              </div>
            </div>

            {/* Stat 3: Open Positions */}
            <div className="p-5 flex items-center justify-between min-w-0">
              <div className="flex flex-col gap-0.5 min-w-0 text-left">
                <span className="text-[9px] font-bold text-muted uppercase tracking-wider block">Open Positions</span>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-2xl font-black text-foreground font-outfit leading-none">{stats.openOpportunities}</span>
                  <span className="inline-flex items-center text-[8px] font-bold text-accent bg-accent/5 border border-accent/15 px-1 py-0.5 rounded-sm align-middle leading-none">
                    Active
                  </span>
                </div>
                <span className="text-[9px] text-muted/70 font-medium block mt-1">Synced hiring roles</span>
              </div>
              <div className="flex items-center justify-center size-8 rounded-lg bg-accent/10 border border-accent/20 shrink-0 ml-2">
                <Briefcase className="size-4 text-accent" />
              </div>
            </div>

            {/* Stat 4: Synced Repos */}
            <div className="p-5 flex items-center justify-between min-w-0">
              <div className="flex flex-col gap-0.5 min-w-0 text-left">
                <span className="text-[9px] font-bold text-muted uppercase tracking-wider block">Synced Repos</span>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-2xl font-black text-foreground font-outfit leading-none">{stats.verifiedRepositories}</span>
                  <span className="inline-flex items-center gap-0.5 text-[8px] font-bold text-success bg-success/5 border border-success/15 px-1 py-0.5 rounded-sm align-middle leading-none">
                    <CheckCircle2 className="size-2 text-success" />
                    <span>Verified</span>
                  </span>
                </div>
                <span className="text-[9px] text-muted/70 font-medium block mt-1">Synced codebases</span>
              </div>
              <div className="flex items-center justify-center size-8 rounded-lg bg-surface-secondary/70 border border-border/30 shrink-0 ml-2">
                <GitFork className="size-4 text-muted/80" />
              </div>
            </div>

            {/* Stat 5: Active Engineers */}
            <div className="p-5 flex items-center justify-between min-w-0 col-span-2 sm:col-span-1">
              <div className="flex flex-col gap-0.5 min-w-0 text-left">
                <span className="text-[9px] font-bold text-muted uppercase tracking-wider block">Active Engineers</span>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-2xl font-black text-foreground font-outfit leading-none">{stats.totalMembers}</span>
                  <span className="inline-flex items-center text-[8px] font-bold text-muted bg-surface-secondary border border-border/30 px-1 py-0.5 rounded-sm align-middle leading-none">
                    Vetted
                  </span>
                </div>
                <span className="text-[9px] text-muted/70 font-medium block mt-1">Ecosystem talent</span>
              </div>
              <div className="flex items-center justify-center size-8 rounded-lg bg-surface-secondary/70 border border-border/30 shrink-0 ml-2">
                <Users className="size-4 text-muted/80" />
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      {/* 3. Discovery Layer: Featured Organizations */}
      {featuredLoading ? (
        <div className="flex flex-col gap-3 text-left">
          <div className="flex items-center gap-1.5 select-none">
            <Sparkles className="size-4 text-accent" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted">Featured Partners</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-6">
            {[...Array(2)].map((_, i) => (
              <FeaturedCardSkeleton key={i} />
            ))}
          </div>
        </div>
      ) : featuredOrgs.length > 0 ? (
        <div className="flex flex-col gap-3 text-left">
          <div className="flex items-center gap-1.5 select-none">
            <Sparkles className="size-4 text-accent animate-pulse" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted">Featured Partners</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-6">
            {featuredOrgs.slice(0, 4).map((org) => (
              <FeaturedOrganizationCard key={org.organizationId} organization={org} />
            ))}
          </div>
        </div>
      ) : null}

      {/* 4. Unified Filter & Search Control Panel */}
      <Card glow={false} className="w-full bg-surface border border-border/70 rounded-2xl p-4 shadow-xs select-none">
        <form onSubmit={handleSearchSubmit} className="flex flex-col gap-4 w-full">
          {/* Main search and location input (Unified Container Layout) */}
          <div className="flex flex-col md:flex-row items-stretch gap-3 w-full">
            <div className="flex flex-col md:flex-row items-center flex-1 w-full bg-field border border-border focus-within:border-focus focus-within:ring-1 focus-within:ring-focus rounded-xl shadow-xs overflow-hidden h-10 transition-all duration-200">
              {/* Search Keyword */}
              <div className="relative flex-1 w-full flex items-center h-full">
                <Search className="absolute left-3 size-4 text-muted/65 pointer-events-none z-10" />
                <input
                  id="search-orgs"
                  type="text"
                  placeholder="Search partner name, keywords, technology tags..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 h-full border-0 bg-transparent text-xs font-semibold outline-hidden text-foreground placeholder-field-placeholder"
                  aria-label="Search partner organizations"
                />
              </div>

              {/* Divider Line on Desktop */}
              <div className="hidden md:block w-px h-6 bg-border shrink-0" />

              {/* Search Location */}
              <div className="relative w-full md:w-60 flex items-center h-full border-t border-border md:border-t-0 md:border-l-0">
                <MapPin className="absolute left-3 size-4 text-muted/65 pointer-events-none z-10" />
                <input
                  id="search-location"
                  type="text"
                  placeholder="Filter by city/location..."
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full pl-9 pr-3 h-full border-0 bg-transparent text-xs font-semibold outline-hidden text-foreground placeholder-field-placeholder"
                  aria-label="Search by location"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto shrink-0 justify-end h-10">
              <Button 
                type="button" 
                variant="ghost"
                className={`font-semibold rounded-xl px-4 h-full text-xs cursor-pointer border flex items-center gap-1.5 ${showFilters ? 'bg-surface-secondary text-foreground border-border/90' : 'bg-transparent text-muted border-border/40 hover:bg-surface-secondary/50'}`}
                onClick={() => setShowFilters(!showFilters)}
              >
                <SlidersHorizontal className="size-3.5" />
                <span>Filters</span>
                {getActiveFilterCount() > 0 && (
                  <span className="inline-flex items-center justify-center size-4 text-[9px] font-black bg-accent text-accent-foreground rounded-full">
                    {getActiveFilterCount()}
                  </span>
                )}
              </Button>

              <Button type="submit" className="bg-accent text-accent-foreground font-extrabold rounded-xl px-5 h-full text-xs cursor-pointer hover:opacity-90 transition-all select-none">
                Search
              </Button>
            </div>
          </div>

          {/* Collapsible Dropdown Filter Drawer with custom styled selectors */}
          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-border/30 w-full animate-fade-in text-left">
              {/* Industry sector selector */}
              <div className="flex flex-col">
                <label htmlFor="search-industry" className="text-[9px] font-bold uppercase tracking-wider text-muted mb-1 block">Industry Sector</label>
                <div className="relative flex items-center w-full">
                  <select
                    id="search-industry"
                    value={industry}
                    onChange={(e) => handleFilterChange("industry", e.target.value)}
                    className="w-full bg-field-background border border-border/80 focus:border-focus rounded-xl pl-3 pr-8 py-2 text-xs font-semibold text-foreground outline-hidden h-10 cursor-pointer hover:bg-surface-secondary/40 transition-colors duration-150 appearance-none"
                  >
                    <option value="">All Sectors</option>
                    <option value="Software">Software</option>
                    <option value="AI">AI / Machine Learning</option>
                    <option value="Fintech">Fintech</option>
                    <option value="Healthtech">Healthtech</option>
                    <option value="Cloud Computing">Cloud Computing</option>
                    <option value="Web3">Web3 / Blockchain</option>
                    <option value="E-commerce">E-commerce</option>
                  </select>
                  <ChevronDown className="absolute right-3 size-3.5 text-muted pointer-events-none z-10" />
                </div>
              </div>

              {/* Company size selector */}
              <div className="flex flex-col">
                <label htmlFor="search-size" className="text-[9px] font-bold uppercase tracking-wider text-muted mb-1 block">Company Size</label>
                <div className="relative flex items-center w-full">
                  <select
                    id="search-size"
                    value={companySize}
                    onChange={(e) => handleFilterChange("companySize", e.target.value)}
                    className="w-full bg-field-background border border-border/80 focus:border-focus rounded-xl pl-3 pr-8 py-2 text-xs font-semibold text-foreground outline-hidden h-10 cursor-pointer hover:bg-surface-secondary/40 transition-colors duration-150 appearance-none"
                  >
                    <option value="">All Scale Sizes</option>
                    <option value="1-10">1 - 10 Employees</option>
                    <option value="11-50">11 - 50 Employees</option>
                    <option value="51-200">51 - 200 Employees</option>
                    <option value="201-500">201 - 500 Employees</option>
                    <option value="501-1000">501 - 1000 Employees</option>
                    <option value="1000+">1000+ Employees</option>
                  </select>
                  <ChevronDown className="absolute right-3 size-3.5 text-muted pointer-events-none z-10" />
                </div>
              </div>

              {/* Verification selector */}
              <div className="flex flex-col">
                <label htmlFor="search-verified" className="text-[9px] font-bold uppercase tracking-wider text-muted mb-1 block">Verification Level</label>
                <div className="relative flex items-center w-full">
                  <select
                    id="search-verified"
                    value={verifiedFilter}
                    onChange={(e) => handleFilterChange("verified", e.target.value)}
                    className="w-full bg-field-background border border-border/80 focus:border-focus rounded-xl pl-3 pr-8 py-2 text-xs font-semibold text-foreground outline-hidden h-10 cursor-pointer hover:bg-surface-secondary/40 transition-colors duration-150 appearance-none"
                  >
                    <option value="all">All Verification Levels</option>
                    <option value="verified">Verified Only</option>
                    <option value="unverified">Unverified Only</option>
                  </select>
                  <ChevronDown className="absolute right-3 size-3.5 text-muted pointer-events-none z-10" />
                </div>
              </div>

              {/* Sorting selector */}
              <div className="flex flex-col">
                <label htmlFor="search-sort" className="text-[9px] font-bold uppercase tracking-wider text-muted mb-1 block">Sort Listings By</label>
                <div className="relative flex items-center w-full">
                  <select
                    id="search-sort"
                    value={sortBy}
                    onChange={(e) => handleFilterChange("sort", e.target.value)}
                    className="w-full bg-field-background border border-border/80 focus:border-focus rounded-xl pl-3 pr-8 py-2 text-xs font-semibold text-foreground outline-hidden h-10 cursor-pointer hover:bg-surface-secondary/40 transition-colors duration-150 appearance-none"
                  >
                    <option value="recently_updated">Recently Active</option>
                    <option value="recently_created">Recently Added</option>
                    <option value="alphabetical_asc">Alphabetical (A-Z)</option>
                    <option value="alphabetical_desc">Alphabetical (Z-A)</option>
                    <option value="most_engineers">Verified Engineers</option>
                    <option value="most_repositories">Synced Repositories</option>
                    <option value="most_jobs">Active Roles</option>
                  </select>
                  <ChevronDown className="absolute right-3 size-3.5 text-muted pointer-events-none z-10" />
                </div>
              </div>
            </div>
          )}

          {/* Active filter badges row */}
          {activeChips.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-dashed border-border/30 select-none">
              <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Applied Filters:</span>
              {activeChips.map((chip) => (
                <Chip
                  key={chip.key}
                  size="sm"
                  variant="soft"
                  color="accent"
                  className="h-6 px-2 text-[10px] font-bold bg-accent/5 border border-accent/20 text-accent-foreground rounded-lg"
                >
                  <div className="flex items-center gap-1">
                    <span>{chip.label}</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (chip.key === "q") setSearch("");
                        if (chip.key === "loc") setLocation("");
                        if (chip.key === "ind") setIndustry("");
                        if (chip.key === "size") setCompanySize("");
                        if (chip.key === "verified") setVerifiedFilter("all");
                        
                        const keyMap: Record<string, string> = { q: "q", loc: "loc", ind: "ind", size: "size", verified: "verified" };
                        updateUrlParams({ [keyMap[chip.key]]: null, page: "1" });
                      }}
                      className="hover:bg-accent/20 rounded-full p-0.5 ml-1 transition-colors cursor-pointer inline-flex items-center justify-center size-3.5"
                      aria-label={`Remove filter ${chip.label}`}
                    >
                      <X className="size-2.5 text-accent" />
                    </button>
                  </div>
                </Chip>
              ))}
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleResetFilters} 
                className="text-xs text-muted hover:text-foreground h-6 min-w-0 px-2.5 font-bold hover:bg-surface-secondary rounded-lg flex items-center gap-1"
              >
                <RotateCcw className="size-3" />
                <span>Reset All</span>
              </Button>
            </div>
          )}
        </form>
      </Card>

      {/* 5. Main Grid Results View */}
      {loading ? (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {[...Array(12)].map((_, i) => (
              <ListingCardSkeleton key={i} />
            ))}
          </div>
        </div>
      ) : error ? (
        <Card glow={false} className="border border-danger/20 bg-danger/5 rounded-2xl p-8 text-center select-none max-w-lg mx-auto mt-6">
          <span className="text-danger font-extrabold text-sm block mb-1">Failed to load Ecosystem Directory</span>
          <span className="text-muted text-xs block mb-4">{error}</span>
          <Button 
            className="bg-danger text-danger-foreground border border-danger/40 rounded-xl px-5 h-9 text-xs cursor-pointer font-bold mx-auto flex items-center justify-center" 
            onClick={fetchOrganizations}
          >
            Retry Connection
          </Button>
        </Card>
      ) : organizations.length === 0 ? (
        /* Empty State with fallback recommendations */
        <div className="flex flex-col gap-8 w-full select-none text-center py-12">
          <div className="max-w-md mx-auto py-8">
            <Building2 size={48} className="text-muted/65 mx-auto mb-3" />
            <h3 className="font-extrabold text-base text-foreground mb-1">No Ecosystem Partners Found</h3>
            <p className="text-muted text-xs leading-relaxed mb-5">
              We couldn't find any organizations matching your search criteria. Try broadening your keywords or resetting filters.
            </p>
            <Button size="sm" className="bg-accent text-accent-foreground font-extrabold rounded-xl px-4 py-2 h-9 text-xs cursor-pointer mx-auto" onClick={handleResetFilters}>
              Clear Active Filters
            </Button>
          </div>

          {!featuredLoading && featuredOrgs.length > 0 && (
            <div className="flex flex-col gap-3 text-left border-t border-border/40 pt-8">
              <div className="flex items-center gap-1.5 select-none">
                <TrendingUp className="size-4 text-success" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted">Recommended Organizations</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {featuredOrgs.slice(0, 4).map((org) => (
                  <OrganizationCard key={org.organizationId} organization={org} />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Paginated listings results */
        <div className="flex flex-col gap-6">
          {/* Responsive Desktop-First Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {organizations.map((org) => (
              <OrganizationCard key={org.organizationId} organization={org} />
            ))}
          </div>

          {/* Pagination Controls */}
          {totalCount > pageSize && (
            <div className="pt-4 border-t border-border/40 w-full select-none mt-4">
              <PaginationWrapper
                page={page}
                totalPages={Math.ceil(totalCount / pageSize)}
                totalItems={totalCount}
                itemsPerPage={pageSize}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
