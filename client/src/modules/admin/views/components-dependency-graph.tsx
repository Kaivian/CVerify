"use client";

import React, { useEffect, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  Position,
  NodeProps,
  Edge
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { getComponentRegistry } from "../../../components/registry";
import { useComponentSystemStore } from "../../../stores/use-component-system-store";
import { ComponentNode as RegistryNode } from "../../../components/registry/types";

// ============================================================================
// 1. Custom Node Rendering Component
// ============================================================================
interface CustomNodeData extends Record<string, unknown> {
  node: RegistryNode;
  active: boolean;
  onSelect: (id: string) => void;
}

const CustomComponentNode: React.FC<NodeProps> = ({ data, id }) => {
  const customData = data as unknown as CustomNodeData;
  const item = customData.node;
  const isSelected = customData.active;

  // Custom visual theme based on Atomic Design category
  const getCategoryStyles = () => {
    switch (item.category) {
      case "atom":
        return "border-primary bg-primary/5 text-primary shadow-primary/10";
      case "molecule":
        return "border-secondary bg-secondary/5 text-secondary shadow-secondary/10";
      case "organism":
      default:
        return "border-accent bg-accent/5 text-accent shadow-accent/10";
    }
  };

  const getStatusBadge = () => {
    switch (item.status) {
      case "stable":
        return "bg-success/10 text-success border-success/20";
      case "beta":
        return "bg-warning/10 text-warning border-warning/20";
      case "experimental":
        return "bg-purple-500/10 text-purple-400 border-purple-500/20";
      case "legacy":
      default:
        return "bg-danger/10 text-danger border-danger/20";
    }
  };

  return (
    <div
      onClick={() => customData.onSelect(item.id)}
      className={[
        "px-4 py-3 rounded-2xl border-2 shadow-md w-60 transition-all duration-300 font-outfit cursor-pointer select-none",
        "bg-surface hover:scale-105 active:scale-[0.98]",
        isSelected ? "ring-2 ring-accent border-accent scale-105 shadow-lg" : "border-border/60",
        getCategoryStyles()
      ].join(" ")}
    >
      {/* Handles for flow linkage */}
      <Handle type="target" position={Position.Left} className="w-2.5 h-2.5 bg-accent/80 border-2 border-surface" />
      <Handle type="source" position={Position.Right} className="w-2.5 h-2.5 bg-accent/80 border-2 border-surface" />

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-[9px] font-extrabold uppercase tracking-wider opacity-85">
            {item.category}
          </span>
          <span className={["px-1.5 py-0.5 rounded-md text-[9px] font-bold border", getStatusBadge()].join(" ")}>
            {item.status}
          </span>
        </div>

        <div className="space-y-0.5">
          <h4 className="font-extrabold text-foreground text-sm truncate">{item.name}</h4>
          <p className="text-[10px] text-muted truncate">{item.description}</p>
        </div>

        <div className="flex items-center justify-between pt-1.5 border-t border-border/20 text-[9px] text-muted">
          <span>Reused in: {item.usedIn.length}</span>
          <span>Risk Index: {item.dependencyRisk}/5</span>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 2. Dynamic interactive graph canvas
// ============================================================================
export const ComponentsDependencyGraph: React.FC = () => {
  const { selectedComponentId, selectComponent } = useComponentSystemStore();

  const { nodes: registryNodes } = useMemo(() => getComponentRegistry(), []);

  // Map visual nodes based on structured coordinates
  const initialNodes = useMemo(() => {
    // Partition indexes to align rows neatly
    let atomIdx = 0;
    let moleIdx = 0;
    let orgIdx = 0;

    return registryNodes.map((item) => {
      let x = 100;
      let y = 50;

      if (item.category === "atom") {
        x = 100;
        y = atomIdx * 160 + 40;
        atomIdx++;
      } else if (item.category === "molecule") {
        x = 460;
        y = moleIdx * 160 + 40;
        moleIdx++;
      } else if (item.category === "organism") {
        x = 820;
        y = orgIdx * 160 + 80;
        orgIdx++;
      }

      return {
        id: item.id,
        type: "custom",
        position: { x, y },
        data: {
          node: item,
          active: selectedComponentId === item.id,
          onSelect: (id: string) => selectComponent(id)
        }
      };
    });
  }, [registryNodes, selectedComponentId, selectComponent]);

  // Dynamic automatic calculation of links
  const initialEdges = useMemo(() => {
    const edges: Edge[] = [];
    registryNodes.forEach((node) => {
      if (node.composedOf && node.composedOf.length > 0) {
        node.composedOf.forEach((sourceId) => {
          const isHighlighted = selectedComponentId === node.id || selectedComponentId === sourceId;
          edges.push({
            id: `edge-${sourceId}-to-${node.id}`,
            source: sourceId,
            target: node.id,
            type: "smoothstep",
            animated: isHighlighted,
            style: {
              stroke: isHighlighted ? "#006FEE" : "var(--border)",
              strokeWidth: isHighlighted ? 3 : 1.5,
              opacity: isHighlighted ? 1 : 0.4
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 14,
              height: 14,
              color: isHighlighted ? "#006FEE" : "var(--border)"
            }
          });
        });
      }
    });
    return edges;
  }, [registryNodes, selectedComponentId]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync active states on selection trigger
  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: {
          ...n.data,
          active: selectedComponentId === n.id
        }
      }))
    );
  }, [selectedComponentId, setNodes]);

  // Sync edges highlights
  useEffect(() => {
    setEdges(initialEdges);
  }, [selectedComponentId, initialEdges, setEdges]);

  const nodeTypes = useMemo(() => ({ custom: CustomComponentNode }), []);

  return (
    <div className="w-full h-[620px] rounded-2xl border-2 border-border/60 bg-surface overflow-hidden relative shadow-sm">
      <div className="absolute top-4 left-4 z-10 select-none bg-surface/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-border/40 text-xs font-semibold text-muted flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
        <span>Interactive Canvas • Hover or Click Nodes to Inspect Paths</span>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.5}
        maxZoom={1.5}
      >
        <Background gap={16} size={1} className="opacity-40 text-muted" />
        <Controls className="!bg-surface !border-2 !border-border/60 !rounded-xl !shadow-sm overflow-hidden" />
        <MiniMap
          nodeColor={(n) => {
            const nodeData = n.data as unknown as CustomNodeData;
            const category = nodeData?.node?.category;
            if (category === "atom") return "var(--primary)";
            if (category === "molecule") return "var(--secondary)";
            return "var(--accent)";
          }}
          className="!bg-surface !border-2 !border-border/60 !rounded-xl !shadow-sm overflow-hidden opacity-90 hidden sm:block"
        />
      </ReactFlow>
    </div>
  );
};

export default ComponentsDependencyGraph;
