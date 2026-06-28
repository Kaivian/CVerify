"use client";

import React, { useState, useEffect } from "react";
import {
  GitFork,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  Search,
  Sparkles,
  Clock,
  ShieldAlert,
  Play,
  Briefcase,
  Code,
  CheckCircle
} from "lucide-react";
import {
  Typography,
  Card,
  Button,
  Chip,
  Input,
  Checkbox,
  Spinner,
  ProgressBar
} from "@heroui/react";
import { profileApi } from "@/services/profile.service";
import { type CandidateSkillTreeNodeResponse } from "@/types/profile.types";
import { useCandidateAssessmentStore } from "@/stores/use-candidate-assessment-store";

export default function SkillTreePage() {
  const [loading, setLoading] = useState(true);
  const [treeData, setTreeData] = useState<CandidateSkillTreeNodeResponse[]>([]);
  const [selectedNode, setSelectedNode] = useState<CandidateSkillTreeNodeResponse | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    "Domain", "Subdomain", "Technology", "Framework", "Library", "Tool", "Methodology"
  ]);

  const assessmentStore = useCandidateAssessmentStore();

  useEffect(() => {
    // Load expansion states from localStorage if available
    try {
      const saved = localStorage.getItem("cverify_skill_tree_expanded");
      if (saved) {
        setExpandedNodes(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to load expanded nodes from localStorage", e);
    }
    loadSkillTree();
  }, []);

  const loadSkillTree = async () => {
    setLoading(true);
    try {
      const data = await profileApi.fetchLatestSkillTree();
      if (data && Array.isArray(data)) {
        setTreeData(data);
        if (data.length > 0) {
          setSelectedNode(data[0]);
          // Expand root nodes by default if no saved expansion state
          setExpandedNodes(prev => {
            if (Object.keys(prev).length === 0) {
              const initial: Record<string, boolean> = {};
              data.forEach(node => {
                initial[node.id] = true;
              });
              return initial;
            }
            return prev;
          });
        }
      } else {
        setTreeData([]);
      }
    } catch (err) {
      console.error("Failed to load skill tree:", err);
      setTreeData([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (nodeId: string) => {
    setExpandedNodes(prev => {
      const next = { ...prev, [nodeId]: !prev[nodeId] };
      try {
        localStorage.setItem("cverify_skill_tree_expanded", JSON.stringify(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });
  };

  // Helper to filter nodes recursively
  const filterTree = (nodes: CandidateSkillTreeNodeResponse[]): CandidateSkillTreeNodeResponse[] => {
    if (!nodes || !Array.isArray(nodes)) return [];
    return nodes
      .map(node => {
        const matchesSearch = node.displayName.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategories.includes(node.category);
        const filteredChildren = node.children ? filterTree(node.children) : [];

        const isMatch = (matchesSearch && matchesCategory) || filteredChildren.length > 0;

        if (isMatch) {
          return {
            ...node,
            children: filteredChildren
          };
        }
        return null;
      })
      .filter((n): n is CandidateSkillTreeNodeResponse => n !== null);
  };

  const filteredTree = filterTree(treeData);

  const getProficiencyColor = (level: string): "success" | "warning" | "default" | "accent" => {
    switch (level.toLowerCase()) {
      case "expert": return "success";
      case "practitioner": return "accent";
      case "working": return "warning";
      case "awareness": return "default";
      default: return "default";
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "Domain": return "bg-blue-500/10 text-blue-400 border border-blue-500/20";
      case "Subdomain": return "bg-purple-500/10 text-purple-400 border border-purple-500/20";
      case "Technology": return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
      case "Framework": return "bg-amber-500/10 text-amber-400 border border-amber-500/20";
      case "Library": return "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20";
      case "Tool": return "bg-pink-500/10 text-pink-400 border border-pink-500/20";
      case "Methodology": return "bg-teal-500/10 text-teal-400 border border-teal-500/20";
      default: return "bg-default/10 text-default-400 border border-default/20";
    }
  };

  const handleTriggerAssessment = async () => {
    setLoading(true);
    try {
      await assessmentStore.triggerAssessment();
      // Connect progress stream and poll
      await loadSkillTree();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Render a single tree node recursively
  const renderTreeNode = (node: CandidateSkillTreeNodeResponse, depth: number = 0) => {
    const isExpanded = !!expandedNodes[node.id];
    const isSelected = selectedNode?.id === node.id;
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={node.id} className="select-none font-outfit">
        <div
          onClick={() => setSelectedNode(node)}
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
          className={`flex items-center justify-between py-2.5 pr-3 rounded-lg cursor-pointer transition-all border ${isSelected
              ? "bg-surface-secondary border-border text-foreground font-semibold"
              : "border-transparent hover:bg-surface-secondary/40 text-muted hover:text-foreground"
            }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {hasChildren ? (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand(node.id);
                }}
                className="p-0.5 rounded-sm hover:bg-separator/40 cursor-pointer"
              >
                {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              </span>
            ) : (
              <span className="w-5" />
            )}

            {hasChildren ? (
              isExpanded ? <FolderOpen size={17} className="text-amber-500 shrink-0" /> : <Folder size={17} className="text-amber-500 shrink-0" />
            ) : (
              <GitFork size={16} className="text-muted/70 shrink-0" />
            )}

            <span className="truncate text-sm">{node.displayName}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className={`px-2 py-0.5 text-[10px] rounded-full uppercase tracking-wider font-extrabold ${getCategoryColor(node.category)}`}>
              {node.category}
            </span>
            <Chip
              size="sm"
              variant="soft"
              color={getProficiencyColor(node.proficiencyLevel)}
              className="text-[10px] uppercase font-bold"
            >
              {node.proficiencyLevel}
            </Chip>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="mt-0.5 border-l border-separator/30 ml-5 pl-1.5">
            {node.children.map(child => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Structured Evidence details parser
  const renderSupportingEvidence = (evidenceStr?: string) => {
    if (!evidenceStr) return <p className="text-xs text-muted">No evidence provided.</p>;
    try {
      const parsed = JSON.parse(evidenceStr);
      const references = parsed.references || [];
      if (references.length === 0) {
        return <p className="text-xs text-muted">No concrete profile references generated.</p>;
      }
      return (
        <div className="space-y-3.5">
          {references.map((ref: any, idx: number) => {
            const Icon = ref.sourceType === "Repository" ? Code : ref.sourceType === "WorkExperience" ? Briefcase : CheckCircle;
            return (
              <div key={idx} className="p-3 bg-background border border-border/60 rounded-xl flex gap-3 items-start">
                <div className="p-2 rounded-lg bg-surface-secondary text-foreground shrink-0">
                  <Icon size={16} />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted">
                    {ref.sourceType}
                  </span>
                  <h4 className="text-xs font-bold text-foreground">
                    {ref.displayName}
                  </h4>
                  <p className="text-xs text-muted leading-relaxed font-light">
                    {ref.details}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      );
    } catch {
      return (
        <div className="p-3 bg-background border border-border/60 rounded-xl">
          <p className="text-xs text-muted font-light leading-relaxed">{evidenceStr}</p>
        </div>
      );
    }
  };

  return (
    <div className="space-y-6 font-outfit select-none">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Typography type="h1" className="text-2xl font-bold text-foreground">
            Verified Skill Tree
          </Typography>
          <Typography type="body-xs" className="text-muted mt-0.5 font-light">
            Hierarchical, validated assessment of capabilities and professional skills.
          </Typography>
        </div>
        <Button
          variant="outline"
          onClick={loadSkillTree}
          isDisabled={loading}
          className="cursor-pointer"
        >
          Refresh Tree
        </Button>
      </div>

      {loading ? (
        <Card className="flex flex-col items-center justify-center p-16 space-y-4">
          <Spinner size="lg" />
          <p className="text-sm text-muted">Loading candidate skill tree...</p>
        </Card>
      ) : treeData.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-16 text-center space-y-6">
          <div className="p-4 rounded-full bg-surface-secondary text-muted">
            <GitFork size={36} />
          </div>
          <div className="space-y-2 max-w-md">
            <h3 className="text-lg font-bold text-foreground">No Verified Skill Tree Found</h3>
            <p className="text-sm text-muted font-light leading-relaxed">
              Verify your technical repositories and profile to construct your candidate intelligence skill tree.
            </p>
          </div>
          <Button variant="primary" onClick={handleTriggerAssessment} className="cursor-pointer">
            <Play size={15} /> Trigger Assessment
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Sidebar Filters */}
          <Card className="lg:col-span-3 p-4 space-y-5">
            <div className="space-y-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-foreground">Search</span>
              <div className="relative w-full">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <Input
                  placeholder="Filter by skill..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9"
                />
              </div>
            </div>

            <div className="space-y-2.5">
              <span className="text-xs font-extrabold uppercase tracking-wider text-foreground">Filter Categories</span>
              <div className="flex flex-col gap-2">
                {["Domain", "Subdomain", "Technology", "Framework", "Library", "Tool", "Methodology"].map(cat => (
                  <Checkbox
                    key={cat}
                    isSelected={selectedCategories.includes(cat)}
                    onChange={() => {
                      setSelectedCategories(prev =>
                        prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
                      );
                    }}
                    className="text-xs font-light"
                  >
                    {cat}
                  </Checkbox>
                ))}
              </div>
            </div>
          </Card>

          {/* Tree Rendering */}
          <Card className="lg:col-span-5 p-5 min-h-[600px] max-h-[800px] overflow-y-auto">
            {filteredTree.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-16 text-center text-muted">
                <Search size={24} className="mb-2" />
                <p className="text-sm font-light">No matching skills found.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {filteredTree.map(node => renderTreeNode(node, 0))}
              </div>
            )}
          </Card>

          {/* Details Drawer */}
          <Card className="lg:col-span-4 p-5 min-h-[600px]">
            {selectedNode ? (
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-0.5 text-[10px] rounded-full uppercase tracking-wider font-extrabold ${getCategoryColor(selectedNode.category)}`}>
                      {selectedNode.category}
                    </span>
                    <Chip
                      variant="soft"
                      color={getProficiencyColor(selectedNode.proficiencyLevel)}
                      className="text-[10px] uppercase font-extrabold"
                    >
                      {selectedNode.proficiencyLevel}
                    </Chip>
                  </div>
                  <h2 className="text-xl font-bold text-foreground">
                    {selectedNode.displayName}
                  </h2>
                </div>

                <div className="grid grid-cols-2 gap-4 bg-surface-secondary/40 border border-border/40 p-4 rounded-2xl select-none">
                  <div className="space-y-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted flex items-center gap-1.5">
                      <Clock size={12} /> Experience
                    </span>
                    <p className="text-sm font-bold text-foreground">
                      {selectedNode.estimatedExperienceMonths > 0
                        ? `${selectedNode.estimatedExperienceMonths} mo`
                        : "N/A"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted flex items-center gap-1.5">
                      <Sparkles size={12} /> Confidence
                    </span>
                    <p className="text-sm font-bold text-foreground">
                      {Math.round(selectedNode.confidenceScore * 100)}%
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-foreground">Proficiency Indicator</span>
                  <div className="space-y-1">
                    <ProgressBar
                      value={
                        selectedNode.proficiencyLevel.toLowerCase() === "expert" ? 95 :
                          selectedNode.proficiencyLevel.toLowerCase() === "practitioner" ? 70 :
                            selectedNode.proficiencyLevel.toLowerCase() === "working" ? 45 : 20
                      }
                      color={getProficiencyColor(selectedNode.proficiencyLevel)}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-foreground">Supporting Evidence</span>
                  {renderSupportingEvidence(selectedNode.supportingEvidence)}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-16 text-center text-muted min-h-[400px]">
                <GitFork size={30} className="mb-2" />
                <p className="text-sm font-light">Select a skill node to view detailed verifications.</p>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
