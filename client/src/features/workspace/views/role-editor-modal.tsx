"use client";

import React, { useState } from "react";
import { Button, Input, Checkbox, Spinner } from "@heroui/react";
import { useWorkspaceStore } from "../store/use-workspace-store";
import SelectDropdown from "@/components/ui/select-dropdown";
import DialogModal from "@/components/ui/dialog-modal";
import type { PermissionDto } from "../types/roles.types";

interface RoleEditorModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  organizationSlug: string;
  roleId?: string | null;
  onClose: () => void;
}

export const RoleEditorModal: React.FC<RoleEditorModalProps> = ({
  isOpen,
  onOpenChange,
  organizationSlug,
  roleId,
  onClose,
}) => {
  const roles = useWorkspaceStore((s) => s.roles[organizationSlug]) || [];
  const permissions = useWorkspaceStore((s) => s.availablePermissions[organizationSlug]) || [];
  const createRole = useWorkspaceStore((s) => s.createRole);
  const updateRole = useWorkspaceStore((s) => s.updateRole);

  const [displayName, setDisplayName] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [parentRoleId, setParentRoleId] = useState<string>("none");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAutoSlug, setIsAutoSlug] = useState(true);

  const isEdit = !!roleId;
  const editingRole = isEdit && roleId ? roles.find((r) => r.id.toLowerCase() === roleId.toLowerCase()) : null;

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const [prevRoleId, setPrevRoleId] = useState(roleId);
  const [prevEditingRole, setPrevEditingRole] = useState(editingRole);

  // Sync state when props/roles transition
  if (isOpen !== prevIsOpen || roleId !== prevRoleId || editingRole !== prevEditingRole) {
    setPrevIsOpen(isOpen);
    setPrevRoleId(roleId);
    setPrevEditingRole(editingRole);

    if (isOpen) {
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
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/(^_+|_+$)/g, "");
  };

  // Handle display name change
  const handleDisplayNameChange = (val: string) => {
    setDisplayName(val);
    if (!isEdit && isAutoSlug) {
      setName(slugify(val));
    }
  };

  // Recursively get inherited permissions from selected parent role
  const getInheritedPermissions = (parentId: string): Set<string> => {
    const inherited = new Set<string>();
    let currentId = parentId === "none" ? null : parentId;
    const visited = new Set<string>();

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const activeId = currentId;
      const parent = roles.find((r) => r.id.toLowerCase() === activeId.toLowerCase());
      if (!parent) break;

      parent.permissions?.forEach((p) => inherited.add(p));
      currentId = parent.parentRoleId || null;
    }

    return inherited;
  };

  const inheritedPermissions = getInheritedPermissions(parentRoleId);

  // Filter roles that can be selected as parent
  // We must prevent selecting the editing role itself as its parent
  const parentRoleOptions = [
    { value: "none", label: "None (Global Scope)" },
    ...roles
      .filter((r) => !isEdit || !roleId || r.id.toLowerCase() !== roleId.toLowerCase())
      .map((r) => ({
        value: r.id,
        label: r.displayName,
      })),
  ];

  // Group available permissions by module
  const permissionsByModule = permissions.reduce((acc, perm) => {
    const moduleName = perm.module || "General";
    if (!acc[moduleName]) acc[moduleName] = [];
    acc[moduleName].push(perm);
    return acc;
  }, {} as Record<string, PermissionDto[]>);

  const handleTogglePermission = (permName: string) => {
    if (inheritedPermissions.has(permName)) return; // Locked because of parent inheritance

    setSelectedPermissions((prev) =>
      prev.includes(permName) ? prev.filter((p) => p !== permName) : [...prev, permName]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim() || !name.trim()) return;

    setIsSubmitting(true);
    const resolvedParentId = parentRoleId === "none" ? null : parentRoleId;

    // Filter out permissions that are inherited, so we only save the direct overrides
    const directPermissions = selectedPermissions.filter((p) => !inheritedPermissions.has(p));

    let success = false;
    if (isEdit && roleId) {
      success = await updateRole(organizationSlug, roleId, {
        name,
        displayName,
        description,
        parentRoleId: resolvedParentId,
        permissionNames: directPermissions,
      });
    } else {
      const newId = await createRole(organizationSlug, {
        name,
        displayName,
        description,
        parentRoleId: resolvedParentId,
        permissionNames: directPermissions,
      });
      success = !!newId;
    }

    setIsSubmitting(false);
    if (success) {
      onClose();
      onOpenChange(false);
    } else {
      alert("An error occurred while saving the role. Verify that the name is unique and has no circular inheritance.");
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
        className="flex-1 cursor-pointer font-bold rounded-xl py-2.5 text-xs"
        isDisabled={isSubmitting}
      >
        Cancel
      </Button>
      <Button
        type="submit"
        form="role-editor-form"
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
      title={isEdit ? "Edit Business Role" : "Create Business Role"}
      size="lg"
      footer={footer}
    >
      <form id="role-editor-form" onSubmit={handleSubmit} className="space-y-4 font-outfit select-none">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted block mb-1">Role Display Name</label>
            <Input
              required
              placeholder="e.g. Senior Talent Lead"
              value={displayName}
              onChange={(e) => handleDisplayNameChange(e.target.value)}
              className="w-full text-xs font-semibold rounded-xl border border-border"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-muted block mb-1">System Name (Slug)</label>
            <Input
              required
              disabled={isEdit}
              placeholder="e.g. senior_talent_lead"
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
          <label className="text-xs font-bold text-muted block mb-1">Description</label>
          <textarea
            placeholder="Describe the responsibilities of this business role..."
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
            tooltip="Inheritance is acyclic. The child role automatically acquires all permissions of the parent role."
          />
        </div>

        {/* Permissions Checklist Area */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-muted uppercase tracking-wider text-[10px]">
              Role Permissions
            </label>
            <span className="text-muted text-[10px] font-semibold">
              {selectedPermissions.length + inheritedPermissions.size} selected
            </span>
          </div>

          <div className="space-y-4 border border-border bg-surface-secondary/20 p-4 rounded-xl max-h-[240px] overflow-y-auto">
            {Object.entries(permissionsByModule).map(([moduleName, modulePerms]) => (
              <div key={moduleName} className="space-y-2 last:mb-0 mb-4 select-none">
                <div className="text-[10px] font-bold text-accent uppercase tracking-wider border-b border-border/60 pb-1">
                  {moduleName}
                </div>
                <div className="space-y-2">
                  {modulePerms.map((perm) => {
                    const isInherited = inheritedPermissions.has(perm.name);
                    const isChecked = isInherited || selectedPermissions.includes(perm.name);

                    return (
                      <div
                        key={perm.id}
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
                        <div className="space-y-0.5 min-w-0">
                          <div className="font-semibold flex items-center gap-1.5 flex-wrap">
                            <span>{perm.displayName}</span>
                            {isInherited && (
                              <span className="text-[9px] bg-accent/10 text-accent font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-0.5">
                                Inherited
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-muted truncate max-w-sm">
                            {perm.description || perm.name}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </form>
    </DialogModal>
  );
};

export default RoleEditorModal;
