import dynamic from "next/dynamic";
import { ComponentType } from "react";

export type DemoTransitionType = "fade" | "slide-x" | "slide-y" | "scale" | "blur" | "none";
export type DemoThemeType = "light" | "dark" | "system";

export interface SceneMetadata {
  id: string;
  title: string;
  description?: string;
  transition?: DemoTransitionType;
  background?: string; // Tailwind bg class (e.g., 'bg-background', 'bg-surface')
  theme?: DemoThemeType;
  preload?: boolean; // Eager preloading indicator
  allowBack?: boolean; // Can user step back from this slide? Default: true
  showNavigation?: boolean; // Show navigation controls? Default: true
  showProgress?: boolean; // Show progress indicators? Default: true
  assetsToPreload?: string[]; // Media or assets required by this scene
}

export interface DemoSection {
  metadata: SceneMetadata;
  component: ComponentType<any>;
}

export const DEMO_SECTIONS: DemoSection[] = [
  {
    metadata: {
      id: "welcome",
      title: "Welcome to CVerify",
      description: "Experience absolute technical truth and instant verification.",
      transition: "fade",
      background: "bg-background",
      theme: "light",
      preload: true,
      allowBack: false,
      showNavigation: true,
      showProgress: true,
      assetsToPreload: [], // Add path/URLs to preload if any
    },
    component: dynamic(() => import("./sections/Section01"), {
      ssr: false,
    }),
  },
];
