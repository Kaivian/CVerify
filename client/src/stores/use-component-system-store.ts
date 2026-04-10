"use client";

import { create } from "zustand";

export type ExplorerView =
  | "overview"
  | "atoms"
  | "molecules"
  | "organisms"
  | "templates"
  | "features"
  | "experimental"
  | "deprecated"
  | "graph"
  | "analytics"
  | "settings";

export type PreviewTheme = "light" | "dark" | "high-contrast";
export type PreviewDevice = "desktop" | "tablet" | "mobile";

interface ComponentSystemState {
  activeView: ExplorerView;
  searchQuery: string;
  selectedComponentId: string | null;
  previewTheme: PreviewTheme;
  previewDevice: PreviewDevice;
  cmdKOpen: boolean;
  
  setView: (view: ExplorerView) => void;
  setSearchQuery: (query: string) => void;
  selectComponent: (id: string | null) => void;
  setTheme: (theme: PreviewTheme) => void;
  setDevice: (device: PreviewDevice) => void;
  setCmdKOpen: (open: boolean) => void;
  resetAll: () => void;
}

export const useComponentSystemStore = create<ComponentSystemState>((set) => ({
  activeView: "overview",
  searchQuery: "",
  selectedComponentId: null,
  previewTheme: "dark",
  previewDevice: "desktop",
  cmdKOpen: false,

  setView: (view) => set({ activeView: view }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  selectComponent: (id) => set({ selectedComponentId: id }),
  setTheme: (theme) => set({ previewTheme: theme }),
  setDevice: (device) => set({ previewDevice: device }),
  setCmdKOpen: (open) => set({ cmdKOpen: open }),

  resetAll: () =>
    set({
      activeView: "overview",
      searchQuery: "",
      selectedComponentId: null,
      previewTheme: "dark",
      previewDevice: "desktop",
      cmdKOpen: false,
    }),
}));
