'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  DashboardFilterState,
  DEFAULT_DASHBOARD_FILTERS,
  TimeRangePreset,
  EnvironmentFilter,
  AiProviderFilter,
  RegionFilter,
  HealthStatusFilter
} from '../types/admin-dashboard-filter.types';

interface DashboardFilterContextType {
  filters: DashboardFilterState;
  setFilter: <K extends keyof DashboardFilterState>(key: K, value: DashboardFilterState[K]) => void;
  setFilters: (newFilters: Partial<DashboardFilterState>) => void;
  resetFilters: () => void;
  activeFilterCount: number;
  isCustomRange: boolean;
  refreshTrigger: number;
  triggerRefreshAll: () => void;
}

const STORAGE_KEY = 'cverify_admin_dashboard_filters';

const DashboardFilterContext = createContext<DashboardFilterContextType | null>(null);

export function DashboardFilterProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  // Initialize state from URL params > LocalStorage > Defaults
  const [filters, setFiltersState] = useState<DashboardFilterState>(() => {
    if (typeof window === 'undefined') return DEFAULT_DASHBOARD_FILTERS;

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const parsedSaved = saved ? JSON.parse(saved) : {};

      const urlTimeRange = searchParams.get('timeRange') as TimeRangePreset;
      const urlEnv = searchParams.get('environment') as EnvironmentFilter;
      const urlOrg = searchParams.get('org');
      const urlAi = searchParams.get('aiProvider') as AiProviderFilter;
      const urlRegion = searchParams.get('region') as RegionFilter;
      const urlStatus = searchParams.get('status') as HealthStatusFilter;

      return {
        ...DEFAULT_DASHBOARD_FILTERS,
        ...parsedSaved,
        ...(urlTimeRange ? { timeRange: urlTimeRange } : {}),
        ...(urlEnv ? { environment: urlEnv } : {}),
        ...(urlOrg ? { organizationId: urlOrg } : {}),
        ...(urlAi ? { aiProvider: urlAi } : {}),
        ...(urlRegion ? { region: urlRegion } : {}),
        ...(urlStatus ? { status: urlStatus } : {})
      };
    } catch {
      return DEFAULT_DASHBOARD_FILTERS;
    }
  });

  // Sync state to URL and localStorage
  const syncState = useCallback((newState: DashboardFilterState) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
      } catch (e) {
        console.warn('Failed to save filters to localStorage', e);
      }

      const params = new URLSearchParams();
      if (newState.timeRange !== DEFAULT_DASHBOARD_FILTERS.timeRange) params.set('timeRange', newState.timeRange);
      if (newState.environment !== DEFAULT_DASHBOARD_FILTERS.environment) params.set('environment', newState.environment);
      if (newState.organizationId !== DEFAULT_DASHBOARD_FILTERS.organizationId) params.set('org', newState.organizationId);
      if (newState.aiProvider !== DEFAULT_DASHBOARD_FILTERS.aiProvider) params.set('aiProvider', newState.aiProvider);
      if (newState.region !== DEFAULT_DASHBOARD_FILTERS.region) params.set('region', newState.region);
      if (newState.status !== DEFAULT_DASHBOARD_FILTERS.status) params.set('status', newState.status);

      const queryString = params.toString();
      const newUrl = queryString ? `${pathname}?${queryString}` : pathname;
      router.replace(newUrl, { scroll: false });
    }
  }, [pathname, router]);

  const setFilter = useCallback(<K extends keyof DashboardFilterState>(key: K, value: DashboardFilterState[K]) => {
    setFiltersState((prev) => {
      const next = { ...prev, [key]: value };
      syncState(next);
      return next;
    });
  }, [syncState]);

  const setFilters = useCallback((newFilters: Partial<DashboardFilterState>) => {
    setFiltersState((prev) => {
      const next = { ...prev, ...newFilters };
      syncState(next);
      return next;
    });
  }, [syncState]);

  const resetFilters = useCallback(() => {
    setFiltersState(DEFAULT_DASHBOARD_FILTERS);
    syncState(DEFAULT_DASHBOARD_FILTERS);
  }, [syncState]);

  const triggerRefreshAll = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid firing if user is inside an input/textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const filterInput = document.getElementById('admin-filter-bar-search');
        filterInput?.focus();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        triggerRefreshAll();
      } else if (e.key === 'Escape') {
        resetFilters();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [resetFilters, triggerRefreshAll]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.timeRange !== DEFAULT_DASHBOARD_FILTERS.timeRange) count++;
    if (filters.environment !== DEFAULT_DASHBOARD_FILTERS.environment) count++;
    if (filters.organizationId !== DEFAULT_DASHBOARD_FILTERS.organizationId) count++;
    if (filters.aiProvider !== DEFAULT_DASHBOARD_FILTERS.aiProvider) count++;
    if (filters.region !== DEFAULT_DASHBOARD_FILTERS.region) count++;
    if (filters.status !== DEFAULT_DASHBOARD_FILTERS.status) count++;
    return count;
  }, [filters]);

  const isCustomRange = filters.timeRange === 'custom';

  return (
    <DashboardFilterContext.Provider
      value={{
        filters,
        setFilter,
        setFilters,
        resetFilters,
        activeFilterCount,
        isCustomRange,
        refreshTrigger,
        triggerRefreshAll
      }}
    >
      {children}
    </DashboardFilterContext.Provider>
  );
}

export function useDashboardFilters() {
  const context = useContext(DashboardFilterContext);
  if (!context) {
    throw new Error('useDashboardFilters must be used within a DashboardFilterProvider');
  }
  return context;
}
