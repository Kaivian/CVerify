import dynamic from "next/dynamic";
import { type ComponentType } from "react";

export type DemoTransitionType = "fade" | "slide-x" | "slide-y" | "scale" | "blur" | "none";
export type DemoThemeType = "light" | "dark" | "system";

export interface DemoPhase {
  id: string;
  label: string;
}

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
  phases: DemoPhase[]; // Centralized list of phases
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
      phases: [
        { id: "logo", label: "Welcome & Logo" },
        { id: "intro", label: "Attestation Concept" },
        { id: "login", label: "Secure Gateway Login" }
      ],
      assetsToPreload: [
        "/brand/logo.png",
        "/brand/logo-white.png",
        "/brand/logo&name-white.png",
        "/brand/logo&name-black.png",
      ], // Add path/URLs to preload if any
    },
    component: dynamic(() => import("./sections/Section01"), {
      ssr: false,
    }),
  },
  {
    metadata: {
      id: "connect-sources",
      title: "Connect Source Providers",
      description: "Link your GitHub and GitLab accounts to import contributions.",
      transition: "fade",
      background: "bg-background",
      theme: "light",
      showNavigation: true,
      showProgress: true,
      phases: [
        { id: "dashboard", label: "Developer Dashboard" },
        { id: "oauth", label: "GitHub Authentication" }
      ],
    },
    component: dynamic(() => import("./sections/Section02"), {
      ssr: false,
    }),
  },
  {
    metadata: {
      id: "indexing-repositories",
      title: "Indexing Repositories",
      description: "CVerify analyzes your contribution history and generates cryptographic proofs.",
      transition: "fade",
      background: "bg-background",
      theme: "light",
      showNavigation: true,
      showProgress: true,
      phases: [
        { id: "sync-repo", label: "Sync Repositories" },
        { id: "show-repos", label: "Select Repositories" },
        { id: "analyze", label: "Cryptographic Indexing" },
        { id: "link-cv", label: "Integrate to Profile" }
      ],
    },
    component: dynamic(() => import("./sections/Section03"), {
      ssr: false,
    }),
  },
  {
    metadata: {
      id: "profile-integration",
      title: "Profile Integration",
      description: "Link your verified contributions and cryptographic proofs directly to your CV.",
      transition: "fade",
      background: "bg-background",
      theme: "light",
      showNavigation: true,
      showProgress: true,
      phases: [
        { id: "fill-cv", label: "Autofill Profile" },
        { id: "add-repo", label: "Link Verified Repository" },
        { id: "analyze-cv", label: "Verify & Analyze CV" }
      ],
    },
    component: dynamic(() => import("./sections/Section04"), {
      ssr: false,
    }),
  },
  {
    metadata: {
      id: "ai-matching",
      title: "AI Matcher",
      description: "CVerify AI analyzes your verified history and matches you to roles.",
      transition: "fade",
      background: "bg-background",
      theme: "light",
      showNavigation: true,
      showProgress: true,
      phases: [
        { id: "ai-match", label: "AI Role Compatibility" },
        { id: "apply", label: "Submit Application" }
      ],
    },
    component: dynamic(() => import("./sections/Section05"), {
      ssr: false,
    }),
  },
];

