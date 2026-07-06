"use client";

import React, { useState } from "react";
import { Button, Input, Checkbox, Spinner } from "@heroui/react";
import { adminService } from "@/services/admin.service";
import { SelectDropdown } from "@/components/ui/select-dropdown";
import { DialogModal } from "@/components/ui/dialog-modal";
import { getPermissionsByModule } from "@/features/auth/permissions/permission.metadata";
import type { RoleListItem } from "@/types/admin.types";

interface RoleEditorModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  roles: RoleListItem[];
  roleId?: string | null;
  onClose: () => void;
  onSaveSuccess: () => void;
}

export const RoleEditorModal: React.FC<RoleEditorModalProps> = ({
  isOpen,
  onOpenChange,
  roles,
  roleId,
  onClose,
  onSaveSuccess,
}) => {
  const [displayName, setDisplayName] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [parentRoleId, setParentRoleId] = useState<string>("none");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAutoSlug, setIsAutoSlug] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isEdit = !!roleId;
  const editingRole = isEdit && roleId ? roles.find((r) => r.id === roleId) : null;

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const [prevRoleId, setPrevRoleId] = useState(roleId);
  const [prevEditingRole, setPrevEditingRole] = useState(editingRole);

  const permissionModules = getPermissionsByModule();

  // Sync state when props/roles transition
  if (isOpen !== prevIsOpen || roleId !== prevRoleId || editingRole !== prevEditingRole) {
    setPrevIsOpen(isOpen);
    setPrevRoleId(roleId);
    setPrevEditingRole(editingRole);

    if (isOpen) {
      setErrorMsg(null);
      if (isEdit && editingRole) {
        setDisplayName(editingRole.displayName);
        setName(editingRole.name);
        setDescription(editingRole.description || "");
        setParentRoleId(editingRole.parentRoleId || "none");
        setSelectedPermissions(editingRole.permissions || []);
        setIsAutoSlug(false);
      } else {
        setDisplayName("");
        setName("");
        setDescription("");
        setParentRoleId("none");
        setSelectedPermissions([]);
        setIsAutoSlug(true);
      }
    }
  }

  // Slugify display name
  const slugify = (text: string) => {
    return text
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/(^_+|_+$)/g, "");
  };

  // Handle display name change
  const handleDisplayNameChange = (val: string) => {
    setDisplayName(val);
    if (!isEdit && isAutoSlug) {
      setName(slugify(val));
    }
  };

  // Get inherited permissions from selected parent role
  const getInheritedPermissions = (parentId: string): Set<string> => {
    const inherited = new Set<string>();
    if (!parentId || parentId === "none") return inherited;

    const parent = roles.find((r) => r.id === parentId);
    if (parent) {
      parent.permissions?.forEach((p) => inherited.add(p));
    }
    return inherited;
  };

  const inheritedPermissions = getInheritedPermissions(parentRoleId);

  // Filter roles that can be selected as parent (maximum depth of 1)
  // We exclude the role itself, and also roles that have a parent (to prevent depth 2)
  const parentRoleOptions = [
    { value: "none", label: "None (Global Scope)" },
    ...roles
      .filter(
        (r) =>
          (!isEdit || r.id !== roleId) && // Not itself
          !r.parentRoleId // Parent has no parent
      )
      .map((r) => ({
        value: r.id,
        label: r.displayName,
      })),
  ];

  const handleTogglePermission = (permName: string) => {
    if (inheritedPermissions.has(permName)) return; // Locked because of parent inheritance

    setSelectedPermissions((prev) => {
      // Special wildcard behavior toggle
      if (permName === "*:*:*" || permName === "*") {
        return prev.includes(permName) ? [] : [permName];
      }
      // If wildcard is active, regular toggles do nothing
      if (prev.includes("*:*:*") || prev.includes("*")) {
        return prev;
      }
      return prev.includes(permName) ? prev.filter((p) => p !== permName) : [...prev, permName];
    });
  };

  const handleSelectAllInModule = (moduleName: string, permNames: string[]) => {
    setSelectedPermissions((prev) => {
      const others = prev.filter((p) => !permNames.includes(p));
      const allSelected = permNames.every((p) => prev.includes(p));
      if (allSelected) {
        return others;
      } else {
        return [...others, ...permNames];
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!displayName.trim() || !name.trim()) return;

    if (name.length > 50) {
      setErrorMsg("Role slug cannot exceed 50 characters.");
      return;
    }
    if (displayName.length > 100) {
      setErrorMsg("Display name cannot exceed 100 characters.");
      return;
    }
    if (description.length > 250) {
      setErrorMsg("Description cannot exceed 250 characters.");
      return;
    }

    setIsSubmitting(true);
    const resolvedParentId = parentRoleId === "none" ? null : parentRoleId;

    // Filter out permissions that are inherited, so we only save the direct overrides
    const directPermissions = selectedPermissions.filter((p) => !inheritedPermissions.has(p));

    let success = false;
    const payload = {
      name,
      displayName,
      description: description || null,
      parentRoleId: resolvedParentId,
      permissions: directPermissions,
      version: editingRole?.version,
    };

    try {
      if (isEdit && roleId) {
        await adminService.updateRole(roleId, payload);
      } else {
        await adminService.createRole(payload);
      }
      success = true;
    } catch (err: unknown) {
      console.error("Failed to save admin role", err);
      const error = err as { code?: string; message?: string; response?: { data?: { message?: string } } };
      const serverMsg = error?.response?.data?.message || error?.message;
      if (error?.code === "409" || serverMsg?.includes("conflict") || serverMsg?.includes("concurrency")) {
        setErrorMsg("Concurrency Conflict: This role was modified by another administrator. Please refresh and try again.");
      } else {
        setErrorMsg(serverMsg || "An error occurred while saving the role.");
      }
    } finally {
      setIsSubmitting(false);
    }

    if (success) {
      onSaveSuccess();
      onClose();
      onOpenChange(false);
    }
  };

  const footer = (
    <div className="flex gap-3 w-full">
      <Button
        variant="secondary"
        onClick={() => {
          onClose();
          onOpenChange(false);
        }}
        className="flex-1 cursor-pointer font-bold rounded-xl py-2.5 text-xs border border-border"
        isDisabled={isSubmitting}
      >
        Cancel
      </Button>
      <Button
        type="submit"
        form="admin-role-editor-form"
        className="flex-1 cursor-pointer bg-foreground text-background font-bold rounded-xl py-2.5 text-xs flex items-center justify-center gap-2"
        isDisabled={isSubmitting || !displayName.trim() || !name.trim()}
      >
        {isSubmitting ? (
          <>
            <Spinner size="sm" color="current" />
            Saving...
          </>
        ) : isEdit ? (
          "Save Changes"
        ) : (
          "Create Role"
        )}
      </Button>
    </div>
  );

  return (
    <DialogModal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit Admin Role" : "Create Admin Role"}
      size="lg"
      footer={footer}
    >
      <form id="admin-role-editor-form" onSubmit={handleSubmit} className="space-y-4 font-outfit select-none">
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-danger/10 border border-danger/20 text-danger flex gap-2.5 text-xs font-semibold select-none leading-relaxed">
            <div>{errorMsg}</div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-bold text-muted">Role Display Name</label>
              <span className="text-[10px] text-muted font-bold">{displayName.length}/100</span>
            </div>
            <Input
              required
              maxLength={100}
              placeholder="e.g. Auditor Coordinator"
              value={displayName}
              onChange={(e) => handleDisplayNameChange(e.target.value)}
              className="w-full text-xs font-semibold rounded-xl border border-border"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-bold text-muted">System Name (Slug)</label>
              <span className="text-[10px] text-muted font-bold">{name.length}/50</span>
            </div>
            <Input
              required
              disabled={isEdit}
              maxLength={50}
              placeholder="e.g. AUDITOR_COORDINATOR"
              value={name}
              onChange={(e) => {
                setName(slugify(e.target.value));
                setIsAutoSlug(false);
              }}
              className="w-full text-xs font-semibold rounded-xl border border-border font-mono"
            />
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-bold text-muted">Description</label>
            <span className="text-[10px] text-muted font-bold">{description.length}/250</span>
          </div>
          <textarea
            maxLength={250}
            placeholder="Describe the responsibilities of this admin role..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-3 rounded-xl border border-border bg-surface text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-focus/20 min-h-[80px]"
          />
        </div>

        <div className="space-y-1">
          <SelectDropdown
            value={parentRoleId}
            onChange={setParentRoleId}
            options={parentRoleOptions}
            label="Parent Role (Inherits Permissions)"
            placeholder="Select parent role..."
            tooltip="Inheritance is acyclic and capped at depth 1. The child role automatically acquires all permissions of the parent role."
          />
        </div>

        {/* Permissions Checklist Area */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-muted uppercase tracking-wider text-[10px]">
              Role Permissions Matrix
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedPermissions(["*:*:*"])}
                className="text-[10px] font-bold text-muted hover:text-foreground cursor-pointer select-none"
              >
                Bypass to System Wildcard (*)
              </button>
              <span className="text-muted text-[10px] font-semibold">
                {selectedPermissions.length + inheritedPermissions.size} selected
              </span>
            </div>
          </div>

          <div className="space-y-4 border border-border bg-surface-secondary/20 p-4 rounded-xl max-h-[240px] overflow-y-auto">
            {Object.entries(permissionModules).map(([moduleName, modulePerms]) => {
              const permNames = modulePerms.map((p) => p.name);
              const allSelected = permNames.every(
                (p) => selectedPermissions.includes(p) || inheritedPermissions.has(p)
              );

              return (
                <div key={moduleName} className="space-y-2 last:mb-0 mb-4 select-none">
                  <div className="flex justify-between items-center border-b border-border/60 pb-1">
                    <span className="text-[10px] font-bold text-accent uppercase tracking-wider">
                      {moduleName} Module
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSelectAllInModule(moduleName, permNames)}
                      className="text-[9px] font-bold text-muted hover:text-foreground cursor-pointer"
                    >
                      {allSelected ? "Clear Module" : "Grant Module"}
                    </button>
                  </div>
                  <div className="space-y-2">
                    {modulePerms.map((perm) => {
                      const isInherited = inheritedPermissions.has(perm.name);
                      const isChecked =
                        isInherited ||
                        selectedPermissions.includes(perm.name) ||
                        selectedPermissions.includes("*:*:*") ||
                        selectedPermissions.includes("*");

                      return (
                        <div
                          key={perm.name}
                          onClick={() => handleTogglePermission(perm.name)}
                          className={`flex items-start gap-3 p-2 rounded-lg transition-colors cursor-pointer text-xs ${
                            isInherited
                              ? "bg-surface-secondary/40 text-muted opacity-80"
                              : "hover:bg-surface-secondary/80 text-foreground"
                          }`}
                        >
                          <Checkbox
                            isSelected={isChecked}
                            isDisabled={isInherited}
                            onChange={() => handleTogglePermission(perm.name)}
                            aria-label={`Toggle permission ${perm.displayName}`}
                          >
                            <Checkbox.Control className="mt-1 border-2 border-border data-[selected=true]:bg-accent data-[selected=true]:border-accent rounded size-4 before:rounded">
                              <Checkbox.Indicator className="text-accent-foreground size-3" />
                            </Checkbox.Control>
                          </Checkbox>
                          <div className="space-y-0.5 min-w-0 flex-1">
                            <div className="font-semibold flex items-center gap-1.5 flex-wrap">
                              <span>{perm.displayName}</span>
                              {isInherited && (
                                <span className="text-[9px] bg-accent/10 text-accent font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                                  Inherited
                                </span>
                              )}
                              {perm.dangerous && (
                                <span className="px-1.5 py-0.5 rounded bg-danger/10 text-danger border border-danger/20 text-[7px] font-extrabold tracking-wider uppercase">
                                  DANGEROUS
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-muted truncate max-w-sm">
                              {perm.description || perm.name}
                            </div>
                            <div className="font-mono text-[9px] text-muted/65 mt-0.5">
                              {perm.name}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </form>
    </DialogModal>
  );
};
