"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
  Database,
  ShieldCheck,
  Cpu,
  Clock,
  RefreshCw,
  Server,
  CheckCircle2,
  AlertTriangle,
  Terminal,
  Compass,
  ArrowUpRight,
  Zap,
  Gauge,
  Cloud
} from 'lucide-react';
import { systemApi } from '../../../services/system.service';
import { type SystemTelemetryData } from '../../../types/system.types';

// Helper to log telemetry updates in development environment only
const logDev = (message: string, data?: unknown) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`%c[Status Dashboard]%c ${message}`, 'color: #10b981; font-weight: bold;', 'color: inherit;', data || '');
  }
};

export default function SystemStatusPage() {
  const [telemetry, setTelemetry] = useState<SystemTelemetryData>({
    health: null,
    ping: null,
    version: null,
    latency: null,
    lastChecked: null,
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState<boolean>(false);

  // Auto-refresh countdown tracking (30 seconds)
  const [countdown, setCountdown] = useState<number>(30);

  /**
   * Triggers the full diagnostic suite asynchronously:
   * 1. Measures connection ping and calculates round-trip latency.
   * 2. Queries structured multi-service health checking (DB, Redis, Auth).
   * 3. Queries software versioning and environments details.
   */
  const runDiagnostics = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    setIsRefreshing(true);
    setErrorMsg(null);
    logDev('Starting live frontend-backend diagnostic sequence...');

    try {
      // 1. Measure ping latency
      const pingResult = await systemApi.ping();

      // 2. Fetch multi-service health (resolves normally even if 503 degraded)
      const healthData = await systemApi.fetchHealth();

      // 3. Fetch software versioning metadata
      const versionData = await systemApi.fetchVersion();

      setTelemetry({
        health: healthData,
        ping: pingResult.response,
        version: versionData,
        latency: pingResult.latency,
        lastChecked: new Date().toLocaleTimeString(),
      });

      logDev('Diagnostic sequence completed successfully.', {
        health: healthData,
        latency: pingResult.latency,
        version: versionData
      });
    } catch (err: unknown) {
      const error = err as Error;
      logDev('Diagnostic sequence encountered an execution error.', error);

      // Attempt to retrieve fallback version data or general connection failure message
      setErrorMsg(
        error.message ||
        'Unable to establish a socket connection to the CVerify API server. Check your network or API endpoint status.'
      );

      setTelemetry({
        health: null,
        ping: null,
        version: null,
        latency: null,
        lastChecked: new Date().toLocaleTimeString(),
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setCountdown(30); // reset the countdown timer
    }
  }, []);

  // Initial load
  useEffect(() => {
    queueMicrotask(() => {
      runDiagnostics();
    });
  }, [runDiagnostics]);

  // Countdown timer and auto-refresh loop
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          logDev('Auto-refresh countdown reached zero. Restarting diagnostics...');
          runDiagnostics(true); // run silently in the background
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [runDiagnostics]);

  // Determine overall status based on health service indicators
  const getOverallStatus = () => {
    if (isLoading && !telemetry.lastChecked) return 'loading';
    if (errorMsg || !telemetry.health) return 'offline';

    const db = telemetry.health.services.database;
    const redis = telemetry.health.services.redis;
    const auth = telemetry.health.services.auth;
    const ai = telemetry.health.services.ai || 'unhealthy';
    const cloudflare = telemetry.health.services.cloudflare || 'unhealthy';

    if (db === 'healthy' && redis === 'healthy' && auth === 'healthy' && ai === 'healthy' && cloudflare === 'healthy') {
      return 'healthy';
    }
    return 'degraded';
  };

  const overallStatus = getOverallStatus();

  return (
    <div className="dark min-h-screen flex flex-col justify-between bg-background text-foreground font-sans selection:bg-accent/30 selection:text-accent relative overflow-hidden">

      {/* Visual Ambient Blur Accents */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-cyan-900/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-indigo-950/10 blur-[150px] pointer-events-none" />

      {/* Main Status Container */}
      <main className="max-w-5xl w-full mx-auto px-4 py-12 md:py-16 flex-1 flex flex-col justify-center relative z-10">

        {/* Brand Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-surface border border-border flex items-center justify-center shadow-lg group">
              <Compass size={24} className="text-accent group-hover:rotate-45 transition-transform duration-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                CVerify AI <span className="text-muted text-sm font-normal">/ status</span>
              </h1>
              <p className="text-xs text-muted">
                Public service availability, API latency, and diagnostic dashboard
              </p>
            </div>
          </div>

          {/* Interactive controls */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted flex items-center gap-1.5 bg-surface/40 px-3 py-1.5 rounded-full border border-border/60">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              Auto-refreshing in <span className="font-mono text-accent font-medium">{countdown}s</span>
            </span>

            <button
              onClick={() => runDiagnostics()}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-surface hover:bg-surface-secondary border border-border hover:border-border/80 text-xs font-semibold tracking-wide text-foreground/80 hover:text-foreground transition-all disabled:opacity-50 select-none shadow-md"
            >
              <RefreshCw size={13} className={`text-accent ${isRefreshing ? 'animate-spin' : ''}`} />
              Run Diagnostics
            </button>
          </div>
        </div>

        {/* Global Progress Countdown Bar */}
        <div className="w-full h-[3px] bg-surface-secondary rounded-full mb-8 overflow-hidden">
          <div
            className="h-full bg-linear-to-r from-accent to-indigo-500 transition-all duration-1000 ease-linear rounded-full"
            style={{ width: `${(countdown / 30) * 100}%` }}
          />
        </div>

        {/* LOADING STATE PLACEHOLDER */}
        {isLoading && !telemetry.lastChecked ? (
          <div className="space-y-6">
            {/* Header Glass Card Skeleton */}
            <div className="h-44 rounded-2xl bg-surface/30 border border-border/40 backdrop-blur-md animate-pulse flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <Compass className="text-accent/40 animate-spin-slow" size={40} />
                <span className="text-xs text-muted font-semibold tracking-wider">COMPILING TELEMETRY DIAGNOSTICS...</span>
              </div>
            </div>

            {/* Grid Skeletons */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 rounded-xl bg-surface/30 border border-border/40 backdrop-blur-md animate-pulse" />
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6">

            {/* 1. HERO GENERAL STATUS BANNER */}
            <div className={`p-6 md:p-8 rounded-2xl border backdrop-blur-md shadow-2xl relative overflow-hidden transition-all duration-500 ${overallStatus === 'healthy'
                ? 'bg-emerald-950/20 border-emerald-500/30 shadow-emerald-950/10'
                : overallStatus === 'degraded'
                  ? 'bg-amber-950/20 border-amber-500/30 shadow-amber-950/10'
                  : 'bg-rose-950/20 border-rose-500/30 shadow-rose-950/10'
              }`}>

              {/* Corner status glow backdrop */}
              <div className={`absolute top-0 right-0 w-60 h-60 rounded-full blur-[80px] opacity-20 pointer-events-none translate-x-20 -translate-y-20 transition-all ${overallStatus === 'healthy'
                  ? 'bg-emerald-500'
                  : overallStatus === 'degraded'
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
                }`} />

              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
                <div className="space-y-2">
                  <div className="flex items-center gap-2.5">
                    <span className="relative flex h-3.5 w-3.5">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${overallStatus === 'healthy'
                          ? 'bg-emerald-400'
                          : overallStatus === 'degraded'
                            ? 'bg-amber-400'
                            : 'bg-rose-400'
                        }`} />
                      <span className={`relative inline-flex rounded-full h-3.5 w-3.5 ${overallStatus === 'healthy'
                          ? 'bg-emerald-500'
                          : overallStatus === 'degraded'
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        }`} />
                    </span>
                    <span className={`text-sm font-extrabold uppercase tracking-widest ${overallStatus === 'healthy'
                        ? 'text-emerald-400'
                        : overallStatus === 'degraded'
                          ? 'text-amber-400'
                          : 'text-rose-400'
                      }`}>
                      {overallStatus === 'healthy'
                        ? 'Operational'
                        : overallStatus === 'degraded'
                          ? 'Degraded Performance'
                          : 'API Offline'}
                    </span>
                  </div>

                  <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
                    {overallStatus === 'healthy' && 'All systems are operating normally.'}
                    {overallStatus === 'degraded' && 'Some systems are experiencing outages.'}
                    {overallStatus === 'offline' && 'Failed to establish connection to core APIs.'}
                  </h2>

                  <p className="text-xs text-muted max-w-xl">
                    {overallStatus === 'healthy' && 'We are monitoring API gateways, background workers, permission models, database queries, and storage targets. No incidents detected.'}
                    {overallStatus === 'degraded' && 'We have detected minor health degradation on one or more services. Engineers are automatically alerted.'}
                    {overallStatus === 'offline' && 'The connection to the backend was terminated or refused. Gateway returned an unresolvable response. Telemetry details below.'}
                  </p>
                </div>

                <div className="flex flex-col bg-surface/60 border border-border px-5 py-4 rounded-xl items-start md:items-end min-w-[200px] backdrop-blur-lg">
                  <span className="text-[10px] text-muted uppercase tracking-widest font-semibold mb-1">
                    LAST CHECKED METRIC
                  </span>
                  <span className="text-base font-bold text-foreground font-mono">
                    {telemetry.lastChecked || 'Never'}
                  </span>
                  <span className="text-[10px] text-accent/80 font-medium mt-1 flex items-center gap-1">
                    <Zap size={10} /> Active development port
                  </span>
                </div>
              </div>
            </div>

            {/* 2. INCIDENT & ERROR METRICS PANEL */}
            {errorMsg && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex gap-3 items-center backdrop-blur-md">
                <AlertTriangle size={18} className="text-rose-400 shrink-0" />
                <div className="space-y-0.5">
                  <span className="font-bold block">Connectivity Alert:</span>
                  <p className="text-rose-300/80">{errorMsg}</p>
                </div>
              </div>
            )}

            {/* 3. CORE SERVICE GRID SUMMARY */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

              {/* 1. CORE BACKEND SERVICE */}
              <div className="p-5 rounded-xl bg-surface-secondary/40 border border-border backdrop-blur-md shadow-lg transition-all duration-300 hover:border-border/85 group">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2.5 rounded-lg bg-surface border border-border text-accent group-hover:text-foreground transition-colors">
                    <Server size={18} />
                  </div>
                  {telemetry.ping ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      online
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/20">
                      offline
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-bold text-foreground mb-1">CVerify Core Backend</h3>
                <p className="text-xs text-muted mb-3">
                  Confirms that the client dashboard is successfully connected to the ASP.NET Core backend gateway.
                </p>
                <div className="text-[10px] text-muted flex justify-between items-center border-t border-border pt-2.5">
                  <span>Probing status:</span>
                  <span className="font-mono text-foreground/80">/api/system/ping</span>
                </div>
              </div>

              {/* 2. DATABASE SERVICE */}
              <div className="p-5 rounded-xl bg-surface-secondary/40 border border-border backdrop-blur-md shadow-lg transition-all duration-300 hover:border-border/85 group">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2.5 rounded-lg bg-surface border border-border text-accent group-hover:text-foreground transition-colors">
                    <Database size={18} />
                  </div>
                  {telemetry.health ? (
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${telemetry.health.services.database === 'healthy'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                      {telemetry.health.services.database}
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-surface text-muted border border-border">
                      offline
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-bold text-foreground mb-1">PostgreSQL Database</h3>
                <p className="text-xs text-muted mb-3">
                  Hosts traveler registrations, customizable credentials, evaluation logs, and metadata.
                </p>
                <div className="text-[10px] text-muted flex justify-between items-center border-t border-border pt-2.5">
                  <span>Probing status:</span>
                  <span className="font-mono text-foreground/80">CanConnect() API</span>
                </div>
              </div>

              {/* 3. REDIS DISTRIBUTED STATE */}
              <div className="p-5 rounded-xl bg-surface-secondary/40 border border-border backdrop-blur-md shadow-lg transition-all duration-300 hover:border-border/85 group">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2.5 rounded-lg bg-surface border border-border text-accent group-hover:text-foreground transition-colors">
                    <Cpu size={18} />
                  </div>
                  {telemetry.health ? (
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${telemetry.health.services.redis === 'healthy'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                      {telemetry.health.services.redis}
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-surface text-muted border border-border">
                      offline
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-bold text-foreground mb-1">Redis In-Memory Cache</h3>
                <p className="text-xs text-muted mb-3">
                  Handles session validation buffers, rate-limiting session pools, and caching policies.
                </p>
                <div className="text-[10px] text-muted flex justify-between items-center border-t border-border pt-2.5">
                  <span>Multiplexer:</span>
                  <span className="font-mono text-foreground/80">IsConnected API</span>
                </div>
              </div>

              {/* 4. SECURITY AUTH INFRASTRUCTURE */}
              <div className="p-5 rounded-xl bg-surface-secondary/40 border border-border backdrop-blur-md shadow-lg transition-all duration-300 hover:border-border/85 group">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2.5 rounded-lg bg-surface border border-border text-accent group-hover:text-foreground transition-colors">
                    <ShieldCheck size={18} />
                  </div>
                  {telemetry.health ? (
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${telemetry.health.services.auth === 'healthy'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                      {telemetry.health.services.auth}
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-surface text-muted border border-border">
                      offline
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-bold text-foreground mb-1">Auth & Identity Security</h3>
                <p className="text-xs text-muted mb-3">
                  Issues JWT access tokens, validates brute-force attempts, and processes role permissions.
                </p>
                <div className="text-[10px] text-muted flex justify-between items-center border-t border-border pt-2.5">
                  <span>Mechanism:</span>
                  <span className="font-mono text-foreground/80">Secure HttpOnly Cookies</span>
                </div>
              </div>

              {/* 5. AI PLANNER MICROSERVICE */}
              <div className="p-5 rounded-xl bg-surface-secondary/40 border border-border backdrop-blur-md shadow-lg transition-all duration-300 hover:border-border/85 group">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2.5 rounded-lg bg-surface border border-border text-accent group-hover:text-foreground transition-colors">
                    <Zap size={18} />
                  </div>
                  {telemetry.health ? (
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${(telemetry.health.services.ai || 'unhealthy') === 'healthy'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                      {telemetry.health.services.ai || 'unhealthy'}
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-surface text-muted border border-border">
                      offline
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-bold text-foreground mb-1">AI Travel Planner Brain</h3>
                <p className="text-xs text-muted mb-3">
                  Powers qualification assessment brains, metadata sanitization, and classification engines.
                </p>
                <div className="text-[10px] text-muted flex justify-between items-center border-t border-border pt-2.5">
                  <span>Connection check:</span>
                  <span className="font-mono text-foreground/80">/health/ready</span>
                </div>
              </div>

              {/* 6. CLOUDFLARE R2 STORAGE */}
              <div className="p-5 rounded-xl bg-surface-secondary/40 border border-border backdrop-blur-md shadow-lg transition-all duration-300 hover:border-border/85 group">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2.5 rounded-lg bg-surface border border-border text-accent group-hover:text-foreground transition-colors">
                    <Cloud size={18} />
                  </div>
                  {telemetry.health ? (
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${(telemetry.health.services.cloudflare || 'unhealthy') === 'healthy'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                      {telemetry.health.services.cloudflare || 'unhealthy'}
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-surface text-muted border border-border">
                      offline
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-bold text-foreground mb-1">Cloudflare R2 Storage</h3>
                <p className="text-xs text-muted mb-3">
                  Stores qualification evidence, certificate backups, user profile images, and binary blobs.
                </p>
                <div className="text-[10px] text-muted flex justify-between items-center border-t border-border pt-2.5">
                  <span>Connection check:</span>
                  <span className="font-mono text-foreground/80">ListObjectsV2 API</span>
                </div>
              </div>

            </div>

            {/* 4. PERFORMANCE TELEMETRY & SYSTEM DETAILS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Telemetry Metrics */}
              <div className="p-6 rounded-xl bg-surface-secondary/40 border border-border backdrop-blur-md space-y-4">
                <h3 className="text-xs font-bold text-muted uppercase tracking-widest flex items-center gap-2">
                  <Gauge size={14} className="text-accent" />
                  API Performance Metrics
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-surface border border-border">
                    <span className="text-[10px] text-muted font-semibold block mb-1">ROUND-TRIP LATENCY</span>
                    {telemetry.latency !== null ? (
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold font-mono text-accent">
                          {telemetry.latency}
                        </span>
                        <span className="text-[10px] font-bold text-muted">ms</span>
                      </div>
                    ) : (
                      <span className="text-sm font-bold text-muted/60 font-mono">-- ms</span>
                    )}
                  </div>

                  <div className="p-4 rounded-lg bg-surface border border-border">
                    <span className="text-[10px] text-muted font-semibold block mb-1">PING VERIFY</span>
                    {telemetry.ping ? (
                      <span className="text-sm font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                        <CheckCircle2 size={12} /> {telemetry.ping.message}
                      </span>
                    ) : (
                      <span className="text-sm font-bold text-rose-500 uppercase tracking-wider flex items-center gap-1">
                        <AlertTriangle size={12} /> FAILED
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-3.5 rounded-lg bg-surface/40 border border-border flex justify-between items-center text-xs text-muted">
                  <span className="flex items-center gap-1.5">
                    <Clock size={13} className="text-muted/60" />
                    Estimated connection state:
                  </span>
                  <span className="font-semibold text-foreground/90">
                    {telemetry.latency !== null
                      ? telemetry.latency < 50
                        ? 'Excellent (Local Host)'
                        : telemetry.latency < 200
                          ? 'Optimal (Broadband)'
                          : 'Delayed'
                      : 'Offline'}
                  </span>
                </div>
              </div>

              {/* Server Details */}
              <div className="p-6 rounded-xl bg-surface-secondary/40 border border-border backdrop-blur-md flex flex-col justify-between">
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-muted uppercase tracking-widest flex items-center gap-2">
                    <Server size={14} className="text-accent" />
                    Environment & Software Releases
                  </h3>

                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1">
                      <span className="text-[10px] text-muted uppercase font-semibold">Active Profile</span>
                      <span className="font-bold text-foreground/80 block">
                        {telemetry.version?.environment || 'Development'}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] text-muted uppercase font-semibold">Software Version</span>
                      <span className="font-bold text-foreground/80 block">
                        v{telemetry.version?.version || '1.0.0'}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] text-muted uppercase font-semibold">CORS Protocol</span>
                      <span className="font-bold text-foreground/80 block">
                        Credentials Enabled
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] text-muted uppercase font-semibold">Build Date Target</span>
                      <span className="font-bold text-foreground/80 block">
                        {telemetry.version?.buildDate || '2026-05-14'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-border text-[10px] text-muted flex justify-between items-center">
                  <span>Server core build:</span>
                  <span className="font-mono text-muted">Next.js 16 Client + ASP.NET Core 10.0</span>
                </div>
              </div>

            </div>

            {/* 5. TECHNICAL TELEMETRY RAW PREVIEW */}
            <div className="rounded-xl border border-border bg-surface/40 backdrop-blur-md overflow-hidden">
              <button
                onClick={() => setShowRawJson(!showRawJson)}
                className="w-full flex justify-between items-center px-6 py-4 hover:bg-surface-secondary/10 transition-colors text-xs font-semibold text-foreground/80"
              >
                <span className="flex items-center gap-2">
                  <Terminal size={14} className="text-accent" />
                  Show Technical Telemetry
                </span>
                <span className="text-[10px] font-mono bg-surface-secondary border border-border text-muted px-2 py-0.5 rounded">
                  {showRawJson ? 'COLLAPSE' : 'EXPAND'}
                </span>
              </button>

              {showRawJson && (
                <div className="border-t border-border p-5 bg-background font-mono text-[11px] text-foreground/80 overflow-x-auto space-y-4 max-h-[300px] overflow-y-auto">
                  <div className="space-y-1">
                    <span className="text-accent text-xs font-bold font-sans flex items-center gap-1 select-none">
                      <ArrowUpRight size={10} /> Health Status Endpoint Payload (GET /api/system/health)
                    </span>
                    <pre className="text-muted p-2.5 rounded bg-surface-secondary/40 border border-border">
                      {JSON.stringify(telemetry.health, null, 2)}
                    </pre>
                  </div>

                  <div className="space-y-1">
                    <span className="text-accent text-xs font-bold font-sans flex items-center gap-1 select-none">
                      <ArrowUpRight size={10} /> Connection Ping Endpoint Payload (GET /api/system/ping)
                    </span>
                    <pre className="text-muted p-2.5 rounded bg-surface-secondary/40 border border-border">
                      {JSON.stringify(telemetry.ping, null, 2)}
                    </pre>
                  </div>

                  <div className="space-y-1">
                    <span className="text-accent text-xs font-bold font-sans flex items-center gap-1 select-none">
                      <ArrowUpRight size={10} /> Versioning Release Endpoint Payload (GET /api/system/version)
                    </span>
                    <pre className="text-muted p-2.5 rounded bg-surface-secondary/40 border border-border">
                      {JSON.stringify(telemetry.version, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

      </main>

      {/* Footer Branding */}
      <footer className="w-full max-w-5xl mx-auto px-4 py-8 border-t border-border/60 relative z-10 flex flex-col sm:flex-row justify-between items-center gap-4 text-[11px] text-muted font-medium">
        <div className="flex items-center gap-1.5">
          <span>&copy; {new Date().getFullYear()} CVerify AI Inc. All rights reserved.</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="/login" className="hover:text-foreground transition-colors">Access Console</a>
          <span className="text-muted/40">|</span>
          <span className="text-muted flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Cloud Gateways Live
          </span>
        </div>
      </footer>

    </div>
  );
}
