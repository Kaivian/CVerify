import React, { useRef, useState, useEffect } from "react";
import { CVPreview } from "./CVPreview";
import { type CvDraftState } from "./types";

interface CvLivePreviewProps {
  drafts: CvDraftState;
  avatarUrl?: string | null;
}

export const CvLivePreview: React.FC<CvLivePreviewProps> = ({ drafts }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [contentHeight, setContentHeight] = useState(1123);

  // Handle dynamic visual scaling to fit parent container width and height compensation
  useEffect(() => {
    if (typeof window === "undefined") return;

    const container = containerRef.current;
    const preview = previewRef.current;
    if (!container || !preview) return;

    const updateLayout = () => {
      const parentWidth = container.clientWidth - 16; // subtracting padding (8px left/right)
      const targetWidth = 794; // Standard A4 width in pixels at 96 DPI

      // Calculate scale to fit the width of the container, allowing vertical scrolling
      const scaleX = parentWidth > 0 ? parentWidth / targetWidth : 1;

      // Clamp scale to reasonable limits (max 1.0 to prevent upscaling blur)
      const clampedScale = Math.max(0.2, Math.min(1.0, scaleX));
      setScale(clampedScale);

      // Measure the inner print area (unclipped in-flow container) instead of the absolute box
      const printArea = preview.querySelector(".cv-print-area") as HTMLElement | null;
      const targetHeight = printArea
        ? (printArea.scrollHeight || printArea.offsetHeight || 1123)
        : (preview.scrollHeight || preview.offsetHeight || 1123);

      setContentHeight(targetHeight);
    };

    updateLayout();

    // ResizeObserver to track container width and preview height changes
    const observer = new ResizeObserver(() => {
      updateLayout();
    });

    observer.observe(container);
    observer.observe(preview);

    // Observe DOM mutations (like pagination updates) to reliably re-measure height
    const mutationObserver = new MutationObserver(() => {
      updateLayout();
    });
    mutationObserver.observe(preview, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
    };
  }, [drafts]);

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
      className="flex-1 w-full rounded-xl overflow-y-auto overflow-x-hidden flex flex-col items-center justify-start relative cv-preview-container"
      style={{ minHeight: "400px" }}
    >
      <div
        className="cv-preview-wrapper"
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
          className="cv-preview-scaler"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            width: "794px",
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
            projects={drafts["projects"]}
          />
        </div>
      </div>
    </div>
  );
};
