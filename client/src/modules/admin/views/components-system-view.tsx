"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { Card } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { getComponentNodes } from "../../../components/registry";
import { PreviewSandbox } from "../../../components/registry/preview-sandbox";
import { useComponentSystemStore, ExplorerView, PreviewTheme, PreviewDevice } from "../../../stores/use-component-system-store";
import { useSearchParams } from "next/navigation";
import {
  Search,
  SlidersHorizontal,
  ChevronRight,
  ExternalLink,
  Code,
  Network,
  X,
  Keyboard,
  ShieldCheck,
  Zap,
  Activity,
  AlertTriangle,
  FileText,
  Settings
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Dynamically import React Flow Canvas to safeguard Next.js SSR hydration compliance
const ComponentsDependencyGraph = dynamic(
  () => import("./components-dependency-graph"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[620px] rounded-2xl bg-surface animate-pulse border-2 border-border/60 flex flex-col items-center justify-center gap-3 text-muted select-none">
        <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-semibold">Initializing Dependency Graph Canvas...</span>
      </div>
    )
  }
);

// ============================================================================
// 1. Primary Components System Workspace Dashboard
// ============================================================================
export const ComponentsSystemView: React.FC = () => {
  const searchParams = useSearchParams();
  const routeView = searchParams?.get("view") as ExplorerView | null;

  const {
    activeView,
    setView,
    searchQuery,
    setSearchQuery,
    selectedComponentId,
    selectComponent,
    previewTheme,
    setTheme,
    previewDevice,
    setDevice,
    cmdKOpen,
    setCmdKOpen
  } = useComponentSystemStore();

  const [activeTag, setActiveTag] = useState<string>("all");
  const [activeMaturity, setActiveMaturity] = useState<string>("all");

  // Sync router search view state to Zustand store post-hydration
  useEffect(() => {
    if (routeView) {
      setView(routeView);
    }
  }, [routeView, setView]);

  // Load registered nodes
  const allNodes = useMemo(() => getComponentNodes(), []);

  // Compute stats for analytics dashboard
  const stats = useMemo(() => {
    const total = allNodes.length;
    const atoms = allNodes.filter(n => n.category === "atom").length;
    const molecules = allNodes.filter(n => n.category === "molecule").length;
    const organisms = allNodes.filter(n => n.category === "organism").length;
    const stable = allNodes.filter(n => n.status === "stable").length;
    const beta = allNodes.filter(n => n.status === "beta").length;
    const experimental = allNodes.filter(n => n.status === "experimental").length;
    
    // Average Risk score
    const avgRisk = total > 0 
      ? (allNodes.reduce((acc, val) => acc + val.dependencyRisk, 0) / total).toFixed(1)
      : "0";

    // Overall Governance design health score (e.g. based on accessibility & stability ratios)
    const healthyA11y = allNodes.filter(n => n.a11yCompliant).length;
    const healthScore = total > 0
      ? Math.round(((healthyA11y / total) * 0.5 + (stable / total) * 0.5) * 100)
      : 100;

    return { total, atoms, molecules, organisms, stable, beta, experimental, avgRisk, healthScore };
  }, [allNodes]);

  // List all distinct tags dynamically to satisfy dynamic classification requirements
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    allNodes.forEach(node => node.tags.forEach(t => tags.add(t)));
    return ["all", ...Array.from(tags)];
  }, [allNodes]);

  // Command-K keyboard event listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdKOpen(!cmdKOpen);
      }
      if (e.key === "Escape") {
        setCmdKOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cmdKOpen, setCmdKOpen]);

  // Filtering implementation matching name, tags, and category criteria
  const filteredNodes = useMemo(() => {
    return allNodes.filter((node) => {
      // Category filter (Overview matches everything, otherwise matches category mapping)
      if (activeView !== "overview" && activeView !== "graph" && activeView !== "analytics" && activeView !== "settings") {
        // Map ExplorerView (plural atoms) to category (singular atom)
        const singularCategory = activeView.replace(/s$/, "") as any;
        if (node.category !== singularCategory) return false;
      }

      // Dynamic category selection check for Experimental / Deprecated
      if (activeView === "experimental" && node.status !== "experimental") return false;
      if (activeView === "deprecated" && node.status !== "legacy") return false;

      // Fuzzy Search matching name, description or tags
      if (searchQuery.trim() !== "") {
        const query = searchQuery.toLowerCase();
        const matchesName = node.name.toLowerCase().includes(query);
        const matchesDesc = node.description.toLowerCase().includes(query);
        const matchesTag = node.tags.some(t => t.toLowerCase().includes(query));
        if (!matchesName && !matchesDesc && !matchesTag) return false;
      }

      // Tag filter
      if (activeTag !== "all" && !node.tags.includes(activeTag)) return false;

      // Maturity filter
      if (activeMaturity !== "all" && node.status !== activeMaturity) return false;

      return true;
    });
  }, [allNodes, activeView, searchQuery, activeTag, activeMaturity]);

  const activeComponent = useMemo(() => {
    if (!selectedComponentId) return null;
    return allNodes.find(n => n.id === selectedComponentId) || null;
  }, [selectedComponentId, allNodes]);

  return (
    <div className="space-y-6 font-outfit select-none relative min-h-screen pb-16">
      {/* 1. Header Hero section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-surface border-2 border-border/60">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              Components Intelligence Platform
            </h1>
          </div>
          <p className="text-xs text-muted font-medium">
            Inspect composition hierarchy, track reusability index, and govern frontend architectures dynamically.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="solid"
            size="sm"
            onClick={() => setCmdKOpen(true)}
            className="cursor-pointer bg-surface-secondary text-foreground hover:bg-border/20 border border-border/60"
          >
            <Keyboard size={14} className="mr-1.5" />
            <span>Search Command Finder</span>
            <span className="ml-2 scale-90 px-1 py-0.5 rounded-md text-[9px] font-mono bg-border/40 font-bold border border-border/30">
              Ctrl+K
            </span>
          </Button>
        </div>
      </div>

      {/* 2. Interactive Views Navigation Switch */}
      {activeView === "analytics" && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card glow={false} className="p-5 border-2 border-border/60">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1">
                  Design Governance Score
                </span>
                <span className="text-3xl font-extrabold text-foreground">{stats.healthScore}%</span>
              </div>
              <div className="w-9 h-9 rounded-lg bg-success/15 border border-success/20 text-success flex items-center justify-center">
                <ShieldCheck size={18} />
              </div>
            </div>
            <p className="text-[10px] text-muted mt-3">Stability compliance matches strict accessibility standards.</p>
          </Card>

          <Card glow={false} className="p-5 border-2 border-border/60">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1">
                  Total Library Elements
                </span>
                <span className="text-3xl font-extrabold text-foreground">{stats.total}</span>
              </div>
              <div className="w-9 h-9 rounded-lg bg-accent/15 border border-accent/20 text-accent flex items-center justify-center">
                <Zap size={18} />
              </div>
            </div>
            <p className="text-[10px] text-muted mt-3">{stats.atoms} Atoms • {stats.molecules} Molecules • {stats.organisms} Organisms</p>
          </Card>

          <Card glow={false} className="p-5 border-2 border-border/60">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1">
                  Maturity Status Index
                </span>
                <span className="text-3xl font-extrabold text-foreground">
                  {Math.round((stats.stable / stats.total) * 100)}%
                </span>
              </div>
              <div className="w-9 h-9 rounded-lg bg-warning/15 border border-warning/20 text-warning flex items-center justify-center">
                <Activity size={18} />
              </div>
            </div>
            <p className="text-[10px] text-muted mt-3">{stats.stable} Stable • {stats.beta} Beta • {stats.experimental} Experimental</p>
          </Card>

          <Card glow={false} className="p-5 border-2 border-border/60">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1">
                  Cascade Risk Index
                </span>
                <span className="text-3xl font-extrabold text-foreground">{stats.avgRisk}</span>
              </div>
              <div className="w-9 h-9 rounded-lg bg-danger/15 border border-danger/20 text-danger flex items-center justify-center">
                <AlertTriangle size={18} />
              </div>
            </div>
            <p className="text-[10px] text-muted mt-3">Calculated average risk score across nested component paths.</p>
          </Card>
        </div>
      )}

      {/* 3. Search, Filter Panels & Category Views */}
      {activeView !== "graph" && activeView !== "analytics" && activeView !== "settings" && (
        <div className="flex flex-col gap-4">
          {/* Main search input bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" size={16} />
              <input
                type="text"
                placeholder="Fuzzy search by name, tag, description or dependencies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-10 pr-4 rounded-xl border-2 border-border/60 bg-surface text-sm focus-visible:outline-none focus-visible:border-accent font-semibold transition-all duration-200"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground cursor-pointer border-0 bg-transparent"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Quick dropdown filter categories */}
            <div className="flex gap-2">
              <select
                value={activeTag}
                onChange={(e) => setActiveTag(e.target.value)}
                className="h-10 px-3 rounded-xl border-2 border-border/60 bg-surface text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:border-accent cursor-pointer"
              >
                {allTags.map(tag => (
                  <option key={tag} value={tag}>
                    Tag: {tag === "all" ? "All Tags" : tag}
                  </option>
                ))}
              </select>

              <select
                value={activeMaturity}
                onChange={(e) => setActiveMaturity(e.target.value)}
                className="h-10 px-3 rounded-xl border-2 border-border/60 bg-surface text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:border-accent cursor-pointer"
              >
                <option value="all">Maturity: All</option>
                <option value="stable">Stable</option>
                <option value="beta">Beta</option>
                <option value="experimental">Experimental</option>
                <option value="legacy">Legacy / Deprecated</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* 4. Core Render Workspace (Framer Motion Grid or Graph Canvas) */}
      <AnimatePresence mode="wait">
        {activeView === "graph" ? (
          <motion.div
            key="graph-view"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
          >
            <ComponentsDependencyGraph />
          </motion.div>
        ) : activeView === "settings" ? (
          <motion.div
            key="settings-view"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="p-8 rounded-2xl bg-surface border-2 border-border/60 flex flex-col items-center justify-center text-center max-w-md mx-auto"
          >
            <Settings className="w-12 h-12 text-accent mb-4 animate-spin" />
            <h3 className="text-base font-bold text-foreground">Future Governance Settings</h3>
            <p className="text-xs text-muted max-w-xs mt-1">
              Configure AST automated analyzer pipelines, provision custom component scoring metrics rules, and enable Slack notification alert webhooks.
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="grid-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filteredNodes.length > 0 ? (
              filteredNodes.map((item) => (
                <Card
                  key={item.id}
                  glow={false}
                  className={[
                    "p-5 hover:scale-[1.01] hover:border-accent/40 active:scale-100 border-2 border-border/60 relative overflow-hidden transition-all duration-200 cursor-pointer flex flex-col justify-between min-h-[220px]",
                    selectedComponentId === item.id ? "border-accent/60 shadow-md scale-[1.01]" : ""
                  ].join(" ")}
                  onClick={() => selectComponent(item.id)}
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-muted uppercase tracking-wider bg-surface-secondary border border-border/60 px-2 py-0.5 rounded-md">
                        {item.category}
                      </span>
                      <span className={[
                        "text-[9px] font-bold px-1.5 py-0.5 rounded-md border",
                        item.status === "stable" ? "bg-success/15 border-success/20 text-success" :
                        item.status === "beta" ? "bg-warning/15 border-warning/20 text-warning" : "bg-purple-500/15 border-purple-500/20 text-purple-400"
                      ].join(" ")}>
                        {item.status}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <h3 className="text-base font-bold text-foreground flex items-center gap-1.5">
                        {item.name}
                        {item.a11yCompliant && (
                          <span className="w-1.5 h-1.5 rounded-full bg-success" title="Accessibility compliant" />
                        )}
                      </h3>
                      <p className="text-xs text-muted leading-relaxed line-clamp-3">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-border/20 pt-4 flex justify-between items-center text-[10px] text-muted mt-3">
                    <span>Reused in: {item.usedIn.length}</span>
                    <span className="text-accent hover:underline flex items-center gap-1">
                      Open Inspector <ChevronRight size={10} />
                    </span>
                  </div>
                </Card>
              ))
            ) : (
              <div className="col-span-full py-16 text-center text-muted select-none flex flex-col items-center justify-center gap-3">
                <Search size={32} className="opacity-40 animate-pulse" />
                <p className="text-sm font-semibold">No registered components match active filters.</p>
                <p className="text-xs text-muted/60">Try searching for core atoms like "Button" or "Card".</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 5. Slide-Out Detail Inspector Panel */}
      <AnimatePresence>
        {activeComponent && (
          <div className="fixed inset-0 z-50 flex justify-end">
            {/* Dark background modal overlay mask */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => selectComponent(null)}
              className="absolute inset-0 bg-[#000000] cursor-pointer"
            />

            {/* Sliding Panel */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="relative w-full max-w-2xl h-full bg-background border-l-2 border-border/80 shadow-2xl flex flex-col justify-between overflow-hidden"
            >
              {/* Header section */}
              <div className="p-6 border-b border-border/60 flex items-center justify-between select-none">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-muted uppercase tracking-wider bg-surface-secondary border border-border/60 px-2.5 py-0.5 rounded-md">
                      {activeComponent.category}
                    </span>
                    <span className={[
                      "text-[9px] font-bold px-1.5 py-0.5 rounded-md border",
                      activeComponent.status === "stable" ? "bg-success/15 border-success/20 text-success" :
                      activeComponent.status === "beta" ? "bg-warning/15 border-warning/20 text-warning" : "bg-purple-500/15 border-purple-500/20 text-purple-400"
                    ].join(" ")}>
                      {activeComponent.status}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-foreground flex items-center gap-2 mt-1">
                    {activeComponent.name} Inspector
                  </h2>
                </div>
                <button
                  onClick={() => selectComponent(null)}
                  className="w-8 h-8 rounded-full bg-surface hover:bg-border/20 border border-border/60 flex items-center justify-center text-muted hover:text-foreground transition-all duration-200 cursor-pointer border-0"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Scrollable details panel */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Visual Metadata Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-surface-secondary/40 p-4 rounded-xl border border-border/60 select-none">
                  <div>
                    <span className="text-[9px] font-bold text-muted uppercase tracking-wider block">Reuse Score</span>
                    <span className="text-sm font-extrabold text-foreground">{activeComponent.reuseScore} dependents</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-muted uppercase tracking-wider block">Maturity Level</span>
                    <span className="text-sm font-extrabold text-foreground">{activeComponent.status}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-muted uppercase tracking-wider block">Dependency Risk</span>
                    <span className="text-sm font-extrabold text-foreground">{activeComponent.dependencyRisk}/5 score</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-muted uppercase tracking-wider block">Last Updated</span>
                    <span className="text-sm font-extrabold text-foreground">{activeComponent.lastUpdated}</span>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Governance Details</h4>
                  <p className="text-sm text-muted leading-relaxed select-text">
                    {activeComponent.description}
                  </p>
                </div>

                {/* Live Preview Harness Box */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center select-none">
                    <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                      <Zap size={14} className="text-accent animate-pulse" />
                      Live Preview Sandbox
                    </h4>
                    <div className="flex gap-2">
                      <select
                        value={previewTheme}
                        onChange={(e) => setTheme(e.target.value as PreviewTheme)}
                        className="h-8 px-2 rounded-lg border border-border bg-surface text-[10px] font-semibold text-foreground focus-visible:outline-none cursor-pointer"
                      >
                        <option value="light">Theme: Light</option>
                        <option value="dark">Theme: Dark</option>
                        <option value="high-contrast">Theme: Contrast</option>
                      </select>

                      <select
                        value={previewDevice}
                        onChange={(e) => setDevice(e.target.value as PreviewDevice)}
                        className="h-8 px-2 rounded-lg border border-border bg-surface text-[10px] font-semibold text-foreground focus-visible:outline-none cursor-pointer"
                      >
                        <option value="desktop">Device: Desktop</option>
                        <option value="tablet">Device: Tablet</option>
                        <option value="mobile">Device: Mobile</option>
                      </select>
                    </div>
                  </div>

                  <PreviewSandbox
                    componentId={activeComponent.id}
                    theme={previewTheme}
                    device={previewDevice}
                  />
                </div>

                {/* Dependency and Composition Relationships */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 select-none border-t border-border/20 pt-6">
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1">
                      <Network size={12} />
                      Uses (Child Elements)
                    </h4>
                    {activeComponent.composedOf.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {activeComponent.composedOf.map((c) => (
                          <span
                            key={c}
                            onClick={() => selectComponent(c)}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-border/80 bg-surface-secondary text-foreground hover:border-accent/40 cursor-pointer transition-all duration-200"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted">This component is a leaf atom and uses no child elements.</span>
                    )}
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1">
                      <FileText size={12} />
                      Used In (Composing Parents)
                    </h4>
                    {activeComponent.usedIn.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {activeComponent.usedIn.map((c) => (
                          <span
                            key={c}
                            onClick={() => {
                              if (allNodes.some(n => n.id === c)) {
                                selectComponent(c);
                              }
                            }}
                            className={[
                              "px-2.5 py-1 rounded-lg text-xs font-semibold border border-border/80 bg-surface-secondary text-foreground transition-all duration-200",
                              allNodes.some(n => n.id === c) ? "hover:border-accent/40 cursor-pointer" : "opacity-80"
                            ].join(" ")}
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted">Not composed in any parent elements.</span>
                    )}
                  </div>
                </div>

                {/* Code Snippets Snippet View */}
                <div className="space-y-3 pt-6 border-t border-border/20">
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1">
                    <Code size={12} />
                    Import & Implementation Snippet
                  </h4>
                  <div className="rounded-xl border border-border/80 bg-zinc-950 p-4 font-mono text-[11px] text-zinc-300 select-text overflow-x-auto max-h-56">
                    <pre>{activeComponent.codeSnippet}</pre>
                  </div>
                </div>
              </div>

              {/* Panel Footer */}
              <div className="p-4 border-t border-border/60 bg-surface flex justify-between select-none">
                <div className="flex flex-col justify-center text-[10px] text-muted">
                  <span>Owner: {activeComponent.owner}</span>
                  <span>Maintainers: {activeComponent.maintainers.join(", ")}</span>
                </div>
                <Button
                  variant="bordered"
                  size="sm"
                  onClick={() => selectComponent(null)}
                  className="cursor-pointer"
                >
                  Close Inspector
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 6. Floating CMD-K Command Finder Panel */}
      <AnimatePresence>
        {cmdKOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Modal mask overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setCmdKOpen(false)}
              className="absolute inset-0 bg-black/60 cursor-pointer"
            />

            {/* Command finder dialog box */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg bg-surface border-2 border-border/80 shadow-2xl rounded-2xl overflow-hidden flex flex-col justify-between"
            >
              {/* Finder search input */}
              <div className="relative border-b border-border/60 p-4">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                <input
                  type="text"
                  placeholder="Type a component, view, or category name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-11 pl-10 pr-4 rounded-xl border-0 bg-transparent text-sm focus-visible:outline-none font-semibold text-foreground"
                  autoFocus
                />
              </div>

              {/* Suggestions results scroll list */}
              <div className="max-h-[300px] overflow-y-auto p-2 space-y-1">
                {/* Suggestions header */}
                <div className="text-[10px] font-bold text-muted/60 uppercase tracking-wider px-3 py-1 select-none">
                  Quick Actions & Views
                </div>
                
                <button
                  onClick={() => {
                    setView("overview");
                    setCmdKOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-foreground hover:bg-accent/10 hover:text-accent transition-all duration-200 cursor-pointer border-0 bg-transparent flex justify-between items-center"
                >
                  <span>Go to Overview Dashboard</span>
                  <span className="scale-90 px-1 py-0.5 rounded bg-border/40 text-[9px]">View</span>
                </button>

                <button
                  onClick={() => {
                    setView("graph");
                    setCmdKOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-foreground hover:bg-accent/10 hover:text-accent transition-all duration-200 cursor-pointer border-0 bg-transparent flex justify-between items-center"
                >
                  <span>Go to Interactive Dependency Graph</span>
                  <span className="scale-90 px-1 py-0.5 rounded bg-border/40 text-[9px]">Canvas</span>
                </button>

                {/* Components results */}
                <div className="text-[10px] font-bold text-muted/60 uppercase tracking-wider px-3 py-2 select-none border-t border-border/20 mt-2">
                  Matching Component Registry
                </div>

                {filteredNodes.length > 0 ? (
                  filteredNodes.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        selectComponent(item.id);
                        setCmdKOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-foreground hover:bg-accent/10 hover:text-accent transition-all duration-200 cursor-pointer border-0 bg-transparent flex justify-between items-center"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-surface-secondary text-muted uppercase">
                          {item.category}
                        </span>
                        <span>{item.name}</span>
                      </div>
                      <span className="text-[10px] text-muted italic">Inspect component</span>
                    </button>
                  ))
                ) : (
                  <div className="text-xs text-muted text-center py-4 select-none">
                    No components match search query.
                  </div>
                )}
              </div>

              {/* Command bar footer tips */}
              <div className="p-3 border-t border-border/60 bg-surface-secondary/40 flex justify-between items-center text-[10px] text-muted select-none">
                <span>Use Arrow keys to navigate, Enter to select</span>
                <span>Press ESC to close</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ComponentsSystemView;
