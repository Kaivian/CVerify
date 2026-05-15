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
      const parentWidth = container.clientWidth - 16; // subtracting padding (8px left/right)
      const parentHeight = container.clientHeight - 16; // subtracting padding (8px top/bottom)
      const targetWidth = 794; // Standard A4 width in pixels at 96 DPI
      const targetHeight = 1123; // Standard A4 height in pixels at 96 DPI

      // Calculate scale to fit the width of the container, allowing vertical scrolling
      const scaleX = parentWidth > 0 ? parentWidth / targetWidth : 1;

      // Clamp scale to reasonable limits (max 1.0 to prevent upscaling blur)
      const clampedScale = Math.max(0.2, Math.min(1.0, scaleX));
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
  const summary = { bio: drafts["basic-info"].bio };
  const skills = drafts["skills"];
  const experience = drafts["experience"];
  const education = drafts["education"];
  const achievements = drafts["achievements"];
  const preferences = drafts["preferences"];

  return (
    <div
      ref={containerRef}
      className="flex-1 w-full rounded-xl overflow-y-auto overflow-x-hidden flex flex-col items-center justify-start relative"
      style={{ minHeight: "400px" }}
    >
      <div
        style={{
          width: `${794 * scale}px`,
          height: `${contentHeight * scale}px`,
          position: "relative",
          display: "flex",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <div
          ref={previewRef}
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            width: "794px",
            minHeight: `${contentHeight}px`,
            position: "absolute",
            left: 0,
            top: 0,
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
    </div>
  );
};
