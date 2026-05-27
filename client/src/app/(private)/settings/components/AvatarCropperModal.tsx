"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button, Slider } from "@heroui/react";
import { ZoomIn, ZoomOut, Move } from "lucide-react";
import { DialogModal } from "@/components/ui/dialog-modal";

interface AvatarCropperModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  imageSrc: string | null;
  onCropComplete: (croppedBlob: Blob) => void;
  onCancel: () => void;
}

export const AvatarCropperModal: React.FC<AvatarCropperModalProps> = ({
  isOpen,
  onOpenChange,
  imageSrc,
  onCropComplete,
  onCancel,
}) => {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isWide, setIsWide] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const cropCircleRef = useRef<HTMLDivElement | null>(null);
  const dragStart = useRef({ x: 0, y: 0 });

  // Handle Drag Start
  const handleStart = (clientX: number, clientY: number) => {
    setIsDragging(true);
    dragStart.current = { x: clientX - offset.x, y: clientY - offset.y };
  };

  // Handle Drag Move
  const handleMove = (clientX: number, clientY: number) => {
    if (!isDragging) return;
    setOffset({
      x: clientX - dragStart.current.x,
      y: clientY - dragStart.current.y,
    });
  };

  // Handle Drag End
  const handleEnd = () => {
    setIsDragging(false);
  };

  // Mouse Interaction Handlers
  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleStart(e.clientX, e.clientY);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    handleMove(e.clientX, e.clientY);
  };

  const onMouseUp = () => {
    handleEnd();
  };

  // Touch Interaction Handlers
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      handleStart(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      handleMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const onTouchEnd = () => {
    handleEnd();
  };

  // Trackpad / Scroll Wheel Zooming
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomStep = 0.05;
    const direction = e.deltaY > 0 ? -1 : 1;
    const newZoom = Math.min(Math.max(zoom + direction * zoomStep, 1), 3);
    setZoom(newZoom);
  };

  // Image Load: Calculate aspect ratio to fit the viewport perfectly
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    setIsWide(naturalWidth > naturalHeight);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  // Keyboard accessibility for adjustments
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const step = e.shiftKey ? 20 : 5;
      const zoomStep = 0.1;

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          setOffset((prev) => ({ ...prev, x: prev.x - step }));
          break;
        case "ArrowRight":
          e.preventDefault();
          setOffset((prev) => ({ ...prev, x: prev.x + step }));
          break;
        case "ArrowUp":
          e.preventDefault();
          setOffset((prev) => ({ ...prev, y: prev.y - step }));
          break;
        case "ArrowDown":
          e.preventDefault();
          setOffset((prev) => ({ ...prev, y: prev.y + step }));
          break;
        case "=":
        case "+":
          e.preventDefault();
          setZoom((z) => Math.min(z + zoomStep, 3));
          break;
        case "-":
        case "_":
          e.preventDefault();
          setZoom((z) => Math.max(z - zoomStep, 1));
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Export cropped area via hidden HTML5 Canvas
  const handleCrop = () => {
    const img = imgRef.current;
    const cropCircle = cropCircleRef.current;
    if (!img || !cropCircle) return;

    setIsGenerating(true);

    // Bounding dimensions in standard browser layout
    const imgRect = img.getBoundingClientRect();
    const cropRect = cropCircle.getBoundingClientRect();

    // Visual relative offsets of image top-left to crop circular spotlight
    const relX = imgRect.left - cropRect.left;
    const relY = imgRect.top - cropRect.top;

    // Define export quality dimensions (standard high-definition square profile)
    const targetSize = 400;
    const factor = targetSize / cropRect.width;

    const canvas = document.createElement("canvas");
    canvas.width = targetSize;
    canvas.height = targetSize;
    const ctx = canvas.getContext("2d");

    if (ctx) {
      ctx.clearRect(0, 0, targetSize, targetSize);

      // Perform physical canvas image projection based on browser coordinate mapping
      ctx.drawImage(
        img,
        relX * factor,
        relY * factor,
        imgRect.width * factor,
        imgRect.height * factor
      );

      // Compress and export as high-quality optimized JPEG Blob
      canvas.toBlob(
        (blob) => {
          setIsGenerating(false);
          if (blob) {
            onCropComplete(blob);
          }
        },
        "image/jpeg",
        0.9
      );
    } else {
      setIsGenerating(false);
    }
  };

  return (
    <DialogModal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title="Adjust Profile Photo"
      size="sm"
      isDismissable={false}
    >
      <div className="flex flex-col items-center gap-6 py-2 select-none w-full">
        {/* Main Crop Reposition Viewport */}
        <div
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onWheel={onWheel}
          className="relative w-full aspect-square max-w-[280px] bg-neutral-950 overflow-hidden rounded-2xl flex items-center justify-center cursor-move border border-border shadow-inner"
        >
          {imageSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
                <img
              ref={imgRef}
              src={imageSrc}
              alt="Crop Source"
              onLoad={handleImageLoad}
              className="max-w-none max-h-none select-none pointer-events-none transition-transform duration-0"
              style={{
                width: isWide ? "auto" : "100%",
                height: isWide ? "100%" : "auto",
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                transformOrigin: "center center",
              }}
            />
          ) : (
            <div className="text-muted text-xs">No image loaded</div>
          )}

          {/* Premium Spotlight Circular Overlay */}
          <div
            ref={cropCircleRef}
            className="w-[200px] h-[200px] rounded-full absolute pointer-events-none border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.65)]"
          />

          {/* Micro Drag Indicator Badge */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] text-white/90 flex items-center gap-1 border border-white/10 pointer-events-none">
            <Move className="size-3" />
            <span>Drag to reposition</span>
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="w-full max-w-[280px] flex flex-col gap-2">
          <div className="flex justify-between items-center text-xs text-muted-foreground font-semibold">
            <span>Zoom</span>
            <span>{Math.round(zoom * 100)}%</span>
          </div>
          <div className="flex items-center gap-3">
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              onPress={() => setZoom((z) => Math.max(z - 0.1, 1))}
              className="rounded-lg hover:bg-surface-secondary border border-border text-muted hover:text-foreground shrink-0 size-8 min-w-8"
              aria-label="Zoom Out"
            >
              <ZoomOut size={14} />
            </Button>
            <Slider
              aria-label="Zoom slider"
              step={0.01}
              minValue={1}
              maxValue={3}
              value={zoom}
              onChange={(val) => setZoom(Array.isArray(val) ? val[0] : val)}
              className="w-full"
            />
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              onPress={() => setZoom((z) => Math.min(z + 0.1, 3))}
              className="rounded-lg hover:bg-surface-secondary border border-border text-muted hover:text-foreground shrink-0 size-8 min-w-8"
              aria-label="Zoom In"
            >
              <ZoomIn size={14} />
            </Button>
          </div>
        </div>

        {/* Action Controls */}
        <div className="w-full flex items-center justify-end gap-3 pt-3 border-t border-border/40">
          <Button
            variant="ghost"
            size="sm"
            onPress={onCancel}
            className="rounded-xl border border-border hover:bg-surface-secondary font-bold text-xs"
            isDisabled={isGenerating}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onPress={handleCrop}
            className="rounded-xl bg-foreground text-background hover:bg-foreground/90 font-extrabold text-xs shadow-sm"
            isDisabled={isGenerating}
          >
            {isGenerating ? "Processing..." : "Apply"}
          </Button>
        </div>
      </div>
    </DialogModal>
  );
};

export default AvatarCropperModal;
