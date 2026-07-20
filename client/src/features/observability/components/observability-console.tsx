'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Button, Dropdown } from '@heroui/react';
import {
  Search,
  Pause,
  Play,
  Trash2,
  Copy,
  Download,
  Pin,
  ChevronRight,
  ChevronDown,
  ArrowDown,
  Filter,
  Check,
  Terminal,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useObservabilityStore } from '../store/use-observability-store';
import { ObservabilityLogEntry, LogSeverity, LogService } from '@/types/observability.types';

interface ObservabilityConsoleProps {
  title?: string;
  serviceFilter?: LogService | 'ALL';
  showServiceSelector?: boolean;
}

export function ObservabilityConsole({
  title = 'Live Observability Log Stream',
  serviceFilter = 'ALL',
  showServiceSelector = true,
}: ObservabilityConsoleProps) {
  const {
    logs,
    isPaused,
    autoScroll,
    filter,
    togglePause,
    toggleAutoScroll,
    togglePinLog,
    clearLogs,
    setFilter,
    resetFilter,
  } = useObservabilityStore();

  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive if autoScroll is enabled
  useEffect(() => {
    if (autoScroll && containerRef.current && !isPaused) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs.length, autoScroll, isPaused]);

  // Filter logs based on severity, service, search query, pinned status
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Service filter
      const targetService = serviceFilter !== 'ALL' ? serviceFilter : filter.service;
      if (targetService !== 'ALL' && log.service !== targetService) {
        return false;
      }

      // Severity filter
      if (filter.severity && filter.severity !== 'ALL' && log.severity !== filter.severity) {
        return false;
      }

      // Pinned filter
      if (filter.showOnlyPinned && !log.isPinned) {
        return false;
      }

      // Search query
      if (filter.searchQuery && filter.searchQuery.trim() !== '') {
        const q = filter.searchQuery.toLowerCase();
        const msgMatch = log.message.toLowerCase().includes(q);
        const sourceMatch = log.source.toLowerCase().includes(q);
        const serviceMatch = log.service.toLowerCase().includes(q);
        const corrMatch = log.correlationId?.toLowerCase().includes(q);
        const traceMatch = log.traceId?.toLowerCase().includes(q);
        const metaMatch = log.metadata ? JSON.stringify(log.metadata).toLowerCase().includes(q) : false;

        if (!msgMatch && !sourceMatch && !serviceMatch && !corrMatch && !traceMatch && !metaMatch) {
          return false;
        }
      }

      return true;
    });
  }, [logs, serviceFilter, filter]);

  const toggleExpand = (id: string) => {
    setExpandedLogIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCopy = (log: ObservabilityLogEntry) => {
    navigator.clipboard.writeText(JSON.stringify(log, null, 2));
    setCopiedId(log.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleExport = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(filteredLogs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `observability-logs-${new Date().toISOString().substring(0, 19)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const getSeverityBadgeColor = (severity: LogSeverity) => {
    switch (severity) {
      case 'TRACE':
        return 'bg-surface-tertiary text-muted border-border';
      case 'DEBUG':
        return 'bg-accent/15 text-accent border-accent/30';
      case 'INFO':
        return 'bg-success/15 text-success border-success/30';
      case 'WARNING':
        return 'bg-warning/15 text-warning border-warning/30';
      case 'ERROR':
        return 'bg-danger/15 text-danger border-danger/30';
      case 'CRITICAL':
        return 'bg-danger/25 text-danger border-danger/40 font-bold';
      default:
        return 'bg-surface-tertiary text-muted border-border';
    }
  };

  const getServiceBadge = (service: LogService) => {
    switch (service) {
      case 'Frontend':
        return <span className="px-1.5 py-0.5 rounded text-[10px] bg-accent/15 text-accent border border-accent/30 font-semibold">FE</span>;
      case 'AI Backend':
        return <span className="px-1.5 py-0.5 rounded text-[10px] bg-warning/15 text-warning border border-warning/30 font-semibold">AI</span>;
      default:
        return <span className="px-1.5 py-0.5 rounded text-[10px] bg-success/15 text-success border border-success/30 font-semibold">BE</span>;
    }
  };

  return (
    <div className="flex flex-col h-full rounded-2xl border border-border bg-surface shadow-2xl overflow-hidden font-mono text-foreground">
      {/* Mac OS / Vercel CLI Terminal Header Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-surface-secondary border-b border-border text-xs">
        <div className="flex items-center gap-3">
          {/* Terminal Window Controls */}
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-danger/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-warning/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-success/80 inline-block" />
          </div>

          <div className="h-4 w-px bg-border mx-1" />

          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-accent" />
            <span className="font-semibold text-foreground tracking-wide text-xs">{title}</span>
          </div>

          {/* Status Badge */}
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wider flex items-center gap-1.5 ${
              isPaused
                ? 'bg-warning/15 text-warning border border-warning/30'
                : 'bg-success/15 text-success border border-success/30'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isPaused ? 'bg-warning' : 'bg-success animate-ping'}`} />
            {isPaused ? 'PAUSED' : 'LIVE'}
          </span>

          <span className="text-muted text-[11px] font-sans">
            ({filteredLogs.length} / {logs.length} entries)
          </span>
        </div>

        {/* Action Controls Right - HeroUI Buttons */}
        <div className="flex items-center gap-2">
          {/* Toggle Pause/Resume */}
          <Button
            size="sm"
            variant={isPaused ? 'outline' : 'tertiary'}
            onPress={togglePause}
            className="flex items-center gap-1.5 text-xs"
          >
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            {isPaused ? 'Resume' : 'Pause'}
          </Button>

          {/* Toggle Auto-scroll */}
          <Button
            size="sm"
            variant={autoScroll ? 'primary' : 'tertiary'}
            onPress={toggleAutoScroll}
            className="flex items-center gap-1.5 text-xs"
          >
            <ArrowDown className="w-3.5 h-3.5" />
            Auto-Scroll
          </Button>

          {/* Download JSON */}
          <Button
            size="sm"
            variant="tertiary"
            isIconOnly
            onPress={handleExport}
            aria-label="Export Logs JSON"
          >
            <Download className="w-3.5 h-3.5" />
          </Button>

          {/* Clear Console */}
          <Button
            size="sm"
            variant="danger-soft"
            isIconOnly
            onPress={() => clearLogs(serviceFilter)}
            aria-label="Clear Console"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Filter Toolbar Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-surface-tertiary/40 border-b border-border text-xs">
        {/* Search Bar */}
        <div className="relative flex-1 min-w-[240px] max-w-md flex items-center">
          <Search className="w-3.5 h-3.5 text-muted absolute left-3 pointer-events-none" />
          <input
            type="text"
            placeholder="Search log messages, trace IDs, metadata..."
            value={filter.searchQuery || ''}
            onChange={(e) => setFilter({ searchQuery: e.target.value })}
            className="w-full h-8 pl-8 pr-8 bg-surface border border-border rounded-lg text-xs text-foreground placeholder:text-muted focus:outline-none focus:border-accent"
          />
          {filter.searchQuery && (
            <button
              onClick={() => setFilter({ searchQuery: '' })}
              className="absolute right-2.5 text-muted hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Controls via HeroUI Dropdown */}
        <div className="flex items-center gap-2">
          {/* Severity HeroUI Dropdown */}
          <Dropdown>
            <Button size="sm" variant="outline" className="flex items-center gap-1.5 text-xs">
              <Filter className="w-3.5 h-3.5 text-muted" />
              Severity: {filter.severity || 'ALL'}
              <ChevronDown className="w-3 h-3 text-muted ml-0.5" />
            </Button>
            <Dropdown.Popover placement="bottom start" className="bg-surface border border-border shadow-xl rounded-xl p-1.5 min-w-[160px] z-50 font-outfit">
              <Dropdown.Menu onAction={(key) => setFilter({ severity: key as LogSeverity | 'ALL' })}>
                <Dropdown.Item id="ALL" textValue="ALL Severities" className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer hover:bg-surface-secondary text-foreground">
                  ALL Severities
                </Dropdown.Item>
                <Dropdown.Item id="TRACE" textValue="TRACE" className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer hover:bg-surface-secondary text-muted">
                  TRACE
                </Dropdown.Item>
                <Dropdown.Item id="DEBUG" textValue="DEBUG" className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer hover:bg-surface-secondary text-accent">
                  DEBUG
                </Dropdown.Item>
                <Dropdown.Item id="INFO" textValue="INFO" className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer hover:bg-surface-secondary text-success">
                  INFO
                </Dropdown.Item>
                <Dropdown.Item id="WARNING" textValue="WARNING" className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer hover:bg-surface-secondary text-warning">
                  WARNING
                </Dropdown.Item>
                <Dropdown.Item id="ERROR" textValue="ERROR" className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer hover:bg-surface-secondary text-danger">
                  ERROR
                </Dropdown.Item>
                <Dropdown.Item id="CRITICAL" textValue="CRITICAL" className="px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer hover:bg-surface-secondary text-danger">
                  CRITICAL
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>

          {/* Service HeroUI Dropdown */}
          {showServiceSelector && serviceFilter === 'ALL' && (
            <Dropdown>
              <Button size="sm" variant="outline" className="flex items-center gap-1.5 text-xs">
                <SlidersHorizontal className="w-3.5 h-3.5 text-muted" />
                Service: {filter.service || 'ALL'}
                <ChevronDown className="w-3 h-3 text-muted ml-0.5" />
              </Button>
              <Dropdown.Popover placement="bottom start" className="bg-surface border border-border shadow-xl rounded-xl p-1.5 min-w-[160px] z-50 font-outfit">
                <Dropdown.Menu onAction={(key) => setFilter({ service: key as LogService | 'ALL' })}>
                  <Dropdown.Item id="ALL" textValue="ALL Services" className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer hover:bg-surface-secondary text-foreground">
                    ALL Services
                  </Dropdown.Item>
                  <Dropdown.Item id="Frontend" textValue="Frontend" className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer hover:bg-surface-secondary text-accent">
                    Frontend
                  </Dropdown.Item>
                  <Dropdown.Item id="Backend" textValue="Backend" className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer hover:bg-surface-secondary text-success">
                    Backend
                  </Dropdown.Item>
                  <Dropdown.Item id="AI Backend" textValue="AI Backend" className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer hover:bg-surface-secondary text-warning">
                    AI Backend
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          )}

          {/* Show Pinned Toggle */}
          <Button
            size="sm"
            variant={filter.showOnlyPinned ? 'primary' : 'tertiary'}
            onPress={() => setFilter({ showOnlyPinned: !filter.showOnlyPinned })}
            className="flex items-center gap-1.5 text-xs"
          >
            <Pin className="w-3.5 h-3.5" />
            Pinned Only
          </Button>

          {/* Reset Filters */}
          {(filter.severity !== 'ALL' || filter.service !== 'ALL' || filter.searchQuery || filter.showOnlyPinned) && (
            <Button size="sm" variant="outline" onPress={resetFilter}>
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Log Body Container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-3 space-y-1 text-xs select-text font-mono min-h-[420px] bg-background text-foreground"
      >
        {filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted gap-3 py-24">
            <div className="p-3 rounded-full bg-surface-tertiary/50 border border-border">
              <Terminal className="w-8 h-8 text-muted" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground">No log entries matching current filters.</p>
              <p className="text-xs text-muted mt-1">Listening for incoming real-time telemetry stream...</p>
            </div>
            <Button size="sm" variant="outline" onPress={resetFilter} className="mt-2">
              Reset Filters
            </Button>
          </div>
        ) : (
          filteredLogs.map((log, index) => {
            const isExpanded = expandedLogIds.has(log.id);
            const timeStr = new Date(log.timestamp).toLocaleTimeString('en-US', {
              hour12: false,
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });

            return (
              <div
                key={log.id}
                className={`group flex flex-col rounded-md border px-3 py-2 transition-all ${
                  log.isPinned
                    ? 'border-warning/60 bg-warning/10'
                    : 'border-transparent hover:bg-surface-tertiary/40 hover:border-border/60'
                }`}
              >
                {/* Main Log Line */}
                <div className="flex items-center gap-2.5 flex-wrap">
                  {/* Expand Toggle */}
                  <button
                    onClick={() => toggleExpand(log.id)}
                    className="p-0.5 text-muted hover:text-foreground rounded transition-colors"
                  >
                    {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  </button>

                  {/* Line index */}
                  <span className="text-[10px] text-muted w-8 text-right shrink-0 select-none font-mono">
                    #{index + 1}
                  </span>

                  {/* Timestamp */}
                  <span className="text-muted text-[11px] shrink-0 font-mono">{timeStr}</span>

                  {/* Severity Badge */}
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] border tracking-wider font-semibold shrink-0 ${getSeverityBadgeColor(
                      log.severity
                    )}`}
                  >
                    {log.severity}
                  </span>

                  {/* Service Badge */}
                  {getServiceBadge(log.service)}

                  {/* Source Name */}
                  <span className="text-accent font-semibold text-[11px] shrink-0">[{log.source}]</span>

                  {/* Message Body */}
                  <span className="text-foreground flex-1 truncate font-sans text-xs">{log.message}</span>

                  {/* Additional Micro Chips (Status, Latency, Cost, Token) */}
                  <div className="flex items-center gap-1.5 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                    {log.latencyMs != null && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-surface-tertiary text-muted border border-border rounded font-mono">
                        {log.latencyMs}ms
                      </span>
                    )}
                    {log.tokenUsage && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-warning/10 text-warning border border-warning/20 rounded font-mono">
                        {log.tokenUsage.total} tokens
                      </span>
                    )}

                    {/* Pin Action - HeroUI Icon Button */}
                    <Button
                      size="sm"
                      variant="ghost"
                      isIconOnly
                      onPress={() => togglePinLog(log.id)}
                      className={`min-w-6 h-6 w-6 ${log.isPinned ? 'text-warning' : 'text-muted'}`}
                      aria-label={log.isPinned ? 'Unpin Log' : 'Pin Log'}
                    >
                      <Pin className="w-3.5 h-3.5" />
                    </Button>

                    {/* Copy Action - HeroUI Icon Button */}
                    <Button
                      size="sm"
                      variant="ghost"
                      isIconOnly
                      onPress={() => handleCopy(log)}
                      className="min-w-6 h-6 w-6 text-muted"
                      aria-label="Copy JSON Payload"
                    >
                      {copiedId === log.id ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>

                {/* Expanded Payload / Metadata Inspector */}
                {isExpanded && (
                  <div className="mt-2.5 pl-6 pr-2 py-3 bg-surface rounded-lg border border-border font-mono text-[11px] space-y-2.5">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-muted pb-2 border-b border-border">
                      <div><span className="text-foreground font-semibold">Log ID:</span> {log.id}</div>
                      <div><span className="text-foreground font-semibold">UTC Timestamp:</span> {log.timestamp}</div>
                      {log.correlationId && <div><span className="text-foreground font-semibold">Correlation ID:</span> {log.correlationId}</div>}
                      {log.traceId && <div><span className="text-foreground font-semibold">Trace ID:</span> {log.traceId}</div>}
                      {log.spanId && <div><span className="text-foreground font-semibold">Span ID:</span> {log.spanId}</div>}
                      {log.pipelineId && <div><span className="text-foreground font-semibold">Pipeline ID:</span> {log.pipelineId}</div>}
                    </div>

                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <div>
                        <span className="text-muted font-semibold block mb-1">Metadata Payload:</span>
                        <pre className="p-3 rounded-lg bg-surface-tertiary text-success overflow-x-auto border border-border">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
