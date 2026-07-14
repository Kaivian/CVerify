"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProgressBar, Chip, Spinner, Tabs, Drawer, Tooltip } from "@heroui/react";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  MarkerType,
  type NodeProps,
  type Edge,
  type Node
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import * as Icons from "lucide-react";
import {
  Search,
  ChevronRight,
  Terminal,
  Activity,
  X,
  RefreshCw,
  XCircle,
  Play,
  Pause,
  Trash2,
  AlertCircle
} from "lucide-react";
import {
  aiOperationsService,
  type PipelineMetadata,
  type AiPipelineStats,
  type AiQueue,
  type AiPipelineListItem,
  type AiPipelineDetail,
  type AiProvider,
  type AiWorker
} from "../services/ai-operations.service";

interface LivePipelineEvent {
  jobId: string;
  eventType: string;
  status: string;
  progress: number;
  message: string;
  stageId?: string;
  logLevel?: string;
  logComponent?: string;
  timestamp: string;
}

// Custom Node component for Flow DAG
interface CustomNodeData extends Record<string, unknown> {
  taskIdentifier: string;
  taskName: string;
  status: string;
  progress: number;
}

const CustomTaskNode: React.FC<NodeProps> = ({ data }) => {
  const customData = data as unknown as CustomNodeData;

  const getStatusStyles = () => {
    switch (customData.status) {
      case "Completed":
        return "border-success bg-success/5 text-success shadow-success/10";
      case "Failed":
        return "border-danger bg-danger/5 text-danger shadow-danger/10";
      case "Running":
        return "border-primary bg-primary/5 text-primary shadow-primary/10 animate-pulse";
      case "Queued":
      default:
        return "border-border/60 bg-surface text-muted-foreground";
    }
  };

  return (
    <div className={`px-3 py-2 rounded-xl border shadow-sm w-44 font-sans select-none ${getStatusStyles()}`}>
      <Handle type="target" position={Position.Left} className="w-2 h-2 bg-foreground border border-surface" />
      <Handle type="source" position={Position.Right} className="w-2 h-2 bg-foreground border border-surface" />
      <div className="space-y-1">
        <div className="flex justify-between items-center text-[8px] uppercase tracking-wider opacity-70">
          <span>{customData.taskIdentifier}</span>
          <span>{customData.status}</span>
        </div>
        <h5 className="font-bold text-foreground text-xs truncate">{customData.taskName}</h5>
        {customData.status === "Running" && (
          <div className="w-full bg-primary/20 h-1 rounded-full overflow-hidden mt-1">
            <div className="bg-primary h-full rounded-full" style={{ width: `${customData.progress}%` }}></div>
          </div>
        )}
      </div>
    </div>
  );
};

const nodeTypes = { customTask: CustomTaskNode };

interface DashboardProps {
  pipelineSlug: string;
}

