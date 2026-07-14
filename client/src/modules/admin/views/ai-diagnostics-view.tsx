"use client";

import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Chip, Spinner, Tabs } from "@heroui/react";
import {
  AlertTriangle,
  Terminal,
  FileText,
  User,
  Shield,
  Play
} from "lucide-react";
import { aiOperationsService, type AiPipelineListItem } from "../services/ai-operations.service";

export const AiDiagnosticsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>("failures");
  const [failedPipelines, setFailedPipelines] = useState<AiPipelineListItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedFailureId, setSelectedFailureId] = useState<string | null>(null);
  const [failureLog, setFailureLog] = useState<string[]>([]);
  const [fetchingLogs, setFetchingLogs] = useState<boolean>(false);

  const loadFailures = async () => {
    try {
      setLoading(true);
      const data = await aiOperationsService.getPipelines(undefined, "Failed");
      setFailedPipelines(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFailures();
  }, []);

  const handleRowClick = async (id: string) => {
    try {
      setSelectedFailureId(id);
      setFetchingLogs(true);
      const detail = await aiOperationsService.getPipelineDetail(id);

      const logs = detail.logs.map(l => `[${l.logLevel}] ${l.message}`);
      if (detail.errorMessage) {
        logs.push(`[Fatal Error] ${detail.errorMessage}`);
      }
      setFailureLog(logs);
    } catch (e) {
      console.error(e);
    } finally {
      setFetchingLogs(false);
    }
  };

  const handleRetry = async (e: React.MouseEvent, item: AiPipelineListItem) => {
    e.stopPropagation();
    try {
      await aiOperationsService.retryPipeline(item.id, item.pipelineId);
      loadFailures();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">AI Diagnostics & Audits</h1>
        <p className="text-sm text-muted-foreground">Inspect failed tasks, retry execution branches, and browse security audit logs.</p>
      </div>

      {/* Tabs */}
      <Tabs
        selectedKey={activeTab}
        onSelectionChange={(key) => setActiveTab(key as string)}
        variant="secondary"
        className="mb-4"
      >
        <Tabs.ListContainer>
          <Tabs.List aria-label="Diagnostics tabs" className="gap-6 border-b border-border/40">
            <Tabs.Tab id="failures" className="pb-1.5 text-xs font-semibold select-none cursor-pointer">
              <span>Failures & Recovery ({failedPipelines.length})</span>
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="audit" className="pb-1.5 text-xs font-semibold select-none cursor-pointer">
              <span>Operations Audit Timeline</span>
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>

      {activeTab === "failures" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Failure List Table */}
          <Card glow={true} className="lg:col-span-2 overflow-hidden p-0!">
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
                      <th className="p-4">Error Summary</th>
                      <th className="p-4">Date</th>
                      <th className="p-4"> </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {failedPipelines.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-muted-foreground">
                          No pipeline failures found.
                        </td>
                      </tr>
                    ) : (
                      failedPipelines.map((item) => (
                        <tr
                          key={item.id}
                          className="cursor-pointer hover:bg-surface-secondary/40 transition-colors"
                          onClick={() => handleRowClick(item.id)}
                        >
                          <td className="p-4 font-mono text-[10px] text-muted-foreground">{item.id.slice(0, 8)}...</td>
                          <td className="p-4 font-semibold text-foreground">{item.pipelineId}</td>
                          <td className="p-4 text-danger-400 max-w-[200px] truncate">{item.errorMessage || "Unknown Vetting Failure"}</td>
                          <td className="p-4 text-muted-foreground">{new Date(item.createdAtUtc).toLocaleString()}</td>
                          <td className="p-4 text-right">
                            <Button size="sm" variant="solid" onClick={(e) => handleRetry(e, item)}>
                              <Play className="h-3.5 w-3.5 mr-1" />
                              Retry
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </Card>

          {/* Side-by-side terminal log trace */}
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
                  <AlertTriangle className="h-6 w-6 mb-2 opacity-50 text-warning" />
                  <span>Select a failed run to inspect stack traces.</span>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {activeTab === "audit" && (
        <Card glow={true}>
          {/* Audit log steps timeline */}
          <div className="relative border-l border-border/60 ml-4 pl-6 space-y-8 py-2">
            <div className="relative">
              <div className="absolute left-[-31px] top-0 rounded-full bg-success/20 p-1 text-success border border-success/30">
                <Shield className="h-3.5 w-3.5" />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">admin:ai:queue:paused</span>
                  <span className="font-mono">Today, 2:10 PM</span>
                </div>
                <p className="text-sm text-foreground font-semibold">Queue broker 'ai' paused.</p>
                <p className="text-xs text-muted-foreground flex items-center space-x-1">
                  <User className="h-3 w-3" />
                  <span>Actor: admin@cverify.com (Correlation ID: 8a71b29a)</span>
                </p>
              </div>
            </div>

            <div className="relative">
              <div className="absolute left-[-31px] top-0 rounded-full bg-primary/20 p-1 text-primary border border-primary/30">
                <FileText className="h-3.5 w-3.5" />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">admin:ai:pipeline:cancelled</span>
                  <span className="font-mono">Yesterday, 4:45 PM</span>
                </div>
                <p className="text-sm text-foreground font-semibold">Pipeline cancelled (ID: 41b81fa9-a031-4bf1-a083-ef12999cb182).</p>
                <p className="text-xs text-muted-foreground flex items-center space-x-1">
                  <User className="h-3 w-3" />
                  <span>Actor: admin@cverify.com (Correlation ID: 9b2311cb)</span>
                </p>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
