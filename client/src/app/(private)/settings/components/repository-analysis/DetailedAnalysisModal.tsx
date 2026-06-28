import React, { useState, useEffect, useRef, useMemo } from "react";
import { Modal, Typography, Button, Spinner, Chip, ProgressBar, toast, SearchField, Accordion } from "@heroui/react";
import {
  X,
  XCircle,
  AlertCircle,
  LayoutDashboard,
  Terminal,
  AlertTriangle,
  Crown,
  Sparkles,
  Clock,
  Coins,
  Activity,
  CheckCircle2,
  Share2,
  Filter,
  RefreshCw,
  GitFork,
  BookOpen
} from "lucide-react";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  MarkerType,
  type NodeProps
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type {
  RepositoryAnalysis,
  AnalysisJob,
  AnalysisTask,
  AnalysisTaskEvent,
  ConfidenceMetadata,
  ContributorDistributionItem
} from "@/types/repository-analysis.types";
import { repositoryAnalysisApi } from "@/services/repository-analysis.service";
import { AnalysisTaskTimeline } from "./AnalysisTaskTimeline";
import { AIStreamViewer } from "./AIStreamViewer";
import { parseAndSanitizeMarkdown } from "@/lib/markdown";
import { useTrustGraphStore } from "./stores/use-trust-graph-store";
import { useAnalysisJobStore } from "./stores/use-analysis-job-store";

interface ProgressEventData {
  taskId?: string;
  taskStatus?: string;
  taskProgress?: number;
  taskDurationMs?: number;
  taskErrorMessage?: string;
  promptTokens?: number;
  completionTokens?: number;
  estimatedCostUsd?: number;
  modelName?: string;
  resultData?: string;
  progress?: number;
  status?: string;
  step?: string;
  taskType?: string;
  message?: string;
  id?: string;
  timestamp?: string;
  level?: string;
  eventType?: string;
  metadata?: string;
}

interface DetailedAnalysisModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  repoId: string;
}

const FRIENDLY_NAMES: Record<string, string> = {
  RepoStructure: "Workspace Setup & Provenance Scan",
  CommitIntelligence: "Commit Ownership & Git Trust",
  SkillExtraction: "Technical Skills Scan",
  ArchitectureAnalysis: "Architecture Design Pattern Scan",
  CodeQuality: "Code Quality & Styling Inspection",
  SecurityAnalysis: "Vulnerability & Security Audit",
  RepositoryClassification: "Repository Semantic Classification",
  RepositorySummary: "Recruiter Summary & Narrative",
  CvSynthesis: "CV Synthesis Profile",
};

export const getTaskConfidenceMeta = (task: AnalysisTask | undefined): ConfidenceMetadata | undefined => {
  if (!task || !task.resultData) return undefined;
  try {
    const parsed = JSON.parse(task.resultData);
    return parsed.confidence_meta;
  } catch {
    return undefined;
  }
};

const CustomTrustNode: React.FC<NodeProps> = ({ id, data, type }) => {
  const isSelected = useTrustGraphStore((s) => s.selectedNodeId === id);
  const isHovered = useTrustGraphStore((s) => s.hoveredNodeId === id);
  const hasActiveSelection = useTrustGraphStore((s) => s.selectedNodeId !== null || s.hoveredNodeId !== null);
  const isConnected = useTrustGraphStore((s) => s.connectedNodes.has(id));
  const setHoveredNodeId = useTrustGraphStore((s) => s.setHoveredNodeId);
  const setSelectedNodeId = useTrustGraphStore((s) => s.setSelectedNodeId);

  const nodeData = data as { label?: string; category?: string };
  const label = nodeData.label || "";
  const category = nodeData.category || "";

  // Interaction classes
  let opacityClass = "opacity-100";
  let borderClass = "border-border";
  let shadowClass = "shadow-xs";

  if (hasActiveSelection) {
    if (isConnected) {
      if (isSelected || isHovered) {
        borderClass = "border-accent ring-1 ring-accent";
        shadowClass = "shadow-md";
      } else {
        borderClass = "border-accent/60";
      }
    } else {
      opacityClass = "opacity-30";
    }
  }

  let icon = <Activity className="size-4 text-muted" />;
  let cardStyles = "bg-surface";

  if (type === "developer") {
    icon = <Crown className="size-4 text-warning" />;
    cardStyles = "bg-surface border-warning/30";
  } else if (type === "repository") {
    icon = <Terminal className="size-4 text-accent" />;
    cardStyles = "bg-surface-secondary border-accent/30";
  } else if (type === "skill") {
    icon = <Sparkles className="size-4 text-accent" />;
    cardStyles = "bg-surface border-accent/20";
  } else if (type === "evidence") {
    const isSecurity = category === "security";
    icon = isSecurity ? <AlertTriangle className="size-4 text-danger" /> : <CheckCircle2 className="size-4 text-success" />;
    cardStyles = isSecurity ? "bg-surface border-danger/20" : "bg-surface border-success/20";
  }

  return (
    <div
      onMouseEnter={() => setHoveredNodeId(id)}
      onMouseLeave={() => setHoveredNodeId(null)}
      onClick={() => setSelectedNodeId(id)}
      className={`p-3 rounded-xl border ${borderClass} ${cardStyles} ${opacityClass} ${shadowClass} flex items-center gap-2.5 min-w-[200px] max-w-[260px] text-xs font-sans text-left relative cursor-pointer select-none transition-opacity duration-150`}
    >
      {/* Handles */}
      {type !== "developer" && type !== "evidence" && (
        <Handle
          type="target"
          position={Position.Left}
          className="w-2 h-2 bg-border! border-0! -left-1"
        />
      )}
      <div className="p-1.5 rounded-lg bg-surface-secondary/40 shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center gap-1">
          <span className="text-[8px] text-muted-foreground font-medium block uppercase tracking-wider">
            {type}
          </span>
          {type === "evidence" && (
            <span className={`px-1 rounded text-[7.5px] font-extrabold uppercase shrink-0 ${category === "security" ? "bg-danger/10 text-danger" : "bg-success/10 text-success"
              }`}>
              {category}
            </span>
          )}
          {type === "skill" && (
            <span className="px-1 rounded text-[7.5px] font-extrabold uppercase bg-accent/10 text-accent shrink-0">
              {category}
            </span>
          )}
        </div>
        <strong className="text-foreground font-bold truncate block mt-0.5">
          {label}
        </strong>
      </div>
      {type !== "skill" && (
        <Handle
          type="source"
          position={Position.Right}
          className="w-2 h-2 bg-border! border-0! -right-1"
        />
      )}
    </div>
  );
};

const nodeTypes = {
  developer: CustomTrustNode,
  repository: CustomTrustNode,
  skill: CustomTrustNode,
  evidence: CustomTrustNode,
};

const deriveTrustGraph = (localAnalysis: RepositoryAnalysis | null): { nodes: any[]; edges: any[] } | null => {
  if (!localAnalysis) return null;

  const nodes: any[] = [];
  const edges: any[] = [];

  // 1. Root Developer Node
  nodes.push({
    id: "developer-root",
    type: "developer",
    data: {
      label: localAnalysis.cvSynthesis?.title || "Developer Profile",
      category: "developer",
    },
  });

  // 2. Root Repository Node
  const trustScore = localAnalysis.classification?.trustScore ?? 0;
  const trustScorePct = Math.round(trustScore > 1 ? trustScore : trustScore * 100);
  nodes.push({
    id: "repo-root",
    type: "repository",
    data: {
      label: localAnalysis.repo?.name || "Repository",
      trustScore: trustScorePct,
    },
  });

  // Edge: Developer -> Repository
  edges.push({
    id: "dev-to-repo",
    source: "developer-root",
    target: "repo-root",
    label: "contributes",
  });

  // 3. Skill Nodes
  const skills = localAnalysis.cvSynthesis?.skills || [];
  skills.forEach((skill) => {
    const skillId = `skill-${skill}`;
    nodes.push({
      id: skillId,
      type: "skill",
      data: {
        label: skill,
        category: "skill",
      },
    });

    edges.push({
      id: `repo-to-skill-${skill}`,
      source: "repo-root",
      target: skillId,
    });
  });

  // 4. Evidence Finding Nodes
  const findings = localAnalysis.findings || (localAnalysis as any).ai_conclusions?.findings || [];
  findings.forEach((finding: any, idx: number) => {
    const findingId = `finding-${finding.title || idx}`;
    nodes.push({
      id: findingId,
      type: "evidence",
      data: {
        label: finding.title || finding.finding || `Finding #${idx}`,
        category: finding.category || "quality",
        confidence: finding.confidence || 90,
        explanation: finding.explanation || "",
        impact: finding.impact || "positive",
      },
    });

    edges.push({
      id: `finding-to-repo-${finding.title || idx}`,
      source: findingId,
      target: "repo-root",
    });
  });

  return { nodes, edges };
};

interface TrustGraphViewProps {
  shadowClass?: string; // Add if needed, keeping consistent with standard React Flow types
  trustGraph: {
    nodes: any[];
    edges: any[];
  } | null;
  localAnalysis: RepositoryAnalysis | null;
}

