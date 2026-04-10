export type ComponentCategory = "atom" | "molecule" | "organism" | "template" | "feature";
export type ComponentMaturity = "experimental" | "beta" | "stable" | "legacy";

export interface ComponentNode {
  id: string;
  name: string;
  category: ComponentCategory;
  tags: string[];
  description: string;
  status: ComponentMaturity;
  owner: string;
  maintainers: string[];
  dependencyRisk: number; // 1 to 5 index calculated from composition tree depth
  reuseScore: number; // count of composed components using this element
  responsive: boolean;
  themeable: boolean;
  a11yCompliant: boolean;
  usageCount: number;
  pagesUsed: string[];
  codeSnippet: string;
  lastUpdated: string;
  composedOf: string[]; // Component IDs it uses
  usedIn: string[]; // Component IDs it is used in
}

export interface ComponentEdge {
  id: string;
  source: string;
  target: string;
  type: "composes" | "depends" | "variant";
}

export interface ComponentRegistry {
  nodes: ComponentNode[];
  edges: ComponentEdge[];
}
