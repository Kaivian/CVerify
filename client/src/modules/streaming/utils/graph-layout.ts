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
    if (node.type === "skill" && !showSkills) return false;
    if (node.type === "evidence" && !showEvidence) return false;

    if (node.type === "evidence" && showSecurityOnly) {
      const isSecurity = node.data?.category === "security";
      if (!isSecurity) return false;
    }

    if (lowerSearch) {
      const label = (node.data?.label || "").toLowerCase();
      const nodeType = (node.type || "").toLowerCase();
      const category = (node.data?.category || "").toLowerCase();
      const matchesSearch =
        label.includes(lowerSearch) ||
        nodeType.includes(lowerSearch) ||
        category.includes(lowerSearch);

      if (node.type !== "developer" && node.type !== "repository" && !matchesSearch) {
        return false;
      }
    }

    return true;
  });

  // 2. Filter Edges
  const visibleNodeIds = new Set(filteredNodes.map((n) => n.id));
  const filteredEdges = edges.filter(
    (edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
  );

  // 3. Columns Layout
  const devNodes = filteredNodes.filter((n) => n.type === "developer");
  const repoNodes = filteredNodes.filter((n) => n.type === "repository");
  const skillNodes = filteredNodes.filter((n) => n.type === "skill");
  const evidenceNodes = filteredNodes.filter((n) => n.type === "evidence");

  const VERTICAL_GAP = 120;
  const COL_0_X = 40;     // Left column
  const COL_1_X = 420;    // Center column
  const COL_2_X = 800;    // Right column

  const col0Nodes: PositionedNode[] = [];
  let currentY0 = 60;

  devNodes.forEach((node) => {
    col0Nodes.push({
      ...node,
      position: { x: COL_0_X, y: currentY0 },
    });
    currentY0 += 140;
  });

  evidenceNodes.forEach((node) => {
    col0Nodes.push({
      ...node,
      position: { x: COL_0_X, y: currentY0 },
    });
    currentY0 += VERTICAL_GAP;
  });

  const col2Nodes: PositionedNode[] = [];
  let currentY2 = 60;

  const skillsByCategory: Record<string, RawNode[]> = {};
  skillNodes.forEach((node) => {
    const cat = node.data?.category || "general";
    if (!skillsByCategory[cat]) {
      skillsByCategory[cat] = [];
    }
    skillsByCategory[cat].push(node);
  });

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

  const maxColumnHeight = Math.max(currentY0, currentY2, 250);
  const repoY = Math.max(160, Math.floor(maxColumnHeight / 2) - 30);

  const col1Nodes: PositionedNode[] = repoNodes.map((node) => ({
    ...node,
    position: { x: COL_1_X, y: repoY },
  }));

  const positionedNodes = [...col0Nodes, ...col1Nodes, ...col2Nodes];

  return {
    nodes: positionedNodes,
    edges: filteredEdges,
  };
}
