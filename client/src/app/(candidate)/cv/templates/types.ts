import type React from "react";

export type LayoutStyle = "single-column" | "two-column-left" | "two-column-right";

export interface TemplateBlockProps {
  data: Record<string, any>;
  themeColor?: string;
  avatarUrl?: string | null;
  blockId?: string;
}

export interface TemplateLayoutConfig {
  layoutStyle: LayoutStyle;
  sidebarWidth?: number; // width in px (e.g. 260)
  mainWidth?: number;    // width in px (e.g. 480)
  gapWidth?: number;     // gap between columns in px (e.g. 14)
  blockGap?: number;     // vertical gap between blocks in px (default: 12)
  fullWidthTop?: string[]; // prefixes that are full-width at the top (e.g., ["header"])
  columnMapping: {
    sidebar: string[]; // block prefixes that go to sidebar
    main: string[];    // block prefixes that go to main content
  };
}

export interface CvTemplate {
  id: string;
  name: string;
  version: number;
  className: string;
  layout: TemplateLayoutConfig;
  overrides?: {
    header?: React.FC<TemplateBlockProps>;
    contact?: React.FC<TemplateBlockProps>;
    "section-title"?: React.FC<TemplateBlockProps>;
    paragraph?: React.FC<TemplateBlockProps>;
    "bullet-point"?: React.FC<TemplateBlockProps>;
    "entry-header"?: React.FC<TemplateBlockProps>;
    "tech-list"?: React.FC<TemplateBlockProps>;
    "preferences-grid"?: React.FC<TemplateBlockProps>;
  };
}
