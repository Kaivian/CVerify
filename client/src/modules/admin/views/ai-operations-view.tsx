"use client";

import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProgressBar, Chip, Spinner, Tabs } from "@heroui/react";
import {
  Activity,
  Play,
  Pause,
  Trash2,
  AlertCircle,
  Coins,
  Cpu,
  RefreshCw,
  Terminal,
  XCircle,
  CheckCircle2,
  Server
} from "lucide-react";
import { aiOperationsService, type AiPipelineStats, type AiQueue, type AiPipelineListItem } from "../services/ai-operations.service";

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

export const AiOperationsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [stats, setStats] = useState<AiPipelineStats | null>(null);
  const [queues, setQueues] = useState<AiQueue[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [livePipelines, setLivePipelines] = useState<Record<string, {
    info: AiPipelineListItem;
    logs: string[];
  }>>({});

  // Active queues polling and stats load
  const loadData = async () => {
    try {
      const [statsData, queuesData, activeList] = await Promise.all([
        aiOperationsService.getStats(),
        aiOperationsService.getQueues(),
        aiOperationsService.getPipelines(undefined, "Running", 1, 10)
      ]);
      setStats(statsData);
      setQueues(queuesData);

      // Populate initial running pipelines from DB
      const initialLive: Record<string, { info: AiPipelineListItem; logs: string[] }> = {};
      activeList.forEach(item => {
        initialLive[item.id] = {
          info: item,
          logs: item.errorMessage ? [`[Error] ${item.errorMessage}`] : ["Initializing telemetry..."]
        };
      });
      setLivePipelines(prev => ({ ...initialLive, ...prev }));
    } catch (error) {
      console.error("Failed to load operations center telemetry", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  // SSE progress stream subscription
  useEffect(() => {
    const sseUrl = "/api/admin/ai/operations/progress-stream";
    const eventSource = new EventSource(sseUrl);

    eventSource.onmessage = (event) => {
      if (event.data === "[DONE]") return;

      try {
        const evt = JSON.parse(event.data) as LivePipelineEvent;
        if (!evt.jobId) return;

        setLivePipelines((prev) => {
          const existing = prev[evt.jobId];
          const newLogs = existing ? [...existing.logs] : [];
          
          if (evt.message) {
            const prefix = evt.logLevel ? `[${evt.logLevel}] ` : "";
            newLogs.push(`${prefix}${evt.message}`);
            if (newLogs.length > 50) newLogs.shift();
          }

          // Build item
          const updatedItem: AiPipelineListItem = existing?.info || {
            id: evt.jobId,
            pipelineId: evt.eventType === "SESSION_STARTED" ? "AI Workload" : "Unknown",
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

          // Remove completed/failed runs after 10s
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

    eventSource.onerror = (err) => {
      console.error("Operations Center SSE closed or disconnected", err);
    };

    return () => {
      eventSource.close();
    };
  }, []);

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

  const handleCancelPipeline = async (id: string, type: string) => {
    try {
      await aiOperationsService.cancelPipeline(id, type);
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[400px] flex-col items-center justify-center gap-2">
        <Spinner size="sm" color="accent" />
        <span className="text-xs text-muted-foreground">Connecting to AI Operations Center...</span>
      </div>
    );
  }

  const activeLiveCount = Object.keys(livePipelines).length;

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">AI Operations Center</h1>
          <p className="text-sm text-muted-foreground">Real-time scheduling controls, worker pools, and active message brokers.</p>
        </div>
        <Button variant="bordered" onClick={loadData}>
          <RefreshCw className="h-3.5 w-3.5 mr-1" />
          Sync States
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
              <span>System Overview</span>
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="live" className="pb-1.5 text-xs font-semibold select-none cursor-pointer">
              <span>Live Monitor ({activeLiveCount})</span>
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="queues" className="pb-1.5 text-xs font-semibold select-none cursor-pointer">
              <span>Queue Managers ({queues.length})</span>
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>

      {/* Tab Panels */}
      {activeTab === "overview" && stats && (
        <div className="space-y-6">
          {/* KPI Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card glow={true}>
              <div className="flex flex-row items-center space-x-4">
                <div className="rounded-xl bg-primary/10 p-3 text-primary">
                  <Activity className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-0.5">Active Pipelines</p>
                  <h3 className="text-2xl font-extrabold text-foreground">{stats.activePipelines}</h3>
                </div>
              </div>
            </Card>

            <Card glow={true}>
              <div className="flex flex-row items-center space-x-4">
                <div className="rounded-xl bg-success/10 p-3 text-success">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-0.5">Completed Today</p>
                  <h3 className="text-2xl font-extrabold text-foreground">{stats.completedToday}</h3>
                </div>
              </div>
            </Card>

            <Card glow={true}>
              <div className="flex flex-row items-center space-x-4">
                <div className="rounded-xl bg-danger/10 p-3 text-danger">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-0.5">Failures Today</p>
                  <h3 className="text-2xl font-extrabold text-foreground">{stats.failedToday}</h3>
                </div>
              </div>
            </Card>

            <Card glow={true}>
              <div className="flex flex-row items-center space-x-4">
                <div className="rounded-xl bg-warning/10 p-3 text-warning">
                  <Coins className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-0.5">Cost Today</p>
                  <h3 className="text-2xl font-extrabold text-foreground">${stats.costToday.toFixed(3)}</h3>
                </div>
              </div>
            </Card>
          </div>

          {/* Infrastructure Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card glow={true} className="lg:col-span-2">
              <div className="space-y-4">
                <h4 className="font-bold text-foreground">Worker Node Health</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm p-3 bg-surface-secondary/50 rounded-xl">
                    <div className="flex items-center space-x-2">
                      <Cpu className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-foreground">cverify-ai-worker-01</span>
                    </div>
                    <Chip size="sm" color="success" variant="soft">Healthy</Chip>
                  </div>
                  <div className="flex justify-between items-center text-sm p-3 bg-surface-secondary/50 rounded-xl">
                    <div className="flex items-center space-x-2">
                      <Cpu className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-foreground">cverify-ai-worker-02</span>
                    </div>
                    <Chip size="sm" color="success" variant="soft">Healthy</Chip>
                  </div>
                </div>
              </div>
            </Card>

            <Card glow={true}>
              <div className="space-y-4">
                <h4 className="font-bold text-foreground">Broker Throughput</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Total Enqueued:</span>
                    <span className="font-semibold text-foreground">{stats.pendingQueue} tasks</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Broker Type:</span>
                    <span className="font-semibold text-foreground">Redis Broker</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Active Streams:</span>
                    <span className="font-semibold text-foreground">{stats.activeSseConnections} clients</span>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {activeTab === "live" && (
        <div className="space-y-4">
          {activeLiveCount === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center border border-dashed border-border/60 rounded-2xl p-6 text-center text-muted-foreground">
              <Terminal className="h-8 w-8 mb-2 opacity-50" />
              <p>No active pipelines running right now.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {Object.entries(livePipelines).map(([id, item]) => (
                <Card key={id} glow={true}>
                  <div className="space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-foreground truncate max-w-xs">{item.info.pipelineId}</h4>
                        <p className="text-xs text-muted-foreground">ID: {id.slice(0, 8)}...</p>
                      </div>
                      <div className="flex space-x-2">
                        <Chip size="sm" variant="soft" color={item.info.status === "Failed" ? "danger" : item.info.status === "Completed" ? "success" : "accent"}>
                          {item.info.status}
                        </Chip>
                        {item.info.status === "Running" && (
                          <Button size="sm" variant="danger" onClick={() => handleCancelPipeline(id, item.info.pipelineId)}>
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
    </div>
  );
};
