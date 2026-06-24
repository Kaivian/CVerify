import React, { useRef, useState, useEffect } from "react";
import { Scroll, Search, Copy, Download } from "lucide-react";
import { Button } from "@heroui/react";
import { type StreamingLog } from "../types";

interface StreamingLogConsoleProps {
  logs: StreamingLog[];
  logsSearchQuery: string;
  logsLevelFilter: string;
  autoScroll: boolean;
  onSearchChange: (query: string) => void;
  onLevelFilterChange: (level: string) => void;
  onAutoScrollChange: (scroll: boolean) => void;
  onCopyLogs: () => void;
  onDownloadLogs: () => void;
}

export function StreamingLogConsole({
  logs,
  logsSearchQuery,
  logsLevelFilter,
  autoScroll,
  onSearchChange,
  onLevelFilterChange,
  onAutoScrollChange,
  onCopyLogs,
  onDownloadLogs,
}: StreamingLogConsoleProps) {
  // Filter logs based on search query and log level
  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.message.toLowerCase().includes(logsSearchQuery.toLowerCase()) ||
      (log.component && log.component.toLowerCase().includes(logsSearchQuery.toLowerCase()));

    const matchesLevel = logsLevelFilter === "All" || log.logLevel.toLowerCase() === logsLevelFilter.toLowerCase();

    return matchesSearch && matchesLevel;
  });

  return (
    <div className="flex-1 flex flex-col bg-background/30 overflow-hidden">
      {/* Console Action Bar */}
      <div className="px-5 py-3 border-b border-border/10 bg-surface-secondary flex flex-wrap items-center gap-3 shrink-0">
        <div className="flex items-center gap-1.5 text-[10px] text-muted font-bold uppercase tracking-wider">
          <Scroll className="size-3.5 text-muted/60" /> Console Logs
        </div>

        {/* Search input */}
        <div className="relative max-w-[180px] h-7">
          <Search className="absolute left-2.5 top-1.5 size-3.5 text-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search logs..."
            value={logsSearchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full h-7 pl-8 pr-2.5 bg-field-background border border-border rounded-lg text-xs text-foreground placeholder-field-placeholder focus:outline-none focus:border-accent font-sans"
          />
        </div>

        {/* Level Filter */}
        <div className="flex items-center gap-1 bg-field-background border border-border p-0.5 rounded-lg h-7">
          {["All", "Info", "Success", "Warning", "Error"].map((lvl) => (
            <button
              key={lvl}
              onClick={() => onLevelFilterChange(lvl)}
              className={`text-[9px] font-bold px-2 py-1 rounded transition-colors ${logsLevelFilter === lvl ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground"}`}
            >
              {lvl}
            </button>
          ))}
        </div>

        {/* Auto scroll control */}
        <label className="flex items-center gap-1.5 text-[10px] text-muted cursor-pointer ml-2">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => onAutoScrollChange(e.target.checked)}
            className="accent-primary size-3 bg-field-background border-border rounded"
          />
          <span>Auto-Scroll</span>
        </label>

        {/* Copy / Download buttons */}
        <div className="ml-auto flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs font-bold text-muted border border-border bg-surface-secondary hover:bg-surface-tertiary px-2"
            onPress={onCopyLogs}
          >
            <Copy className="size-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs font-bold text-muted border border-border bg-surface-secondary hover:bg-surface-tertiary px-2"
            onPress={onDownloadLogs}
          >
            <Download className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Logs terminal itself */}
      <div className="flex-1 min-h-0 flex flex-col bg-background p-4">
        {filteredLogs.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <Search className="size-8 text-muted/30 mb-2" />
            <span className="text-xs text-muted font-extrabold">No matching logs</span>
            <span className="text-[10px] text-muted/80 max-w-[200px] mt-1 leading-normal">
              No console logs matched your search or filters.
            </span>
          </div>
        ) : (
          <VirtualLogConsole logs={filteredLogs} autoScroll={autoScroll} />
        )}
      </div>
    </div>
  );
}

interface VirtualLogConsoleProps {
  logs: StreamingLog[];
  autoScroll?: boolean;
}

export function VirtualLogConsole({ logs, autoScroll = true }: VirtualLogConsoleProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(400);

  useEffect(() => {
    if (containerRef.current) {
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setHeight(entry.contentRect.height);
        }
      });
      resizeObserver.observe(containerRef.current);
      return () => resizeObserver.disconnect();
    }
  }, []);

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  const ROW_HEIGHT = 22; // px per log row
  const BUFFER = 15;
  const totalHeight = logs.length * ROW_HEIGHT;

  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER);
  const endIndex = Math.min(logs.length, Math.ceil((scrollTop + height) / ROW_HEIGHT) + BUFFER);

  const visibleLogs = logs.slice(startIndex, endIndex);

  return (
    <div
      ref={containerRef}
      onScroll={onScroll}
      className="flex-1 overflow-y-auto bg-background font-mono text-[10px] text-foreground relative rounded-xl border border-border/60 leading-normal"
    >
      <div style={{ height: `${totalHeight}px`, width: "100%", position: "relative" }}>
        <div style={{ transform: `translateY(${startIndex * ROW_HEIGHT}px)`, position: "absolute", left: 0, right: 0 }}>
          {visibleLogs.map((log, index) => {
            const globalIndex = startIndex + index;
            let levelColor = "text-muted bg-surface-secondary/40 border-border";
            if (log.logLevel === "Success") levelColor = "text-success bg-success/10 border-success/20";
            else if (log.logLevel === "Warning") levelColor = "text-warning bg-warning/10 border-warning/20";
            else if (log.logLevel === "Error") levelColor = "text-danger bg-danger/10 border-danger/20";
            else if (log.logLevel === "Debug") levelColor = "text-accent bg-accent/10 border-accent/20";

            return (
              <div
                key={log.id}
                className="flex items-center gap-3 hover:bg-surface-secondary/30 px-3 whitespace-nowrap overflow-hidden border-b border-border/30 text-ellipsis"
                style={{ height: `${ROW_HEIGHT}px` }}
              >
                {/* Row number counter */}
                <span className="text-muted/60 shrink-0 w-8 text-right font-semibold">
                  {globalIndex + 1}
                </span>

                {/* Timestamp */}
                <span className="text-muted/50 shrink-0 font-light font-mono">
                  {new Date(log.timestamp).toLocaleTimeString(undefined, { hour12: false })}
                </span>

                {/* Log component tag */}
                {log.component && (
                  <span className="text-accent font-bold shrink-0 uppercase tracking-wider text-[8px] bg-accent/10 px-1 py-0.5 rounded border border-accent/20 leading-none">
                    {log.component}
                  </span>
                )}

                {/* Level Chip */}
                <span className={`shrink-0 font-bold text-[8px] uppercase px-1 py-0.5 rounded border leading-none tracking-wider ${levelColor}`}>
                  {log.logLevel}
                </span>

                {/* Message */}
                <span className="text-foreground/90 truncate font-mono select-text font-medium">
                  {log.message}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
