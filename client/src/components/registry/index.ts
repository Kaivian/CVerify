import { atomComponents } from "./atoms";
import { moleculeComponents } from "./molecules";
import { organismComponents } from "./organisms";
import { ComponentNode, ComponentEdge, ComponentRegistry } from "./types";

/**
 * Aggregates all registered visual component metadata nodes dynamically.
 */
export const getComponentNodes = (): ComponentNode[] => {
  return [
    ...atomComponents,
    ...moleculeComponents,
    ...organismComponents
  ];
};

/**
 * Automatically computes graph dependency edges based on node-level composedOf definitions.
 * This guarantees synchronization between metadata and the visual dependency layout.
 */
export const getComponentEdges = (nodes: ComponentNode[]): ComponentEdge[] => {
  const edges: ComponentEdge[] = [];
  
  nodes.forEach((node) => {
    if (node.composedOf && node.composedOf.length > 0) {
      node.composedOf.forEach((sourceId) => {
        edges.push({
          id: `edge-${sourceId}-to-${node.id}`,
          source: sourceId,
          target: node.id,
          type: "composes"
        });
      });
    }
  });

  return edges;
};

/**
 * Retrieves the unified ComponentRegistry payload containing all nodes and auto-resolved edges.
 */
export const getComponentRegistry = (): ComponentRegistry => {
  const nodes = getComponentNodes();
  const edges = getComponentEdges(nodes);
  return { nodes, edges };
};
