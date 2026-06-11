export interface RawNode {
  id: string;
  type: string;
  data: Record<string, any>;
}

export interface RawEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  weight?: number;
}

export interface PositionedNode extends RawNode {
  position: { x: number; y: number };
}

export interface LayoutOptions {
  showSkills: boolean;
  showEvidence: boolean;
  showSecurityOnly: boolean;
  searchQuery: string;
}

/**
 * Decoupled graph layout normalization stage.
 * Sorts and positions nodes into a clean unidirectional left-to-right visual DAG flow:
 * Column 0 (Left): Developer (top) & Evidence (bottom)
 * Column 1 (Center): Repository (centered)
 * Column 2 (Right): Calibrated Skills (grouped/stacked)
 */
export function calculateGraphLayout(
  nodes: RawNode[],
  edges: RawEdge[],
  options: LayoutOptions
): { nodes: PositionedNode[]; edges: RawEdge[] } {
  if (!nodes || nodes.length === 0) {
    return { nodes: [], edges: [] };
  }

  const { showSkills, showEvidence, showSecurityOnly, searchQuery } = options;
  const lowerSearch = searchQuery.toLowerCase().trim();

  // 1. Filter Nodes
  const filteredNodes = nodes.filter((node) => {
    // Basic type filters
    if (node.type === "skill" && !showSkills) return false;
    if (node.type === "evidence" && !showEvidence) return false;

    // Security only filter for evidence nodes
    if (node.type === "evidence" && showSecurityOnly) {
      const isSecurity = node.data?.category === "security";
      if (!isSecurity) return false;
    }

    // Search query filter
    if (lowerSearch) {
      const label = (node.data?.label || "").toLowerCase();
      const nodeType = (node.type || "").toLowerCase();
      const category = (node.data?.category || "").toLowerCase();
      const matchesSearch =
        label.includes(lowerSearch) ||
        nodeType.includes(lowerSearch) ||
        category.includes(lowerSearch);

      // We always keep the developer and repository nodes visible to maintain root context
      if (node.type !== "developer" && node.type !== "repository" && !matchesSearch) {
        return false;
      }
    }

    return true;
  });

  // 2. Filter Edges to only connect visible nodes
  const visibleNodeIds = new Set(filteredNodes.map((n) => n.id));
  const filteredEdges = edges.filter(
    (edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
  );

  // 3. Separate nodes by type for structured positioning
  const devNodes = filteredNodes.filter((n) => n.type === "developer");
  const repoNodes = filteredNodes.filter((n) => n.type === "repository");
  const skillNodes = filteredNodes.filter((n) => n.type === "skill");
  const evidenceNodes = filteredNodes.filter((n) => n.type === "evidence");

  // Determine heights and coordinates to prevent vertical overlaps
  const VERTICAL_GAP = 90;
  const COL_0_X = 40;     // Left column (Developer & Evidence)
  const COL_1_X = 320;    // Center column (Repository)
  const COL_2_X = 600;    // Right column (Skills)

  // Calculate Column 0 (Left) layouts
  // Developer is at the top, evidence nodes are stacked below
  const col0Nodes: PositionedNode[] = [];
  let currentY0 = 60;

  devNodes.forEach((node) => {
    col0Nodes.push({
      ...node,
      position: { x: COL_0_X, y: currentY0 },
    });
    currentY0 += 120; // Extra separation between Developer and Evidence
  });

  evidenceNodes.forEach((node) => {
    col0Nodes.push({
      ...node,
      position: { x: COL_0_X, y: currentY0 },
    });
    currentY0 += VERTICAL_GAP;
  });

  // Calculate Column 2 (Right) layout (Skills)
  const col2Nodes: PositionedNode[] = [];
  let currentY2 = 60;

  // Group skills by category to prevent cognitive overlap
  const skillsByCategory: Record<string, RawNode[]> = {};
  skillNodes.forEach((node) => {
    const cat = node.data?.category || "general";
    if (!skillsByCategory[cat]) {
      skillsByCategory[cat] = [];
    }
    skillsByCategory[cat].push(node);
  });

  // Layout skills sorted by categories
  const sortedCategories = Object.keys(skillsByCategory).sort();
  sortedCategories.forEach((cat) => {
    const categorySkills = skillsByCategory[cat];
    categorySkills.forEach((node) => {
      col2Nodes.push({
        ...node,
        position: { x: COL_2_X, y: currentY2 },
      });
      currentY2 += VERTICAL_GAP;
    });
  });

  // Calculate Column 1 (Center) layout (Repository)
  // Position repository at the vertical center of the other columns to keep connections balanced
  const maxColumnHeight = Math.max(currentY0, currentY2, 250);
  const repoY = Math.max(160, Math.floor(maxColumnHeight / 2) - 30);

  const col1Nodes: PositionedNode[] = repoNodes.map((node) => ({
    ...node,
    position: { x: COL_1_X, y: repoY },
  }));

  // Combine positioned nodes
  const positionedNodes = [...col0Nodes, ...col1Nodes, ...col2Nodes];

  return {
    nodes: positionedNodes,
    edges: filteredEdges,
  };
}
