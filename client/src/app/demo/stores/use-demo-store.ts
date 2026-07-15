import { create } from "zustand";
import { DEMO_SECTIONS, DemoTransitionType, type SceneMetadata } from "../config";

export type SceneLifecycleState =
  | "beforeEnter"
  | "entering"
  | "active"
  | "beforeExit"
  | "exiting"
  | "destroy";

interface DemoState {
  currentSectionIndex: number;
  navigationDirection: "next" | "prev" | "none";
  transitionState: SceneLifecycleState;
  
  // Sub-stage tracking (for sections that have internal steps)
  subStage: number;
  totalSubStages: number;
  
  // Actions
  setSectionIndex: (index: number) => void;
  nextSection: () => void;
  prevSection: () => void;
  setTransitionState: (state: SceneLifecycleState) => void;
  syncFromUrl: () => void;
  setSubStage: (stage: number, total?: number) => void;
  
  // Helpers
  getCurrentMetadata: () => SceneMetadata;
}

// Client-side asset preloading helper
const preloadAssets = (urls: string[]) => {
  if (typeof window === "undefined") return;
  urls.forEach((url) => {
    try {
      if (url.endsWith(".mp4") || url.endsWith(".webm") || url.endsWith(".ogv")) {
        const video = document.createElement("video");
        video.src = url;
        video.preload = "auto";
      } else {
        const img = new Image();
        img.src = url;
      }
    } catch (err) {
      console.warn(`[Demo Preloader] Failed to preload asset: ${url}`, err);
    }
  });
};

const preloadAdjacent = (currentIndex: number) => {
  const adjacentIndices = [currentIndex - 1, currentIndex + 1];
  adjacentIndices.forEach((idx) => {
    if (idx >= 0 && idx < DEMO_SECTIONS.length) {
      const metadata = DEMO_SECTIONS[idx].metadata;
      if (metadata.assetsToPreload && metadata.assetsToPreload.length > 0) {
        preloadAssets(metadata.assetsToPreload);
      }
    }
  });
};

// URL synchronizer (using window.history on client)
const updateUrlSearchParam = (sceneId: string) => {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("scene", sceneId);
  window.history.pushState({ path: url.toString() }, "", url.toString());
};

export const useDemoStore = create<DemoState>((set, get) => ({
  currentSectionIndex: 0,
  navigationDirection: "none",
  transitionState: "beforeEnter",
  subStage: 0,
  totalSubStages: 0,

  getCurrentMetadata: () => {
    const { currentSectionIndex } = get();
    return DEMO_SECTIONS[currentSectionIndex]?.metadata || DEMO_SECTIONS[0].metadata;
  },

  setSectionIndex: (index: number) => {
    const { currentSectionIndex, transitionState } = get();
    
    // Lock transitions during active animation states
    if (transitionState === "entering" || transitionState === "exiting") {
      return;
    }

    if (index < 0 || index >= DEMO_SECTIONS.length) return;
    if (index === currentSectionIndex) return;

    const direction = index > currentSectionIndex ? "next" : "prev";
    const nextSceneMetadata = DEMO_SECTIONS[index].metadata;

    set({
      currentSectionIndex: index,
      navigationDirection: direction,
      transitionState: "exiting",
    });

    // Trigger URL Sync
    updateUrlSearchParam(nextSceneMetadata.id);

    // Trigger preloads for next adjacent nodes
    preloadAdjacent(index);
  },

  nextSection: () => {
    const { currentSectionIndex, subStage, totalSubStages } = get();
    if (totalSubStages > 1 && subStage < totalSubStages - 1) {
      set({ subStage: subStage + 1 });
      return;
    }
    get().setSectionIndex(currentSectionIndex + 1);
  },

  prevSection: () => {
    const { currentSectionIndex, subStage, totalSubStages } = get();
    if (totalSubStages > 1 && subStage > 0) {
      set({ subStage: subStage - 1 });
      return;
    }
    const currentMetadata = get().getCurrentMetadata();

    // Check allowBack constraint
    if (currentMetadata.allowBack === false) {
      return;
    }

    get().setSectionIndex(currentSectionIndex - 1);
  },

  setTransitionState: (state: SceneLifecycleState) => {
    set({ transitionState: state });
  },

  setSubStage: (stage: number, total?: number) => {
    const updates: Partial<DemoState> = { subStage: stage };
    if (total !== undefined) {
      updates.totalSubStages = total;
    }
    set(updates);
  },

  syncFromUrl: () => {
    if (typeof window === "undefined") return;
    const urlParams = new URLSearchParams(window.location.search);
    const sceneId = urlParams.get("scene");
    
    if (!sceneId) {
      // Set initial URL if not present
      const initialScene = DEMO_SECTIONS[0].metadata.id;
      updateUrlSearchParam(initialScene);
      return;
    }

    const matchedIndex = DEMO_SECTIONS.findIndex(
      (section) => section.metadata.id === sceneId
    );

    if (matchedIndex !== -1 && matchedIndex !== get().currentSectionIndex) {
      set({
        currentSectionIndex: matchedIndex,
        navigationDirection: matchedIndex > get().currentSectionIndex ? "next" : "prev",
        transitionState: "beforeEnter",
      });
      preloadAdjacent(matchedIndex);
    }
  },
}));
