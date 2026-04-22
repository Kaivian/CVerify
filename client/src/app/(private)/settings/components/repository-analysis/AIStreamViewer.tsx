import React, { useEffect, useRef, useState, useMemo } from "react";
import { Terminal, Check, AlertTriangle, Search, Copy, ArrowDown } from "lucide-react";
import { Spinner, Button } from "@heroui/react";
import type { AnalysisTaskEvent } from "@/types/repository-analysis.types";

export interface DecoratedTaskEvent extends AnalysisTaskEvent {
  taskType?: string;
}

interface AIStreamViewerProps {
  events: DecoratedTaskEvent[];
  isLoading: boolean;
  taskName: string;
  taskStatus: string;
}

const SHORT_TASK_NAMES: Record<string, string> = {
  RepoStructure: "Setup",
  CommitIntelligence: "Git",
  SkillExtraction: "Skills",
  ArchitectureAnalysis: "Arch",
  CodeQuality: "Quality",
  SecurityAnalysis: "Security",
  RepositorySummary: "Summary",
};

export const AIStreamViewer: React.FC<AIStreamViewerProps> = ({
  events,
  isLoading,
  taskName,
  taskStatus,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(450);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.height) {
          setViewportHeight(entry.contentRect.height);
        }
      }
    });

    resizeObserver.observe(el);
    setViewportHeight(el.clientHeight || 450);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Filter events based on search query
  const filteredEvents = useMemo(() => {
    if (!searchQuery.trim()) return events;
    const q = searchQuery.toLowerCase();
    return events.filter(
      (ev) =>
        ev.message.toLowerCase().includes(q) ||
        ev.level.toLowerCase().includes(q)
    );
  }, [events, searchQuery]);

  // Viewport virtualizer setup
  const rowHeight = 24; // Average row height in pixels
  const buffer = 15;

  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - buffer);
  const endIndex = Math.min(
    filteredEvents.length,
    Math.ceil((scrollTop + viewportHeight) / rowHeight) + buffer
  );

  const visibleEvents = useMemo(() => {
    return filteredEvents.slice(startIndex, endIndex);
  }, [filteredEvents, startIndex, endIndex]);

  const paddingTop = startIndex * rowHeight;
  const paddingBottom = (filteredEvents.length - endIndex) * rowHeight;

  // Auto-scroll effect
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [events, autoScroll, searchQuery]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    setScrollTop(target.scrollTop);

    const isAtBottom =
      target.scrollHeight - target.scrollTop - target.clientHeight < 25;
    setAutoScroll(isAtBottom);
  };

  const handleCopyLogs = () => {
    const text = events
      .map(
        (ev) =>
          `[${formatTimestamp(ev.timestamp)}] [${ev.level.toUpperCase()}] ${ev.message}`
      )
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getLogLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case "error":
        return "text-danger bg-danger/10 border-danger/20";
      case "warning":
        return "text-warning bg-warning/10 border-warning/20";
      case "debug":
        return "text-muted bg-surface-secondary border-border/40";
      case "info":
      default:
        return "text-success bg-success/10 border-success/20";
    }
  };

  const formatTimestamp = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
    } catch {
      return "";
    }
  };

  return (
    <div className="flex flex-col border border-border bg-background/40 backdrop-blur-md rounded-2xl overflow-hidden h-full shadow-2xl relative font-mono text-xs text-left">
      {/* Console Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-surface-secondary/80 border-b border-border/60">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5 mr-1.5 select-none">
            <span className="w-3 h-3 rounded-full bg-danger/30 border border-danger/40 block" />
            <span className="w-3 h-3 rounded-full bg-warning/30 border border-warning/40 block" />
            <span className="w-3 h-3 rounded-full bg-success/30 border border-success/40 block" />
          </div>
          <Terminal className="size-4 text-accent shrink-0" />
          <span className="font-bold text-foreground text-[11px] tracking-wider uppercase font-sans">
            Terminal: {taskName}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Search Input */}
          <div className="relative w-40 md:w-56 font-sans">
            <Search className="size-3.5 absolute left-2.5 top-2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1 text-[11px] bg-field-background border border-border/80 rounded-lg text-foreground placeholder-muted focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          {/* Copy Button */}
          <Button
            size="sm"
            variant="secondary"
            onClick={handleCopyLogs}
            isDisabled={events.length === 0}
            className="h-7 px-2.5 rounded-lg text-[10px] font-sans font-bold flex items-center gap-1.5 border border-border/50 hover:bg-surface-secondary"
          >
            <Copy size={12} />
            <span>{copied ? "Copied!" : "Copy"}</span>
          </Button>

          {/* Status Display */}
          <div className="flex items-center shrink-0 border-l border-border/40 pl-3">
            {taskStatus === "Running" && (
              <span className="flex items-center gap-1.5 text-[10px] text-warning font-bold uppercase tracking-wider font-sans">
                <Spinner size="sm" color="warning" className="scale-65 shrink-0" /> Executing
              </span>
            )}
            {taskStatus === "Completed" && (
              <span className="flex items-center gap-1 text-[10px] text-success font-bold uppercase tracking-wider font-sans">
                <Check className="size-3.5" /> Idle
              </span>
            )}
            {taskStatus === "Failed" && (
              <span className="flex items-center gap-1 text-[10px] text-danger font-bold uppercase tracking-wider font-sans">
                <AlertTriangle className="size-3.5" /> Stopped
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Terminal Logs Body */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 p-4 overflow-y-auto select-text relative min-h-[300px]"
      >
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 font-sans">
            <Spinner color="accent" />
            <span className="text-muted text-xs">Reading task execution logs...</span>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted/65 text-xs text-center px-4 font-sans gap-2">
            <Terminal size={24} className="opacity-40" />
            <span>
              {searchQuery
                ? "No logs matching query."
                : "No log events emitted yet for this task."}
            </span>
          </div>
        ) : (
          <div
            style={{
              paddingTop: `${paddingTop}px`,
              paddingBottom: `${paddingBottom}px`,
              minHeight: `${filteredEvents.length * rowHeight}px`,
            }}
            className="space-y-1"
          >
            {visibleEvents.map((ev, idx) => (
              <div
                key={ev.id}
                style={{ height: `${rowHeight}px` }}
                className="flex gap-2.5 items-center leading-relaxed text-[11px]"
              >
                {/* Line number */}
                <span className="w-8 text-muted/65 shrink-0 text-right select-none text-[9.5px]">
                  {startIndex + idx + 1}
                </span>

                {/* Timestamp */}
                <span className="text-muted/40 shrink-0 select-none text-[10px]">
                  [{formatTimestamp(ev.timestamp)}]
                </span>

                {/* Task Badge */}
                {ev.taskType && (
                  <span className="shrink-0 text-[8.5px] font-sans font-bold px-1.5 py-0.5 rounded-md bg-accent/10 border border-accent/20 text-accent select-none uppercase">
                    {SHORT_TASK_NAMES[ev.taskType] || ev.taskType}
                  </span>
                )}

                {/* Level Tag */}
                <span
                  className={`shrink-0 uppercase font-black tracking-wider text-[8px] px-1.5 py-0.5 rounded-md border ${getLogLevelColor(
                    ev.level
                  )} select-none`}
                >
                  {ev.level}
                </span>

                {/* Message */}
                <span className="text-foreground/90 truncate flex-1 hover:text-foreground transition-colors select-text">
                  {ev.message}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Scroll to bottom floating button if needed */}
      {!autoScroll && filteredEvents.length > 0 && (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            setAutoScroll(true);
            if (containerRef.current) {
              containerRef.current.scrollTop = containerRef.current.scrollHeight;
            }
          }}
          className="absolute bottom-4 right-4 rounded-full size-8 p-0 min-w-0 bg-surface-secondary border border-border shadow-md text-foreground flex items-center justify-center hover:bg-surface-tertiary"
        >
          <ArrowDown size={14} />
        </Button>
      )}
    </div>
  );
};

export default AIStreamViewer;
