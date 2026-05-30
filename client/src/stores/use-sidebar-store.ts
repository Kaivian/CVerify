"use client";

import { create } from 'zustand';

interface SidebarState {
  isCollapsed: boolean;
  isMobileOpen: boolean;
  expandedGroups: Record<string, boolean>;
  toggleCollapsed: () => void;
  setMobileOpen: (open: boolean) => void;
  toggleGroup: (id: string) => void;
  setGroupExpanded: (id: string, expanded: boolean) => void;
  resetMobile: () => void;
  initializeCollapsed: () => void;
}

export const useSidebarStore = create<SidebarState>((set) => ({
  isCollapsed: false,
  isMobileOpen: false,
  expandedGroups: {},
  
  toggleCollapsed: () =>
    set((state) => {
      const nextCollapsed = !state.isCollapsed;
      if (typeof window !== 'undefined') {
        localStorage.setItem('sidebar_collapsed', String(nextCollapsed));
      }
      return { isCollapsed: nextCollapsed };
    }),
  
  setMobileOpen: (open) => set({ isMobileOpen: open }),
  
  toggleGroup: (id) =>
    set((state) => {
      const nextExpanded = {
        ...state.expandedGroups,
        [id]: !state.expandedGroups[id],
      };
      if (typeof window !== "undefined") {
        localStorage.setItem("sidebar_expanded_groups", JSON.stringify(nextExpanded));
      }
      return { expandedGroups: nextExpanded };
    }),
    
  setGroupExpanded: (id, expanded) =>
    set((state) => {
      const nextExpanded = {
        ...state.expandedGroups,
        [id]: expanded,
      };
      if (typeof window !== "undefined") {
        localStorage.setItem("sidebar_expanded_groups", JSON.stringify(nextExpanded));
      }
      return { expandedGroups: nextExpanded };
    }),
    
  resetMobile: () => set({ isMobileOpen: false }),

  initializeCollapsed: () => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("sidebar_collapsed");
    if (stored !== null) {
      set({ isCollapsed: stored === "true" });
    }
    const storedExpanded = localStorage.getItem("sidebar_expanded_groups");
    if (storedExpanded !== null) {
      try {
        set({ expandedGroups: JSON.parse(storedExpanded) });
      } catch (_error) {
        // Ignore JSON parse errors
      }
    }
  },
}));
