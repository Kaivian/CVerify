import React, { useState, useEffect } from "react";
import { Input, Button, TextArea, Checkbox, Chip, Tooltip, Label, DateField, DatePicker, Calendar } from "@heroui/react";
import { Card } from "@/components/ui/card";
import { PlusCircle, Trash2, Edit2, X, Plus, Info, Sparkles, Link as LinkIcon, FolderCode } from "lucide-react";
import { type ProjectDraftItem } from "./types";
import { BaseUnsavedChangesBar } from "@/components/ui/unsaved-changes-bar";
import { ProjectVerificationLevel, ProjectVerificationStatus } from "@/types/profile.types";
import type { SourceCodeRepository } from "@/types/source-code-provider.types";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useRouter } from "next/navigation";
import { parseDate } from "@internationalized/date";

interface ProjectsFormProps {
  draft: ProjectDraftItem[];
  onChange: (updated: ProjectDraftItem[]) => void;
  onSave: () => Promise<void>;
  onReset: () => void;
  isSaving: boolean;
  isDirty: boolean;
  repositories: SourceCodeRepository[];
}

export const ProjectsForm: React.FC<ProjectsFormProps> = ({
  draft,
  onChange,
  onSave,
  onReset,
  isSaving,
  isDirty,
  repositories,
}) => {
  const router = useRouter();
  const { fetchConnections } = useAuth();

  const [editingItem, setEditingItem] = useState<ProjectDraftItem | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [newTech, setNewTech] = useState("");
  const [newContribution, setNewContribution] = useState("");
  const [step, setStep] = useState<"select_type" | "edit_form" | "select_repos_ai">("edit_form");
  const [selectedRepoIds, setSelectedRepoIds] = useState<string[]>([]);

  const getLinkedRepoIds = (excludeProjectId?: string) => {
    const ids = new Set<string>();
    draft.forEach((p) => {
      if (excludeProjectId && p.id === excludeProjectId) {
        return;
      }
      p.repositoryLinks.forEach((link) => {
        if (link.sourceCodeRepositoryId) {
          ids.add(link.sourceCodeRepositoryId);
        }
      });
    });
    return ids;
  };

  // Connection states
  const [hasLinkedAccount, setHasLinkedAccount] = useState<boolean | null>(null);
  const [isLoadingConnections, setIsLoadingConnections] = useState<boolean>(true);

  useEffect(() => {
    let active = true;
    const checkConnections = async () => {
      try {
        const response = await fetchConnections();
        if (active && response.success && response.data) {
          const hasLinked = response.data.some(
            (c) => (c.providerName === "github" || c.providerName === "gitlab") && c.connected
          );
          setHasLinkedAccount(hasLinked);
        } else if (active) {
          setHasLinkedAccount(false);
        }
      } catch (err) {
        console.error("Failed to load connections in ProjectsForm:", err);
        if (active) setHasLinkedAccount(false);
      } finally {
        if (active) setIsLoadingConnections(false);
      }
    };
    checkConnections();
    return () => {
      active = false;
    };
  }, [fetchConnections]);

  const isAiAnalyzed = editingItem?.verificationLevel === ProjectVerificationLevel.AiAnalyzed;

  const handleImportAiProjects = () => {
    if (selectedRepoIds.length === 0) return;

    const newProjects: ProjectDraftItem[] = [];

    selectedRepoIds.forEach((repoId, idx) => {
      const repo = repositories.find((r) => r.id === repoId);
      if (!repo) return;

      const uniqueTime = Date.now() + idx;
      newProjects.push({
        id: `temp-${uniqueTime}-${repo.id}`,
        name: repo.name,
        role: "",
        description: "AI Analysis Snapshot", // Non-empty string to pass [Required] backend model validation. Will be overwritten by backend with the actual AI summary.
        startDate: "",
        endDate: null,
        isCurrentlyWorking: false,
        verificationLevel: ProjectVerificationLevel.AiAnalyzed,
        verificationStatus: ProjectVerificationStatus.Unverified,
        verifiedAt: null,
        verificationMetadataJson: null,
        repositoryLinks: [
          {
            id: `temp-link-${uniqueTime}-${repo.id}`,
            sourceCodeRepositoryId: repo.id,
            name: repo.name,
            owner: repo.owner,
            htmlUrl: repo.htmlUrl,
          },
        ],
        technologies: [],
        contributions: [],
      });
    });

    onChange([...draft, ...newProjects]);
    setSelectedRepoIds([]);
    setStep("edit_form");
  };

  const handleEdit = (item: ProjectDraftItem) => {
    setEditingItem({ ...item });
    setStep("edit_form");
    setErrors({});
  };

  const handleAddNew = () => {
    setEditingItem(null);
    setStep("select_type");
    setErrors({});
  };

  const selectType = (level: ProjectVerificationLevel) => {
    const newItem: ProjectDraftItem = {
      id: `temp-${Date.now()}`,
      name: "",
      role: "",
      description: "",
      startDate: "",
      endDate: null,
      isCurrentlyWorking: false,
      verificationLevel: level,
      verificationStatus: ProjectVerificationStatus.Unverified,
      verifiedAt: null,
      verificationMetadataJson: null,
      repositoryLinks: [],
      technologies: [],
      contributions: [],
    };
    setEditingItem(newItem);
    setStep("edit_form");
  };

  const handleRemove = (id: string) => {
    const filtered = draft.filter((item) => item.id !== id);
    onChange(filtered);
    if (editingItem?.id === id) {
      setEditingItem(null);
    }
  };

  const validateItem = (item: ProjectDraftItem): boolean => {
    const newErrors: Record<string, string> = {};
    if (!item.name.trim()) newErrors.name = "Project name is required";
    if (!item.description.trim()) newErrors.description = "Description is required";

    if (item.startDate && item.endDate && !item.isCurrentlyWorking) {
      if (new Date(item.startDate) > new Date(item.endDate)) {
        newErrors.endDate = "Start date must not be after end date";
      }
    }

    if (item.verificationLevel === ProjectVerificationLevel.AiAnalyzed && item.repositoryLinks.length === 0) {
      newErrors.repositories = "Please select at least one repository for AI Analysis";
    }

    if (item.verificationLevel === ProjectVerificationLevel.RepositoryLinked && item.repositoryLinks.length === 0) {
      newErrors.repositories = "Please select at least one linked repository";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveItem = () => {
    if (!editingItem) return;
    if (!validateItem(editingItem)) return;

    const exists = draft.some((item) => item.id === editingItem.id);
    let updatedList;
    if (exists) {
      updatedList = draft.map((item) => (item.id === editingItem.id ? editingItem : item));
    } else {
      updatedList = [...draft, editingItem];
    }
    onChange(updatedList);
    setEditingItem(null);
  };

  const handleToggleRepoSelection = (repo: SourceCodeRepository) => {
    if (!editingItem) return;
    const isLinked = editingItem.repositoryLinks.some((l) => l.sourceCodeRepositoryId === repo.id);
    let updatedLinks: typeof editingItem.repositoryLinks;
    if (isLinked) {
      updatedLinks = [];
    } else {
      updatedLinks = [
        {
          id: `temp-link-${repo.id}`,
          sourceCodeRepositoryId: repo.id,
          name: repo.name,
          owner: repo.owner,
          htmlUrl: repo.htmlUrl,
        },
      ];
    }
    setEditingItem({
      ...editingItem,
      repositoryLinks: updatedLinks,
    });
  };

  const addTechnology = () => {
    if (!editingItem || !newTech.trim()) return;
    if (!editingItem.technologies.includes(newTech.trim())) {
      setEditingItem({
        ...editingItem,
        technologies: [...editingItem.technologies, newTech.trim()],
      });
    }
    setNewTech("");
  };

  const removeTechnology = (tech: string) => {
    if (!editingItem) return;
    setEditingItem({
      ...editingItem,
      technologies: editingItem.technologies.filter((t) => t !== tech),
    });
  };

  const addContribution = () => {
    if (!editingItem || !newContribution.trim()) return;
    if (!editingItem.contributions.includes(newContribution.trim())) {
      setEditingItem({
        ...editingItem,
        contributions: [...editingItem.contributions, newContribution.trim()],
      });
    }
    setNewContribution("");
  };

  const removeContribution = (index: number) => {
    if (!editingItem) return;
    setEditingItem({
      ...editingItem,
      contributions: editingItem.contributions.filter((_, i) => i !== index),
    });
  };

  const startDateValue = editingItem?.startDate ? (() => {
    try {
      return parseDate(editingItem.startDate.split("T")[0]);
    } catch {
      return null;
    }
  })() : null;

  const endDateValue = editingItem?.endDate ? (() => {
    try {
      return parseDate(editingItem.endDate.split("T")[0]);
    } catch {
      return null;
    }
  })() : null;

  return (
    <div className="flex flex-col h-full overflow-hidden relative text-left">
      <div className="flex-1 overflow-y-auto px-1.5 flex flex-col gap-4 pb-4">
        {step === "select_type" ? (
          // Option Selection Page
          <div className="flex flex-col gap-4 border border-border/45 p-6 rounded-xl bg-surface-secondary/5">
            <div className="flex justify-between items-center border-b border-border/20 pb-3">
              <span className="font-bold text-xs text-foreground">Select Project Verification Level</span>
              <Button
                isIconOnly
                size="sm"
                variant="secondary"
                className="rounded-xl border border-border/30 h-8 w-8"
                onPress={() => setStep("edit_form")}
                aria-label="Cancel"
              >
                <X className="size-4" />
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2 select-none">
              <Card
                rounded="xl"
                glow={false}
                className="p-5 border border-primary/20 bg-primary/5 hover:border-primary/45 transition-all cursor-pointer flex flex-col gap-3"
                onClick={() => {
                  setSelectedRepoIds([]);
                  setStep("select_repos_ai");
                  setEditingItem(null);
                }}
              >
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <Sparkles className="size-5" />
                  </div>
                  <span className="font-extrabold text-sm text-foreground">AI Analyzed</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Highest Trust. Synchronizes AI evaluation summaries, technologies, and contribution highlights from completed source code analysis.
                </p>
              </Card>

              <Card
                rounded="xl"
                glow={false}
                className="p-5 border border-success/20 bg-success/5 hover:border-success/45 transition-all cursor-pointer flex flex-col gap-3"
                onClick={() => selectType(ProjectVerificationLevel.RepositoryLinked)}
              >
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-success/10 text-success">
                    <LinkIcon className="size-5" />
                  </div>
                  <span className="font-extrabold text-sm text-foreground">Repo Linked</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Medium Trust. Connects manually described work to an existing code repository, ensuring verification mapping for recruiters.
                </p>
              </Card>

              <Card
                rounded="xl"
                glow={false}
                className="p-5 border border-border/40 bg-surface hover:border-foreground/20 transition-all cursor-pointer flex flex-col gap-3"
                onClick={() => selectType(ProjectVerificationLevel.Independent)}
              >
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-default/40 text-muted-foreground">
                    <FolderCode className="size-5" />
                  </div>
                  <span className="font-extrabold text-sm text-foreground">Independent</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Basic Trust. Self-declared project portfolio description. No code repository linkage or AI evidence audit logs.
                </p>
              </Card>
            </div>
          </div>
        ) : step === "select_repos_ai" ? (
          // AI Analyzed Repository Selection Screen (Zero-Form)
          <div className="flex flex-col gap-4 border border-border/45 p-6 rounded-xl bg-surface-secondary/5">
            <div className="flex justify-between items-center border-b border-border/20 pb-3 select-none">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                <span className="font-bold text-xs text-foreground">Import AI Analyzed Repositories</span>
              </div>
              <Button
                isIconOnly
                size="sm"
                variant="secondary"
                className="rounded-xl border border-border/30 h-8 w-8"
                onPress={() => {
                  setSelectedRepoIds([]);
                  setStep("select_type");
                }}
                aria-label="Back to select type"
              >
                <X className="size-4" />
              </Button>
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Select a repository with completed AI assessment. A verified portfolio entry with AI-generated summary, tech stack, and key contributions will be created for the selected repository.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 select-none">
              {repositories.filter(r => r.latestAnalysisStatus === "Completed").length === 0 ? (
                <div className="col-span-2 py-8 text-center border-2 border-dashed border-border/40 rounded-xl flex flex-col items-center justify-center gap-3">
                  <span className="text-muted-foreground text-xs">No analyzed repositories found. Go to Source Code Settings to run analysis.</span>
                  {isLoadingConnections ? (
                    <Button isDisabled size="sm" variant="secondary" className="rounded-xl border border-border/30 h-8 font-bold text-[10px] scale-90">
                      Checking connections...
                    </Button>
                  ) : hasLinkedAccount ? (
                    <Button size="sm" variant="secondary" className="rounded-xl border border-border/30 h-8 font-bold text-[10px] scale-90" onPress={() => router.push("/settings/source-code-providers")}>
                      Go to Source Code Settings
                    </Button>
                  ) : (
                    <Button size="sm" variant="secondary" className="rounded-xl border border-border/30 h-8 font-bold text-[10px] scale-90" onPress={() => router.push("/settings?tab=account")}>
                      Link GitHub / GitLab Account
                    </Button>
                  )}
                </div>
              ) : (() => {
                const linkedRepoIds = getLinkedRepoIds();
                return repositories
                  .filter(r => r.latestAnalysisStatus === "Completed")
                  .map((repo) => {
                    const isAlreadyLinked = linkedRepoIds.has(repo.id);
                    const isSelected = selectedRepoIds.includes(repo.id);
                    const handleToggle = () => {
                      if (isAlreadyLinked) return;
                      if (isSelected) {
                        setSelectedRepoIds(selectedRepoIds.filter(id => id !== repo.id));
                      } else {
                        setSelectedRepoIds([...selectedRepoIds, repo.id]);
                      }
                    };
                    return (
                      <Card
                        key={repo.id}
                        rounded="xl"
                        glow={false}
                        className={`p-3 border transition-all flex items-center justify-between gap-3 text-left ${isAlreadyLinked
                            ? "border-secondary/20 bg-secondary/5 opacity-70 cursor-not-allowed"
                            : isSelected
                              ? "border-accent bg-accent/5 cursor-pointer"
                              : "border-border/40 bg-surface cursor-pointer"
                          }`}
                        onClick={handleToggle}
                      >
                        <div className="flex flex-col min-w-0">
                          <span className="font-extrabold text-[11px] text-foreground truncate">{repo.name}</span>
                          <span className="text-[9px] text-muted-foreground truncate">{repo.owner}</span>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            {repo.primaryLanguage && (
                              <Chip size="sm" variant="soft" color="default" className="text-[8px] h-4 min-h-0 py-0 px-1 font-bold">
                                {repo.primaryLanguage}
                              </Chip>
                            )}
                            <Chip size="sm" variant="soft" color="accent" className="text-[8px] h-4 min-h-0 py-0 px-1 font-bold">
                              Trust: {repo.trustScore.toFixed(1)}
                            </Chip>
                            <Chip size="sm" variant="soft" color="success" className="text-[8px] h-4 min-h-0 py-0 px-1 font-extrabold uppercase">
                              Analyzed
                            </Chip>
                            {isAlreadyLinked && (
                              <Chip size="sm" variant="soft" color="default" className="text-[8px] h-4 min-h-0 py-0 px-1 font-bold">
                                Linked in CV
                              </Chip>
                            )}
                          </div>
                        </div>
                        <Checkbox
                          isSelected={isSelected}
                          isDisabled={isAlreadyLinked}
                          onChange={handleToggle}
                          aria-label={`Select ${repo.name}`}
                        />
                      </Card>
                    );
                  });
              })()}
            </div>

            <div className="flex gap-2 justify-end mt-4">
              <Button
                size="sm"
                variant="secondary"
                className="rounded-xl border border-border/30 h-9 px-4 font-bold text-xs"
                onPress={() => {
                  setSelectedRepoIds([]);
                  setStep("select_type");
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-accent text-accent-foreground font-bold rounded-xl border-none h-9 px-4 text-xs"
                isDisabled={selectedRepoIds.length === 0}
                onPress={handleImportAiProjects}
              >
                Import to CV
              </Button>
            </div>
          </div>
        ) : editingItem ? (
          // Inline Edit Mode
          <div className="flex flex-col gap-5 border border-border/40 p-5 rounded-xl bg-surface-secondary/5">
            <div className="flex justify-between items-center border-b border-border/20 pb-3 select-none">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-foreground">
                  {editingItem.id.startsWith("temp-") ? "Add Project" : "Edit Project"}
                </span>
                {editingItem.verificationLevel === ProjectVerificationLevel.AiAnalyzed && (
                  <Chip size="sm" variant="soft" color="accent" className="text-[9px] font-extrabold uppercase">
                    AI Analyzed
                  </Chip>
                )}
                {editingItem.verificationLevel === ProjectVerificationLevel.RepositoryLinked && (
                  <Chip size="sm" variant="soft" color="success" className="text-[9px] font-extrabold uppercase">
                    Repo Linked
                  </Chip>
                )}
                {editingItem.verificationLevel === ProjectVerificationLevel.Independent && (
                  <Chip size="sm" variant="soft" color="default" className="text-[9px] font-extrabold uppercase">
                    Self Declared
                  </Chip>
                )}
              </div>
              <Button
                isIconOnly
                size="sm"
                variant="secondary"
                className="rounded-xl border border-border/30 h-8 w-8"
                onPress={() => setEditingItem(null)}
                type="button"
                aria-label="Close edit mode"
              >
                <X className="size-4" />
              </Button>
            </div>

            {/* Repositories selection */}
            {editingItem.verificationLevel !== ProjectVerificationLevel.Independent && (() => {
              const filteredRepos = repositories.filter((repo) => {
                if (editingItem.verificationLevel === ProjectVerificationLevel.AiAnalyzed) {
                  return repo.latestAnalysisStatus === "Completed";
                }
                return repo.latestAnalysisStatus !== "Completed";
              });

              return (
                <div className="flex flex-col gap-2">
                  <label className="font-bold text-xs text-foreground">Select Repositories *</label>
                  {errors.repositories && <span className="text-danger text-[10px] select-none">{errors.repositories}</span>}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1 select-none">
                    {filteredRepos.length === 0 ? (
                      <div className="col-span-2 py-6 text-center border-2 border-dashed border-border/40 rounded-xl flex flex-col items-center justify-center gap-3">
                        <span className="text-muted-foreground text-xs">
                          {editingItem.verificationLevel === ProjectVerificationLevel.AiAnalyzed
                            ? "No analyzed repositories available."
                            : "No non-analyzed repositories available."}
                        </span>
                        {isLoadingConnections ? (
                          <Button isDisabled size="sm" variant="secondary" className="rounded-xl border border-border/30 h-8 font-bold text-[10px] scale-90">
                            Checking connections...
                          </Button>
                        ) : hasLinkedAccount ? (
                          <Button size="sm" variant="secondary" className="rounded-xl border border-border/30 h-8 font-bold text-[10px] scale-90" onPress={() => router.push("/settings/source-code-providers")}>
                            Go to Source Code Settings
                          </Button>
                        ) : (
                          <Button size="sm" variant="secondary" className="rounded-xl border border-border/30 h-8 font-bold text-[10px] scale-90" onPress={() => router.push("/settings?tab=account")}>
                            Link GitHub / GitLab Account
                          </Button>
                        )}
                      </div>
                    ) : (() => {
                      const linkedRepoIds = getLinkedRepoIds(editingItem.id);
                      return filteredRepos.map((repo) => {
                        const isAlreadyLinked = linkedRepoIds.has(repo.id);
                        const isLinked = editingItem.repositoryLinks.some((l) => l.sourceCodeRepositoryId === repo.id);
                        const isAnalyzed = repo.latestAnalysisStatus === "Completed";
                        return (
                          <Card
                            key={repo.id}
                            rounded="xl"
                            glow={false}
                            className={`p-3 border transition-all flex items-center justify-between gap-3 text-left ${isAlreadyLinked
                                ? "border-secondary/20 bg-secondary/5 opacity-70 cursor-not-allowed"
                                : isLinked
                                  ? "border-accent bg-accent/5 cursor-pointer"
                                  : "border-border/40 bg-surface cursor-pointer"
                              } ${isAiAnalyzed ? "cursor-not-allowed opacity-80" : ""}`}
                            onClick={() => {
                              if (isAlreadyLinked) return;
                              if (!isAiAnalyzed) handleToggleRepoSelection(repo);
                            }}
                          >
                            <div className="flex flex-col min-w-0">
                              <span className="font-extrabold text-[11px] text-foreground truncate">{repo.name}</span>
                              <span className="text-[9px] text-muted-foreground truncate">{repo.owner}</span>
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                {repo.primaryLanguage && (
                                  <Chip size="sm" variant="soft" color="default" className="text-[8px] h-4 min-h-0 py-0 px-1 font-bold">
                                    {repo.primaryLanguage}
                                  </Chip>
                                )}
                                {isAnalyzed ? (
                                  <>
                                    <Chip size="sm" variant="soft" color="accent" className="text-[8px] h-4 min-h-0 py-0 px-1 font-bold">
                                      Trust: {repo.trustScore.toFixed(1)}
                                    </Chip>
                                    <Chip size="sm" variant="soft" color="success" className="text-[8px] h-4 min-h-0 py-0 px-1 font-extrabold uppercase">
                                      Analyzed
                                    </Chip>
                                  </>
                                ) : (
                                  <Chip size="sm" variant="soft" color="warning" className="text-[8px] h-4 min-h-0 py-0 px-1 font-extrabold uppercase">
                                    {repo.latestAnalysisStatus === "Pending" ? "Analyzing" : "Not Analyzed"}
                                  </Chip>
                                )}
                                {isAlreadyLinked && (
                                  <Chip size="sm" variant="soft" color="default" className="text-[8px] h-4 min-h-0 py-0 px-1 font-bold">
                                    Linked in CV
                                  </Chip>
                                )}
                              </div>
                            </div>
                            <Checkbox
                              isSelected={isLinked}
                              isDisabled={isAiAnalyzed || isAlreadyLinked}
                              onChange={() => {
                                if (isAlreadyLinked) return;
                                if (!isAiAnalyzed) handleToggleRepoSelection(repo);
                              }}
                              aria-label={`Select ${repo.name}`}
                            />
                          </Card>
                        );
                      });
                    })()}
                  </div>
                </div>
              );
            })()}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-foreground">Project Name *</label>
                <Input
                  value={editingItem.name}
                  onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                  placeholder="e.g. CVerify Core Portal"
                  aria-label="Project name"
                  maxLength={100}
                  disabled={isAiAnalyzed}
                />
                <div className="flex justify-between items-center text-[10px] text-muted-foreground mt-0.5 select-none">
                  {errors.name ? <span className="text-danger">{errors.name}</span> : <span />}
                  <span>{(editingItem.name || "").length}/100 characters</span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-foreground">Role / Position</label>
                <Input
                  value={editingItem.role || ""}
                  onChange={(e) => setEditingItem({ ...editingItem, role: e.target.value })}
                  placeholder="e.g. Lead Developer"
                  aria-label="Role / Position"
                  maxLength={100}
                  disabled={isAiAnalyzed}
                />
                <div className="flex justify-end text-[10px] text-muted-foreground mt-0.5 select-none">
                  <span>{(editingItem.role || "").length}/100 characters</span>
                </div>
              </div>

              <DatePicker
                value={startDateValue}
                onChange={(val) => setEditingItem({ ...editingItem, startDate: val ? val.toString() : "" })}
                isDisabled={isAiAnalyzed}
                className="flex flex-col gap-1.5 w-full text-left"
              >
                <Label className="font-bold text-foreground text-xs">Start Date</Label>
                <DateField.Group fullWidth>
                  <DateField.Input>
                    {(segment) => <DateField.Segment segment={segment} />}
                  </DateField.Input>
                  <DateField.Suffix>
                    <DatePicker.Trigger>
                      <DatePicker.TriggerIndicator />
                    </DatePicker.Trigger>
                  </DateField.Suffix>
                </DateField.Group>
                <DatePicker.Popover>
                  <Calendar aria-label="Start Date">
                    <Calendar.Header>
                      <Calendar.YearPickerTrigger>
                        <Calendar.YearPickerTriggerHeading />
                        <Calendar.YearPickerTriggerIndicator />
                      </Calendar.YearPickerTrigger>
                      <Calendar.NavButton slot="previous" />
                      <Calendar.NavButton slot="next" />
                    </Calendar.Header>
                    <Calendar.Grid>
                      <Calendar.GridHeader>
                        {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
                      </Calendar.GridHeader>
                      <Calendar.GridBody>
                        {(date) => <Calendar.Cell date={date} />}
                      </Calendar.GridBody>
                    </Calendar.Grid>
                    <Calendar.YearPickerGrid>
                      <Calendar.YearPickerGridBody>
                        {({ year }) => <Calendar.YearPickerCell year={year} />}
                      </Calendar.YearPickerGridBody>
                    </Calendar.YearPickerGrid>
                  </Calendar>
                </DatePicker.Popover>
              </DatePicker>

              <DatePicker
                value={endDateValue}
                onChange={(val) => setEditingItem({ ...editingItem, endDate: val ? val.toString() : null })}
                isDisabled={isAiAnalyzed || editingItem.isCurrentlyWorking}
                className="flex flex-col gap-1.5 w-full text-left"
              >
                <Label className="font-bold text-foreground text-xs">End Date</Label>
                <DateField.Group fullWidth>
                  <DateField.Input>
                    {(segment) => <DateField.Segment segment={segment} />}
                  </DateField.Input>
                  <DateField.Suffix>
                    <DatePicker.Trigger>
                      <DatePicker.TriggerIndicator />
                    </DatePicker.Trigger>
                  </DateField.Suffix>
                </DateField.Group>
                <DatePicker.Popover>
                  <Calendar aria-label="End Date">
                    <Calendar.Header>
                      <Calendar.YearPickerTrigger>
                        <Calendar.YearPickerTriggerHeading />
                        <Calendar.YearPickerTriggerIndicator />
                      </Calendar.YearPickerTrigger>
                      <Calendar.NavButton slot="previous" />
                      <Calendar.NavButton slot="next" />
                    </Calendar.Header>
                    <Calendar.Grid>
                      <Calendar.GridHeader>
                        {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
                      </Calendar.GridHeader>
                      <Calendar.GridBody>
                        {(date) => <Calendar.Cell date={date} />}
                      </Calendar.GridBody>
                    </Calendar.Grid>
                    <Calendar.YearPickerGrid>
                      <Calendar.YearPickerGridBody>
                        {({ year }) => <Calendar.YearPickerCell year={year} />}
                      </Calendar.YearPickerGridBody>
                    </Calendar.YearPickerGrid>
                  </Calendar>
                </DatePicker.Popover>
              </DatePicker>

              <label className={`flex items-center gap-2 py-2 select-none md:col-span-2 ${isAiAnalyzed ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
                <Checkbox
                  isSelected={editingItem.isCurrentlyWorking}
                  isDisabled={isAiAnalyzed}
                  onChange={(isSelected: boolean) =>
                    !isAiAnalyzed && setEditingItem({
                      ...editingItem,
                      isCurrentlyWorking: isSelected,
                      endDate: isSelected ? null : editingItem.endDate,
                    })
                  }
                  aria-label="Currently working on this project"
                  className={isAiAnalyzed ? "cursor-not-allowed" : "cursor-pointer"}
                >
                  <Checkbox.Content>
                    <Checkbox.Control className="w-4 h-4 rounded border border-field-border flex items-center justify-center bg-field group-data-[selected=true]:bg-accent group-data-[selected=true]:border-accent transition-all shrink-0 focus-visible:ring-2 focus-visible:ring-focus group-data-[disabled=true]:opacity-50">
                      <Checkbox.Indicator className="text-accent-foreground flex items-center justify-center">
                        <svg className="w-2.5 h-2.5 fill-none stroke-current stroke-3" viewBox="0 0 24 24">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </Checkbox.Indicator>
                    </Checkbox.Control>
                  </Checkbox.Content>
                </Checkbox>
                <span className="text-xs font-semibold text-foreground">Currently working on this project</span>
              </label>
            </div>

            <div className="flex flex-col gap-1.5 text-xs">
              <label className="font-bold text-foreground">Description *</label>
              <TextArea
                value={editingItem.description}
                onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                placeholder="Give a description of the project..."
                rows={4}
                aria-label="Project description"
                maxLength={2000}
                disabled={isAiAnalyzed}
              />
              <div className="flex justify-between items-center text-[10px] text-muted-foreground mt-0.5 select-none">
                {errors.description ? <span className="text-danger">{errors.description}</span> : <span />}
                <span>{(editingItem.description || "").length}/2000 characters</span>
              </div>
            </div>

            {editingItem.verificationLevel === ProjectVerificationLevel.AiAnalyzed && (
              <Card rounded="xl" glow={false} className="p-4 border border-primary/20 bg-primary/5 select-none">
                <div className="flex gap-2.5 items-start">
                  <Sparkles className="size-4.5 text-primary shrink-0 mt-0.5" />
                  <span className="text-[10px] text-muted-foreground leading-normal font-semibold">
                    Note: Since this is an AI Analyzed Project, when you confirm and save the section, the CVerify backend will automatically pull the latest analysis report snapshot (technologies, contributions, role, description) if you leave them empty.
                  </span>
                </div>
              </Card>
            )}

            {/* Tech stack section */}
            <div className="flex flex-col gap-2 border-t border-border/20 pt-3">
              <label className="font-bold text-xs text-foreground">Technologies Used</label>
              {!isAiAnalyzed && (
                <div className="flex gap-2 items-start">
                  <div className="flex-1 flex flex-col gap-0.5">
                    <Input
                      value={newTech}
                      onChange={(e) => setNewTech(e.target.value)}
                      placeholder="Add technology (e.g. React.js)..."
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addTechnology();
                        }
                      }}
                      aria-label="Technology name"
                      maxLength={30}
                    />
                    <div className="flex justify-end text-[10px] text-muted-foreground mt-0.5 select-none">
                      <span>{(newTech || "").length}/30 characters</span>
                    </div>
                  </div>
                  <Button size="sm" variant="secondary" className="rounded-xl border border-border/30 h-10 min-w-10" onPress={addTechnology} type="button" aria-label="Add technology">
                    <Plus className="size-4" />
                  </Button>
                </div>
              )}
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {editingItem.technologies.map((tech) => (
                  <Chip
                    key={tech}
                    size="sm"
                    variant="soft"
                    color="default"
                    className="text-[9px] font-bold py-1 px-1.5 flex items-center gap-1"
                  >
                    <span className="flex items-center gap-1">
                      {tech}
                      {!isAiAnalyzed && (
                        <button type="button" onClick={() => removeTechnology(tech)} className="bg-transparent border-none text-muted-foreground cursor-pointer flex items-center" aria-label={`Remove ${tech}`}>
                          <X className="size-2.5" />
                        </button>
                      )}
                    </span>
                  </Chip>
                ))}
              </div>
            </div>

            {/* Contributions section */}
            <div className="flex flex-col gap-3 border-t border-border/20 pt-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1">
                  <span className="font-bold text-xs text-foreground">Key Contributions / Highlights</span>
                  <Tooltip delay={0}>
                    <Tooltip.Trigger>
                      <Info className="size-3.5 text-muted-foreground hover:text-foreground cursor-help" />
                    </Tooltip.Trigger>
                    <Tooltip.Content showArrow className="bg-surface border border-border rounded-xl p-2 text-xs max-w-xs text-foreground wrap-break-word">
                      Explain key tasks or improvements you built (e.g., 'Implemented real-time synchronization between frontend and database').
                    </Tooltip.Content>
                  </Tooltip>
                </div>
              </div>

              {!isAiAnalyzed && (
                <div className="flex gap-2 items-start">
                  <div className="flex-1 flex flex-col gap-0.5">
                    <Input
                      value={newContribution}
                      onChange={(e) => setNewContribution(e.target.value)}
                      placeholder="Add contribution..."
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addContribution();
                        }
                      }}
                      aria-label="Contribution highlight"
                      maxLength={300}
                    />
                    <div className="flex justify-end text-[10px] text-muted-foreground mt-0.5 select-none">
                      <span>{(newContribution || "").length}/300 characters</span>
                    </div>
                  </div>
                  <Button size="sm" variant="secondary" className="rounded-xl border border-border/30 h-10 min-w-10" onPress={addContribution} type="button" aria-label="Add contribution">
                    <Plus className="size-4" />
                  </Button>
                </div>
              )}

              <div className="flex flex-col gap-2 mt-1">
                {editingItem.contributions.map((cont, idx) => (
                  <div key={idx} className="flex items-start justify-between gap-3 p-2 border border-border/30 rounded-lg bg-surface text-xs">
                    <span className="leading-relaxed text-muted-foreground">{cont}</span>
                    {!isAiAnalyzed && (
                      <Button
                        isIconOnly
                        size="sm"
                        variant="secondary"
                        className="rounded-xl border border-border/30 h-6 w-6 text-danger"
                        onPress={() => removeContribution(idx)}
                        type="button"
                        aria-label="Remove contribution"
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <Button size="sm" className="bg-accent text-accent-foreground font-bold rounded-xl border-none mt-2 h-9" onPress={handleSaveItem}>
              Confirm
            </Button>
          </div>
        ) : (
          // List Mode
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center select-none">
              <span className="text-xs font-bold text-foreground">Portfolio Projects</span>
              <Button
                size="sm"
                variant="secondary"
                className="rounded-xl text-[10px] font-bold flex items-center gap-1 border border-border/30 h-8"
                onPress={handleAddNew}
                type="button"
              >
                <PlusCircle className="size-3.5" />
                Add Project
              </Button>
            </div>

            <div className="flex flex-col gap-3">
              {draft.length === 0 ? (
                <div className="py-10 text-center border-2 border-dashed border-border/40 rounded-xl select-none">
                  <span className="text-muted-foreground text-xs">No projects added yet. Click "Add Project" to add your first project.</span>
                </div>
              ) : (
                draft.map((item) => (
                  <Card key={item.id} rounded="xl" glow={false} className="p-4 border border-border/40 bg-surface text-left">
                    <div className="flex flex-row justify-between items-center gap-4 w-full">
                      <div className="flex flex-col gap-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground text-xs truncate">{item.name}</span>
                          {item.verificationLevel === ProjectVerificationLevel.AiAnalyzed && (
                            <Chip size="sm" variant="soft" color="accent" className="text-[8px] font-extrabold uppercase scale-90">
                              AI
                            </Chip>
                          )}
                          {item.verificationLevel === ProjectVerificationLevel.RepositoryLinked && (
                            <Chip size="sm" variant="soft" color="success" className="text-[8px] font-extrabold uppercase scale-90">
                              Linked
                            </Chip>
                          )}
                          {item.verificationLevel === ProjectVerificationLevel.Independent && (
                            <Chip size="sm" variant="soft" color="default" className="text-[8px] font-extrabold uppercase scale-90">
                              Self
                            </Chip>
                          )}
                        </div>
                        {item.role && <span className="text-[10px] text-muted-foreground font-semibold">{item.role}</span>}
                        {(item.startDate || item.endDate) && (
                          <span className="text-[9px] text-muted-foreground">
                            {item.startDate ? item.startDate : "N/A"} to {item.isCurrentlyWorking ? "Present" : (item.endDate ? item.endDate : "N/A")}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          isIconOnly
                          size="sm"
                          variant="secondary"
                          className="rounded-xl border border-border/30 h-8 w-8"
                          onPress={() => handleEdit(item)}
                          type="button"
                          aria-label={`Edit ${item.name}`}
                        >
                          <Edit2 className="size-3.5" />
                        </Button>
                        <Button
                          isIconOnly
                          size="sm"
                          variant="secondary"
                          className="rounded-xl border border-border/30 h-8 w-8 text-danger"
                          onPress={() => handleRemove(item.id)}
                          type="button"
                          aria-label={`Remove ${item.name}`}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {!editingItem && step === "edit_form" && (
        <BaseUnsavedChangesBar
          message="You have unsaved project portfolio changes."
          onReset={onReset}
          onSave={onSave}
          isDirty={isDirty}
          isSubmitting={isSaving}
        />
      )}
    </div>
  );
};
