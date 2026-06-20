"use client";

import React, { useState, useEffect } from "react";
import {
  Button,
  Input,
  Chip,
  Spinner,
  Typography,
  AlertDialog,
  toast
} from "@heroui/react";
import { Card } from "@/components/ui/card";
import { Trash2, Edit2, Shield, Settings, AlertTriangle } from "lucide-react";
import { hiringRequirementService, type CapabilityCatalogItem } from "@/services/hiring-requirement.service";

interface TaxonomyManagerProps {
  workspaceId: string;
  onBack: () => void;
}

export default function TaxonomyManager({ workspaceId, onBack }: TaxonomyManagerProps) {
  const [capabilities, setCapabilities] = useState<CapabilityCatalogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [isEditing, setIsEditing] = useState(false);
  const [editingItem, setEditingItem] = useState<CapabilityCatalogItem | null>(null);
  
  const [displayName, setDisplayName] = useState("");
  const [category, setCategory] = useState("Internal Technologies");
  const [description, setDescription] = useState("");
  const [skillsText, setSkillsText] = useState("");
  const [evidenceText, setEvidenceText] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirmCapId, setDeleteConfirmCapId] = useState<string | null>(null);


  const loadCapabilities = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const items = await hiringRequirementService.getCatalog(workspaceId);
      setCapabilities(items);
    } catch (err: any) {
      setError(err.message || "Failed to load capability taxonomy catalog.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    Promise.resolve().then(() => {
      loadCapabilities();
    });
  }, [workspaceId]);

  const handleEdit = (item: CapabilityCatalogItem) => {
    setEditingItem(item);
    setDisplayName(item.displayName);
    setCategory(item.category);
    setDescription(item.description);
    setSkillsText(item.skills.join(", "));
    setEvidenceText(item.expectedEvidence.join(", "));
    setIsEditing(true);
    setFormError(null);
    // Scroll to form
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingItem(null);
    setDisplayName("");
    setCategory("Internal Technologies");
    setDescription("");
    setSkillsText("");
    setEvidenceText("");
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!displayName.trim()) {
      setFormError("Display name is required.");
      return;
    }
    if (!description.trim()) {
      setFormError("Description is required.");
      return;
    }

    const skills = skillsText
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const expectedEvidence = evidenceText
      .split(",")
      .map((e) => e.trim())
      .filter((e) => e.length > 0);

    setIsSaving(true);
    try {
      if (editingItem) {
        // Update custom capability
        const updated = await hiringRequirementService.updateCustomCapability(editingItem.capabilityId, {
          displayName: displayName.trim(),
          category: category.trim(),
          description: description.trim(),
          skills,
          expectedEvidence
        });
        setCapabilities(prev => prev.map(c => c.capabilityId === editingItem.capabilityId ? updated : c));
      } else {
        // Create custom capability
        const created = await hiringRequirementService.createCustomCapability({
          workspaceId,
          displayName: displayName.trim(),
          category: category.trim(),
          description: description.trim(),
          skills,
          expectedEvidence
        });
        setCapabilities(prev => [...prev, created]);
      }
      handleCancel();
    } catch (err: any) {
      setFormError(err.message || "Failed to save custom capability.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (capabilityId: string) => {
    setDeleteConfirmCapId(capabilityId);
  };

  const executeDelete = async (capabilityId: string) => {
    try {
      await hiringRequirementService.deleteCustomCapability(capabilityId);
      setCapabilities(prev => prev.filter(c => c.capabilityId !== capabilityId));
      toast.success("Custom capability archived/deleted successfully.");
    } catch (err: any) {
      toast.danger(err.message || "Failed to delete capability item.");
    }
  };

  return (
    <div className="space-y-6 font-outfit text-foreground">
      <div className="flex items-center justify-between">
        <div>
          <Typography type="h3" className="font-bold text-foreground">Capability Taxonomy Manager</Typography>
          <Typography type="body-xs" className="text-muted">Configure workspace-specific custom capabilities and review standard global templates.</Typography>
        </div>
        <Button
          onClick={onBack}
          className="bg-surface text-foreground hover:bg-surface-secondary border border-border text-xs font-bold px-4 py-2 rounded-xl cursor-pointer"
        >
          Back to requirements
        </Button>
      </div>

      {/* Editor Form Card */}
      {(isEditing || !isEditing) && (
        <Card className="border border-border/80">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Typography type="h4" className="font-bold text-foreground flex items-center gap-1.5 border-b border-border/40 pb-2">
              <Settings size={18} className="text-accent" />
              {isEditing ? "Modify Custom Capability" : "Create Custom Capability"}
            </Typography>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground/80 block">Capability Name</label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Core Banking System Integration"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground/80 block">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-field-background text-foreground text-xs font-semibold focus:border-focus focus:ring-1 focus:ring-focus/20 outline-hidden cursor-pointer"
                >
                  <option value="Domain Expertise">Domain Expertise</option>
                  <option value="Internal Technologies">Internal Technologies</option>
                  <option value="Backend Engineering">Backend Engineering</option>
                  <option value="Frontend Engineering">Frontend Engineering</option>
                  <option value="DevOps & Infrastructure">DevOps & Infrastructure</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground/80 block">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what skills, design patterns, or engineering problems this capability entails..."
                className="w-full text-xs font-medium bg-field-background text-foreground border border-border rounded-xl p-3 h-20 focus:border-focus focus:ring-1 focus:ring-focus/20 outline-hidden"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground/80 block">
                  Keywords / Skills <span className="text-[10px] text-muted">(Comma-separated)</span>
                </label>
                <Input
                  value={skillsText}
                  onChange={(e) => setSkillsText(e.target.value)}
                  placeholder="e.g. COBOL, MQSeries, AS400"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground/80 block">
                  AST / Git Blame signals <span className="text-[10px] text-muted">(Comma-separated)</span>
                </label>
                <Input
                  value={evidenceText}
                  onChange={(e) => setEvidenceText(e.target.value)}
                  placeholder="e.g. IBM.Integration, mq-configs, bank-transactions"
                  className="text-xs"
                />
              </div>
            </div>

            {formError && (
              <div className="text-xs text-danger font-semibold bg-danger/10 border border-danger/20 p-2.5 rounded-lg">
                {formError}
              </div>
            )}

            <div className="flex justify-end gap-2 border-t border-border/40 pt-4">
              {isEditing && (
                <Button
                  type="button"
                  onClick={handleCancel}
                  className="bg-transparent border border-border text-foreground hover:bg-surface-secondary text-xs font-semibold py-2 px-4 rounded-xl cursor-pointer"
                >
                  Cancel
                </Button>
              )}
              <Button
                type="submit"
                isPending={isSaving}
                className="bg-accent text-accent-foreground text-xs font-bold py-2 px-6 rounded-xl cursor-pointer hover:opacity-90"
              >
                {isEditing ? "Save Changes" : "Create Capability"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Capabilities list table */}
      <Card className="p-0 overflow-hidden border border-border">
        {isLoading ? (
          <div className="p-12 text-center">
            <Spinner size="md" color="warning" />
            <span className="text-xs font-bold text-muted block mt-2">Loading workspace taxonomy catalog...</span>
          </div>
        ) : error ? (
          <div className="p-12 text-center text-danger font-semibold">
            {error}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-secondary/50 font-bold text-muted uppercase tracking-wider text-[10px]">
                  <th className="p-4 w-1/4">Name</th>
                  <th className="p-4">Category</th>
                  <th className="p-4 w-1/3">Description</th>
                  <th className="p-4">Type</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {capabilities.map((cap) => {
                  const isCustom = cap.capabilityId.startsWith("custom.");
                  return (
                    <tr key={cap.capabilityId} className="border-b border-border/60 hover:bg-surface-secondary/35 transition-colors">
                      <td className="p-4 font-bold text-foreground">
                        {cap.displayName}
                        <span className="block font-mono text-[9px] text-muted font-normal mt-0.5">{cap.capabilityId}</span>
                      </td>
                      <td className="p-4 font-semibold text-foreground/80">{cap.category}</td>
                      <td className="p-4 text-muted leading-relaxed font-normal">{cap.description}</td>
                      <td className="p-4">
                        <Chip
                          size="sm"
                          variant="soft"
                          className={
                            isCustom
                              ? "bg-accent/15 border border-accent/30 text-accent font-bold"
                              : "bg-default/20 text-foreground font-semibold"
                          }
                        >
                          {isCustom ? "Custom Workspace" : "Global Framework"}
                        </Chip>
                      </td>
                      <td className="p-4 text-right flex justify-end gap-2">
                        {isCustom ? (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleEdit(cap)}
                              className="bg-default text-default-foreground hover:bg-surface-tertiary border border-border p-1.5 rounded-lg cursor-pointer"
                            >
                              <Edit2 size={12} className="text-foreground" />
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleDelete(cap.capabilityId)}
                              className="bg-danger/10 text-danger border border-danger/20 p-1.5 rounded-lg cursor-pointer"
                            >
                              <Trash2 size={12} />
                            </Button>
                          </>
                        ) : (
                          <div className="text-[10px] text-muted font-bold flex items-center gap-1 select-none py-1.5 px-3">
                            <Shield size={10} /> Locked
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {deleteConfirmCapId && (
        <AlertDialog.Backdrop
          isOpen={!!deleteConfirmCapId}
          onOpenChange={(open) => {
            if (!open) setDeleteConfirmCapId(null);
          }}
        >
          <AlertDialog.Container>
            <AlertDialog.Dialog className="sm:max-w-[400px]">
              {(renderProps) => (
                <>
                  <AlertDialog.CloseTrigger />
                  <AlertDialog.Header>
                    <AlertDialog.Icon status="danger">
                      <AlertTriangle className="size-5 text-danger" />
                    </AlertDialog.Icon>
                    <AlertDialog.Heading>
                      Delete Custom Capability
                    </AlertDialog.Heading>
                  </AlertDialog.Header>
                  <AlertDialog.Body className="text-sm font-sans font-light leading-relaxed">
                    <p>
                      Are you sure you want to archive/delete this custom capability?
                    </p>
                    <p className="mt-2 text-xs text-muted">
                      Unpublishing custom capabilities will not break existing requirement records but they will no longer be selectable for new intakes.
                    </p>
                  </AlertDialog.Body>
                  <AlertDialog.Footer>
                    <Button
                      variant="tertiary"
                      onPress={() => {
                        setDeleteConfirmCapId(null);
                        renderProps.close();
                      }}
                      className="rounded-xl"
                    >
                      Cancel
                    </Button>
                    <Button
                      onPress={() => {
                        executeDelete(deleteConfirmCapId);
                        setDeleteConfirmCapId(null);
                        renderProps.close();
                      }}
                      className="bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20 rounded-xl font-semibold animate-none"
                    >
                      Delete
                    </Button>
                  </AlertDialog.Footer>
                </>
              )}
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      )}
    </div>
  );
}
