"use client";

import { create } from 'zustand';

interface SidebarState {
  currentPortal: string | null;
  isCollapsed: boolean;
  isMobileOpen: boolean;
  expandedGroups: Record<string, boolean>;
  toggleCollapsed: () => void;
  setMobileOpen: (open: boolean) => void;
  toggleGroup: (id: string) => void;
  setGroupExpanded: (id: string, expanded: boolean) => void;
  resetMobile: () => void;
  initializeCollapsed: () => void;
  switchPortal: (nextPortal: string) => void;
}

export const useSidebarStore = create<SidebarState>((set) => ({
  currentPortal: null,
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
        const portal = state.currentPortal || "candidate";
        localStorage.setItem(`sidebar_expanded_groups_${portal}`, JSON.stringify(nextExpanded));
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
        const portal = state.currentPortal || "candidate";
        localStorage.setItem(`sidebar_expanded_groups_${portal}`, JSON.stringify(nextExpanded));
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
  },

  switchPortal: (nextPortal: string) => {
    set((state) => {
      const prevPortal = state.currentPortal;
      if (prevPortal === nextPortal) return {};

      // 1. Persist the current expanded groups for the old portal
      if (prevPortal && typeof window !== "undefined") {
        localStorage.setItem(
          `sidebar_expanded_groups_${prevPortal}`,
          JSON.stringify(state.expandedGroups)
        );
      }

      // 2. Load the expanded groups for the new portal
      let nextExpanded = {};
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem(`sidebar_expanded_groups_${nextPortal}`);
        if (stored) {
          try {
            nextExpanded = JSON.parse(stored);
          } catch (_) {}
        }
      }

      return {
        currentPortal: nextPortal,
        expandedGroups: nextExpanded,
      };
    });
  },
}));
