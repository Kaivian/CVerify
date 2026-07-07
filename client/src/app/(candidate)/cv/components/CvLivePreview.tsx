import React, { useRef, useState, useEffect } from "react";
import { CVPreview } from "./CVPreview";
import { type CvDraftState } from "./types";
import { mapDraftStateToCvProps } from "../utils/cvMapper";

interface CvLivePreviewProps {
  drafts: CvDraftState;
  avatarUrl?: string | null;
  templateId?: string;
}

export const CvLivePreview: React.FC<CvLivePreviewProps> = ({ drafts, templateId, avatarUrl }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [contentHeight, setContentHeight] = useState(1123);

  // Calculate visual scale to fit parent container width
  useEffect(() => {
    if (typeof window === "undefined") return;

    const container = containerRef.current;
    if (!container) return;

    const updateScale = () => {
      const parentWidth = container.clientWidth - 16; // subtracting padding (8px left/right)
      const targetWidth = 794; // Standard A4 width in pixels at 96 DPI
      const scaleX = parentWidth > 0 ? parentWidth / targetWidth : 1;
      setScale(Math.max(0.2, Math.min(1.0, scaleX)));
    };

    updateScale();

    const observer = new ResizeObserver(updateScale);
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  // Track content element height via ResizeObserver (fires reliably after pagination completes)
  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    const observer = new ResizeObserver(() => {
      const height = content.offsetHeight;
      if (height > 0) setContentHeight(height);
    });

    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  const cvProps = mapDraftStateToCvProps(drafts, avatarUrl, templateId);

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
          flexShrink: 0,
        }}
      >
        <div
          ref={contentRef}
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
          <CVPreview {...cvProps} />
        </div>
      </div>
    </div>
  );
};
