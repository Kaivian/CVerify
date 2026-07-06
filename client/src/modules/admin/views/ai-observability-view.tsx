"use client";

import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { ProgressBar, Chip, Spinner, Tabs } from "@heroui/react";
import {
  Globe,
  Server
} from "lucide-react";
import { aiOperationsService, type AiPipelineStats, type AiProvider, type AiWorker } from "../services/ai-operations.service";

export const AiObservabilityView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>("analytics");
  const [stats, setStats] = useState<AiPipelineStats | null>(null);
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [workers, setWorkers] = useState<AiWorker[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadTelemetry = async () => {
    try {
      const [statsData, providersData, workersData] = await Promise.all([
        aiOperationsService.getStats(),
        aiOperationsService.getProviders(),
        aiOperationsService.getWorkers()
      ]);
      setStats(statsData);
      setProviders(providersData);
      setWorkers(workersData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTelemetry();
    const interval = setInterval(loadTelemetry, 5000);
    return () => clearInterval(interval);
  }, []);

  // Compute SVG Line coordinates for Cost trends
  const svgLinePoints = React.useMemo(() => {
    if (!stats || !stats.dailyTrends || stats.dailyTrends.length === 0) return "";
    const trends = stats.dailyTrends;
    const maxCost = Math.max(...trends.map(t => Number(t.costUsd)), 0.1);
    
    return trends.map((t, idx) => {
      const x = (idx / (trends.length - 1)) * 600 + 40;
      const y = 180 - (Number(t.costUsd) / maxCost) * 140;
      return `${x},${y}`;
    }).join(" ");
  }, [stats]);

  if (loading) {
    return (
      <div className="flex h-[400px] flex-col items-center justify-center gap-2">
        <Spinner size="sm" color="accent" />
        <span className="text-xs text-muted-foreground">Syncing Observability Telemetry...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">AI Observability & Costs</h1>
        <p className="text-sm text-muted-foreground">Monitor token consumption rate, model execution pricing, and provider status.</p>
      </div>

      {/* Tabs */}
      <Tabs
        selectedKey={activeTab}
        onSelectionChange={(key) => setActiveTab(key as string)}
        variant="secondary"
        className="mb-4"
      >
        <Tabs.ListContainer>
          <Tabs.List aria-label="Observability tabs" className="gap-6 border-b border-border/40">
            <Tabs.Tab id="analytics" className="pb-1.5 text-xs font-semibold select-none cursor-pointer">
              <span>Cost & Token Analytics</span>
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="providers" className="pb-1.5 text-xs font-semibold select-none cursor-pointer">
              <span>Model Providers ({providers.length})</span>
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="workers" className="pb-1.5 text-xs font-semibold select-none cursor-pointer">
              <span>Background Workers ({workers.length})</span>
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>

      {activeTab === "analytics" && stats && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Custom SVG Spending Chart */}
          <Card glow={true} className="xl:col-span-2">
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-foreground">Spending Trend (7 Days)</h4>
                  <p className="text-xs text-muted-foreground">Daily USD expenditure across LLM providers.</p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-muted-foreground">Total (7D)</span>
                  <span className="font-bold block text-foreground">${stats.dailyTrends.reduce((sum, t) => sum + Number(t.costUsd), 0).toFixed(3)}</span>
                </div>
              </div>

              {/* SVG Line Graph */}
              <div className="relative h-56 w-full border-b border-l border-border/40 pb-2">
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
                      <path
                        d={`M 40,180 L ${svgLinePoints} L 640,180 Z`}
                        fill="url(#areaGrad)"
                      />
                      <polyline
                        fill="none"
                        stroke="#006FEE"
                        strokeWidth="3"
                        points={svgLinePoints}
                      />
                    </>
                  )}

                  {stats.dailyTrends.map((t, idx) => {
                    const maxCost = Math.max(...stats.dailyTrends.map(x => Number(x.costUsd)), 0.1);
                    const cx = (idx / (stats.dailyTrends.length - 1)) * 600 + 40;
                    const cy = 180 - (Number(t.costUsd) / maxCost) * 140;
                    return (
                      <g key={idx} className="group">
                        <circle
                          cx={cx}
                          cy={cy}
                          r="5"
                          fill="var(--background)"
                          stroke="#006FEE"
                          strokeWidth="2.5"
                          className="cursor-pointer hover:r-7 transition-all"
                        />
                        <text x={cx} y={cy - 12} textAnchor="middle" className="fill-foreground font-mono text-[9px] font-bold opacity-0 group-hover:opacity-100 transition-opacity bg-background">
                          ${t.costUsd.toFixed(3)}
                        </text>
                      </g>
                    );
                  })}
                </svg>
                {/* X Axis labels */}
                <div className="absolute bottom-0 left-10 right-10 flex justify-between text-[10px] text-muted-foreground font-mono transform translate-y-6">
                  {stats.dailyTrends.map(t => (
                    <span key={t.date}>{new Date(t.date).toLocaleDateString(undefined, { weekday: 'short' })}</span>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* Model Breakdown */}
          <Card glow={true}>
            <div className="space-y-4">
              <h4 className="font-bold text-foreground">Cost Distribution</h4>
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Google Gemini Pro</span>
                  <span className="font-semibold text-foreground">62% ($0.28 USD)</span>
                </div>
                <ProgressBar value={62} size="sm" color="success" />

                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">OpenAI GPT-4o</span>
                  <span className="font-semibold text-foreground">28% ($0.12 USD)</span>
                </div>
                <ProgressBar value={28} size="sm" color="accent" />

                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Claude 3.5 Sonnet</span>
                  <span className="font-semibold text-foreground">10% ($0.04 USD)</span>
                </div>
                <ProgressBar value={10} size="sm" color="warning" />
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === "providers" && (
        <Card glow={true} className="overflow-hidden p-0!">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-border/40 text-muted-foreground font-semibold uppercase tracking-wider bg-surface-secondary/20">
                  <th className="p-4">Provider name</th>
                  <th className="p-4">Model Status</th>
                  <th className="p-4">API Latency</th>
                  <th className="p-4">Requests/Sec</th>
                  <th className="p-4">Error rate</th>
                  <th className="p-4">Rate Limits</th>
                  <th className="p-4">Accumulated Cost</th>
                  <th className="p-4">Routing fallback</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {providers.map((p) => (
                  <tr key={p.providerName}>
                    <td className="p-4 font-bold text-foreground text-sm flex items-center space-x-2">
                      <Globe className="h-4 w-4 text-primary" />
                      <span>{p.providerName}</span>
                    </td>
                    <td className="p-4">
                      <Chip color={p.healthStatus === "Healthy" ? "success" : "warning"} variant="soft" size="sm">
                        {p.healthStatus}
                      </Chip>
                    </td>
                    <td className="p-4 font-mono text-sm text-foreground">{p.latencyMs} ms</td>
                    <td className="p-4 text-sm text-foreground">{p.requestsPerSec} r/s</td>
                    <td className={`p-4 text-sm font-semibold ${p.errorRate > 0 ? "text-danger" : "text-foreground"}`}>
                      {(p.errorRate * 100).toFixed(1)}%
                    </td>
                    <td className="p-4 text-xs text-muted-foreground">{p.rateLimitStatus}</td>
                    <td className="p-4 text-sm font-bold text-foreground">${p.accumulatedCost.toFixed(3)}</td>
                    <td className="p-4 text-xs text-muted-foreground">{p.fallbackStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {activeTab === "workers" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {workers.map((w) => (
            <Card key={w.workerName} glow={true}>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <Server className="h-5 w-5 text-primary" />
                    <h4 className="font-bold text-foreground">{w.workerName}</h4>
                  </div>
                  <Chip size="sm" color="success" variant="soft">
                    Active
                  </Chip>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-muted-foreground block mb-0.5">Container ID</span>
                    <span className="font-mono text-foreground">{w.containerId}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block mb-0.5">Current Task</span>
                    <span className="font-semibold text-foreground truncate block">{w.currentTask}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block mb-0.5">CPU Load</span>
                    <span className="font-semibold text-foreground">{w.cpuUsagePercent}%</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block mb-0.5">Memory Load</span>
                    <span className="font-semibold text-foreground">{w.memoryUsagePercent}%</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/20 text-[10px] text-muted-foreground font-mono">
                  <span>Heartbeat: {new Date(w.lastHeartbeat).toLocaleTimeString()}</span>
                  <span>Version: {w.version}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
