import React, { useRef, useState, useEffect } from "react";
import { CVPreview } from "./CVPreview";
import { type CvDraftState } from "./types";
import { sourceCodeProviderApi } from "@/services/source-code-provider.service";
import { type SourceCodeRepository } from "@/types/source-code-provider.types";

interface CvLivePreviewProps {
  drafts: CvDraftState;
  avatarUrl?: string | null;
}

export const CvLivePreview: React.FC<CvLivePreviewProps> = ({ drafts }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [contentHeight, setContentHeight] = useState(1123);
  const [repositories, setRepositories] = useState<SourceCodeRepository[]>([]);

  // Fetch user's verified repositories to display as projects
  useEffect(() => {
    let active = true;
    const fetchRepos = async () => {
      try {
        const result = await sourceCodeProviderApi.fetchRepositories({
          page: 1,
          pageSize: 100,
        });
        if (active) {
          // Filter to only display repositories that are verified or analyzed successfully
          const verifiedRepos = result.items.filter(r => r.isVerified || r.latestAnalysisStatus === "Completed");
          setRepositories(verifiedRepos);
        }
      } catch (err) {
        console.error("Failed to load repositories for live preview:", err);
      }
    };
    fetchRepos();
    return () => {
      active = false;
    };
  }, []);

  // Handle dynamic visual scaling to fit parent container width and height compensation
  useEffect(() => {
    if (typeof window === "undefined") return;

    const container = containerRef.current;
    const preview = previewRef.current;
    if (!container || !preview) return;

    const updateLayout = () => {
      const parentWidth = container.clientWidth - 32; // subtracting padding (16px left/right)
      const targetWidth = 794; // Standard A4 width in pixels at 96 DPI
      
      let computedScale = 1;
      if (parentWidth > 0) {
        computedScale = parentWidth / targetWidth;
      }
      
      // Clamp scale between 0.45 and 0.75
      const clampedScale = Math.max(0.45, Math.min(0.75, computedScale));
      setScale(clampedScale);

      // Measure raw unscaled height of the preview content
      const height = preview.scrollHeight || preview.offsetHeight || 1123;
      setContentHeight(height);
    };

    updateLayout();

    // ResizeObserver to track container width and preview height changes
    const observer = new ResizeObserver(() => {
      updateLayout();
    });

    observer.observe(container);
    observer.observe(preview);

    return () => {
      observer.disconnect();
    };
  }, [drafts, repositories]);

  const basic = drafts["basic-info"];
  const summary = drafts["career-summary"];
  const skills = drafts["skills"];
  const experience = drafts["experience"];
  const education = drafts["education"];
  const achievements = drafts["achievements"];
  const preferences = drafts["preferences"];

  return (
    <div
      ref={containerRef}
      className="flex-1 w-full bg-neutral-100 rounded-xl border border-border/40 overflow-y-auto overflow-x-hidden flex flex-col items-center justify-start p-4 relative"
      style={{ minHeight: "400px" }}
    >
      <div
        ref={previewRef}
        className="origin-top"
        style={{
          transform: `scale(${scale})`,
          width: "794px",
          minHeight: `${contentHeight}px`,
          marginBottom: `${-contentHeight * (1 - scale)}px`, // collapses vertical empty space caused by scaling
        }}
      >
        <CVPreview
          basic={basic}
          summary={summary}
          skills={skills}
          experience={experience}
          education={education}
          achievements={achievements}
          preferences={preferences}
          projects={repositories}
        />
      </div>
    </div>
  );
};
