import React, { useState, useEffect } from "react";
import { securityAdminService } from "@/services/security-admin.service";
import { type SecurityDashboardData } from "@/types/security.types";
import { Card, Typography, Spinner, Button, toast } from "@heroui/react";
import {
  ShieldAlert,
  RotateCw,
  UserX,
  Activity,
  AlertTriangle,
  Globe,
  CheckCircle,
  Eye
} from "lucide-react";
import { EventDetailDrawer } from "./event-detail-drawer";

export function SecurityDashboardView() {
  const [data, setData] = useState<SecurityDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const fetchDashboardData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const stats = await securityAdminService.getDashboardData();
      setData(stats);
    } catch (err) {
      console.error("Failed to fetch security dashboard metrics", err);
      toast.danger("Failed to sync security dashboard data.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchDashboardData(true);
  };

  const handleOpenDetails = (id: string) => {
    setSelectedEventId(id);
    setIsDrawerOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3 text-muted text-xs">
        <Spinner size="md" />
        <span>Aggregating threat telemetry...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20 text-muted text-xs">
        Failed to resolve administrative monitoring metrics.
      </div>
    );
  }

  const { stats, recentEvents, dailyTrends, topAttackingIps, topCountries, categoryBreakdown } = data;

  const getSeverityColor = (severity: string) => {
    const s = severity.toUpperCase();
    if (s === "CRITICAL") return "text-danger";
    if (s === "HIGH") return "text-warning";
    return "text-accent";
  };

  return (
    <div className="space-y-6 text-foreground font-outfit max-w-7xl mx-auto">
      {/* Action Header bar */}
      <div className="flex justify-end">
        <Button
          onPress={handleRefresh}
          className="rounded-xl"
        >
          <RotateCw size={14} className={isRefreshing ? "animate-spin" : ""} />
          Refresh Stats
        </Button>
      </div>

      {/* Grid of Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Threats */}
        <Card className="p-4 bg-surface border border-border rounded-2xl shadow-surface flex flex-row items-center gap-4">
          <div className="p-3.5 rounded-xl bg-danger/10 text-danger border border-danger/10">
            <ShieldAlert size={20} />
          </div>
          <div>
            <span className="text-[10px] text-muted font-bold block uppercase tracking-wider">Active Threats</span>
            <span className="text-xl font-extrabold text-foreground">{stats.activeThreats}</span>
            <span className="text-[9px] text-muted block mt-0.5">Critical/High severity</span>
          </div>
        </Card>

        {/* Unresolved Critical */}
        <Card className="p-4 bg-surface border border-border rounded-2xl shadow-surface flex flex-row items-center gap-4">
          <div className="p-3.5 rounded-xl bg-warning/10 text-warning border border-warning/10">
            <AlertTriangle size={20} />
          </div>
          <div>
            <span className="text-[10px] text-muted font-bold block uppercase tracking-wider">Unresolved Critical</span>
            <span className="text-xl font-extrabold text-foreground">{stats.unresolvedCritical}</span>
            <span className="text-[9px] text-muted block mt-0.5">Immediate containment required</span>
          </div>
        </Card>

        {/* Failed Logins Today */}
        <Card className="p-4 bg-surface border border-border rounded-2xl shadow-surface flex flex-row items-center gap-4">
          <div className="p-3.5 rounded-xl bg-accent/10 text-accent border border-accent/10">
            <UserX size={20} />
          </div>
          <div>
            <span className="text-[10px] text-muted font-bold block uppercase tracking-wider">Failed Logins Today</span>
            <span className="text-xl font-extrabold text-foreground">{stats.failedLoginsToday}</span>
            <span className="text-[9px] text-muted block mt-0.5">Brute-force check threshold</span>
          </div>
        </Card>

        {/* MTTR (Mean Time to Resolution) */}
        <Card className="p-4 bg-surface border border-border rounded-2xl shadow-surface flex flex-row items-center gap-4">
          <div className="p-3.5 rounded-xl bg-success/10 text-success border border-success/10">
            <Activity size={20} />
          </div>
          <div>
            <span className="text-[10px] text-muted font-bold block uppercase tracking-wider">Mean Response (MTTR)</span>
            <span className="text-xl font-extrabold text-foreground">{stats.avgMttrHours.toFixed(1)} hrs</span>
            <span className="text-[9px] text-muted block mt-0.5">Average resolve time (30d)</span>
          </div>
        </Card>
      </div>

      {/* Diagnostics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Trend Graph (SVG) */}
        <Card className="lg:col-span-2 p-5 bg-surface border border-border rounded-2xl shadow-surface flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-extrabold uppercase text-muted tracking-wider mb-1">Threat Incident Velocity</h3>
            <span className="text-[10px] text-muted">Daily security alerts over the last 7 calendar days.</span>
          </div>

          {/* Simple Static SVG Chart block */}
          <div className="h-40 w-full mt-4 flex items-end justify-between border-b border-separator pb-1 gap-2 font-mono text-[9px] text-muted">
            {dailyTrends.map((t, idx) => {
              const maxVal = Math.max(...dailyTrends.map(x => x.eventCount)) || 1;
              const barHeight = Math.max(10, (t.eventCount / maxVal) * 100);
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                  <span className="font-bold text-foreground text-[10px]">{t.eventCount}</span>
                  <div className="w-full bg-accent/10 border border-accent/20 rounded-t-lg transition-all" style={{ height: `${barHeight}%` }}>
                    {t.criticalCount > 0 && <div className="bg-danger h-2 rounded-t-md" title={`${t.criticalCount} Critical Events`} />}
                  </div>
                  <span className="uppercase tracking-wider">{t.timeLabel}</span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Threat Origin lists */}
        <Card className="p-5 bg-surface border border-border rounded-2xl shadow-surface space-y-5">
          <div>
            <h3 className="text-xs font-extrabold uppercase text-muted tracking-wider mb-1">Top Attacking Origins</h3>
            <span className="text-[10px] text-muted">Telemetry indicators by country and IP.</span>
          </div>

          {/* IPs and Countries */}
          <div className="space-y-4 text-xs">
            {/* Countries list */}
            <div>
              <span className="text-[10px] font-bold text-muted uppercase block border-b border-separator/40 pb-1 mb-2">Countries</span>
              {topCountries.length === 0 ? (
                <span className="text-[10px] text-muted italic">No geographic data logged.</span>
              ) : (
                <div className="space-y-1.5">
                  {topCountries.map((c, i) => (
                    <div key={i} className="flex justify-between items-center">
                      <span className="flex items-center gap-1.5"><Globe size={12} className="text-muted" /> Code: {c.key}</span>
                      <span className="font-mono text-muted">{c.value} events</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* IP addresses list */}
            <div>
              <span className="text-[10px] font-bold text-muted uppercase block border-b border-separator/40 pb-1 mb-2">Offending IPs</span>
              {topAttackingIps.length === 0 ? (
                <span className="text-[10px] text-muted italic">No attacking IPs logged.</span>
              ) : (
                <div className="space-y-1.5 font-mono">
                  {topAttackingIps.map((ip, i) => (
                    <div key={i} className="flex justify-between items-center">
                      <span className="text-foreground">{ip.key}</span>
                      <span className="text-muted">{ip.value} events</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Category Breakdown & Recent Signals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Category Breakdown */}
        <Card className="p-5 bg-surface border border-border rounded-2xl shadow-surface space-y-4">
          <div>
            <h3 className="text-xs font-extrabold uppercase text-muted tracking-wider mb-1">Signals by Category</h3>
            <span className="text-[10px] text-muted">Distribution breakdown of threats.</span>
          </div>

          <div className="space-y-3 text-xs">
            {categoryBreakdown.length === 0 ? (
              <span className="text-muted italic">No records.</span>
            ) : (
              categoryBreakdown.map((item, idx) => {
                const total = categoryBreakdown.reduce((acc, curr) => acc + curr.value, 0) || 1;
                const percentage = ((item.value / total) * 100).toFixed(0);
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="font-bold text-foreground">{item.key}</span>
                      <span className="text-muted font-mono">{item.value} ({percentage}%)</span>
                    </div>
                    <div className="w-full bg-border/40 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-accent h-full" style={{ width: `${percentage}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* Recent Events List */}
        <Card className="lg:col-span-2 p-5 bg-surface border border-border rounded-2xl shadow-surface space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xs font-extrabold uppercase text-muted tracking-wider mb-1">Recent Telemetry Signals</h3>
              <span className="text-[10px] text-muted">Latest 10 security alerts streaming from backend channels.</span>
            </div>
          </div>

          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {recentEvents.length === 0 ? (
              <div className="text-center py-10 text-muted text-xs">No recent threat events logged.</div>
            ) : (
              recentEvents.map((e) => (
                <div
                  key={e.id}
                  onClick={() => handleOpenDetails(e.id)}
                  className="p-3 rounded-xl border border-separator/40 hover:bg-surface-secondary/40 select-none cursor-pointer flex justify-between items-center gap-4 text-xs transition-colors"
                >
                  <div className="space-y-0.5 truncate flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold uppercase tracking-wider text-[9px] ${getSeverityColor(e.severity)}`}>
                        [{e.severity}]
                      </span>
                      <span className="font-bold text-foreground">{e.eventType.replace(/_/g, " ")}</span>
                    </div>
                    <span className="text-muted text-[11px] block truncate">{e.description}</span>
                  </div>

                  <div className="text-right whitespace-nowrap flex items-center gap-3">
                    <div className="flex flex-col text-[10px] text-muted font-mono">
                      <span>IP: {e.ipAddress || "Internal"}</span>
                      <span>{new Date(e.createdAt).toLocaleTimeString()}</span>
                    </div>
                    <Eye size={14} className="text-muted hover:text-foreground" />
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Drawer Overlay for Event Insights */}
      <EventDetailDrawer
        isOpen={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        eventId={selectedEventId}
        onClose={() => { setIsDrawerOpen(false); setSelectedEventId(null); }}
        onUpdateSuccess={() => fetchDashboardData(true)}
      />
    </div>
  );
}
