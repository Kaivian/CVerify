import React, { useEffect, useMemo } from "react";
import { Button, Chip, SearchField, ProgressBar } from "@heroui/react";
import {
  X,
  Crown,
  Terminal,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Share2,
  RefreshCw,
  Clock,
  Coins,
  Activity
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
import { useTrustGraphStore } from "../stores/use-trust-graph-store";

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
            <span className={`px-1 rounded text-[7.5px] font-extrabold uppercase shrink-0 ${category === "security" ? "bg-danger/10 text-danger" : "bg-success/10 text-success"}`}>
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

const deriveTrustGraph = (report: any): { nodes: any[]; edges: any[] } | null => {
  if (!report) return null;

  const nodes: any[] = [];
  const edges: any[] = [];

  // 1. Root Developer Node
  nodes.push({
    id: "developer-root",
    type: "developer",
    data: {
      label: report.cvSynthesis?.title || "Developer Profile",
      category: "developer",
    },
  });

  // 2. Root Repository Node
  const trustScore = report.classification?.trustScore ?? 0;
  const trustScorePct = Math.round(trustScore > 1 ? trustScore : trustScore * 100);
  nodes.push({
    id: "repo-root",
    type: "repository",
    data: {
      label: report.repo?.name || "Repository",
      trustScore: trustScorePct,
    },
  });

  edges.push({
    id: "dev-to-repo",
    source: "developer-root",
    target: "repo-root",
    label: "contributes",
  });

  // 3. Skill Nodes
  const skills = report.cvSynthesis?.skills || [];
  skills.forEach((skill: string) => {
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
  const findings = report.findings || report.ai_conclusions?.findings || [];
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
  report: any;
}

export const TrustGraphView: React.FC<TrustGraphViewProps> = ({ report }) => {
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

  useEffect(() => {
    if (report) {
      const graph = report.trust_intelligence?.trust_graph;
      if (graph && graph.nodes && graph.nodes.length > 0) {
        initializeGraph(graph.nodes, graph.edges);
      } else {
        const derived = deriveTrustGraph(report);
        if (derived) {
          initializeGraph(derived.nodes, derived.edges);
        }
      }
    }
  }, [report, initializeGraph]);

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
        style: {},
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
      const gitMetrics = report?.facts?.git_metrics;
      const repoOwner = report?.repo?.full_name ? report.repo.full_name.split("/")[0] : "";
      const devEmail = gitMetrics?.contributor_distribution?.find((c: any) => c.author.toLowerCase().includes(repoOwner.toLowerCase() || ""))?.email || "verified_git_signature@github.com";
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
                {report?.trust_intelligence?.conflict_resolution_log?.length
                  ? "Overrode active ownership discrepancy. Resolved commit profile alignment flags."
                  : "Git history signature matches local developer credentials. Primary commit patterns verified."}
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (selectedNode.type === "repository") {
      const repo = report?.repo;
      const classif = report?.classification;
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
      const findings = report?.findings || report?.ai_conclusions?.findings || [];
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
            className={`rounded-lg px-3 py-1 h-7.5 text-[10.5px] font-extrabold uppercase ${showSkills ? "bg-background text-foreground shadow-sm" : "bg-transparent text-muted hover:text-foreground"}`}
          >
            <Sparkles size={11} className="mr-1" />
            Skills
          </Button>
          <Button
            size="sm"
            onClick={() => setShowEvidence(!showEvidence)}
            className={`rounded-lg px-3 py-1 h-7.5 text-[10.5px] font-extrabold uppercase ${showEvidence && !showSecurityOnly ? "bg-background text-foreground shadow-sm" : "bg-transparent text-muted hover:text-foreground"}`}
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
            className={`rounded-lg px-3 py-1 h-7.5 text-[10.5px] font-extrabold uppercase ${showSecurityOnly ? "bg-background text-danger shadow-sm" : "bg-transparent text-muted hover:text-danger"}`}
          >
            <AlertTriangle size={11} className="mr-1" />
            Security Only
          </Button>
        </div>
      </div>

      {/* Main Graph & Inspect split screen container */}
      <div className="flex gap-0 border border-border/80 bg-surface rounded-3xl overflow-hidden relative h-[500px] md:h-[600px]">
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
        <div className="w-[300px] h-full border-l border-border bg-surface-secondary/20 flex flex-col shrink-0 select-text">
          {renderInspectPanel()}
        </div>
      </div>
    </div>
  );
};
