"use client";

import React, { useEffect, useState } from "react";
import { useWorkspaceStore } from "../store/use-workspace-store";
import { Checkbox, Spinner, Typography } from "@heroui/react";
import { Shield, Lock, Info, Edit3 } from "lucide-react";
import { RoleEditorModal } from "./role-editor-modal";
import type { PermissionDto, BusinessRoleDetailsDto } from "../types/roles.types";

interface PermissionGridProps {
  organizationSlug: string;
}

export const PermissionGrid: React.FC<PermissionGridProps> = ({ organizationSlug }) => {
  const fetchRoles = useWorkspaceStore((s) => s.fetchRoles);
  const fetchAvailablePermissions = useWorkspaceStore((s) => s.fetchAvailablePermissions);
  const updateRole = useWorkspaceStore((s) => s.updateRole);

  const roles = useWorkspaceStore((s) => s.roles[organizationSlug]) || [];
  const permissions = useWorkspaceStore((s) => s.availablePermissions[organizationSlug]) || [];
  const isLoadingRoles = useWorkspaceStore((s) => s.rolesLoading[organizationSlug]);
  const rolesError = useWorkspaceStore((s) => s.rolesErrors[organizationSlug]);

  const [loadingPerms, setLoadingPerms] = useState(true);
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

  const handleEditRole = (roleId: string) => {
    setSelectedRoleId(roleId);
    setIsModalOpen(true);
  };

  const [prevOrgSlug, setPrevOrgSlug] = useState(organizationSlug);
  if (organizationSlug !== prevOrgSlug) {
    setPrevOrgSlug(organizationSlug);
    setLoadingPerms(true);
  }

  useEffect(() => {
    if (organizationSlug) {
      Promise.all([
        fetchRoles(organizationSlug),
        fetchAvailablePermissions(organizationSlug),
      ]).finally(() => {
        setLoadingPerms(false);
      });
    }
  }, [organizationSlug, fetchRoles, fetchAvailablePermissions]);

  // Recursively resolve if a permission is inherited from any parent role
  const isPermissionInherited = (
    parentRoleId: string | null | undefined,
    permissionName: string
  ): { inherited: boolean; parentName: string | null } => {
    let currentId = parentRoleId;
    const visited = new Set<string>();

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const activeId = currentId;
      const parent = roles.find((r) => r.id.toLowerCase() === activeId.toLowerCase());
      if (!parent) break;

      if (parent.permissions?.includes(permissionName)) {
        return { inherited: true, parentName: parent.displayName };
      }
      currentId = parent.parentRoleId;
    }

    return { inherited: false, parentName: null };
  };

  const handleTogglePermission = async (role: BusinessRoleDetailsDto, permName: string) => {
    if (role.isSystem || updatingRoleId) return;

    setUpdatingRoleId(role.id);
    const hasPermission = role.permissions?.includes(permName) || false;
    const updatedPermissions = hasPermission
      ? role.permissions.filter((p) => p !== permName)
      : [...(role.permissions || []), permName];

    const success = await updateRole(organizationSlug, role.id, {
      name: role.name,
      displayName: role.displayName,
      description: role.description || "",
      parentRoleId: role.parentRoleId,
      permissionNames: updatedPermissions,
    });

    if (!success) {
      alert("Failed to update role permissions. Please try again.");
    }
    setUpdatingRoleId(null);
  };

  if (isLoadingRoles || loadingPerms) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-muted">
        <Spinner size="md" color="current" />
        <Typography type="body-xs" className="font-semibold">
          Loading permission matrix...
        </Typography>
      </div>
    );
  }

  if (rolesError) {
    return (
      <div className="p-8 text-center border border-danger/20 bg-danger/5 rounded-2xl text-danger">
        <Typography type="h4" className="font-bold mb-2">
          Failed to Load Matrix
        </Typography>
        <Typography type="body-xs">{rolesError}</Typography>
      </div>
    );
  }

  if (permissions.length === 0 || roles.length === 0) {
    return (
      <div className="p-8 text-center border border-border bg-surface rounded-2xl text-muted">
        <Typography type="body-xs">No roles or permissions available to display.</Typography>
      </div>
    );
  }

  // Group permissions by module
  const permissionsByModule = permissions.reduce((acc, perm) => {
    const moduleName = perm.module || "General";
    if (!acc[moduleName]) acc[moduleName] = [];
    acc[moduleName].push(perm);
    return acc;
  }, {} as Record<string, PermissionDto[]>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <Typography type="h4" className="font-bold text-foreground">
            Role Permission Matrix
          </Typography>
          <Typography type="body-xs" className="text-muted mt-1">
            An overview of permissions mapped across all business roles. Custom roles' direct permissions can be toggled in real-time.
          </Typography>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="bg-surface-secondary/40 border-b border-border select-none">
              <th className="p-4 font-bold text-foreground w-80 min-w-[320px]">
                Permission / Capability
              </th>
              {roles.map((role) => (
                <th key={role.id} className="p-4 font-bold text-foreground text-center min-w-[120px] vertical-align-middle">
                  <div className="flex flex-col items-center gap-1">
                    <span className="flex items-center gap-1.5 font-bold">
                      {role.isSystem && <Shield size={12} className="text-accent" />}
                      {role.displayName}
                      {!role.isSystem && (
                        <button
                          onClick={() => handleEditRole(role.id)}
                          className="p-1 rounded-md text-muted hover:text-foreground hover:bg-surface-secondary/80 transition-colors inline-flex items-center justify-center cursor-pointer ml-1"
                          title="Edit Role"
                        >
                          <Edit3 size={11} className="w-3 h-3" />
                        </button>
                      )}
                    </span>
                    <span className="text-[10px] text-muted font-normal uppercase tracking-wider">
                      {role.isSystem ? "System" : "Custom"}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(permissionsByModule).map(([moduleName, modulePerms]) => (
              <React.Fragment key={moduleName}>
                {/* Module Header Row */}
                <tr className="bg-surface-secondary/20 border-b border-border/80 font-bold select-none">
                  <td colSpan={roles.length + 1} className="px-4 py-2 text-accent font-bold uppercase tracking-wider text-[10px]">
                    {moduleName}
                  </td>
                </tr>

                {modulePerms.map((perm) => (
                  <tr
                    key={perm.id}
                    className="border-b border-border last:border-none hover:bg-surface-secondary/10"
                  >
                    <td className="p-4 space-y-1 pr-6">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{perm.displayName}</span>
                        <span 
                          title={perm.description || "No description provided."}
                          className="text-muted hover:text-foreground cursor-help p-0.5 inline-flex items-center rounded-full"
                        >
                          <Info size={12} />
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-muted">{perm.name}</div>
                    </td>

                    {roles.map((role) => {
                      const isDirect = role.permissions?.includes(perm.name) || false;
                      const { inherited, parentName } = isPermissionInherited(role.parentRoleId, perm.name);

                      return (
                        <td key={role.id} className="p-4 text-center vertical-align-middle">
                          <div className="flex justify-center items-center">
                            {inherited ? (
                              <div 
                                title={`Inherited from parent role: ${parentName}`}
                                className="flex items-center justify-center cursor-help"
                              >
                                <Checkbox
                                  isSelected={true}
                                  isDisabled={true}
                                  aria-label={`Inherited permission ${perm.displayName} for ${role.displayName}`}
                                >
                                  <Checkbox.Control className="border-2 border-border data-[selected=true]:bg-accent data-[selected=true]:border-accent rounded size-4 before:rounded">
                                    <Checkbox.Indicator className="text-accent-foreground size-3" />
                                  </Checkbox.Control>
                                </Checkbox>
                              </div>
                            ) : role.isSystem ? (
                              <Checkbox
                                isSelected={isDirect}
                                isDisabled={true}
                                aria-label={`System permission ${perm.displayName} for ${role.displayName}`}
                              >
                                <Checkbox.Control className="border-2 border-border data-[selected=true]:bg-accent data-[selected=true]:border-accent rounded size-4 before:rounded">
                                  <Checkbox.Indicator className="text-accent-foreground size-3" />
                                </Checkbox.Control>
                              </Checkbox>
                            ) : (
                              <div className="relative">
                                {updatingRoleId === role.id ? (
                                  <Spinner size="sm" color="current" className="text-accent/60" />
                                ) : (
                                  <Checkbox
                                    isSelected={isDirect}
                                    onChange={() => handleTogglePermission(role, perm.name)}
                                    aria-label={`Toggle permission ${perm.displayName} for ${role.displayName}`}
                                  >
                                    <Checkbox.Control className="border-2 border-border data-[selected=true]:bg-accent data-[selected=true]:border-accent rounded size-4 before:rounded">
                                      <Checkbox.Indicator className="text-accent-foreground size-3" />
                                    </Checkbox.Control>
                                  </Checkbox>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="bg-surface-secondary/40 border border-border rounded-xl p-4 flex gap-3 text-xs text-muted leading-relaxed select-none">
        <Lock size={16} className="text-muted shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-foreground">Inherited Permissions Policy:</span> Permissions inherited from a parent role cannot be toggled directly. To modify inherited permissions, update the parent role definition or remove the role hierarchy linkage.
        </div>
      </div>

      <RoleEditorModal
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        organizationSlug={organizationSlug}
        roleId={selectedRoleId}
        onClose={() => setSelectedRoleId(null)}
      />
    </div>
  );
};