export const AiPipelineDashboardView: React.FC<DashboardProps> = ({ pipelineSlug }) => {
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [registry, setRegistry] = useState<PipelineMetadata[]>([]);
  const [activeMetadata, setActiveMetadata] = useState<PipelineMetadata | null>(null);
  
  // Dashboard state
  const [stats, setStats] = useState<AiPipelineStats | null>(null);
  const [queues, setQueues] = useState<AiQueue[]>([]);
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [workers, setWorkers] = useState<AiWorker[]>([]);
  const [executions, setExecutions] = useState<AiPipelineListItem[]>([]);
  const [repositories, setRepositories] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [reposSyncing, setReposSyncing] = useState<Record<string, boolean>>({});
  
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  // SSE progress stream
  const [livePipelines, setLivePipelines] = useState<Record<string, {
    info: AiPipelineListItem;
    logs: string[];
  }>>({});

  // Drawer detail state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AiPipelineDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);

  // Failure state
  const [selectedFailureId, setSelectedFailureId] = useState<string | null>(null);
  const [failureLog, setFailureLog] = useState<string[]>([]);
  const [fetchingLogs, setFetchingLogs] = useState<boolean>(false);

  // 1. Fetch registry config
  useEffect(() => {
    const fetchRegistry = async () => {
      try {
        const reg = await aiOperationsService.getRegistry();
        setRegistry(reg);
        const matched = reg.find(p => p.routeSlug === pipelineSlug);
        if (matched) {
          setActiveMetadata(matched);
        }
      } catch (err) {
        console.error("Failed to load pipeline registry", err);
      }
    };
    fetchRegistry();
  }, [pipelineSlug]);

  // 2. Poll statistics & queues for current pipeline
  const loadData = async () => {
    if (!activeMetadata) return;
    try {
      const [statsData, queuesData, providersData, workersData, executionsData, reposData, eventsData] = await Promise.all([
        aiOperationsService.getStats(activeMetadata.id),
        aiOperationsService.getQueues(),
        aiOperationsService.getProviders(),
        aiOperationsService.getWorkers(),
        aiOperationsService.getPipelines(activeMetadata.id),
        aiOperationsService.getRepositories(),
        aiOperationsService.getEvents()
      ]);
      setStats(statsData);
      setQueues(queuesData.filter(q => activeMetadata.queueTypes.includes(q.queueName)));
      setProviders(providersData);
      setWorkers(workersData);
      setExecutions(executionsData);
      setRepositories(reposData);
      setEvents(eventsData);
    } catch (err) {
      console.error("Telemetry sync failed", err);
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerSync = async (repoId: string) => {
    setReposSyncing(prev => ({ ...prev, [repoId]: true }));
    try {
      await aiOperationsService.triggerRepositoryAnalysis(repoId);
      loadData();
    } catch (err) {
      console.error("Failed to trigger sync", err);
    } finally {
      setReposSyncing(prev => ({ ...prev, [repoId]: false }));
    }
  };

  useEffect(() => {
    if (activeMetadata) {
      loadData();
      const interval = setInterval(loadData, 5000);
      return () => clearInterval(interval);
    }
  }, [activeMetadata]);

  // 3. SSE Progressive Stream Ticker filtered by current pipeline
  useEffect(() => {
    if (!activeMetadata) return;

    const sseUrl = "/api/admin/ai/operations/progress-stream";
    const eventSource = new EventSource(sseUrl);

    eventSource.onmessage = (event) => {
      if (event.data === "[DONE]") return;

      try {
        const evt = JSON.parse(event.data) as LivePipelineEvent;
        if (!evt.jobId) return;

        // Filter events by active pipeline ID
        if (evt.eventType !== "SESSION_STARTED" && livePipelines[evt.jobId] === undefined) {
          // If not in state, skip to prevent crosstalk from other pipelines
          return;
        }

        setLivePipelines((prev) => {
          const existing = prev[evt.jobId];
          const newLogs = existing ? [...existing.logs] : [];
          
          if (evt.message) {
            const prefix = evt.logLevel ? `[${evt.logLevel}] ` : "";
            newLogs.push(`${prefix}${evt.message}`);
            if (newLogs.length > 50) newLogs.shift();
          }

          const updatedItem: AiPipelineListItem = existing?.info || {
            id: evt.jobId,
            pipelineId: activeMetadata.displayName,
            status: evt.status,
            progress: evt.progress,
            totalCostUsd: 0,
            totalInputTokens: 0,
            totalOutputTokens: 0,
            pipelineVersion: "1.0.0",
            createdAtUtc: new Date().toISOString(),
            retryCount: 0,
            queuePosition: 0
          };

          updatedItem.status = evt.status;
          updatedItem.progress = evt.progress;

          if (evt.status === "Completed" || evt.status === "Failed" || evt.status === "Cancelled") {
            setTimeout(() => {
              setLivePipelines(curr => {
                const copy = { ...curr };
                delete copy[evt.jobId];
                return copy;
              });
            }, 10000);
          }

          return {
            ...prev,
            [evt.jobId]: {
              info: updatedItem,
              logs: newLogs
            }
          };
        });
      } catch (err) {
        console.error("Failed to parse live telemetry packet", err);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [activeMetadata]);

  // Helpers
  const handlePauseQueue = async (name: string) => {
    try {
      await aiOperationsService.pauseQueue(name);
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleResumeQueue = async (name: string) => {
    try {
      await aiOperationsService.resumeQueue(name);
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleClearQueue = async (name: string) => {
    if (!window.confirm(`Are you sure you want to clear all tasks from queue '${name}'?`)) return;
    try {
      await aiOperationsService.clearQueue(name);
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCancelPipeline = async (id: string) => {
    if (!activeMetadata) return;
    try {
      await aiOperationsService.cancelPipeline(id, activeMetadata.id);
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleRetryPipeline = async (id: string) => {
    if (!activeMetadata) return;
    try {
      await aiOperationsService.retryPipeline(id, activeMetadata.id);
      if (selectedId) handleRowClick(selectedId);
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleRowClick = async (id: string) => {
    try {
      setSelectedId(id);
      setDetailLoading(true);
      const data = await aiOperationsService.getPipelineDetail(id);
      setDetail(data);
    } catch (e) {
      console.error(e);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleFailureClick = async (id: string) => {
    try {
      setSelectedFailureId(id);
      setFetchingLogs(true);
      const data = await aiOperationsService.getPipelineDetail(id);
      const logs = data.logs.map(l => `[${l.logLevel}] ${l.message}`);
      if (data.errorMessage) {
        logs.push(`[Fatal Error] ${data.errorMessage}`);
      }
      setFailureLog(logs);
    } catch (e) {
      console.error(e);
    } finally {
      setFetchingLogs(false);
    }
  };

  const handleFailureRetry = async (e: React.MouseEvent, item: AiPipelineListItem) => {
    e.stopPropagation();
    try {
      await aiOperationsService.retryPipeline(item.id, item.pipelineId);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredExecutions = useMemo(() => {
    return executions.filter(item => {
      const matchSearch = (item.id.toLowerCase().includes(search.toLowerCase()) ||
        (item.candidateName && item.candidateName.toLowerCase().includes(search.toLowerCase())) ||
        (item.repositoryName && item.repositoryName.toLowerCase().includes(search.toLowerCase())));
      
      const matchStatus = statusFilter === "all" || item.status.toLowerCase() === statusFilter.toLowerCase();
      return matchSearch && matchStatus;
    });
  }, [executions, search, statusFilter]);

  const failedExecutions = useMemo(() => {
    return executions.filter(e => e.status === "Failed");
  }, [executions]);

  const displayLivePipelines = useMemo(() => {
    const merged = { ...livePipelines };
    
    executions.forEach(e => {
      if ((e.status === "Running" || e.status === "Queued") && !merged[e.id]) {
        merged[e.id] = {
          info: e,
          logs: [
            `[${new Date(e.createdAtUtc).toLocaleTimeString()}] Pipeline initialized with status: ${e.status}. Waiting for worker dispatch.`
          ]
        };
      }
    });

    return merged;
  }, [livePipelines, executions]);

  const svgLinePoints = useMemo(() => {
    if (!stats || !stats.dailyTrends || stats.dailyTrends.length === 0) return "";
    const trends = stats.dailyTrends;
    const maxCost = Math.max(...trends.map(t => Number(t.costUsd)), 0.1);
    
    return trends.map((t, idx) => {
      const x = (idx / (trends.length - 1)) * 600 + 40;
      const y = 180 - (Number(t.costUsd) / maxCost) * 140;
      return `${x},${y}`;
    }).join(" ");
  }, [stats]);

  // DAG Nodes & Edges Configuration
  const { flowNodes, flowEdges } = useMemo(() => {
    if (!detail) return { flowNodes: [], flowEdges: [] };

    // Standard static DAG layout for Repository analysis
    if (detail.pipelineId === "repository-analysis") {
      const dagNodesTemplate = [
        { id: "L1-001", name: "Git Ingest", col: 0, row: 2 },
        { id: "L1-002", name: "Commit Extractor", col: 1, row: 0 },
        { id: "L1-004", name: "Stack Extractor", col: 1, row: 1 },
        { id: "L1-012", name: "Blame Authorship", col: 1, row: 2 },
        { id: "L1-013", name: "Clone Detect", col: 1, row: 3 },
        { id: "L1-003", name: "Diff Parser", col: 2, row: 0 },
        { id: "L1-005", name: "Feature Engine", col: 2, row: 1 },
        { id: "L1-006", name: "Arch Analyzer", col: 2, row: 2 },
        { id: "L1-007", name: "Timeline Analyze", col: 2, row: 3 },
        { id: "L1-010", name: "Complexity", col: 2, row: 4 },
        { id: "L1-011", name: "Code Quality", col: 2, row: 5 },
        { id: "L1-015", name: "Ownership Score", col: 2, row: 6 },
        { id: "L1-008", name: "Arch Change Det", col: 3, row: 0 },
        { id: "L1-009", name: "Intent Inference", col: 3, row: 1 },
        { id: "L1-014", name: "AI Code Detect", col: 3, row: 2 },
        { id: "L1-017", name: "Skill Graph Build", col: 3, row: 3 },
        { id: "L1-018", name: "Trust Score Gen", col: 3, row: 4 },
        { id: "L1-016", name: "Repo Intelligence", col: 4, row: 2 }
      ];

      const staticEdgesTemplate = [
        { source: "L1-001", target: "L1-002" },
        { source: "L1-001", target: "L1-004" },
        { source: "L1-001", target: "L1-012" },
        { source: "L1-001", target: "L1-013" },
        { source: "L1-002", target: "L1-003" },
        { source: "L1-002", target: "L1-007" },
        { source: "L1-002", target: "L1-009" },
        { source: "L1-002", target: "L1-015" },
        { source: "L1-003", target: "L1-008" },
        { source: "L1-003", target: "L1-009" },
        { source: "L1-003", target: "L1-014" },
        { source: "L1-004", target: "L1-005" },
        { source: "L1-004", target: "L1-006" },
        { source: "L1-004", target: "L1-010" },
        { source: "L1-004", target: "L1-011" },
        { source: "L1-004", target: "L1-017" },
        { source: "L1-005", target: "L1-017" },
        { source: "L1-006", target: "L1-008" },
        { source: "L1-012", target: "L1-015" },
        { source: "L1-015", target: "L1-017" },
        { source: "L1-015", target: "L1-018" },
        { source: "L1-011", target: "L1-018" },
        { source: "L1-009", target: "L1-018" },
        { source: "L1-007", target: "L1-016" },
        { source: "L1-008", target: "L1-016" },
        { source: "L1-010", target: "L1-016" },
        { source: "L1-013", target: "L1-016" },
        { source: "L1-014", target: "L1-016" },
        { source: "L1-017", target: "L1-016" },
        { source: "L1-018", target: "L1-016" }
      ];

      const taskStates: Record<string, { status: string; progress: number }> = {};
      detail.pipelineTasks.forEach(task => {
        taskStates[task.taskType] = { status: task.status, progress: task.progress };
      });
      detail.stages.forEach(s => {
        if (!taskStates[s.stageId]) {
          taskStates[s.stageId] = { status: s.status, progress: s.progress };
        }
      });

      const nodes: Node[] = dagNodesTemplate.map((t) => {
        const taskState = taskStates[t.id] || { status: "Queued", progress: 0 };
        return {
          id: t.id,
          type: "customTask",
          position: { x: t.col * 220 + 30, y: t.row * 90 + 40 },
          data: {
            taskIdentifier: t.id,
            taskName: t.name,
            status: taskState.status,
            progress: taskState.progress
          }
        };
      });

      const edges: Edge[] = staticEdgesTemplate.map(e => {
        const isHighlighted = taskStates[e.source]?.status === "Completed" && taskStates[e.target]?.status === "Running";
        return {
          id: `edge-${e.source}-to-${e.target}`,
          source: e.source,
          target: e.target,
          type: "smoothstep",
          animated: isHighlighted,
          style: {
            stroke: isHighlighted ? "#006FEE" : "var(--border)",
            strokeWidth: isHighlighted ? 2.5 : 1.2,
            opacity: isHighlighted ? 1.0 : 0.4
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 10,
            height: 10,
            color: isHighlighted ? "#006FEE" : "var(--border)"
          }
        };
      });

      return { flowNodes: nodes, flowEdges: edges };
    } else {
      // Build a simple horizontal visual trace for other business pipelines
      const nodes: Node[] = detail.stages.map((stage, idx) => ({
        id: stage.stageId,
        type: "customTask",
        position: { x: idx * 220 + 40, y: 180 },
        data: {
          taskIdentifier: `Step ${idx + 1}`,
          taskName: stage.stageName,
          status: stage.status,
          progress: stage.progress
        }
      }));

      const edges: Edge[] = [];
      for (let i = 0; i < nodes.length - 1; i++) {
        edges.push({
          id: `edge-${nodes[i].id}-to-${nodes[i + 1].id}`,
          source: nodes[i].id,
          target: nodes[i + 1].id,
          type: "smoothstep",
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 10,
            height: 10,
            color: "var(--border)"
          }
        });
      }
      return { flowNodes: nodes, flowEdges: edges };
    }
  }, [detail]);

  if (loading || !activeMetadata) {
    return (
      <div className="flex h-[400px] flex-col items-center justify-center gap-2">
        <Spinner size="sm" color="accent" />
        <span className="text-xs text-muted-foreground">Initializing Dashboard Registry...</span>
      </div>
    );
  }

  const activeLiveCount = Object.keys(displayLivePipelines).length;

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{activeMetadata.displayName} Operations</h1>
          <p className="text-sm text-muted-foreground">{activeMetadata.description}</p>
        </div>
        <Button variant="bordered" onClick={loadData}>
          <RefreshCw className="h-3.5 w-3.5 mr-1" />
          Sync Telemetry
        </Button>
      </div>

      {/* Tabs */}
      <Tabs
        selectedKey={activeTab}
        onSelectionChange={(key) => setActiveTab(key as string)}
        variant="secondary"
        className="mb-4"
      >
        <Tabs.ListContainer>
          <Tabs.List aria-label="Operations tabs" className="gap-6 border-b border-border/40">
            <Tabs.Tab id="overview" className="pb-1.5 text-xs font-semibold select-none cursor-pointer">
              <span>Overview</span>
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="repos" className="pb-1.5 text-xs font-semibold select-none cursor-pointer">
              <span>Repository Health ({repositories.length})</span>
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="live" className="pb-1.5 text-xs font-semibold select-none cursor-pointer">
              <span>Live Monitor ({activeLiveCount})</span>
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="queues" className="pb-1.5 text-xs font-semibold select-none cursor-pointer">
              <span>Queue Status ({queues.length})</span>
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="history" className="pb-1.5 text-xs font-semibold select-none cursor-pointer">
              <span>Execution History ({executions.length})</span>
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="diagnostics" className="pb-1.5 text-xs font-semibold select-none cursor-pointer">
              <span>Failure Recovery ({failedExecutions.length})</span>
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>

      {/* Overview Dashboard */}
      {activeTab === "overview" && stats && (
        <div className="space-y-6">
          {/* Strongly Typed KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
            {stats.domainMetrics?.map((metric, idx) => {
              const IconComponent = (Icons as any)[metric.icon || "Activity"] || Icons.Activity;
              return (
                <Tooltip key={idx} delay={0}>
                  <Tooltip.Trigger className="w-full block text-left">
                    <div>
                      <Card glow={true} className="cursor-default transition-all hover:bg-surface-secondary/20">
                        <div className="flex flex-row items-center space-x-3">
                        <div className="rounded-lg bg-surface-secondary/80 p-2.5 text-primary">
                          <IconComponent className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-0.5 whitespace-normal">
                            {metric.label}
                          </p>
                          <h4 className="text-lg font-extrabold text-foreground leading-tight truncate">
                            {metric.value}
                            {metric.unit && <span className="text-[10px] font-normal text-muted-foreground ml-0.5">{metric.unit}</span>}
                          </h4>
                          {metric.trend && (
                            <span className="text-[9px] text-success font-medium block mt-0.5 truncate">{metric.trend}</span>
                          )}
                        </div>
                      </div>
                    </Card>
                  </div>
                </Tooltip.Trigger>
                  <Tooltip.Content className="max-w-xs bg-surface border border-border p-2 shadow-md rounded-lg text-xs text-muted-foreground">
                    {metric.description || metric.label}
                  </Tooltip.Content>
                </Tooltip>
              );
            })}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* SVG Spending Curve */}
            <Card glow={true} className="xl:col-span-2">
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-foreground">Spending Trend (7 Days)</h4>
                    <p className="text-xs text-muted-foreground">Daily USD expenditure for {activeMetadata.displayName}.</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-muted-foreground block">Cumulative (7D)</span>
                    <span className="font-bold text-foreground">${stats.dailyTrends.reduce((sum, t) => sum + Number(t.costUsd), 0).toFixed(3)}</span>
                  </div>
                </div>

                <div className="relative h-52 w-full border-b border-l border-border/40 pb-2">
                  <svg className="w-full h-full" viewBox="0 0 680 200" preserveAspectRatio="none">
                    <line x1="40" y1="40" x2="640" y2="40" stroke="var(--border)" strokeDasharray="4 4" strokeWidth="0.5" />
                    <line x1="40" y1="110" x2="640" y2="110" stroke="var(--border)" strokeDasharray="4 4" strokeWidth="0.5" />
                    
                    <defs>
                      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#006FEE" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#006FEE" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {svgLinePoints && (
                      <>
                        <path d={`M 40,180 L ${svgLinePoints} L 640,180 Z`} fill="url(#areaGrad)" />
                        <polyline fill="none" stroke="#006FEE" strokeWidth="3" points={svgLinePoints} />
                      </>
                    )}

                    {stats.dailyTrends.map((t, idx) => {
                      const maxCost = Math.max(...stats.dailyTrends.map(x => Number(x.costUsd)), 0.1);
                      const cx = (idx / (stats.dailyTrends.length - 1)) * 600 + 40;
                      const cy = 180 - (Number(t.costUsd) / maxCost) * 140;
                      return (
                        <circle
                          key={idx}
                          cx={cx}
                          cy={cy}
                          r="4.5"
                          fill="var(--background)"
                          stroke="#006FEE"
                          strokeWidth="2.5"
                        />
                      );
                    })}
                  </svg>
                  <div className="absolute bottom-0 left-10 right-10 flex justify-between text-[10px] text-muted-foreground font-mono transform translate-y-5">
                    {stats.dailyTrends.map(t => (
                      <span key={t.date}>{new Date(t.date).toLocaleDateString(undefined, { weekday: 'short' })}</span>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            {/* Cost Breakdown & Tokens */}
            <Card glow={true} className="flex flex-col justify-between">
              <div className="space-y-4">
                <h4 className="font-bold text-foreground">Operations Cost Breakouts</h4>
                
                {/* Provider breakdown */}
                <div className="space-y-2">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">By LLM Provider</span>
                  {stats.costByProvider && Object.keys(stats.costByProvider).length > 0 ? (
                    <div className="space-y-1.5">
                      {Object.entries(stats.costByProvider).map(([provider, cost]) => (
                        <div key={provider} className="flex justify-between items-center text-xs">
                          <span className="text-muted-foreground">{provider}</span>
                          <span className="font-mono font-semibold">${cost.toFixed(4)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground italic">No provider cost details available.</div>
                  )}
                </div>

                <div className="border-t border-border/40 my-3"></div>

                {/* Repository breakdown */}
                <div className="space-y-2">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">By Repository</span>
                  {stats.costByRepository && Object.keys(stats.costByRepository).length > 0 ? (
                    <div className="space-y-1.5 max-h-32 overflow-y-auto scrollbar-none">
                      {Object.entries(stats.costByRepository).map(([repoName, cost]) => (
                        <div key={repoName} className="flex justify-between items-center text-xs">
                          <span className="text-muted-foreground truncate max-w-[150px]">{repoName}</span>
                          <span className="font-mono font-semibold">${cost.toFixed(4)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground italic">No repository cost details available.</div>
                  )}
                </div>
              </div>

              <div className="border-t border-border/40 pt-3 mt-4 space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Cumulative Prompt Tokens:</span>
                  <span className="font-mono font-semibold text-foreground">{stats.totalPromptTokens?.toLocaleString() ?? 0}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Cumulative Completion Tokens:</span>
                  <span className="font-mono font-semibold text-foreground">{stats.totalCompletionTokens?.toLocaleString() ?? 0}</span>
                </div>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Active Workers */}
            <Card glow={true}>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-foreground">Active Worker Nodes</h4>
                  <Chip size="sm" color="success" variant="soft">{workers.length} Online</Chip>
                </div>
                {workers.length === 0 ? (
                  <div className="text-xs text-muted-foreground italic p-4 text-center">No active worker nodes detected.</div>
                ) : (
                  <div className="space-y-4">
                    {workers.map((worker) => (
                      <div key={worker.workerName} className="p-3 bg-surface-secondary/40 rounded-xl space-y-2 border border-border/20">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-foreground font-mono">{worker.workerName}</span>
                          <span className="text-[10px] text-muted-foreground">v{worker.version}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-[10px] text-muted-foreground">
                          <div>
                            <span className="block">CPU Utilization</span>
                            <div className="flex items-center space-x-1.5 mt-0.5">
                              <div className="flex-1 bg-border h-1.5 rounded-full overflow-hidden">
                                <div className="bg-primary h-full" style={{ width: `${worker.cpuUsagePercent}%` }}></div>
                              </div>
                              <span className="font-mono text-foreground font-semibold">{worker.cpuUsagePercent}%</span>
                            </div>
                          </div>
                          <div>
                            <span className="block">RAM Utilization</span>
                            <div className="flex items-center space-x-1.5 mt-0.5">
                              <div className="flex-1 bg-border h-1.5 rounded-full overflow-hidden">
                                <div className="bg-success h-full" style={{ width: `${worker.memoryUsagePercent}%` }}></div>
                              </div>
                              <span className="font-mono text-foreground font-semibold">{worker.memoryUsagePercent}%</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          <span>Current Task: </span>
                          <span className="font-mono text-foreground">{worker.currentTask || "Idle"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            {/* Recent Events Feed */}
            <Card glow={true}>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-foreground">Recent Pipeline Events</h4>
                  <Chip size="sm" variant="soft" color="accent">Real-time Feed</Chip>
                </div>
                <div className="bg-black/95 text-emerald-400 font-mono text-[10px] p-4 rounded-xl h-64 overflow-y-auto space-y-2 scrollbar-none border border-border/40">
                  {events.length === 0 ? (
                    <div className="text-center text-muted-foreground p-8">No recent system events logged.</div>
                  ) : (
                    events.map((ev) => (
                      <div key={ev.id} className="leading-normal border-b border-white/5 pb-1">
                        <span className="text-white/40 mr-2">[{new Date(ev.timestamp).toLocaleTimeString()}]</span>
                        {ev.repositoryName && <span className="text-blue-400 mr-1">[{ev.repositoryName}]</span>}
                        <span className="text-white/60 mr-1">({ev.eventType}):</span>
                        <span className={ev.logLevel === "Error" ? "text-red-400 font-bold" : ev.logLevel === "Warning" ? "text-yellow-400 font-bold" : "text-emerald-400"}>
                          {ev.message}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Connected Repositories Health Tab */}
      {activeTab === "repos" && (
        <div className="space-y-4">
          <Card glow={true} className="overflow-hidden p-0!">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/40 text-muted-foreground font-semibold uppercase tracking-wider bg-surface-secondary/20">
                    <th className="p-4">Repository</th>
                    <th className="p-4">Default Branch</th>
                    <th className="p-4">Sync Status</th>
                    <th className="p-4">Trust Rating</th>
                    <th className="p-4">Risk Profile</th>
                    <th className="p-4">Last Sync Date</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {repositories.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        No connected repositories discovered in this workspace.
                      </td>
                    </tr>
                  ) : (
                    repositories.map((repo) => {
                      const isSyncing = reposSyncing[repo.id];
                      return (
                        <tr key={repo.id} className="hover:bg-surface-secondary/40 transition-colors">
                          <td className="p-4">
                            <div className="font-semibold text-foreground">{repo.name}</div>
                            <div className="text-[10px] text-muted-foreground">{repo.owner}</div>
                          </td>
                          <td className="p-4 font-mono text-muted-foreground">{repo.defaultBranch}</td>
                          <td className="p-4">
                            <Chip
                              size="sm"
                              variant="soft"
                              color={
                                repo.latestAnalysisStatus === "Completed"
                                  ? "success"
                                  : repo.latestAnalysisStatus === "Failed"
                                  ? "danger"
                                  : repo.latestAnalysisStatus === "NeverAnalyzed"
                                  ? "default"
                                  : "accent"
                              }
                            >
                              {repo.latestAnalysisStatus === "NeverAnalyzed" ? "Never Synced" : repo.latestAnalysisStatus}
                            </Chip>
                          </td>
                          <td className="p-4">
                            {repo.trustScore > 0 ? (
                              <div className="flex items-center space-x-1">
                                <Icons.ShieldCheck className={`h-4 w-4 ${repo.trustScore >= 0.7 ? "text-success" : repo.trustScore >= 0.4 ? "text-warning" : "text-danger"}`} />
                                <span className="font-bold text-foreground font-mono">{repo.trustScore.toFixed(2)}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic">Pending</span>
                            )}
                          </td>
                          <td className="p-4">
                            {repo.latestRiskLevel ? (
                              <div className="flex items-center space-x-2">
                                <Chip
                                  size="sm"
                                  variant="soft"
                                  color={
                                    repo.latestRiskLevel === "High"
                                      ? "danger"
                                      : repo.latestRiskLevel === "Medium"
                                      ? "warning"
                                      : "success"
                                  }
                                >
                                  {repo.latestRiskLevel}
                                </Chip>
                                <span className="font-mono text-muted-foreground">({repo.latestRiskScore.toFixed(1)})</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic">No assessment</span>
                            )}
                          </td>
                          <td className="p-4 text-muted-foreground">
                            {repo.latestAnalysisCompletedAtUtc ? new Date(repo.latestAnalysisCompletedAtUtc).toLocaleString() : "Never"}
                          </td>
                          <td className="p-4 text-right">
                            <Button
                              size="sm"
                              variant="solid"
                              disabled={isSyncing || repo.latestAnalysisStatus === "Running"}
                              onClick={() => handleTriggerSync(repo.id)}
                            >
                              {isSyncing ? (
                                <Spinner size="sm" className="mr-1" />
                              ) : (
                                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                              )}
                              Trigger Sync
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Live Monitor */}
      {activeTab === "live" && (
        <div className="space-y-4">
          {activeLiveCount === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center border border-dashed border-border/60 rounded-2xl p-6 text-center text-muted-foreground">
              <Terminal className="h-8 w-8 mb-2 opacity-50" />
              <p>No active {activeMetadata.displayName} workloads running right now.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {Object.entries(displayLivePipelines).map(([id, item]) => (
                <Card key={id} glow={true}>
                  <div className="space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-foreground truncate max-w-xs">{activeMetadata.displayName} Vetting</h4>
                        <p className="text-xs text-muted-foreground">ID: {id.slice(0, 8)}...</p>
                      </div>
                      <div className="flex space-x-2">
                        <Chip size="sm" variant="soft" color={item.info.status === "Failed" ? "danger" : item.info.status === "Completed" ? "success" : "accent"}>
                          {item.info.status}
                        </Chip>
                        {item.info.status === "Running" && (
                          <Button size="sm" variant="danger" onClick={() => handleCancelPipeline(id)}>
                            <XCircle className="h-4 w-4 mr-1" />
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Progress</span>
                        <span>{item.info.progress}%</span>
                      </div>
                      <ProgressBar value={item.info.progress} size="sm" color="accent" />
                    </div>

                    {/* Console logger */}
                    <div className="bg-black/90 text-emerald-400 font-mono text-[10px] p-3 rounded-xl h-36 overflow-y-auto space-y-1 scrollbar-none">
                      {item.logs.map((log, index) => (
                        <div key={index} className="truncate">{log}</div>
                      ))}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Queue Status */}
      {activeTab === "queues" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {queues.map((q) => (
            <Card key={q.queueName} glow={true}>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-foreground capitalize">{q.queueName} Broker</h4>
                    <p className="text-xs text-muted-foreground">Length: {q.queueLength} tasks</p>
                  </div>
                  <Chip color={q.status === "Paused" ? "warning" : "success"} variant="soft" size="sm">
                    {q.status}
                  </Chip>
                </div>

                <div className="flex space-x-3 pt-2">
                  {q.status === "Active" ? (
                    <Button variant="flat" className="flex-1" onClick={() => handlePauseQueue(q.queueName)}>
                      <Pause className="h-4 w-4 mr-1" />
                      Pause Broker
                    </Button>
                  ) : (
                    <Button variant="flat" className="flex-1" onClick={() => handleResumeQueue(q.queueName)}>
                      <Play className="h-4 w-4 mr-1" />
                      Resume Broker
                    </Button>
                  )}
                  <Button variant="danger" className="flex-1" onClick={() => handleClearQueue(q.queueName)}>
                    <Trash2 className="h-4 w-4 mr-1" />
                    Purge tasks
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Execution History */}
      {activeTab === "history" && (
        <div className="space-y-4">
          <Card glow={true}>
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="relative w-full md:max-w-xs">
                <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-muted-foreground">
                  <Search className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  placeholder="Search executions by ID, candidate..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-surface-secondary border border-border/60 text-foreground outline-hidden focus:border-primary transition-colors"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full md:w-36 px-3 py-2 text-xs rounded-xl bg-surface-secondary border border-border/60 text-foreground outline-hidden"
              >
                <option value="all">All Statuses</option>
                <option value="queued">Queued</option>
                <option value="running">Running</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </Card>

          <Card glow={true} className="overflow-hidden p-0!">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/40 text-muted-foreground font-semibold uppercase tracking-wider bg-surface-secondary/20">
                    <th className="p-4">Workload ID</th>
                    <th className="p-4">Context</th>
                    <th className="p-4">Initiator</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Cost</th>
                    <th className="p-4">Execution Date</th>
                    <th className="p-4"> </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filteredExecutions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        No trace logs found for {activeMetadata.displayName}.
                      </td>
                    </tr>
                  ) : (
                    filteredExecutions.map((e) => (
                      <tr
                        key={e.id}
                        className="cursor-pointer hover:bg-surface-secondary/40 transition-colors"
                        onClick={() => handleRowClick(e.id)}
                      >
                        <td className="p-4 font-mono text-[10px] text-muted-foreground">{e.id.slice(0, 8)}...</td>
                        <td className="p-4 font-semibold text-foreground">{e.repositoryName || activeMetadata.displayName}</td>
                        <td className="p-4 text-foreground">{e.candidateName || "System"}</td>
                        <td className="p-4">
                          <Chip size="sm" variant="soft" color={e.status === "Failed" ? "danger" : e.status === "Completed" ? "success" : "accent"}>
                            {e.status}
                          </Chip>
                        </td>
                        <td className="p-4 font-semibold">${e.totalCostUsd.toFixed(3)}</td>
                        <td className="p-4 text-muted-foreground">{new Date(e.createdAtUtc).toLocaleString()}</td>
                        <td className="p-4 text-right">
                          <ChevronRight className="h-4 w-4 inline text-muted-foreground" />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Diagnostics / Failure Recovery */}
      {activeTab === "diagnostics" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card glow={true} className="lg:col-span-2 overflow-hidden p-0!">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/40 text-muted-foreground font-semibold uppercase tracking-wider bg-surface-secondary/20">
                    <th className="p-4">Workload ID</th>
                    <th className="p-4">Error Summary</th>
                    <th className="p-4">Date</th>
                    <th className="p-4"> </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {failedExecutions.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-muted-foreground">
                        No active pipeline failures found.
                      </td>
                    </tr>
                  ) : (
                    failedExecutions.map((item) => (
                      <tr
                        key={item.id}
                        className="cursor-pointer hover:bg-surface-secondary/40 transition-colors"
                        onClick={() => handleFailureClick(item.id)}
                      >
                        <td className="p-4 font-mono text-[10px] text-muted-foreground">{item.id.slice(0, 8)}...</td>
                        <td className="p-4 text-danger-400 max-w-[240px] truncate">{item.errorMessage || "Vetting branch failure"}</td>
                        <td className="p-4 text-muted-foreground">{new Date(item.createdAtUtc).toLocaleString()}</td>
                        <td className="p-4 text-right">
                          <Button size="sm" variant="solid" onClick={(e) => handleFailureRetry(e, item)}>
                            <RefreshCw className="h-3.5 w-3.5 mr-1" />
                            Retry
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Diagnostic trace side console */}
          <Card glow={true} className="flex flex-col h-[400px] lg:h-auto min-h-[300px]">
            <div className="flex flex-col h-full bg-black/95 min-w-0 p-4 rounded-2xl">
              <div className="flex items-center space-x-2 text-white/50 text-xs font-mono mb-3">
                <Terminal className="h-4 w-4" />
                <span>Diagnostics trace console</span>
              </div>
              {selectedFailureId ? (
                fetchingLogs ? (
                  <div className="flex-1 flex items-center justify-center">
                    <Spinner size="sm" color="accent" />
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto font-mono text-[10px] text-red-400 space-y-1.5 scrollbar-none">
                    {failureLog.map((line, idx) => (
                      <div key={idx} className="leading-relaxed whitespace-pre-wrap">{line}</div>
                    ))}
                  </div>
                )
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground font-mono text-xs">
                  <AlertCircle className="h-6 w-6 mb-2 opacity-50 text-warning" />
                  <span>Select a failed run to inspect stack traces.</span>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Execution Drawer */}
      <Drawer>
        <Drawer.Backdrop
          isOpen={selectedId !== null}
          onOpenChange={(open) => { if (!open) { setSelectedId(null); setDetail(null); } }}
          variant="blur"
        >
          <Drawer.Content placement="right" className="h-screen max-w-5xl w-[85vw] bg-background">
            <Drawer.Dialog className="h-full bg-background flex flex-col border-s border-border">
              <Drawer.CloseTrigger
                aria-label="Close details"
                className="absolute top-4 right-4 z-50 rounded-full bg-surface-secondary text-muted-foreground hover:text-foreground hover:bg-surface-tertiary transition-colors flex items-center justify-center h-8 w-8 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </Drawer.CloseTrigger>

              <div className="border-b border-border/60 py-4 px-6 flex justify-between items-center bg-surface">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Pipeline Run Trace</h2>
                  <p className="text-xs text-muted-foreground">ID: {selectedId}</p>
                </div>
                {detail && detail.status === "Failed" && (
                  <Button variant="solid" onClick={() => handleRetryPipeline(detail.id)}>
                    <Activity className="h-4 w-4 mr-1" />
                    Retry Workload
                  </Button>
                )}
              </div>

              <div className="flex-1 overflow-hidden flex flex-row h-full">
                {detailLoading ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-2">
                    <Spinner size="sm" color="accent" />
                    <span className="text-xs text-muted-foreground">Reconstructing trace telemetry...</span>
                  </div>
                ) : detail ? (
                  <>
                    <div className="w-1/3 border-r border-border/60 bg-surface flex flex-col h-full overflow-hidden">
                      <div className="p-6 border-b border-border/60 space-y-4">
                        <h3 className="font-bold text-foreground">Execution Parameters</h3>
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <span className="text-muted-foreground block mb-0.5">Provider / Model</span>
                            <span className="font-semibold text-foreground">{detail.provider || "N/A"} ({detail.modelName || "N/A"})</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block mb-0.5">Cumulative Cost</span>
                            <span className="font-semibold text-foreground">${detail.totalCostUsd.toFixed(4)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block mb-0.5">Vetting Context</span>
                            <span className="font-semibold text-foreground truncate block">{detail.repositoryName || "N/A"}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block mb-0.5">Total Tokens</span>
                            <span className="font-semibold text-foreground">{detail.totalInputTokens + detail.totalOutputTokens}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex-1 flex flex-col min-h-0 bg-black/95">
                        <div className="flex items-center space-x-2 px-4 py-2 border-b border-white/10 text-white/50 text-[10px] font-mono">
                          <Terminal className="h-3.5 w-3.5" />
                          <span>Telemetry Log Feed</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 font-mono text-[10px] text-emerald-400 space-y-1.5 scrollbar-none">
                          {detail.logs.map((log) => (
                            <div key={log.id} className="leading-relaxed">
                              <span className="text-white/40 select-none mr-2">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                              <span className={log.logLevel === "Error" ? "text-red-400" : log.logLevel === "Warning" ? "text-yellow-400" : ""}>
                                {log.message}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 h-full bg-surface-secondary relative">
                      <ReactFlow
                        nodes={flowNodes}
                        edges={flowEdges}
                        nodeTypes={nodeTypes}
                        fitView
                        proOptions={{ hideAttribution: true }}
                      >
                        <Background color="var(--border)" gap={16} size={1} />
                        <Controls />
                      </ReactFlow>
                    </div>
                  </>
                ) : null}
              </div>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </Drawer>
    </div>
  );
};
