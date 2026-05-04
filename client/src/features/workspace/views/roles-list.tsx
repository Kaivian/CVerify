"use client";

import React, { useState, useEffect } from "react";
import { useWorkspaceStore } from "../store/use-workspace-store";
import { Button, Card, Chip, Table, Typography } from "@heroui/react";
import { Search, Shield, ShieldAlert, Plus, Edit3, Trash2 } from "lucide-react";
import { SkeletonLoader, EmptyState } from "@/components/ui/states";
import { RoleEditorModal } from "./role-editor-modal";
import type { BusinessRoleDetailsDto } from "../types/roles.types";

interface RolesListProps {
  organizationSlug: string;
}

export const RolesList: React.FC<RolesListProps> = ({ organizationSlug }) => {
  const fetchRoles = useWorkspaceStore((s) => s.fetchRoles);
  const deleteRole = useWorkspaceStore((s) => s.deleteRole);

  const roles = useWorkspaceStore((s) => s.roles[organizationSlug]) || [];
  const isLoading = useWorkspaceStore((s) => s.rolesLoading[organizationSlug]);
  const error = useWorkspaceStore((s) => s.rolesErrors[organizationSlug]);

  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

  useEffect(() => {
    if (organizationSlug) {
      fetchRoles(organizationSlug);
    }
  }, [organizationSlug, fetchRoles]);

  const handleCreateRole = () => {
    setSelectedRoleId(null);
    setIsModalOpen(true);
  };

  const handleEditRole = (roleId: string) => {
    setSelectedRoleId(roleId);
    setIsModalOpen(true);
  };

  const handleDeleteRole = async (role: BusinessRoleDetailsDto) => {
    if (role.isSystem) return;
    
    const confirmed = window.confirm(
      `Are you sure you want to delete the business role "${role.displayName}"? This action cannot be undone.`
    );
    if (!confirmed) return;

    const success = await deleteRole(organizationSlug, role.id);
    if (!success) {
      alert("Failed to delete role. Ensure it is not currently assigned to any members.");
    }
  };

  const filteredRoles = roles.filter(
    (role) =>
      role.displayName.toLowerCase().includes(search.toLowerCase()) ||
      role.name.toLowerCase().includes(search.toLowerCase()) ||
      (role.description && role.description.toLowerCase().includes(search.toLowerCase()))
  );

  if (isLoading && roles.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="h-8 w-48 bg-separator/50 animate-pulse rounded-lg" />
          <div className="h-10 w-36 bg-separator/50 animate-pulse rounded-lg" />
        </div>
        <Card className="p-0 overflow-hidden border border-border bg-surface rounded-2xl">
          <SkeletonLoader rows={6} columns={5} />
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-8 border border-danger/20 bg-danger/5 text-center text-danger rounded-2xl">
        <Typography type="h4" className="font-bold mb-2">
          Failed to Load Business Roles
        </Typography>
        <Typography type="body-xs" className="mb-4">{error}</Typography>
        <Button onClick={() => fetchRoles(organizationSlug)} variant="secondary" className="mx-auto">
          Retry Loading
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between select-none">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3.5 top-3.5 text-muted" />
          <input
            type="text"
            placeholder="Search roles by name, slug or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-surface text-xs focus:outline-none focus:ring-2 focus:ring-focus/20"
          />
        </div>
        <Button
          onClick={handleCreateRole}
          className="bg-foreground text-background font-bold text-xs py-2 px-4 rounded-xl flex items-center gap-2 cursor-pointer"
        >
          <Plus size={14} />
          Create Custom Role
        </Button>
      </div>

      {/* Roles Table */}
      <Card className="p-0 overflow-hidden border border-border bg-surface rounded-2xl">
        {filteredRoles.length === 0 ? (
          <EmptyState
            title="No Roles Found"
            description={search ? "No business roles match your search query." : "No business roles configured."}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table aria-label="Business Roles Table" className="w-full">
              <Table.ScrollContainer>
                <Table.Content aria-label="Business Roles Table Content">
                  <Table.Header>
                    <Table.Column isRowHeader className="font-extrabold uppercase text-[10px] tracking-wider py-4">
                      Role / Slug
                    </Table.Column>
                    <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4">
                      Description
                    </Table.Column>
                    <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4">
                      Inherits From
                    </Table.Column>
                    <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4">
                      Type
                    </Table.Column>
                    <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4">
                      Active Members
                    </Table.Column>
                    <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4 text-right pr-6">
                      Actions
                    </Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {filteredRoles.map((role) => (
                      <Table.Row
                        key={role.id}
                        className="border-b border-separator last:border-none hover:bg-surface-secondary/20 transition-colors"
                      >
                        <Table.Cell className="py-4">
                          <div className="space-y-0.5">
                            <div className="font-bold text-foreground text-xs flex items-center gap-1.5">
                              {role.isSystem && <Shield size={12} className="text-accent" />}
                              {role.displayName}
                            </div>
                            <div className="text-[10px] font-mono text-muted">@{role.name}</div>
                          </div>
                        </Table.Cell>
                        <Table.Cell className="text-muted text-xs py-4 max-w-xs truncate">
                          {role.description || <span className="italic opacity-60">No description provided</span>}
                        </Table.Cell>
                        <Table.Cell className="py-4">
                          {role.parentRoleId ? (
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground select-none">
                              <span className="text-muted font-normal text-[10px] font-mono">parent:</span>
                              {role.parentRoleName || "Custom Role"}
                            </div>
                          ) : (
                            <span className="text-muted/60 text-xs italic select-none">None</span>
                          )}
                        </Table.Cell>
                        <Table.Cell className="py-4">
                          <Chip
                            color={role.isSystem ? "accent" : "success"}
                            variant="soft"
                            size="sm"
                            className="font-bold text-[9px] uppercase tracking-wider"
                          >
                            {role.isSystem ? "System" : "Custom"}
                          </Chip>
                        </Table.Cell>
                        <Table.Cell className="text-foreground font-semibold text-xs py-4 select-none">
                          {role.memberCount} {role.memberCount === 1 ? "member" : "members"}
                        </Table.Cell>
                        <Table.Cell className="py-4 text-right pr-6">
                          {role.isSystem ? (
                            <span className="text-muted/50 text-[10px] font-bold uppercase select-none flex items-center justify-end gap-1">
                              <ShieldAlert size={12} className="text-muted/40" />
                              System Locked
                            </span>
                          ) : (
                            <div className="flex items-center justify-end gap-2.5">
                              <button
                                onClick={() => handleEditRole(role.id)}
                                className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-secondary/80 transition-all cursor-pointer flex items-center justify-center"
                                title="Edit Role"
                              >
                                <Edit3 size={13} />
                              </button>
                              <button
                                onClick={() => handleDeleteRole(role)}
                                className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-all cursor-pointer flex items-center justify-center"
                                title="Delete Role"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          )}
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          </div>
        )}
      </Card>

      {/* Editor Modal */}
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
