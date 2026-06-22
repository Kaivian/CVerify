"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { workspaceService } from "../../../../features/workspace/services/workspace.service";
import { type OrganizationListItem, type OrganizationStats } from "../../../../features/workspace/types/workspace.types";
import { OrganizationCard } from "./_components/organization-card";
import { PaginationWrapper } from "@/components/ui/pagination-wrapper";
import { Card } from "@/components/ui/card";
import { Input, Button, Spinner, Chip } from "@heroui/react";
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
  Award
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
    setSearch(searchParams.get("q") || "");
    setLocation(searchParams.get("loc") || "");
    setIndustry(searchParams.get("ind") || "");
    setCompanySize(searchParams.get("size") || "");
    setVerifiedFilter(searchParams.get("verified") || "all");
    setSortBy(searchParams.get("sort") || "recently_updated");
    
    const pageVal = parseInt(searchParams.get("page") || "1", 10);
    setPage(isNaN(pageVal) || pageVal < 1 ? 1 : pageVal);
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
    fetchStats();
    fetchFeatured();
  }, [fetchStats, fetchFeatured]);

  // Refetch organizations list when URL parameters change
  useEffect(() => {
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

  return (
    <div className="flex flex-col gap-6 w-full select-none pb-8 text-foreground bg-background">
      {/* Page Title & Context */}
      <div className="flex flex-col gap-1 text-left">
        <h1 className="text-2xl font-extrabold tracking-tight font-outfit text-foreground" id="page-title">
          Ecosystem Directory
        </h1>
        <p className="text-muted text-xs leading-relaxed max-w-2xl">
          Search and discover verified partner enterprises, developer organizations, and talent hubs participating in the CVerify trust ecosystem.
        </p>
      </div>

      {/* Ecosystem Statistics Grid */}
      {statsLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-surface-secondary/40 border border-border/30 animate-pulse" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 select-none">
          <Card glow={false} className="p-4 bg-surface border border-border/60 rounded-xl shadow-xs text-left">
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider block">Total Partners</span>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-xl font-black text-foreground font-outfit">{stats.totalOrganizations}</span>
              <Building2 className="size-4 text-muted/70 ml-auto" />
            </div>
          </Card>

          <Card glow={false} className="p-4 bg-surface border border-border/60 rounded-xl shadow-xs text-left">
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider block">Verified Companies</span>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-xl font-black text-foreground font-outfit">{stats.verifiedOrganizations}</span>
              <div className="flex items-center gap-1.5 ml-auto">
                <Chip size="sm" variant="soft" color="success" className="h-5 px-1.5 text-[9px] font-extrabold">
                  {stats.totalOrganizations > 0 
                    ? `${((stats.verifiedOrganizations / stats.totalOrganizations) * 100).toFixed(0)}%`
                    : "0%"
                  }
                </Chip>
                <Award className="size-4 text-success" />
              </div>
            </div>
          </Card>

          <Card glow={false} className="p-4 bg-surface border border-border/60 rounded-xl shadow-xs text-left">
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider block">Open Positions</span>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-xl font-black text-foreground font-outfit">{stats.openOpportunities}</span>
              <Briefcase className="size-4 text-accent ml-auto" />
            </div>
          </Card>

          <Card glow={false} className="p-4 bg-surface border border-border/60 rounded-xl shadow-xs text-left">
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider block">Verified Repos</span>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-xl font-black text-foreground font-outfit">{stats.verifiedRepositories}</span>
              <GitFork className="size-4 text-muted/70 ml-auto" />
            </div>
          </Card>

          <Card glow={false} className="p-4 bg-surface border border-border/60 rounded-xl shadow-xs text-left">
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider block">Active Engineers</span>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-xl font-black text-foreground font-outfit">{stats.totalMembers}</span>
              <Users className="size-4 text-muted/70 ml-auto" />
            </div>
          </Card>
        </div>
      ) : null}

      {/* Discovery Layer: Featured / Trending Organizations */}
      {!featuredLoading && featuredOrgs.length > 0 && (
        <div className="flex flex-col gap-3 text-left">
          <div className="flex items-center gap-1.5 select-none">
            <Sparkles className="size-4 text-accent" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted">Featured Partners</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {featuredOrgs.slice(0, 4).map((org) => (
              <OrganizationCard key={org.organizationId} organization={org} />
            ))}
          </div>
        </div>
      )}

      {/* Filter / Search Dashboard Control Panel */}
      <Card glow={false} className="w-full bg-surface border border-border/60 rounded-xl p-4 shadow-xs select-none">
        <form onSubmit={handleSearchSubmit} className="flex flex-col lg:flex-row items-end gap-4 w-full">
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 w-full">
            <div className="flex flex-col text-left">
              <label htmlFor="search-orgs" className="text-[9px] font-bold uppercase tracking-wider text-muted mb-1 block">Keywords</label>
              <div className="relative flex items-center w-full">
                <Search className="absolute left-3.5 size-4 text-muted/70 pointer-events-none z-10" />
                <Input
                  id="search-orgs"
                  placeholder="Company name, tag..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-border text-xs outline-hidden font-medium bg-field text-foreground placeholder-field-placeholder"
                />
              </div>
            </div>

            <div className="flex flex-col text-left">
              <label htmlFor="search-location" className="text-[9px] font-bold uppercase tracking-wider text-muted mb-1 block">Location</label>
              <div className="relative flex items-center w-full">
                <MapPin className="absolute left-3.5 size-4 text-muted/70 pointer-events-none z-10" />
                <Input
                  id="search-location"
                  placeholder="City name..."
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-border text-xs outline-hidden font-medium bg-field text-foreground placeholder-field-placeholder"
                />
              </div>
            </div>

            <div className="flex flex-col text-left">
              <label htmlFor="search-industry" className="text-[9px] font-bold uppercase tracking-wider text-muted mb-1 block">Industry</label>
              <select
                id="search-industry"
                value={industry}
                onChange={(e) => handleFilterChange("industry", e.target.value)}
                className="w-full bg-field-background border border-border rounded-xl px-3 py-2 text-xs font-semibold text-foreground outline-hidden focus:border-focus h-[40px] cursor-pointer"
              >
                <option value="">All Industries</option>
                <option value="Software">Software</option>
                <option value="AI">AI / Machine Learning</option>
                <option value="Fintech">Fintech</option>
                <option value="Healthtech">Healthtech</option>
                <option value="Cloud Computing">Cloud Computing</option>
                <option value="Web3">Web3 / Blockchain</option>
                <option value="E-commerce">E-commerce</option>
              </select>
            </div>

            <div className="flex flex-col text-left">
              <label htmlFor="search-size" className="text-[9px] font-bold uppercase tracking-wider text-muted mb-1 block">Company Size</label>
              <select
                id="search-size"
                value={companySize}
                onChange={(e) => handleFilterChange("companySize", e.target.value)}
                className="w-full bg-field-background border border-border rounded-xl px-3 py-2 text-xs font-semibold text-foreground outline-hidden focus:border-focus h-[40px] cursor-pointer"
              >
                <option value="">All Sizes</option>
                <option value="1-10">1 - 10 Employees</option>
                <option value="11-50">11 - 50 Employees</option>
                <option value="51-200">51 - 200 Employees</option>
                <option value="201-500">201 - 500 Employees</option>
                <option value="501-1000">501 - 1000 Employees</option>
                <option value="1000+">1000+ Employees</option>
              </select>
            </div>

            <div className="flex flex-col text-left">
              <label htmlFor="search-verified" className="text-[9px] font-bold uppercase tracking-wider text-muted mb-1 block">Verification</label>
              <select
                id="search-verified"
                value={verifiedFilter}
                onChange={(e) => handleFilterChange("verified", e.target.value)}
                className="w-full bg-field-background border border-border rounded-xl px-3 py-2 text-xs font-semibold text-foreground outline-hidden focus:border-focus h-[40px] cursor-pointer"
              >
                <option value="all">All Partners</option>
                <option value="verified">Verified Only</option>
                <option value="unverified">Unverified Only</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full lg:w-auto shrink-0 mt-4 lg:mt-0 lg:h-10 self-end">
            <select
              value={sortBy}
              aria-label="Sort options select"
              onChange={(e) => handleFilterChange("sort", e.target.value)}
              className="bg-field-background border border-border rounded-xl px-3 py-2 text-xs font-semibold text-foreground outline-hidden focus:border-focus h-[40px] cursor-pointer flex-1 lg:flex-none lg:w-44"
            >
              <option value="recently_updated">Recently Active</option>
              <option value="recently_created">Recently Added</option>
              <option value="alphabetical_asc">Alphabetical (A-Z)</option>
              <option value="alphabetical_desc">Alphabetical (Z-A)</option>
              <option value="most_engineers">Verified Engineers</option>
              <option value="most_repositories">Synced Repositories</option>
              <option value="most_jobs">Active Roles</option>
            </select>

            <Button type="submit" className="bg-accent text-accent-foreground font-bold rounded-xl px-5 h-10 text-xs cursor-pointer hover:opacity-90 flex-1 lg:flex-none">
              Apply
            </Button>
            <Button variant="ghost" className="font-semibold text-muted rounded-xl px-3 h-10 text-xs cursor-pointer hover:bg-surface-secondary flex-1 lg:flex-none min-w-0" onClick={handleResetFilters}>
              <RotateCcw className="size-3.5" />
            </Button>
          </div>
        </form>
      </Card>

      {/* Main Grid View */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 select-none">
          <Spinner size="md" color="warning" />
          <span className="text-muted text-xs mt-2 font-medium">Loading ecosystem partners...</span>
        </div>
      ) : error ? (
        <Card glow={false} className="border border-danger/20 bg-danger-foreground/20 rounded-xl p-8 text-center select-none">
          <span className="text-danger font-semibold text-sm block mb-1">Ecosystem directory loading failed</span>
          <span className="text-muted text-xs block mb-4">{error}</span>
          <Button variant="ghost" className="text-danger border border-danger/40 rounded-xl px-5 py-2 text-xs cursor-pointer font-bold mx-auto block" onClick={fetchOrganizations}>
            Retry Fetch
          </Button>
        </Card>
      ) : organizations.length === 0 ? (
        /* Empty State with Fallback Suggestions Grid */
        <div className="flex flex-col gap-8 w-full select-none text-center py-12">
          <div className="max-w-md mx-auto py-8">
            <Building2 size={44} className="text-muted mx-auto mb-3" />
            <h3 className="font-bold text-base text-foreground mb-1">No Partners Found</h3>
            <p className="text-muted text-xs leading-relaxed mb-4">
              We couldn't find any ecosystem organizations matching your search criteria. Try expanding your filters or clearing keywords.
            </p>
            <Button size="sm" className="bg-accent text-accent-foreground font-bold rounded-xl px-4 py-2 text-xs cursor-pointer mx-auto" onClick={handleResetFilters}>
              Reset Filters
            </Button>
          </div>

          {featuredOrgs.length > 0 && (
            <div className="flex flex-col gap-3 text-left border-t border-border/40 pt-8">
              <div className="flex items-center gap-1.5 select-none">
                <TrendingUp className="size-4 text-success" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted">Recommended Suggestions</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {featuredOrgs.slice(0, 4).map((org) => (
                  <OrganizationCard key={org.organizationId} organization={org} />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Standard paginated listings results */
        <div className="flex flex-col gap-6">
          {/* Responsive Desktop-First Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {organizations.map((org) => (
              <OrganizationCard key={org.organizationId} organization={org} />
            ))}
          </div>

          {/* Pagination Controls */}
          {totalCount > pageSize && (
            <div className="pt-4 border-t border-border/40 w-full select-none">
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
