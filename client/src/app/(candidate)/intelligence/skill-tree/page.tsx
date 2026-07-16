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
  Briefcase,
  Code,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  TrendingUp,
  Award
} from "lucide-react";
import {
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
import { useAssessment } from "@/providers/assessment-provider";
import { CandidateAssessmentEmptyState } from "@/components/ui/CandidateAssessmentEmptyState";

export default function SkillTreePage() {
  const {
    latestAssessment,
    parsedProfile,
    parsedImprovementPlan,
    isLoadingLatest
  } = useAssessment();

  const [loading, setLoading] = useState(true);
  const [treeData, setTreeData] = useState<CandidateSkillTreeNodeResponse[]>([]);
  const [selectedNode, setSelectedNode] = useState<CandidateSkillTreeNodeResponse | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    "Domain", "Subdomain", "Technology", "Framework", "Library", "Tool", "Methodology"
  ]);

  async function loadSkillTree() {
    setLoading(true);
    try {
      const data = await profileApi.fetchLatestSkillTree();
      if (data && Array.isArray(data)) {
        setTreeData(data);
        if (data.length > 0 && !selectedNode) {
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
  }

  // Load Tree expansion states on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("cverify_skill_tree_expanded");
      if (saved) {
        setExpandedNodes(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to load expanded nodes from localStorage", e);
    }
  }, []);

  // Fetch tree data whenever the active completed assessment ID changes
  useEffect(() => {
    if (latestAssessment?.id) {
      loadSkillTree();
    } else {
      setTreeData([]);
      setLoading(false);
    }
  }, [latestAssessment?.id]);

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

  // Render a single tree node recursively
  const renderTreeNode = (node: CandidateSkillTreeNodeResponse, depth: number = 0) => {
    const isExpanded = !!expandedNodes[node.id];
    const isSelected = selectedNode?.id === node.id;
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={node.id} className="select-none font-sans">
        <div
          onClick={() => setSelectedNode(node)}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          className={`flex items-center justify-between py-2 pr-3 rounded-lg cursor-pointer transition-colors border ${isSelected
              ? "bg-surface-secondary border-border/80 text-foreground font-semibold"
              : "border-transparent hover:bg-surface-secondary/40 text-muted hover:text-foreground"
            }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {hasChildren ? (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand(node.id);
                }}
                className="p-0.5 rounded-sm hover:bg-separator/40 cursor-pointer"
              >
                {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </span>
            ) : (
              <span className="w-[18px]" />
            )}

            {hasChildren ? (
              isExpanded ? <FolderOpen size={15} className="text-amber-500/80 shrink-0" /> : <Folder size={15} className="text-amber-500/80 shrink-0" />
            ) : (
              <GitFork size={14} className="text-muted/60 shrink-0" />
            )}

            <span className="truncate text-xs">{node.displayName}</span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`px-1.5 py-0.5 text-[8px] rounded-full uppercase tracking-wider font-extrabold ${getCategoryColor(node.category)}`}>
              {node.category}
            </span>
            <Chip
              size="sm"
              variant="soft"
              color={getProficiencyColor(node.proficiencyLevel)}
              className="text-[8px] uppercase font-bold h-4 px-1"
            >
              {node.proficiencyLevel}
            </Chip>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="mt-0.5 border-l border-border/30 ml-[25px] pl-1">
            {node.children.map(child => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Structured Evidence details parser
  const renderSupportingEvidence = (evidenceStr?: string) => {
    if (!evidenceStr) return <p className="text-[10px] text-muted-foreground">No evidence provided.</p>;
    try {
      const parsed = JSON.parse(evidenceStr);
      const references = parsed.references || [];
      if (references.length === 0) {
        return <p className="text-[10px] text-muted-foreground">No concrete profile references generated.</p>;
      }
      return (
        <div className="space-y-2">
          {references.map((ref: any, idx: number) => {
            const Icon = ref.sourceType === "Repository" ? Code : ref.sourceType === "WorkExperience" ? Briefcase : CheckCircle;
            return (
              <div key={idx} className="p-2.5 bg-background border border-border/40 rounded-xl flex gap-2.5 items-start text-left">
                <div className="p-1.5 rounded-lg bg-surface-secondary text-foreground shrink-0 mt-0.5">
                  <Icon size={12} />
                </div>
                <div className="space-y-0.5 min-w-0 flex-1">
                  <span className="text-[7px] font-black uppercase tracking-wider text-muted">
                    {ref.sourceType}
                  </span>
                  <h4 className="text-[11px] font-bold text-foreground truncate">
                    {ref.displayName}
                  </h4>
                  <p className="text-[10px] text-muted-foreground leading-normal font-light">
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
        <div className="p-2.5 bg-background border border-border/40 rounded-xl">
          <p className="text-[10px] text-muted-foreground font-light leading-normal">{evidenceStr}</p>
        </div>
      );
    }
  };

  // 1. Initial Assessment Check
  const neverAssessed = !latestAssessment || (latestAssessment.status === "Failed" && treeData.length === 0);
  if (neverAssessed) {
    return <CandidateAssessmentEmptyState />;
  }

  // 2. Loading state while tree is pulling
  if (loading && treeData.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center p-16 space-y-4 border border-border/40 bg-surface">
        <Spinner size="lg" color="accent" />
        <p className="text-sm text-muted-foreground font-light">Loading candidate skill tree...</p>
      </Card>
    );
  }

  // 3. Extract Strong Domains & Gaps from parsed CandidateProfile L2-014
  const domainProfiles = parsedProfile?.domainProfiles || [];
  const profileSkills = parsedProfile?.skills || [];
  const unverifiedSkills = profileSkills.filter(
    (s: any) => !s.evidenceSources || s.evidenceSources.length === 0 || s.confidence < 0.4
  );

  // 4. Extract Roadmap Recommendations from parsed ImprovementPlan L2-015
  const roadmapRecommendations = parsedImprovementPlan?.recommendations || [];

  return (
    <div className="space-y-6 font-sans">
      
      {/* TOP SECTION: Search, Filters & Verified Domains */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 items-stretch text-left">
        {/* Search & Categories (4/10) */}
        <Card className="lg:col-span-4 p-5 border border-border/40 bg-surface rounded-2xl shadow-xs flex flex-col gap-4">
          {/* Search */}
          <div className="space-y-1.5 w-full">
            <span className="text-[10px] font-black uppercase tracking-wider text-foreground">Search</span>
            <div className="relative w-full">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <Input
                placeholder="Filter by skill..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 h-8"
              />
            </div>
          </div>
          {/* Categories */}
          <div className="space-y-2 w-full">
            <span className="text-[10px] font-black uppercase tracking-wider text-foreground">Filter Categories</span>
            <div className="flex flex-wrap gap-2 mt-1">
              {["Domain", "Subdomain", "Technology", "Framework", "Library", "Tool", "Methodology"].map(cat => {
                const isSelected = selectedCategories.includes(cat);
                return (
                  <Chip
                    key={cat}
                    variant={isSelected ? "primary" : "soft"}
                    color={isSelected ? "accent" : "default"}
                    className={`cursor-pointer hover:opacity-80 active:scale-95 transition-all text-[9px] font-extrabold uppercase h-5.5 px-2 select-none ${isSelected ? "border-none" : "border-border/60"}`}
                    onClick={() => {
                      setSelectedCategories(prev =>
                        prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
                      );
                    }}
                  >
                    {cat}
                  </Chip>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Verified Domains (6/10) */}
        <Card className="lg:col-span-6 p-5 border border-border/40 bg-surface rounded-2xl shadow-xs flex flex-col justify-between">
          <div className="space-y-3.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <TrendingUp size={12} className="text-accent" />
              <span>Verified Domains ({domainProfiles.length})</span>
            </span>
            <div className="w-full h-px bg-border/20" />
            {domainProfiles.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">No verified domains analyzed.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {domainProfiles.map((dom: any, idx: number) => (
                  <div 
                    key={idx} 
                    className="p-3 bg-surface-secondary/35 border border-border/20 rounded-xl flex items-center justify-between gap-3 shadow-xs hover:border-accent/40 transition-all duration-200"
                  >
                    <div className="space-y-1 min-w-0">
                      <h4 className="font-bold text-foreground text-xs truncate" title={dom.domainName}>
                        {dom.domainName}
                      </h4>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-muted/20 text-muted-foreground tracking-wider">
                          {dom.seniority}
                        </span>
                      </div>
                    </div>
                    
                    <div className="relative size-9 shrink-0 flex items-center justify-center bg-surface border border-border/40 rounded-full font-mono text-xs font-black text-accent shadow-2xs">
                      {Math.round(dom.score)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* LOWER SECTION: Hierarchy Map vs Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start text-left">
        {/* LEFT COLUMN: Skill Tree Structure */}
        <Card className="lg:col-span-7 p-5 min-h-[600px] max-h-[800px] overflow-y-auto border border-border/40 bg-surface rounded-2xl shadow-xs scrollbar-thin scrollbar-thumb-border">
          <div className="flex justify-between items-center pb-3 border-b border-border/20 mb-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-foreground">Hierarchy Map</span>
            <span className="text-[9px] text-muted-foreground font-bold">Root nodes expanded by default</span>
          </div>

          {filteredTree.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 text-center text-muted min-h-[350px]">
              <Search size={22} className="mb-2" />
              <p className="text-xs font-light text-muted-foreground">No matching skills found.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredTree.map(node => renderTreeNode(node, 0))}
            </div>
          )}
        </Card>

        {/* RIGHT COLUMN: Node Detail Drawer & Learning Roadmap */}
        <div className="lg:col-span-5 space-y-6">
          {/* Selection Detail Card */}
          <Card className="p-5 min-h-[380px] border border-border/40 bg-surface rounded-2xl shadow-xs">
            {selectedNode ? (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className={`px-1.5 py-0.5 text-[8px] rounded-full uppercase tracking-wider font-extrabold ${getCategoryColor(selectedNode.category)}`}>
                      {selectedNode.category}
                    </span>
                    <Chip
                      variant="soft"
                      size="sm"
                      color={getProficiencyColor(selectedNode.proficiencyLevel)}
                      className="text-[8px] uppercase font-extrabold h-4.5 px-1.5"
                    >
                      {selectedNode.proficiencyLevel}
                    </Chip>
                  </div>
                  <h2 className="text-base font-extrabold text-foreground tracking-tight">
                    {selectedNode.displayName}
                  </h2>
                </div>

                <div className="grid grid-cols-2 gap-3 bg-surface-secondary/35 border border-border/20 p-3 rounded-xl select-none">
                  <div className="space-y-0.5">
                    <span className="text-[8px] font-black uppercase tracking-wider text-muted flex items-center gap-1">
                      <Clock size={10} /> Experience
                    </span>
                    <p className="text-xs font-bold text-foreground">
                      {selectedNode.estimatedExperienceMonths > 0
                        ? `${selectedNode.estimatedExperienceMonths} mo`
                        : "N/A"}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[8px] font-black uppercase tracking-wider text-muted flex items-center gap-1">
                      <Sparkles size={10} /> Confidence
                    </span>
                    <p className="text-xs font-bold text-foreground">
                      {Math.round(selectedNode.confidenceScore * 100)}%
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5 text-left">
                  <span className="text-[9px] font-black uppercase tracking-wider text-foreground">Proficiency Indicator</span>
                  <div className="space-y-1">
                    <ProgressBar
                      aria-label="Skill Proficiency Indicator"
                      value={
                        selectedNode.proficiencyLevel.toLowerCase() === "expert" ? 95 :
                          selectedNode.proficiencyLevel.toLowerCase() === "practitioner" ? 70 :
                            selectedNode.proficiencyLevel.toLowerCase() === "working" ? 45 : 20
                      }
                      color={getProficiencyColor(selectedNode.proficiencyLevel)}
                      className="w-full"
                      size="sm"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[9px] font-black uppercase tracking-wider text-foreground flex items-center gap-1">
                    <Code size={11} className="text-accent" />
                    <span>Supporting Evidence</span>
                  </span>
                  <div className="max-h-[180px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-border">
                    {renderSupportingEvidence(selectedNode.supportingEvidence)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-16 text-center text-muted min-h-[300px]">
                <GitFork size={24} className="mb-2 text-muted/50" />
                <p className="text-xs font-light text-muted-foreground">Select a skill node to view detailed verifications.</p>
              </div>
            )}
          </Card>

          {/* Learning Roadmap Card */}
          <Card className="p-4 border border-border/40 bg-surface rounded-2xl shadow-xs text-left">
            <div className="space-y-2.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <Award size={12} className="text-accent" />
                <span>Skill Progression Roadmap</span>
              </span>
              <p className="text-[9px] text-muted-foreground leading-relaxed -mt-1 font-light">
                Target areas and prioritized actions recommended to boost score potential.
              </p>
              <div className="w-full h-px bg-border/20" />
              {roadmapRecommendations.length === 0 ? (
                <p className="text-[10px] text-muted-foreground">No roadmap recommendations generated.</p>
              ) : (
                <div className="max-h-[220px] overflow-y-auto pr-1 flex flex-col gap-2.5 scrollbar-thin scrollbar-thumb-border">
                  {roadmapRecommendations.map((rec: any, idx: number) => (
                    <div key={idx} className="relative pl-6 flex flex-col gap-0.5 leading-relaxed text-xs">
                      {/* Timeline Dot */}
                      <div className="absolute left-0.5 top-1 size-2 rounded-full bg-accent shrink-0" />
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-extrabold text-foreground/95 text-[11px]">
                          {rec.dimension === "UnverifiedSkills" ? "Verify Skills" : rec.dimension}
                        </span>
                        <Chip
                          size="sm"
                          variant="soft"
                          color={rec.priority === "High" ? "danger" : "warning"}
                          className="h-4 text-[7px] font-black uppercase border-none px-1"
                        >
                          {rec.priority}
                        </Chip>
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-normal font-light">
                        <strong>Observed:</strong> {rec.observation}
                      </p>
                      <p className="text-[10px] text-foreground/80 leading-normal font-light mt-0.5 bg-surface-secondary/30 p-2 rounded-lg border border-border/20">
                        <strong>Action:</strong> {rec.action}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* Unverified Target Skills Card */}
          <Card className="p-4 border border-border/40 bg-surface rounded-2xl shadow-xs text-left">
            <div className="space-y-2.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <AlertCircle size={12} className="text-warning" />
                <span>Unverified Target Skills ({unverifiedSkills.length})</span>
              </span>
              <p className="text-[9px] text-muted-foreground leading-relaxed -mt-1 font-light">
                Declared in CV but currently lacking verifiable codebase proof.
              </p>
              <div className="w-full h-px bg-border/20" />
              {unverifiedSkills.length === 0 ? (
                <p className="text-[10px] text-muted-foreground">All declared skills successfully verified!</p>
              ) : (
                <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto pr-1 scrollbar-thin">
                  {unverifiedSkills.map((skill: any, idx: number) => (
                    <Chip
                      key={idx}
                      size="sm"
                      variant="soft"
                      color="warning"
                      className="h-5 text-[9px] font-extrabold px-1.5 bg-warning/10 text-warning border-none uppercase"
                    >
                      {skill.skillName}
                    </Chip>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
        
      </div>
    </div>
  );
}