const TrustGraphView: React.FC<TrustGraphViewProps> = ({ trustGraph, localAnalysis }) => {
  const nodes = useTrustGraphStore((s) => s.nodes);
  const edges = useTrustGraphStore((s) => s.edges);
  const onNodesChange = useTrustGraphStore((s) => s.onNodesChange);
  const onEdgesChange = useTrustGraphStore((s) => s.onEdgesChange);
  const initializeGraph = useTrustGraphStore((s) => s.initializeGraph);

  const selectedNodeId = useTrustGraphStore((s) => s.selectedNodeId);
  const hoveredNodeId = useTrustGraphStore((s) => s.hoveredNodeId);
  const connectedEdges = useTrustGraphStore((s) => s.connectedEdges);
  const setSelectedNodeId = useTrustGraphStore((s) => s.setSelectedNodeId);

  const searchQuery = useTrustGraphStore((s) => s.searchQuery);
  const setSearchQuery = useTrustGraphStore((s) => s.setSearchQuery);
  const showSkills = useTrustGraphStore((s) => s.showSkills);
  const setShowSkills = useTrustGraphStore((s) => s.setShowSkills);
  const showEvidence = useTrustGraphStore((s) => s.showEvidence);
  const setShowEvidence = useTrustGraphStore((s) => s.setShowEvidence);
  const showSecurityOnly = useTrustGraphStore((s) => s.showSecurityOnly);
  const setShowSecurityOnly = useTrustGraphStore((s) => s.setShowSecurityOnly);
  const resetFilters = useTrustGraphStore((s) => s.resetFilters);

  // Initialize graph data once loaded
  useEffect(() => {
    if (trustGraph && trustGraph.nodes && trustGraph.nodes.length > 0) {
      initializeGraph(trustGraph.nodes, trustGraph.edges);
    } else if (localAnalysis) {
      const derived = deriveTrustGraph(localAnalysis);
      if (derived) {
        initializeGraph(derived.nodes, derived.edges);
      }
    }
  }, [trustGraph, localAnalysis, initializeGraph]);

  console.log("TrustGraphView nodes in store:", nodes);
  console.log("TrustGraphView edges in store:", edges);

  const flowEdges = useMemo(() => {
    return edges.map((edge) => {
      const isHighlighted = connectedEdges.has(edge.id);
      const hasActiveSelection = selectedNodeId !== null || hoveredNodeId !== null;

      let className = "normal-edge";
      if (hasActiveSelection) {
        className = isHighlighted ? "highlighted-edge" : "dimmed-edge";
      }

      return {
        ...edge,
        type: "default",
        className,
        style: {}, // Avoid style overrides to maintain Tailwind class specificity
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 15,
          height: 15,
          color: hasActiveSelection && !isHighlighted ? "var(--border)" : "var(--separator)",
        },
      };
    });
  }, [edges, connectedEdges, selectedNodeId, hoveredNodeId]);

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return nodes.find((n) => n.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center border border-border bg-background/40 rounded-xl p-4 text-muted text-xs font-sans">
        <Share2 className="size-5 mb-2 opacity-50" />
        <span>No trust graph data generated for this repository.</span>
      </div>
    );
  }

  // Inspect Panel Render Method
  const renderInspectPanel = () => {
    if (!selectedNode) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-muted-foreground font-sans select-none">
          <Share2 className="size-8 mb-3 opacity-40 text-muted" />
          <span className="text-xs font-bold text-foreground">Select a Node to Inspect</span>
          <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed max-w-[200px]">
            Click any node in the trust graph to view complete metadata, authenticity checks, and cryptographic verification details.
          </p>
        </div>
      );
    }

    if (selectedNode.type === "developer") {
      const gitMetrics = localAnalysis?.facts?.git_metrics;
      const repoOwner = localAnalysis?.repo.full_name ? localAnalysis.repo.full_name.split("/")[0] : "";
      const devEmail = gitMetrics?.contributor_distribution?.find((c) => c.author.toLowerCase().includes(repoOwner.toLowerCase() || ""))?.email || "verified_git_signature@github.com";
      return (
        <div className="flex-1 flex flex-col gap-4 font-sans p-4 text-left">
          <div className="space-y-1">
            <Chip size="sm" variant="soft" className="h-5 text-[8.5px] font-extrabold uppercase rounded-md bg-warning/10 text-warning border border-warning/20">
              Developer Identity
            </Chip>
            <h4 className="text-sm font-black text-foreground">{selectedNode.data.label}</h4>
            <span className="text-[10px] text-muted font-mono block truncate">{devEmail}</span>
          </div>

          <div className="space-y-3 pt-2 border-t border-border/40">
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[10.5px]">
                <span className="text-muted font-semibold">User Contribution Ratio</span>
                <span className="font-mono font-bold text-foreground">
                  {((gitMetrics?.user_commit_ratio ?? 1) * 100).toFixed(1)}%
                </span>
              </div>
              <ProgressBar
                aria-label="User contribution ratio"
                value={(gitMetrics?.user_commit_ratio ?? 1) * 100}
                color="accent"
                size="sm"
                className="w-full"
              >
                <ProgressBar.Track>
                  <ProgressBar.Fill />
                </ProgressBar.Track>
              </ProgressBar>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10.5px]">
              <div className="bg-surface-secondary/40 p-2 rounded-lg border border-border/40">
                <span className="text-[8.5px] text-muted uppercase font-bold block">User Commits</span>
                <strong className="text-xs font-mono font-bold text-foreground mt-0.5 block">
                  {Math.round((gitMetrics?.user_commit_ratio ?? 1) * (gitMetrics?.total_commits ?? 0))}
                </strong>
              </div>
              <div className="bg-surface-secondary/40 p-2 rounded-lg border border-border/40">
                <span className="text-[8.5px] text-muted uppercase font-bold block">Total Commits</span>
                <strong className="text-xs font-mono font-bold text-foreground mt-0.5 block">
                  {gitMetrics?.total_commits ?? 0}
                </strong>
              </div>
            </div>

            <div className="bg-surface-secondary/20 p-3 rounded-xl border border-border/40 space-y-1.5">
              <span className="text-[8.5px] text-muted uppercase font-extrabold block">Authenticity Insights</span>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                {localAnalysis?.trust_intelligence?.conflict_resolution_log?.length
                  ? "Overrode active ownership discrepancy. Resolved commit profile alignment flags."
                  : "Git history signature matches local developer credentials. Primary commit patterns verified."}
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (selectedNode.type === "repository") {
      const repo = localAnalysis?.repo;
      const classif = localAnalysis?.classification;
      return (
        <div className="flex-1 flex flex-col gap-4 font-sans p-4 text-left">
          <div className="space-y-1">
            <Chip size="sm" variant="soft" className="h-5 text-[8.5px] font-extrabold uppercase rounded-md bg-accent/10 text-accent border border-accent/20">
              Target Repository
            </Chip>
            <h4 className="text-sm font-black text-foreground truncate">{repo?.full_name || selectedNode.data.label}</h4>
            <a href={repo?.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-accent font-semibold flex items-center gap-1 hover:underline">
              <Terminal className="size-3" /> View on GitHub
            </a>
          </div>

          <div className="space-y-3.5 pt-2 border-t border-border/40 text-[10.5px]">
            <div className="flex justify-between items-center py-1 border-b border-border/10">
              <span className="text-muted font-semibold">Classification Domain</span>
              <span className="font-extrabold text-foreground capitalize">
                {classif?.primaryDomain?.replace(/_/g, " ") || "Unknown"}
              </span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-border/10">
              <span className="text-muted font-semibold">Verification Trust Score</span>
              <span className="font-mono font-black text-success">
                {((classif?.trustScore ?? 0) * 100).toFixed(0)}%
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-surface-secondary/40 p-2 rounded-lg border border-border/40">
                <span className="text-[8px] text-muted uppercase font-semibold block">Stars</span>
                <strong className="text-xs font-mono font-bold text-foreground">{repo?.stars ?? 0}</strong>
              </div>
              <div className="bg-surface-secondary/40 p-2 rounded-lg border border-border/40">
                <span className="text-[8px] text-muted uppercase font-semibold block">Forks</span>
                <strong className="text-xs font-mono font-bold text-foreground">{repo?.forks ?? 0}</strong>
              </div>
            </div>

            <div className="bg-surface-secondary/20 p-2.5 rounded-xl border border-border/40 text-[10px] text-muted-foreground leading-relaxed">
              {repo?.description || `Authentic workspace scan. Active branches: ${repo?.branches ?? 1}. Open PRs: ${repo?.open_prs ?? 0}.`}
            </div>
          </div>
        </div>
      );
    }

    if (selectedNode.type === "skill") {
      return (
        <div className="flex-1 flex flex-col gap-4 font-sans p-4 text-left">
          <div className="space-y-1">
            <Chip size="sm" variant="soft" className="h-5 text-[8.5px] font-extrabold uppercase rounded-md bg-accent/15 text-accent border border-accent/20">
              Technical Skill Node
            </Chip>
            <h4 className="text-sm font-black text-foreground">{selectedNode.data.label}</h4>
            <span className="text-[10px] text-muted capitalize font-bold">Category: {selectedNode.data.category || "Skill Domain"}</span>
          </div>

          <div className="space-y-3 pt-2 border-t border-border/40 text-[10.5px]">
            <div className="bg-surface-secondary/20 p-3 rounded-xl border border-border/40 space-y-2">
              <span className="text-[8.5px] text-muted uppercase font-extrabold block">Calibration Signal</span>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                This technology signature was extracted by scanning local configuration dependencies, package lists, and verified code implementations.
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (selectedNode.type === "evidence") {
      const findings = localAnalysis?.findings || (localAnalysis as any)?.ai_conclusions?.findings || [];
      const matchingFinding = findings.find((f: any) => (f?.finding || f?.title) === selectedNode.data.label);
      const isSecurity = selectedNode.data.category === "security";
      const impact = matchingFinding?.impact || (isSecurity ? "warning" : "positive");
      const explanation = matchingFinding?.explanation || "Evidence verify signal matches structural configurations and authentic contributor patterns.";

      const getImpactClasses = (lvl: string) => {
        switch (lvl.toLowerCase()) {
          case "critical":
            return "bg-danger/10 text-danger border border-danger/20";
          case "warning":
            return "bg-warning/10 text-warning border border-warning/20";
          case "positive":
          default:
            return "bg-success/10 text-success border border-success/20";
        }
      };

      return (
        <div className="flex-1 flex flex-col gap-4 font-sans p-4 text-left overflow-y-auto max-h-[450px]">
          <div className="space-y-1">
            <Chip size="sm" variant="soft" className={`h-5 text-[8.5px] font-extrabold uppercase rounded-md ${getImpactClasses(impact)}`}>
              Evidence / Finding
            </Chip>
            <h4 className="text-sm font-black text-foreground leading-tight">{selectedNode.data.label}</h4>
            <span className="text-[10px] text-muted-foreground capitalize font-semibold block">Audit Category: {selectedNode.data.category}</span>
          </div>

          <div className="space-y-3 pt-2 border-t border-border/40 text-[10.5px]">
            <div className="space-y-1">
              <span className="text-[8.5px] text-muted uppercase font-bold block">Detailed Audit Narrative</span>
              <p className="text-[10.5px] text-muted-foreground leading-relaxed whitespace-pre-wrap font-light">
                {explanation}
              </p>
            </div>

            {matchingFinding?.evidence_signals && matchingFinding.evidence_signals.length > 0 && (
              <div className="space-y-1.5 pt-2">
                <span className="text-[8.5px] text-muted uppercase font-extrabold block">Evidence Citations</span>
                <div className="flex flex-col gap-1 max-h-[120px] overflow-y-auto pr-1">
                  {matchingFinding.evidence_signals.map((sig: string, idx: number) => (
                    <div key={idx} className="p-1.5 border border-border/40 bg-surface-secondary/40 rounded-lg text-[9px] font-mono text-foreground truncate select-all">
                      {sig}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="flex flex-col gap-4 w-full text-left font-sans">
      <style>{`
        .normal-edge .react-flow__edge-path {
          stroke: var(--separator) !important;
          stroke-width: 1.5px !important;
        }
        .highlighted-edge .react-flow__edge-path {
          stroke: var(--accent) !important;
          stroke-width: 2.5px !important;
        }
        .dimmed-edge .react-flow__edge-path {
          stroke: var(--border) !important;
          stroke-width: 1px !important;
          opacity: 0.25 !important;
        }
        .react-flow__edge-text {
          fill: var(--muted) !important;
          stroke: none !important;
          font-size: 8px !important;
          font-weight: 700 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.05em !important;
        }
        .react-flow__edge-textbg {
          fill: var(--surface) !important;
          stroke: var(--border) !important;
          stroke-width: 1px !important;
          rx: 6px !important;
          ry: 6px !important;
        }
        .react-flow__edge-textwrapper {
          transition: opacity 0.2s ease-in-out;
        }
        .normal-edge .react-flow__edge-textwrapper {
          opacity: 0.35;
        }
        .dimmed-edge .react-flow__edge-textwrapper {
          opacity: 0;
        }
        .highlighted-edge .react-flow__edge-textwrapper {
          opacity: 1;
        }
        .react-flow__background {
          opacity: 0.4;
        }
      `}</style>

      {/* Toolbar Layer */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface border border-border/80 p-3 rounded-2xl">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <SearchField
            aria-label="Search nodes"
            value={searchQuery}
            onChange={setSearchQuery}
            className="flex-1"
          >
            <SearchField.Group className="bg-surface-secondary/65 border border-border/60 rounded-xl h-8.5 px-3 flex items-center gap-2">
              <SearchField.SearchIcon className="text-muted-foreground size-3.5" />
              <SearchField.Input
                placeholder="Search nodes..."
                className="w-full bg-transparent border-0 p-0 text-xs font-semibold text-foreground placeholder:text-muted focus:outline-hidden"
              />
              <SearchField.ClearButton className="text-muted-foreground hover:text-foreground cursor-pointer" />
            </SearchField.Group>
          </SearchField>
          <Button
            size="sm"
            onClick={resetFilters}
            className="bg-surface-secondary text-foreground hover:bg-surface-tertiary px-3 rounded-xl h-8.5 text-xs font-bold shrink-0"
          >
            <RefreshCw size={12} className="mr-1" />
            Reset
          </Button>
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center gap-1.5 bg-surface-secondary/50 border border-border/40 rounded-xl p-1 shrink-0">
          <Button
            size="sm"
            onClick={() => setShowSkills(!showSkills)}
            className={`rounded-lg px-3 py-1 h-7.5 text-[10.5px] font-extrabold uppercase ${showSkills ? "bg-background text-foreground shadow-sm" : "bg-transparent text-muted hover:text-foreground"
              }`}
          >
            <Sparkles size={11} className="mr-1" />
            Skills
          </Button>
          <Button
            size="sm"
            onClick={() => setShowEvidence(!showEvidence)}
            className={`rounded-lg px-3 py-1 h-7.5 text-[10.5px] font-extrabold uppercase ${showEvidence && !showSecurityOnly ? "bg-background text-foreground shadow-sm" : "bg-transparent text-muted hover:text-foreground"
              }`}
          >
            <CheckCircle2 size={11} className="mr-1" />
            Evidence
          </Button>
          <Button
            size="sm"
            onClick={() => {
              if (showSecurityOnly) {
                setShowSecurityOnly(false);
              } else {
                setShowEvidence(true);
                setShowSecurityOnly(true);
              }
            }}
            className={`rounded-lg px-3 py-1 h-7.5 text-[10.5px] font-extrabold uppercase ${showSecurityOnly ? "bg-background text-danger shadow-sm" : "bg-transparent text-muted hover:text-danger"
              }`}
          >
            <AlertTriangle size={11} className="mr-1" />
            Security Only
          </Button>
        </div>
      </div>

      {/* Main Graph & Inspect split screen container */}
      <div className="flex gap-0 border border-border/80 bg-surface rounded-3xl overflow-hidden relative h-[750px]">
        {/* Left main area: ReactFlow interactive canvas */}
        <div className="flex-1 h-full relative">
          <ReactFlow
            nodes={nodes}
            edges={flowEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            minZoom={0.3}
            maxZoom={1.5}
            draggable={true}
            nodesConnectable={false}
            nodesDraggable={true}
            elementsSelectable={true}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            onPaneClick={() => setSelectedNodeId(null)}
          >
            <Background gap={16} size={1} color="var(--separator)" />
            <Controls showInteractive={false} className="bg-surface! border-border! shadow-xs!" />
          </ReactFlow>
        </div>

        {/* Right side anchor Inspect Panel */}
        <div className="w-[320px] h-full border-l border-border bg-surface-secondary/20 flex flex-col shrink-0 select-text">
          {renderInspectPanel()}
        </div>
      </div>
    </div>
  );
};

const parseSectionItem = (item: any) => {
  if (item && typeof item === "object") {
    return {
      title: item.title || "Detail Item",
      content: item.content || item.description || "",
    };
  }
  const str = String(item);
  let splitIdx = str.indexOf(" - ");
  if (splitIdx !== -1) {
    return {
      title: str.substring(0, splitIdx).trim(),
      content: str.substring(splitIdx + 3).trim(),
    };
  }
  splitIdx = str.indexOf(": ");
  if (splitIdx !== -1) {
    return {
      title: str.substring(0, splitIdx).trim(),
      content: str.substring(splitIdx + 2).trim(),
    };
  }
  return {
    title: str,
    content: "",
  };
};

export const DetailedAnalysisModal: React.FC<DetailedAnalysisModalProps> = ({
  isOpen,
  onOpenChange,
  repoId,
}) => {
  const repoState = useAnalysisJobStore((state) => state.repoStates[repoId]);
  const jobId = repoState?.jobId || repoState?.latestReport?.jobId || repoState?.partialSnapshot?.jobId || (repoState?.latestReport as any)?.job_id || null;
  const localAnalysis = repoState?.latestReport || repoState?.partialSnapshot || null;
  const status = repoState?.status || "idle";

  const [viewMode, setViewMode] = useState<"report" | "graph" | "logs" | "costs" | "cv">("report");
  const [costs, setCosts] = useState<{
    jobId: string;
    totalCostUsd: number;
    totalTokens: number;
    totalDurationMs: number;
    executions: Array<{
      id: string;
      jobId: string;
      taskId: string;
      executionType: string;
      provider: string;
      model: string;
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      cachedTokens: number;
      estimatedCostUsd: number;
      durationMs: number;
      createdAtUtc: string;
    }>;
  } | null>(null);
  const [loadingCosts, setLoadingCosts] = useState(false);
  const [job, setJob] = useState<AnalysisJob | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskEvents, setTaskEvents] = useState<(AnalysisTaskEvent & { taskType?: string })[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [isRetryingTaskId, setIsRetryingTaskId] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState<string>("00:00");
  const [validationError, setValidationError] = useState<string | null>(null);

  const [prevJobId, setPrevJobId] = useState<string | null>(null);
  const [prevIsOpen, setPrevIsOpen] = useState<boolean>(false);
  const [prevLocalAnalysis, setPrevLocalAnalysis] = useState<RepositoryAnalysis | null>(null);

  // Synchronize modal view mode and resets when jobId or modal open state changes (render-phase sync to avoid eslint set-state-in-effect warning)
  if (jobId !== prevJobId || isOpen !== prevIsOpen) {
    setPrevJobId(jobId);
    setPrevIsOpen(isOpen);
    setPrevLocalAnalysis(localAnalysis);
    setValidationError(null);
    if (!jobId || !isOpen) {
      setJob(null);
      setElapsedTime("00:00");
      setCosts(null);
    }
    // Set initial view mode on open or repo switch
    if (isOpen) {
      if (localAnalysis) {
        setViewMode("report");
      } else {
        setViewMode("logs");
      }
    }
  } else if (localAnalysis !== prevLocalAnalysis) {
    // Just sync the ref without resetting the view mode so that it doesn't hijack the user's active tab!
    setPrevLocalAnalysis(localAnalysis);
  }

  const isJobRunning = status === "ANALYZING" || status === "QUEUED";
  const activeViewMode = viewMode;

  // Fetch costs when switching to costs tab
  useEffect(() => {
    if (!jobId || jobId.startsWith("optimistic-") || !isOpen || viewMode !== "costs") return;

    const loadCosts = async () => {
      setLoadingCosts(true);
      try {
        const costData = await repositoryAnalysisApi.getAnalysisCosts(jobId);
        setCosts(costData);
      } catch (err) {
        console.error("Failed to load cost metrics:", err);
      } finally {
        setLoadingCosts(false);
      }
    };

    loadCosts();
  }, [jobId, isOpen, viewMode]);

  // Load snapshot or report on open
  useEffect(() => {
    if (!isOpen || !repoId) return;

    const loadData = async () => {
      if (!repoState?.latestReport && repoState?.status === "COMPLETED") {
        try {
          await useAnalysisJobStore.getState().loadLatestReport(repoId);
        } catch (err) {
          console.error("Failed to load report in modal:", err);
        }
      }
    };

    loadData();
  }, [isOpen, repoId, repoState?.status, repoState?.latestReport]);

  // Consolidated fetch and polling effect for job status and task events
  useEffect(() => {
    if (!jobId || jobId.startsWith("optimistic-") || !isOpen) return;

    let isSubscribed = true;
    let timeoutId: NodeJS.Timeout | null = null;

    const poll = async (showLoading = false) => {
      if (showLoading && isSubscribed) {
        setLoadingEvents(true);
      }
      try {
        const jobData = await repositoryAnalysisApi.getJobStatus(jobId);
        if (!isSubscribed) return;
        setJob(jobData);

        const tasks = jobData.tasks || [];
        if (tasks.length > 0) {
          const promises = tasks.map(async (t) => {
            try {
              const events = await repositoryAnalysisApi.getTaskEvents(jobId, t.id);
              return events.map(e => ({
                ...e,
                taskType: t.taskType
              }));
            } catch (err) {
              console.error(`Failed to fetch events for task ${t.id}:`, err);
              return [];
            }
          });
          const results = await Promise.all(promises);
          if (isSubscribed) {
            const flatSorted = results
              .flat()
              .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            setTaskEvents(flatSorted);

            setSelectedTaskId((prev) => {
              if (prev && tasks.some((t) => t.id === prev)) {
                return prev;
              }
              const activeOrFailed = tasks.find(
                (t) => t.status === "Running" || t.status === "Failed" || t.status === "Retrying"
              );
              return activeOrFailed?.id || tasks[0].id;
            });
          }
        }

        // If the job is still running, poll again in 4 seconds
        const isTerminal = ["Completed", "Failed", "Cancelled", "TimedOut"].includes(jobData.status);
        if (!isTerminal && isSubscribed) {
          timeoutId = setTimeout(() => {
            poll(false);
          }, 4000);
        }
      } catch (err) {
        console.error("Failed to fetch job status & events:", err);
      } finally {
        if (isSubscribed) {
          setLoadingEvents(false);
        }
      }
    };

    poll(true);

    return () => {
      isSubscribed = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [jobId, isOpen]);

  // Sync live task updates from store into our local job state
  useEffect(() => {
    if (!job || !repoState?.taskEvents || repoState.taskEvents.length === 0) return;

    let updated = false;

    const runSync = () => {
      setJob((prevJob) => {
        if (!prevJob || !prevJob.tasks) return prevJob;

        const updatedTasks = prevJob.tasks.map((t) => {
          const taskEventsForThis = repoState.taskEvents.filter((e) => e.taskId === t.id);
          if (taskEventsForThis.length === 0) return t;

          const latestEvent = taskEventsForThis[taskEventsForThis.length - 1];

          const taskStatus = (latestEvent as any).taskStatus || t.status;
          const taskProgress = (latestEvent as any).taskProgress !== undefined ? (latestEvent as any).taskProgress : t.progress;
          const durationMs = (latestEvent as any).taskDurationMs !== undefined ? (latestEvent as any).taskDurationMs : t.durationMs;
          const errorMessage = (latestEvent as any).taskErrorMessage !== undefined ? (latestEvent as any).taskErrorMessage : t.errorMessage;
          const promptTokens = (latestEvent as any).promptTokens !== undefined ? (latestEvent as any).promptTokens : t.promptTokens;
          const completionTokens = (latestEvent as any).completionTokens !== undefined ? (latestEvent as any).completionTokens : t.completionTokens;
          const estimatedCostUsd = (latestEvent as any).estimatedCostUsd !== undefined ? (latestEvent as any).estimatedCostUsd : t.estimatedCostUsd;
          const modelName = (latestEvent as any).modelName || t.modelName;
          const resultData = (latestEvent as any).resultData || t.resultData;

          if (
            t.status !== taskStatus ||
            t.progress !== taskProgress ||
            t.durationMs !== durationMs ||
            t.errorMessage !== errorMessage ||
            t.promptTokens !== promptTokens ||
            t.completionTokens !== completionTokens ||
            t.estimatedCostUsd !== estimatedCostUsd ||
            t.modelName !== modelName ||
            t.resultData !== resultData
          ) {
            updated = true;
            return {
              ...t,
              status: taskStatus,
              progress: taskProgress,
              durationMs,
              errorMessage,
              promptTokens,
              completionTokens,
              estimatedCostUsd,
              modelName,
              resultData,
            };
          }
          return t;
        });

        if (!updated) return prevJob;
        return {
          ...prevJob,
          tasks: updatedTasks,
        };
      });
    };

    Promise.resolve().then(runSync);
  }, [repoState?.taskEvents, job]);



  // Live Runtime Clock
  const formatDuration = (ms: number): string => {
    if (ms < 0) ms = 0;
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, "0")}m ${secs.toString().padStart(2, "0")}s`;
  };

  const displayElapsedTime = useMemo(() => {
    if (job && !isJobRunning) {
      if (job.startedAt && job.completedAt) {
        const diff = new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime();
        return formatDuration(diff);
      }
      if (job.tasks && job.tasks.length > 0) {
        const totalDurationMs = job.tasks.reduce((sum, t) => sum + (t.durationMs || 0), 0);
        if (totalDurationMs > 0) {
          return formatDuration(totalDurationMs);
        }
      }
    }
    return elapsedTime;
  }, [job, isJobRunning, elapsedTime]);

  useEffect(() => {
    if (!job || !isJobRunning) return;

    const interval = setInterval(() => {
      const start = job.startedAt
        ? new Date(job.startedAt).getTime()
        : new Date(job.createdAtUtc).getTime();
      const diff = Date.now() - start;
      setElapsedTime(formatDuration(diff));
    }, 1000);

    return () => clearInterval(interval);
  }, [isJobRunning, job?.startedAt, job?.createdAtUtc, job]);



  const handleRetryTask = async (taskId: string) => {
    setIsRetryingTaskId(taskId);
    try {
      if (!jobId) return;
      await repositoryAnalysisApi.retryTask(jobId, taskId);
      toast.success("Task retry initiated!");

      setJob((prev) => {
        if (!prev || !prev.tasks) return prev;
        return {
          ...prev,
          status: "Queued",
          progress: 0,
          tasks: prev.tasks.map((t) =>
            t.id === taskId
              ? { ...t, status: "Queued", progress: 0, retryCount: t.retryCount + 1 }
              : t.taskType === "RepositorySummary"
                ? { ...t, status: "Queued", progress: 0 }
                : t
          ),
        };
      });
    } catch (err) {
      console.error("Failed to retry task:", err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      toast.danger("Failed to retry task: " + errorMsg);
    } finally {
      setIsRetryingTaskId(null);
    }
  };

  // Sum up telemetry metrics from all completed tasks
  const tasks = job?.tasks;
  const telemetry = useMemo(() => {
    if (!tasks) {
      return {
        promptTokens: 0,
        completionTokens: 0,
        estimatedCostUsd: 0,
        cacheReadTokens: 0,
        cacheTotalTokens: 0,
        durationMs: 0,
        models: new Set<string>()
      };
    }
    return tasks.reduce(
      (acc, t) => {
        acc.promptTokens += t.promptTokens || 0;
        acc.completionTokens += t.completionTokens || 0;
        acc.estimatedCostUsd += t.estimatedCostUsd || 0;
        acc.cacheReadTokens += t.promptTokens && t.cacheReadTokens ? t.cacheReadTokens : 0;
        acc.cacheTotalTokens += t.promptTokens ? t.promptTokens : 0;
        acc.durationMs += t.durationMs || 0;
        if (t.modelName) {
          acc.models.add(t.modelName);
        }
        return acc;
      },
      {
        promptTokens: 0,
        completionTokens: 0,
        estimatedCostUsd: 0,
        cacheReadTokens: 0,
        cacheTotalTokens: 0,
        durationMs: 0,
        models: new Set<string>()
      }
    );
  }, [tasks]);

  const repoName = localAnalysis?.repo?.full_name || job?.currentStep || "Repository Analysis";
  const commitsCount = localAnalysis?.facts?.git_metrics?.total_commits ?? 0;
  const contributorsCount = localAnalysis?.facts?.git_metrics?.active_contributors ?? 1;

  // Merge database logs with real-time SSE logs
  const combinedLogs = useMemo(() => {
    const dbEvents = taskEvents;
    const liveEvents = repoState?.taskEvents || [];
    const combined = [...dbEvents];

    liveEvents.forEach((liveEv) => {
      const isDuplicate = combined.some(
        (dbEv) => dbEv.message === liveEv.message && dbEv.timestamp === liveEv.timestamp
      );
      if (!isDuplicate) {
        combined.push(liveEv);
      }
    });

    return combined.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [taskEvents, repoState?.taskEvents]);

  // Bento Grid Report Render Method
  const renderBentoGrid = () => {
    if (!localAnalysis) return null;

    const classification = localAnalysis.classification || {
      primaryDomain: "Unknown",
      subDomain: "General",
      confidence: 0,
      isVerified: false,
      trustScore: 0
    };

    const risk = localAnalysis.risk || {
      score: 0,
      level: "low",
      reasons: []
    };

    const sections = localAnalysis.sections || [];
    const engineeringSection = sections.find((s) => s.type === "engineering_practices");
    const securitySection = sections.find((s) => s.type === "security_findings");
    const architectureSection = sections.find((s) => s.type === "architecture_insights");

    const getRiskClasses = (level: string) => {
      switch (level.toLowerCase()) {
        case "high":
          return "text-danger border-danger/30 bg-danger/5";
        case "medium":
          return "text-warning border-warning/30 bg-warning/5";
        case "low":
        default:
          return "text-success border-success/30 bg-success/5";
      }
    };

    const getEvidenceStrength = (ep: number) => {
      if (ep <= 5) return `Minimal (${ep} Signals)`;
      if (ep <= 15) return `Standard (${ep} Signals)`;
      if (ep <= 35) return `Strong (${ep} Signals)`;
      return `Exceptional (${ep} Signals)`;
    };

    const hasWeightedStrength = !!localAnalysis.evidenceStrength;
    const totalEvidencePoints = localAnalysis.evidenceStrength?.score ?? sections.reduce((sum, s) => sum + (s.items?.length ?? 0), 0);
    const strengthLabel = localAnalysis.evidenceStrength?.label ?? getEvidenceStrength(totalEvidencePoints);

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-left font-sans  items-start">
        {/* Column 1 (Left) */}
        <div className="flex flex-col gap-5">
          {/* Tier 1: Score & Verdict Card (Large) */}
          <div className="p-5 border border-border/80 bg-surface rounded-2xl flex flex-col gap-4 min-h-[220px]">
            <div className="flex justify-between items-center">
              <div className="flex flex-col">
                <span className="text-[9px] text-muted uppercase font-extrabold tracking-wider block">
                  Verification Verdict
                </span>
                <div className="flex">
                  <h3 className="text-lg font-black text-foreground capitalize flex items-center gap-1.5">
                    <Crown className="size-4.5 text-warning shrink-0" />
                    {classification.primaryDomain.replace(/_/g, " ")}
                  </h3>
                </div>
              </div>
              <div
                className={`px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider shrink-0 ${getRiskClasses(
                  risk.level
                )}`}
              >
                {risk.level} Risk
              </div>
            </div>
            <Accordion className="w-full" variant="surface">
              <Accordion.Item key="ai-summary" id="ai-summary" aria-label="AI Summary">
                <Accordion.Heading>
                  <Accordion.Trigger className="text-[10.5px] font-bold text-foreground flex items-center justify-between w-full py-1.5 px-1 cursor-pointer select-none">
                    <span className="flex items-center gap-2">
                      <Sparkles className="size-3.5 text-accent shrink-0" />
                      AI Detailed Report
                    </span>
                    <Accordion.Indicator />
                  </Accordion.Trigger>
                </Accordion.Heading>
                <Accordion.Panel>
                  <Accordion.Body className="text-xs text-muted-foreground leading-relaxed pl-5.5 font-light pt-2 pb-3 select-text markdown-summary">
                    <div dangerouslySetInnerHTML={{ __html: parseAndSanitizeMarkdown(localAnalysis.narrative?.recruiter_summary || (risk.reasons.length > 0 ? risk.reasons.join(", ") : "Authentic workspace scan complete.")) }} />
                  </Accordion.Body>
                </Accordion.Panel>
              </Accordion.Item>
            </Accordion>
            <div className="flex items-center justify-between">
              <div className="flex flex-col items-start justify-center gap-2">
                <span className="text-[9px] text-muted uppercase font-bold">Evidence Strength:</span>
                <strong className="text-sm text-foreground font-extrabold font-mono">
                  {hasWeightedStrength ? `${strengthLabel} (${totalEvidencePoints.toFixed(0)} pts)` : strengthLabel}
                </strong>
              </div>
              <div className="flex flex-col items-start justify-center gap-2">
                <span className="text-[9px] text-muted uppercase font-bold">Sub-Domain:</span>
                <strong className="text-sm text-foreground font-extrabold capitalize font-sans truncate]">
                  {classification.subDomain.replace(/_/g, " ")}
                </strong>
              </div>
              <div className="flex flex-col items-start justify-center gap-2">
                <span className="text-[9px] text-muted uppercase font-bold">Trust Score:</span>
                <strong className="text-sm text-foreground font-extrabold font-mono">
                  {(classification.trustScore * 100).toFixed(0)}%
                </strong>
              </div>
            </div>
          </div>

          {/* Tier 2: Skills & Stack Matrix */}
          <div className="p-5 border border-border/80 bg-surface rounded-2xl flex flex-col gap-3">
            <span className="text-[9px] text-muted uppercase font-extrabold tracking-wider block">
              Skills & Stack Matrix
            </span>
            <div className="space-y-3 pr-1">
              <div className="space-y-1">
                <span className="text-[8px] text-muted uppercase font-bold block">Languages</span>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(localAnalysis?.repo?.languages || {}).map(([lang, pct]) => (
                    <span
                      key={lang}
                      className="text-[10px] border border-border/60 bg-surface-secondary text-foreground px-2 py-0.5 rounded-md font-medium"
                    >
                      {lang} <span className="opacity-60 font-mono text-[9px]">{pct}%</span>
                    </span>
                  ))}
                </div>
              </div>

              {localAnalysis?.repo?.topics && localAnalysis.repo.topics.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[8px] text-accent uppercase font-extrabold block">
                    Repository Topics
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {localAnalysis.repo.topics.map((topic) => (
                      <span
                        key={topic}
                        className="text-[10.5px] border border-border/60 bg-surface-secondary text-foreground px-2 py-0.5 rounded-md font-semibold"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Tier 4: Security Findings */}
          <div className="p-5 border border-border/80 bg-surface rounded-2xl flex flex-col gap-3 min-h-[180px]">
            <span className="text-[9px] uppercase font-extrabold tracking-wider block text-danger">
              Security Findings & Auditing
            </span>
            <div className="flex flex-col gap-2">
              {!securitySection || !securitySection.items || securitySection.items.length === 0 ? (
                <div className="text-xs text-muted-foreground italic font-light py-2">
                  No high-risk secrets leaks or security violations detected.
                </div>
              ) : (
                <Accordion className="w-full" variant="surface">
                  {securitySection.items.map((item, idx) => {
                    const parsed = parseSectionItem(item);
                    return (
                      <Accordion.Item key={idx}>
                        <Accordion.Heading>
                          <Accordion.Trigger className="text-[10.5px] font-semibold text-danger flex items-center justify-between w-full">
                            <span className="flex items-center gap-2">
                              <AlertTriangle className="size-3.5 text-danger shrink-0" />
                              {parsed.title}
                            </span>
                            <Accordion.Indicator />
                          </Accordion.Trigger>
                        </Accordion.Heading>
                        <Accordion.Panel>
                          <Accordion.Body className="text-[10.5px] text-muted-foreground leading-relaxed pl-5.5 font-light pt-2">
                            {parsed.content || parsed.title}
                          </Accordion.Body>
                        </Accordion.Panel>
                      </Accordion.Item>
                    );
                  })}
                </Accordion>
              )}
            </div>
          </div>
          {/* Tier 3: Contributor Distributions */}
          <div className="p-5 border border-border/80 bg-surface rounded-2xl flex flex-col gap-3.5 min-h-[200px]">
            <div className="flex justify-between items-center border-b border-border/20 pb-2">
              <span className="text-[9px] text-muted uppercase font-extrabold tracking-wider block">
                Contributor Distributions
              </span>
              <span className="text-[10px] text-muted font-light">
                Bus Factor: <strong>{localAnalysis.facts?.git_metrics?.bus_factor ?? 1}</strong>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-0.5 bg-surface-secondary/20 p-2.5 rounded-xl border border-border/40">
                <span className="text-[8.5px] text-muted uppercase font-bold block">Total Commits</span>
                <strong className="text-lg text-foreground font-black font-mono">
                  {localAnalysis.facts?.git_metrics?.total_commits ?? 0}
                </strong>
              </div>
              <div className="space-y-0.5 bg-surface-secondary/20 p-2.5 rounded-xl border border-border/40">
                <span className="text-[8.5px] text-muted uppercase font-bold block">User Commits</span>
                <strong className="text-lg text-foreground font-black font-mono">
                  {((localAnalysis.facts?.git_metrics?.user_commit_ratio ?? 1) * 100).toFixed(0)}%
                </strong>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[8px] text-muted uppercase font-extrabold block">Top Commit Authors</span>
              <div className="space-y-1.5 pr-1">
                {(localAnalysis.facts?.git_metrics?.contributor_distribution || []).slice(0, 3).map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-foreground truncate max-w-[150px]">
                      {item.author}
                    </span>
                    <span className="font-mono text-muted text-[10px]">
                      {item.commits || 0} commits ({(item.pct || 0).toFixed(1)}%)
                    </span>
                  </div>
                ))}
                {(!localAnalysis.facts?.git_metrics?.contributor_distribution ||
                  localAnalysis.facts.git_metrics.contributor_distribution.length === 0) && (
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-foreground">Target Developer</span>
                      <span className="font-mono text-muted text-[10px]">100.0% contribution ratio</span>
                    </div>
                  )}
              </div>
            </div>
          </div>
          {/* Tier 5: Scope & Quality Metrics */}
          <div className="p-5 border border-border/80 bg-surface rounded-2xl flex flex-col gap-3 min-h-[180px]">
            <span className="text-[9px] text-muted uppercase font-extrabold tracking-wider block">
              Scope & Quality Metrics
            </span>
            {(() => {
              const q = localAnalysis.facts?.quality_metrics || {
                files_scanned: 0,
                files_sampled: 0,
                skipped_files: 0,
                coverage_pct: 100.0,
                prompt_cache_efficiency: 0.0
              };
              return (
                <div className="space-y-2.5 text-xs text-muted-foreground">
                  <div className="flex justify-between items-center py-1 border-b border-border/20">
                    <span className="font-semibold text-foreground">Files Scanned</span>
                    <strong className="font-mono text-foreground font-extrabold">{q.files_scanned}</strong>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-border/20">
                    <span className="font-semibold text-foreground">Files Sampled</span>
                    <strong className="font-mono text-foreground font-extrabold">{q.files_sampled}</strong>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="font-semibold text-foreground">Cache Efficiency</span>
                    <strong className="font-mono text-foreground font-extrabold">
                      {(q.prompt_cache_efficiency * 100).toFixed(0)}%
                    </strong>
                  </div>
                </div>
              );
            })()}
          </div>
          {/* Tier 5: Warnings & Observations */}
          <div className="p-5 border border-border/80 bg-surface rounded-2xl flex flex-col gap-3 h-full">
            <span className="text-[9px] uppercase font-extrabold tracking-wider block text-warning">
              Anomalies & Warnings
            </span>
            <div className="flex flex-col gap-2 pr-1">
              {(() => {
                const uncertainty = localAnalysis.trust_intelligence?.uncertainty_metrics;
                const hasFlags = (risk.reasons?.length ?? 0) > 0;
                const hasUncertaintyMetrics = uncertainty && (
                  uncertainty.timestamp_compression_ratio > 0.05 ||
                  uncertainty.unverified_commits > 0 ||
                  uncertainty.uncalibrated_identities > 0
                );

                if (!hasFlags && !hasUncertaintyMetrics) {
                  return (
                    <div className="text-xs text-muted-foreground italic font-light py-2">
                      No warnings or stylistic flags recorded.
                    </div>
                  );
                }

                return (
                  <div className="space-y-2">
                    {risk.reasons?.map((reason, idx) => (
                      <div
                        key={`reason-${idx}`}
                        className="p-2 border border-warning/10 bg-warning/5 text-warning text-[10.5px] rounded-lg"
                      >
                        <strong className="font-bold">Warning:</strong> {reason}
                      </div>
                    ))}

                    {uncertainty && uncertainty.timestamp_compression_ratio > 0.05 && (
                      <div className="p-2 border border-danger/10 bg-danger/5 text-danger text-[10.5px] rounded-lg">
                        <strong className="font-bold">Violated:</strong> Suspicious commit frequency (compression ratio: {(uncertainty.timestamp_compression_ratio * 100).toFixed(1)}%). Possible automated commit spoofing or history rewrite.
                      </div>
                    )}
                    {uncertainty && uncertainty.unverified_commits > 0 && (
                      <div className="p-2 border border-warning/10 bg-warning/5 text-warning text-[10.5px] rounded-lg">
                        <strong className="font-bold">Warning:</strong> Scanned {uncertainty.unverified_commits} commits lacking verified GitHub signatures.
                      </div>
                    )}
                    {uncertainty && uncertainty.uncalibrated_identities > 0 && (
                      <div className="p-2 border border-warning/10 bg-warning/5 text-warning text-[10.5px] rounded-lg">
                        <strong className="font-bold">Warning:</strong> Detected {uncertainty.uncalibrated_identities} contributor email(s) not registered with GitHub API.
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Column 2 (Right) */}
        <div className="flex flex-col gap-5">
          {/* Tier 1: AI Reasoning & Talent Insights */}
          <div className="p-5 border border-border/80 bg-surface rounded-2xl flex flex-col gap-3 min-h-[220px]">
            <span className="text-[9px] text-muted uppercase font-extrabold tracking-wider block">
              AI Talent Insights & Strengths
            </span>
            <div className="space-y-3 pr-1">
              {localAnalysis.narrative?.top_strengths?.map((s, idx) => (
                <div key={idx} className="space-y-0.5">
                  <span className="text-xs font-extrabold text-foreground flex items-center gap-1">
                    <Sparkles className="size-3 text-accent shrink-0" />
                    {s.strength}
                  </span>
                  <p className="text-[10.5px] text-muted-foreground leading-relaxed font-light pl-4">
                    {s.rationale}
                  </p>
                </div>
              ))}
              {(!localAnalysis.narrative?.top_strengths || localAnalysis.narrative.top_strengths.length === 0) && (
                <span className="text-xs text-muted italic font-light">No specific highlights recorded.</span>
              )}
            </div>
          </div>

          {/* Tier 3: Engineering Practices & Controls */}
          <div className="p-5 border border-border/80 bg-surface rounded-2xl flex flex-col gap-3 min-h-[200px]">
            <span className="text-[9px] text-muted uppercase font-extrabold tracking-wider block">
              Engineering Practices & Controls
            </span>
            <div className="flex flex-col gap-2">
              {!engineeringSection || !engineeringSection.items || engineeringSection.items.length === 0 ? (
                <div className="text-xs text-muted-foreground italic font-light py-2">
                  No explicit engineering practices or control findings recorded.
                </div>
              ) : (
                <Accordion className="w-full" variant="surface">
                  {engineeringSection.items.map((item, idx) => {
                    const parsed = parseSectionItem(item);
                    return (
                      <Accordion.Item key={idx}>
                        <Accordion.Heading>
                          <Accordion.Trigger className="text-[10.5px] font-semibold text-foreground flex items-center justify-between w-full">
                            <span className="flex items-center gap-2">
                              <CheckCircle2 className="size-3.5 text-success shrink-0" />
                              {parsed.title}
                            </span>
                            <Accordion.Indicator />
                          </Accordion.Trigger>
                        </Accordion.Heading>
                        <Accordion.Panel>
                          <Accordion.Body className="text-[10.5px] text-muted-foreground leading-relaxed pl-5.5 font-light pt-2">
                            {parsed.content || parsed.title}
                          </Accordion.Body>
                        </Accordion.Panel>
                      </Accordion.Item>
                    );
                  })}
                </Accordion>
              )}
            </div>
          </div>

          {/* Tier 2: Architecture & Structure */}
          <div className="p-5 border border-border/80 bg-surface rounded-2xl flex flex-col gap-3 min-h-[200px]">
            <span className="text-[9px] text-muted uppercase font-extrabold tracking-wider block">
              Codebase Architecture & Structure
            </span>
            <div className="flex flex-col gap-2">
              {!architectureSection || !architectureSection.items || architectureSection.items.length === 0 ? (
                <div className="text-xs text-muted-foreground italic font-light py-2">
                  No codebase design or architectural insight findings recorded.
                </div>
              ) : (
                <Accordion className="w-full" variant="surface">
                  {architectureSection.items.map((item, idx) => {
                    const parsed = parseSectionItem(item);
                    return (
                      <Accordion.Item key={idx}>
                        <Accordion.Heading>
                          <Accordion.Trigger className="text-[10.5px] font-semibold text-foreground flex items-center justify-between w-full">
                            <span className="flex items-center gap-2">
                              <Terminal className="size-3.5 text-accent shrink-0" />
                              {parsed.title}
                            </span>
                            <Accordion.Indicator />
                          </Accordion.Trigger>
                        </Accordion.Heading>
                        <Accordion.Panel>
                          <Accordion.Body className="text-[10.5px] text-muted-foreground leading-relaxed pl-5.5 font-light pt-2">
                            {parsed.content || parsed.title}
                          </Accordion.Body>
                        </Accordion.Panel>
                      </Accordion.Item>
                    );
                  })}
                </Accordion>
              )}
            </div>
          </div>

          {/* Tier 4: Reliability Index */}
          <div className="p-5 border border-border/80 bg-surface rounded-2xl flex flex-col gap-3 min-h-[200px]">
            <span className="text-[9px] text-muted uppercase font-extrabold tracking-wider block">
              Reliability & Trust Calibration
            </span>
            {(() => {
              const score = Math.round(classification.confidence * 100);
              const completeness =
                localAnalysis.facts?.quality_metrics?.files_sampled
                  ? localAnalysis.facts.quality_metrics.files_sampled /
                  Math.max(1, localAnalysis.facts.quality_metrics.files_scanned)
                  : 1.0;
              const uncertainty = localAnalysis.trust_intelligence?.uncertainty_metrics || {
                variance: 0,
                sampling_bias_risk: 0,
                adversarial_manipulation_risk: 0
              };
              return (
                <div className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex justify-between items-center py-1 border-b border-border/20">
                    <span className="font-semibold text-foreground">Reliability Score</span>
                    <strong
                      className={`font-mono font-extrabold ${score >= 80 ? "text-success" : score >= 50 ? "text-warning" : "text-danger"
                        }`}
                    >
                      {score}%
                    </strong>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-border/20">
                    <span className="font-semibold text-foreground">Completeness</span>
                    <strong className="font-mono text-foreground font-extrabold">
                      {(completeness * 100).toFixed(0)}%
                    </strong>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-border/20">
                    <span className="font-semibold text-foreground">Statistical Variance</span>
                    <strong className="font-mono text-foreground font-extrabold">
                      {uncertainty.variance}%
                    </strong>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-border/20">
                    <span className="font-semibold text-foreground">Sampling Bias Risk</span>
                    <strong className="font-mono text-foreground font-extrabold">
                      {(uncertainty.sampling_bias_risk * 100).toFixed(1)}%
                    </strong>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="font-semibold text-foreground">Adversarial Risk</span>
                    <strong
                      className={`font-mono font-extrabold ${uncertainty.adversarial_manipulation_risk > 30 ? "text-danger" : "text-success"
                        }`}
                    >
                      {uncertainty.adversarial_manipulation_risk}%
                    </strong>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    );
  };

  const renderCvSummaryView = () => {
    if (!localAnalysis?.cvSynthesis) return null;
    const cv = localAnalysis.cvSynthesis;

    const getOwnershipProfileClasses = (profile: string) => {
      switch (profile) {
        case "High contribution profile":
          return "bg-success/15 text-success border border-success/20";
        case "Standard contribution profile":
          return "bg-accent/15 text-accent border border-accent/20";
        case "Low contribution profile":
          return "bg-warning/15 text-warning border border-warning/20";
        case "External contributor context":
        default:
          return "bg-danger/15 text-danger border border-danger/20";
      }
    };

    return (
      <div className="flex flex-col gap-6 text-left font-sans w-full">
        {/* CV Header Info */}
        <div className="p-5 border border-border/80 bg-surface rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <span className="text-[9px] text-muted uppercase font-extrabold tracking-wider block">
              Professional Title
            </span>
            <h3 className="text-lg font-black text-foreground capitalize flex items-center gap-2">
              <Crown className="size-4.5 text-warning shrink-0" />
              {cv.title}
            </h3>
          </div>
          {cv.ownershipProfile && (
            <div className="flex flex-col items-start md:items-end gap-1">
              <span className="text-[9px] text-muted uppercase font-extrabold tracking-wider block">
                Ownership Profile
              </span>
              <Chip
                size="sm"
                variant="soft"
                className={`h-6 text-[10px] font-extrabold uppercase rounded-lg px-2.5 ${getOwnershipProfileClasses(cv.ownershipProfile)}`}
              >
                {cv.ownershipProfile}
              </Chip>
            </div>
          )}
        </div>

        {/* Narrative Summary */}
        <div className="p-5 border border-border/80 bg-surface rounded-2xl flex flex-col gap-3">
          <span className="text-[9px] text-muted uppercase font-extrabold tracking-wider block">
            Executive Summary
          </span>
          <p className="text-xs text-muted leading-relaxed font-light whitespace-pre-wrap">
            {cv.summary}
          </p>
        </div>

        {/* Skills Chips */}
        {cv.skills && cv.skills.length > 0 && (
          <div className="p-5 border border-border/80 bg-surface rounded-2xl flex flex-col gap-3">
            <span className="text-[9px] text-muted uppercase font-extrabold tracking-wider block">
              Core Technical Skills
            </span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {cv.skills.map((skill, idx) => (
                <Chip
                  key={`${skill}-${idx}`}
                  size="sm"
                  variant="soft"
                  className="h-5.5 text-[10px] font-bold bg-surface-secondary text-foreground border border-border/60 rounded-md"
                >
                  {skill}
                </Chip>
              ))}
            </div>
          </div>
        )}

        {/* Highlights Section */}
        {cv.highlights && cv.highlights.length > 0 && (
          <div className="p-5 border border-border/80 bg-surface rounded-2xl flex flex-col gap-3">
            <span className="text-[9px] text-muted uppercase font-extrabold tracking-wider block">
              Key Contributions & Highlights
            </span>
            <ul className="space-y-3 mt-1 pl-1">
              {cv.highlights.map((highlight, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs">
                  <Sparkles className="size-3.5 text-accent shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <strong className="text-foreground font-bold leading-normal block">
                      {highlight.signal}
                    </strong>
                    <p className="text-muted leading-relaxed font-light">
                      {highlight.impact}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  const renderCostsView = () => {
    if (loadingCosts) {
      return (
        <div className="flex flex-col items-center justify-center h-[300px] gap-4">
          <Spinner size="lg" />
          <Typography className="text-muted text-xs">
            Loading cost observability metrics...
          </Typography>
        </div>
      );
    }

    if (!costs || !costs.executions || costs.executions.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-48 border border-border bg-background/40 rounded-xl p-4 text-muted text-xs font-sans">
          <Coins className="size-5 mb-2 opacity-50" />
          <span>No granular cost execution records found for this job.</span>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-6 text-left font-sans w-full">
        {/* Cost Metrics Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="p-5 border border-border/80 bg-surface rounded-2xl flex flex-col justify-between min-h-[120px]">
            <span className="text-[9px] text-muted uppercase font-extrabold tracking-wider block">
              Cumulative Estimated Cost
            </span>
            <strong className="text-2xl text-success font-black font-mono mt-2 block">
              ${costs.totalCostUsd.toFixed(6)}
            </strong>
            <span className="text-[10px] text-muted-foreground mt-1">Based on exact token metrics</span>
          </div>

          <div className="p-5 border border-border/80 bg-surface rounded-2xl flex flex-col justify-between min-h-[120px]">
            <span className="text-[9px] text-muted uppercase font-extrabold tracking-wider block">
              Total Processed Tokens
            </span>
            <strong className="text-2xl text-foreground font-black font-mono mt-2 block">
              {costs.totalTokens.toLocaleString()}
            </strong>
            <span className="text-[10px] text-muted-foreground mt-1">Prompt and Completion combined</span>
          </div>

          <div className="p-5 border border-border/80 bg-surface rounded-2xl flex flex-col justify-between min-h-[120px]">
            <span className="text-[9px] text-muted uppercase font-extrabold tracking-wider block">
              Cumulative API Duration
            </span>
            <strong className="text-2xl text-foreground font-black font-mono mt-2 block">
              {(costs.totalDurationMs / 1000).toFixed(2)}s
            </strong>
            <span className="text-[10px] text-muted-foreground mt-1">Total model latency</span>
          </div>
        </div>

        {/* Detailed Ledger Table */}
        <div className="border border-border/80 bg-surface rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border/80 bg-surface-secondary/40">
            <span className="text-[10px] text-foreground uppercase font-extrabold tracking-wider">
              AI Execution Ledger
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-border/80 bg-surface-secondary/20 text-muted-foreground uppercase text-[9px] font-extrabold">
                  <th className="px-5 py-3 font-sans">Task & Model</th>
                  <th className="px-5 py-3 font-sans">Type</th>
                  <th className="px-5 py-3 font-sans text-right">Prompt Tokens</th>
                  <th className="px-5 py-3 font-sans text-right">Completion Tokens</th>
                  <th className="px-5 py-3 font-sans text-right">Cached Read</th>
                  <th className="px-5 py-3 font-sans text-right font-bold">Estimated Cost</th>
                  <th className="px-5 py-3 font-sans text-right">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {costs.executions.map((exec) => {
                  const matchingTask = job?.tasks?.find(t => t.id === exec.taskId);
                  const taskTypeName = matchingTask ? (FRIENDLY_NAMES[matchingTask.taskType] || matchingTask.taskType) : "Core Agent Step";
                  return (
                    <tr key={exec.id} className="hover:bg-surface-secondary/10 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-foreground">{taskTypeName}</div>
                        <div className="text-[10px] text-muted mt-0.5 font-mono capitalize">
                          {exec.provider} / {exec.model.replace("claude-3-", "")}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <Chip size="sm" variant="soft" className="h-5 text-[8.5px] font-extrabold uppercase rounded-md">
                          {exec.executionType}
                        </Chip>
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-muted-foreground">
                        {exec.promptTokens.toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-muted-foreground">
                        {exec.completionTokens.toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-success-soft">
                        {exec.cachedTokens > 0 ? exec.cachedTokens.toLocaleString() : "-"}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-bold text-success">
                        ${exec.estimatedCostUsd.toFixed(6)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-muted-foreground">
                        {(exec.durationMs / 1000).toFixed(2)}s
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      className="bg-overlay/5 backdrop-blur-md animate-in fade-in duration-200 z-100"
    >
      <Modal.Container placement="center" scroll="inside">
        <Modal.Dialog className="w-full max-w-6xl bg-overlay border border-border rounded-2xl shadow-modal p-6 text-left relative focus-visible:outline-hidden focus:outline-hidden max-h-[95vh] flex flex-col justify-between animate-in zoom-in-95 duration-200">
          {/* Close Trigger */}
          <Modal.CloseTrigger
            aria-label="Close dialog"
            className="absolute right-6 top-6 p-1.5 rounded-full hover:bg-surface-secondary text-muted hover:text-foreground cursor-pointer transition-colors z-10"
          >
            <X size={16} />
          </Modal.CloseTrigger>

          {/* Modal Header */}
          <Modal.Header className="pr-10 flex flex-col items-start gap-3 border-b border-border/20 pb-4">
            <Modal.Heading className="outline-hidden text-left w-full flex items-center justify-between gap-4">
              <div>
                <span className="text-[10px] text-accent uppercase font-extrabold tracking-wider block mb-1">
                  AI Repository Intelligence Dashboard
                </span>
                <span className="font-extrabold text-foreground font-display select-all text-xl block">
                  {repoName}
                </span>
              </div>

              {/* View mode toggle (shown when job is completed or report is loaded) */}
              {(job?.status === "Completed" || localAnalysis) && (
                <div className="flex gap-1 bg-surface-secondary border border-border/80 rounded-xl p-1 shrink-0 font-sans ">
                  <Button
                    size="sm"
                    onClick={() => setViewMode("report")}
                    className={`rounded-lg px-3.5 py-1 text-xs font-bold ${activeViewMode === "report"
                      ? "bg-background text-foreground shadow-sm"
                      : "bg-transparent text-muted hover:text-foreground"
                      }`}
                  >
                    <LayoutDashboard size={13} className="mr-1" />
                    Dashboard
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setViewMode("graph")}
                    className={`rounded-lg px-3.5 py-1 text-xs font-bold ${activeViewMode === "graph"
                      ? "bg-background text-foreground shadow-sm"
                      : "bg-transparent text-muted hover:text-foreground"
                      }`}
                  >
                    <Share2 size={13} className="mr-1" />
                    Trust Graph
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setViewMode("logs")}
                    className={`rounded-lg px-3.5 py-1 text-xs font-bold ${activeViewMode === "logs"
                      ? "bg-background text-foreground shadow-sm"
                      : "bg-transparent text-muted hover:text-foreground"
                      }`}
                  >
                    <Terminal size={13} className="mr-1" />
                    Traces & Logs
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setViewMode("costs")}
                    className={`rounded-lg px-3.5 py-1 text-xs font-bold ${activeViewMode === "costs"
                      ? "bg-background text-foreground shadow-sm"
                      : "bg-transparent text-muted hover:text-foreground"
                      }`}
                  >
                    <Coins size={13} className="mr-1" />
                    Cost Metrics
                  </Button>
                  {localAnalysis?.cvSynthesis && (
                    <Button
                      size="sm"
                      onClick={() => setViewMode("cv")}
                      className={`rounded-lg px-3.5 py-1 text-xs font-bold ${activeViewMode === "cv"
                        ? "bg-background text-foreground shadow-sm"
                        : "bg-transparent text-muted hover:text-foreground"
                        }`}
                    >
                      <Sparkles size={13} className="mr-1" />
                      CV Summary
                    </Button>
                  )}
                </div>
              )}
            </Modal.Heading>

            {/* Top Summary Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 w-full bg-surface-secondary/40 border border-border/40 rounded-2xl p-3 text-[11px] font-mono text-muted-foreground ">
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] text-muted font-bold uppercase tracking-wider font-sans">
                  Status
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {status === "QUEUED" ? (
                    <>
                      <Spinner size="sm" color="warning" className="scale-65 shrink-0" />
                      <span className="text-warning font-extrabold capitalize text-[10px]">Queued</span>
                    </>
                  ) : status === "ANALYZING" ? (
                    <>
                      <Spinner size="sm" color="warning" className="scale-65 shrink-0" />
                      <span className="text-warning font-extrabold capitalize text-[10px]">Running</span>
                    </>
                  ) : status === "COMPLETED" ? (
                    <>
                      <CheckCircle2 size={12} className="text-success shrink-0" />
                      <span className="text-success font-extrabold capitalize text-[10px]">Complete</span>
                    </>
                  ) : status === "CANCELLED_PARTIAL" ? (
                    <>
                      <AlertCircle size={12} className="text-warning shrink-0" />
                      <span className="text-warning font-extrabold capitalize text-[10px]">Stopped (Partial)</span>
                    </>
                  ) : status === "CANCELLED" ? (
                    <>
                      <AlertCircle size={12} className="text-muted shrink-0" />
                      <span className="text-muted-foreground font-bold capitalize text-[10px]">Cancelled</span>
                    </>
                  ) : status === "FAILED" ? (
                    <>
                      <AlertTriangle size={12} className="text-danger shrink-0" />
                      <span className="text-danger font-extrabold capitalize text-[10px]">Failed</span>
                    </>
                  ) : (
                    <span className="text-foreground/80 font-bold capitalize text-[10px]">
                      Never Analyzed
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] text-muted font-bold uppercase tracking-wider font-sans">
                  Current Stage
                </span>
                <span className="text-foreground font-bold truncate block mt-0.5 text-[10px]">
                  {isJobRunning
                    ? FRIENDLY_NAMES[job?.currentStep || ""] || job?.currentStep || "Running"
                    : (job?.status === "Completed" || localAnalysis)
                      ? "Report persisted"
                      : "Idle"}
                </span>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] text-muted font-bold uppercase tracking-wider font-sans">
                  Elapsed Time
                </span>
                <div className="flex items-center gap-1 mt-0.5 text-foreground font-bold text-[10px]">
                  <Clock size={11} className="text-muted shrink-0" />
                  <span>{displayElapsedTime}</span>
                </div>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] text-muted font-bold uppercase tracking-wider font-sans">
                  Git Metrics
                </span>
                <span className="text-foreground font-bold mt-0.5 text-[10px]">
                  {commitsCount} commits / {contributorsCount} auths
                </span>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] text-muted font-bold uppercase tracking-wider font-sans">
                  Total Cost
                </span>
                <div className="flex items-center gap-1 mt-0.5 text-success font-bold text-[10px]">
                  <Coins size={11} className="text-success shrink-0" />
                  <span>${telemetry.estimatedCostUsd.toFixed(4)}</span>
                </div>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] text-muted font-bold uppercase tracking-wider font-sans">
                  Total Tokens
                </span>
                <span className="text-foreground font-bold mt-0.5 text-[10px]">
                  {(telemetry.promptTokens + telemetry.completionTokens).toLocaleString()}
                </span>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] text-muted font-bold uppercase tracking-wider font-sans">
                  AI Models
                </span>
                <span className="text-foreground font-bold truncate block mt-0.5 text-[10px] capitalize">
                  {telemetry.models.size > 0
                    ? Array.from(telemetry.models)
                      .map((m) => m.replace("claude-3-", ""))
                      .join(", ")
                    : "Claude Sonnet"}
                </span>
              </div>
            </div>

            {/* Overall Job Progress Ticker */}
            {isJobRunning && (
              <div className="w-full space-y-1 mt-1 font-mono text-[10px] text-muted-foreground">
                <div className="flex justify-between items-center">
                  <span>Pipeline Execution Progress</span>
                  <div className="flex items-center gap-2">
                    <span className="text-accent font-bold">{Math.round(repoState?.progress || 0)}%</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-[10px] font-extrabold uppercase rounded-lg border-danger/30 hover:bg-danger/10 text-danger cursor-pointer"
                      onClick={async () => {
                        try {
                          await useAnalysisJobStore.getState().cancelReanalyze(repoId);
                          toast.success("Analysis stopped.");
                        } catch (err: any) {
                          toast.danger("Failed to stop analysis: " + err.message);
                        }
                      }}
                    >
                      <XCircle size={10} className="shrink-0" />
                      <span>Stop Analysis</span>
                    </Button>
                  </div>
                </div>
                <ProgressBar
                  aria-label="Job progress"
                  value={repoState?.progress || 0}
                  color="accent"
                  size="sm"
                  className="w-full"
                >
                  <ProgressBar.Track>
                    <ProgressBar.Fill />
                  </ProgressBar.Track>
                </ProgressBar>
              </div>
            )}
          </Modal.Header>

          {/* Modal Body */}
          <Modal.Body className="flex-1 overflow-y-auto space-y-6 select-text max-h-[60vh]">
            {validationError ? (
              <div className="flex flex-col items-center justify-center p-8 border border-danger/20 bg-danger/5 rounded-2xl text-left select-text min-h-[350px]">
                <AlertTriangle className="size-12 text-danger mb-4 shrink-0 animate-bounce" />
                <h3 className="text-lg font-extrabold text-foreground mb-2">Repository Intelligence Diagnostic Failure</h3>
                <p className="text-xs text-muted-foreground mb-6 max-w-lg leading-relaxed text-center font-sans">
                  The AI analysis response for this repository failed to validate against the strict schema contract. This safety boundary prevents rendering corrupted or partial data in the UI.
                </p>
                <div className="flex gap-3 mb-6 ">
                  <Button
                    size="sm"
                    variant="danger"
                    className="rounded-xl font-bold px-4 text-xs"
                    onClick={() => {
                      if (repoId) {
                        setValidationError(null);
                        useAnalysisJobStore.getState().triggerReanalyze(repoId)
                          .then(() => toast.success("Reanalysis queued successfully!"))
                          .catch((e) => toast.danger("Failed to trigger reanalysis: " + (e.message || String(e))));
                      }
                    }}
                  >
                    Reanalyze Repository
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl font-bold px-4 text-xs border-border/40"
                    onClick={() => onOpenChange(false)}
                  >
                    Dismiss
                  </Button>
                </div>
                <details className="w-full bg-background border border-border rounded-2xl p-4 overflow-hidden">
                  <summary className="text-xs font-bold text-muted-foreground hover:text-foreground cursor-pointer ">
                    View Debug Diagnostics & Schema Errors
                  </summary>
                  <div className="mt-3 font-mono text-[10px] text-danger max-h-[220px] overflow-y-auto whitespace-pre-wrap select-all">
                    {validationError}
                  </div>
                </details>
              </div>
            ) : !localAnalysis && !job ? (
              <div className="flex flex-col items-center justify-center h-[300px] gap-4">
                <Spinner size="lg" />
                <Typography className="text-muted text-xs">
                  Initializing repository analysis monitor...
                </Typography>
              </div>
            ) : activeViewMode === "report" && localAnalysis ? (
              renderBentoGrid()
            ) : activeViewMode === "graph" && localAnalysis ? (
              <TrustGraphView trustGraph={localAnalysis.trust_intelligence?.trust_graph || null} localAnalysis={localAnalysis} />
            ) : activeViewMode === "costs" ? (
              renderCostsView()
            ) : activeViewMode === "cv" && localAnalysis?.cvSynthesis ? (
              renderCvSummaryView()
            ) : (
              /* Observability split logs view mode */
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[450px]">
                {/* Left timeline */}
                <div className="lg:col-span-5 space-y-4">
                  {job?.tasks && job.tasks.length > 0 ? (
                    <AnalysisTaskTimeline
                      tasks={job.tasks}
                      selectedTaskId={selectedTaskId}
                      onSelectTask={(id) => setSelectedTaskId(id)}
                      onRetryTask={handleRetryTask}
                      isRetryingTaskId={isRetryingTaskId}
                      isJobRunning={isJobRunning}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-48 border border-border bg-background/40 rounded-xl p-4 text-muted text-xs font-sans">
                      <Activity className="size-5 mb-2 opacity-50" />
                      <span>Pipeline tasks have not been instantiated yet.</span>
                    </div>
                  )}
                </div>

                {/* Right streaming terminal */}
                <div className="lg:col-span-7">
                  <AIStreamViewer
                    events={combinedLogs}
                    isLoading={loadingEvents}
                    taskName="Pipeline Console"
                    taskStatus={
                      !job
                        ? "Running"
                        : job.status === "Completed"
                          ? "Completed"
                          : job.status === "Failed" || job.status === "Cancelled" || job.status === "TimedOut"
                            ? "Failed"
                            : "Running"
                    }
                  />
                </div>
              </div>
            )}
          </Modal.Body>

          {/* Modal Footer */}
          <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-separator ">
            <Button
              onClick={() => onOpenChange(false)}
              className="rounded-xl text-xs font-semibold px-4 h-9"
            >
              Close
            </Button>
          </div>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
};

export default DetailedAnalysisModal;
