"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProgressBar, Chip, Spinner, Tabs, Drawer } from "@heroui/react";
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
import {
  Search,
  ChevronRight,
  Terminal,
  Activity,
  X
} from "lucide-react";
import { aiOperationsService, type AiPipelineListItem, type AiPipelineDetail } from "../services/ai-operations.service";

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
            <div className="bg-primary h-full rounded-full" style={{ width: `${customData.progress}%` }} />
          </div>
        )}
      </div>
    </div>
  );
};

const nodeTypes = { customTask: CustomTaskNode };

export const AiExecutionsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>("pipelines");
  const [executions, setExecutions] = useState<AiPipelineListItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  
  // Drawer Detail State
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AiPipelineDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);

  const loadExecutions = async () => {
    try {
      setLoading(true);
      const data = await aiOperationsService.getPipelines();
      setExecutions(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExecutions();
  }, []);

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

  const handleRetryPipeline = async (id: string, type: string) => {
    try {
      await aiOperationsService.retryPipeline(id, type);
      if (selectedId) handleRowClick(selectedId);
      loadExecutions();
    } catch (e) {
      console.error(e);
    }
  };

  const filteredExecutions = useMemo(() => {
    return executions.filter(item => {
      const matchSearch = (item.id.toLowerCase().includes(search.toLowerCase()) ||
        (item.candidateName && item.candidateName.toLowerCase().includes(search.toLowerCase())) ||
        (item.repositoryName && item.repositoryName.toLowerCase().includes(search.toLowerCase())));
      
      const matchStatus = statusFilter === "all" || item.status.toLowerCase() === statusFilter.toLowerCase();
      const matchType = typeFilter === "all" || item.pipelineId.toLowerCase() === typeFilter.toLowerCase();

      return matchSearch && matchStatus && matchType;
    });
  }, [executions, search, statusFilter, typeFilter]);

  // DAG Nodes & Edges Configuration for Drawer
  const { flowNodes, flowEdges } = useMemo(() => {
    if (!detail) return { flowNodes: [], flowEdges: [] };

    // Static DAG structure for Repository Vetting
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

    // Compute task statuses from detail
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
  }, [detail]);

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">AI Executions Explorer</h1>
        <p className="text-sm text-muted-foreground">Durable execution trace logs, performance metrics, and task graphs.</p>
      </div>

      {/* Explorer Controls */}
      <Card glow={true}>
        <div className="gap-4 flex flex-col md:flex-row items-center justify-between">
          <div className="relative w-full md:max-w-xs">
            <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-muted-foreground">
              <Search className="h-4 w-4" />
            </span>
            <input
              type="text"
              placeholder="Search by ID, candidate, repo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-surface-secondary border border-border/60 text-foreground outline-hidden focus:border-primary transition-colors"
            />
          </div>

          <div className="flex space-x-3 w-full md:w-auto">
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

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full md:w-44 px-3 py-2 text-xs rounded-xl bg-surface-secondary border border-border/60 text-foreground outline-hidden"
            >
              <option value="all">All Types</option>
              <option value="repository-analysis">Repository Analysis</option>
              <option value="candidate-assessment">Candidate Assessment</option>
              <option value="jd-generation">JD Generation</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Table grid */}
      <Card glow={true} className="overflow-hidden p-0!">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <Spinner size="sm" color="accent" />
            </div>
          ) : (
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-border/40 text-muted-foreground font-semibold uppercase tracking-wider bg-surface-secondary/20">
                  <th className="p-4">Workload ID</th>
                  <th className="p-4">Pipeline Type</th>
                  <th className="p-4">Target Context</th>
                  <th className="p-4">Initiator</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Cost Today</th>
                  <th className="p-4">Execution Date</th>
                  <th className="p-4"> </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filteredExecutions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground">
                      No pipeline trace logs found.
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
                      <td className="p-4 font-semibold text-foreground">{e.pipelineId}</td>
                      <td className="p-4 text-foreground">{e.repositoryName || e.pipelineId}</td>
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
          )}
        </div>
      </Card>

      {/* Execution trace details Drawer */}
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
                  <Button variant="solid" onClick={() => handleRetryPipeline(detail.id, detail.pipelineId)}>
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
                    {/* Left Side: Summary & Terminal Logs */}
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

                      {/* Log Ticker */}
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

                    {/* Right Side: Graph Visual Orchestrator */}
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
