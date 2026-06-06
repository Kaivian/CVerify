import { create } from "zustand";
import { applyNodeChanges, applyEdgeChanges, type NodeChange, type EdgeChange } from "@xyflow/react";
import { calculateGraphLayout, PositionedNode, RawEdge, RawNode } from "../utils/graph-layout";

export interface TrustGraphState {
  // Graph Data
  rawNodes: RawNode[];
  rawEdges: RawEdge[];
  nodes: PositionedNode[];
  edges: RawEdge[];

  // Interactive UI State
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  searchQuery: string;
  showSkills: boolean;
  showEvidence: boolean;
  showSecurityOnly: boolean;

  // Cached adjacency / connection lookups
  adjacencyMap: Record<string, Set<string>>;
  connectedNodes: Set<string>; // Connected to active node (selected or hovered)
  connectedEdges: Set<string>; // Connected to active node (selected or hovered)

  // Actions
  initializeGraph: (nodes: RawNode[], edges: RawEdge[]) => void;
  setSelectedNodeId: (id: string | null) => void;
  setHoveredNodeId: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  setShowSkills: (show: boolean) => void;
  setShowEvidence: (show: boolean) => void;
  setShowSecurityOnly: (show: boolean) => void;
  resetFilters: () => void;
  
  // ReactFlow standard change handlers
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
}

// Helper to construct adjacency map for bidirectional connection checking
function buildAdjacencyMap(nodes: RawNode[], edges: RawEdge[]): Record<string, Set<string>> {
  const map: Record<string, Set<string>> = {};
  
  nodes.forEach((node) => {
    map[node.id] = new Set<string>();
  });

  edges.forEach((edge) => {
    if (map[edge.source]) map[edge.source].add(edge.target);
    if (map[edge.target]) map[edge.target].add(edge.source);
  });

  return map;
}

// Helper to compute highlighting sets based on active nodes
function computeConnections(
  activeId: string | null,
  edges: RawEdge[],
  adjacencyMap: Record<string, Set<string>>
): { connectedNodes: Set<string>; connectedEdges: Set<string> } {
  const nodesSet = new Set<string>();
  const edgesSet = new Set<string>();

  if (!activeId) {
    return { connectedNodes: nodesSet, connectedEdges: edgesSet };
  }

  // Active node is always self-connected
  nodesSet.add(activeId);

  // Find direct neighbors
  const neighbors = adjacencyMap[activeId];
  if (neighbors) {
    neighbors.forEach((nId) => {
      nodesSet.add(nId);
    });
  }

  // Find edges connecting activeId
  edges.forEach((edge) => {
    if (edge.source === activeId || edge.target === activeId) {
      edgesSet.add(edge.id);
    }
  });

  return { connectedNodes: nodesSet, connectedEdges: edgesSet };
}

export const useTrustGraphStore = create<TrustGraphState>((set, get) => {
  // Common helper to update layout based on updated filters/search
  const triggerLayoutUpdate = (
    updates: Partial<Pick<TrustGraphState, "showSkills" | "showEvidence" | "showSecurityOnly" | "searchQuery">>
  ) => {
    const state = get();
    const showSkills = updates.showSkills !== undefined ? updates.showSkills : state.showSkills;
    const showEvidence = updates.showEvidence !== undefined ? updates.showEvidence : state.showEvidence;
    const showSecurityOnly = updates.showSecurityOnly !== undefined ? updates.showSecurityOnly : state.showSecurityOnly;
    const searchQuery = updates.searchQuery !== undefined ? updates.searchQuery : state.searchQuery;

    const { nodes: positionedNodes, edges: filteredEdges } = calculateGraphLayout(
      state.rawNodes,
      state.rawEdges,
      { showSkills, showEvidence, showSecurityOnly, searchQuery }
    );

    const adjacencyMap = buildAdjacencyMap(positionedNodes, filteredEdges);
    
    // Clear selection/hover if the respective nodes are no longer visible
    const visibleNodeIds = new Set(positionedNodes.map((n) => n.id));
    let selectedNodeId = state.selectedNodeId;
    if (selectedNodeId && !visibleNodeIds.has(selectedNodeId)) {
      selectedNodeId = null;
    }
    let hoveredNodeId = state.hoveredNodeId;
    if (hoveredNodeId && !visibleNodeIds.has(hoveredNodeId)) {
      hoveredNodeId = null;
    }

    const activeId = hoveredNodeId || selectedNodeId;
    const { connectedNodes, connectedEdges } = computeConnections(activeId, filteredEdges, adjacencyMap);

    set({
      ...updates,
      nodes: positionedNodes,
      edges: filteredEdges,
      adjacencyMap,
      selectedNodeId,
      hoveredNodeId,
      connectedNodes,
      connectedEdges,
    });
  };

  return {
    rawNodes: [],
    rawEdges: [],
    nodes: [],
    edges: [],
    selectedNodeId: null,
    hoveredNodeId: null,
    searchQuery: "",
    showSkills: true,
    showEvidence: true,
    showSecurityOnly: false,
    adjacencyMap: {},
    connectedNodes: new Set(),
    connectedEdges: new Set(),

    initializeGraph: (nodes, edges) => {
      const showSkills = true;
      const showEvidence = true;
      const showSecurityOnly = false;
      const searchQuery = "";

      const { nodes: positionedNodes, edges: filteredEdges } = calculateGraphLayout(
        nodes,
        edges,
        { showSkills, showEvidence, showSecurityOnly, searchQuery }
      );

      const adjacencyMap = buildAdjacencyMap(positionedNodes, filteredEdges);

      set({
        rawNodes: nodes,
        rawEdges: edges,
        nodes: positionedNodes,
        edges: filteredEdges,
        selectedNodeId: null,
        hoveredNodeId: null,
        searchQuery,
        showSkills,
        showEvidence,
        showSecurityOnly,
        adjacencyMap,
        connectedNodes: new Set(),
        connectedEdges: new Set(),
      });
    },

    setSelectedNodeId: (id) => {
      const state = get();
      const activeId = state.hoveredNodeId || id;
      const { connectedNodes, connectedEdges } = computeConnections(activeId, state.edges, state.adjacencyMap);
      set({ selectedNodeId: id, connectedNodes, connectedEdges });
    },

    setHoveredNodeId: (id) => {
      const state = get();
      const activeId = id || state.selectedNodeId;
      const { connectedNodes, connectedEdges } = computeConnections(activeId, state.edges, state.adjacencyMap);
      set({ hoveredNodeId: id, connectedNodes, connectedEdges });
    },

    setSearchQuery: (query) => {
      triggerLayoutUpdate({ searchQuery: query });
    },

    setShowSkills: (show) => {
      triggerLayoutUpdate({ showSkills: show });
    },

    setShowEvidence: (show) => {
      triggerLayoutUpdate({ showEvidence: show });
    },

    setShowSecurityOnly: (show) => {
      triggerLayoutUpdate({ showSecurityOnly: show });
    },

    resetFilters: () => {
      triggerLayoutUpdate({
        showSkills: true,
        showEvidence: true,
        showSecurityOnly: false,
        searchQuery: "",
      });
    },

    onNodesChange: (changes) => {
      set({
        nodes: applyNodeChanges(changes, get().nodes) as PositionedNode[]
      });
    },

    onEdgesChange: (changes) => {
      set({
        edges: applyEdgeChanges(changes, get().edges) as RawEdge[]
      });
    }
  };
});
