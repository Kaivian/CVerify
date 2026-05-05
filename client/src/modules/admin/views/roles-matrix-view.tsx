"use client";

import React, { useState, useEffect, useCallback } from "react";
import { adminService } from "@/services/admin.service";
import { type RoleListItem } from "@/types/admin.types";
import { Card, Table, Chip, Typography } from "@heroui/react";
import { Shield, Plus, RotateCw, Search, ShieldAlert, Edit, Trash2 } from "lucide-react";
import { SkeletonLoader, EmptyState } from "@/components/ui/states";
import { useTranslation } from "react-i18next";
import { TableActionDropdown } from "@/components/ui/table-action-dropdown";
import { RoleEditorModal } from "./role-editor-modal";

export function RolesMatrixView() {
  const { t } = useTranslation(["dashboard-admin", "common"]);
  const [roles, setRoles] = useState<RoleListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Search and Filter State
  const [search, setSearch] = useState("");

  // Editor Modal Dialog State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

  const fetchRoles = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const rolesList = await adminService.getRoles();
      setRoles(rolesList);
    } catch (err) {
      console.error("Failed to fetch roles", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRoles();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchRoles]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchRoles(true);
  };

  const handleOpenCreate = () => {
    setSelectedRoleId(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (roleId: string) => {
    setSelectedRoleId(roleId);
    setIsModalOpen(true);
  };

  const handleDeleteRole = async (role: RoleListItem) => {
    if (role.isSystem) return;

    const confirmed = window.confirm(
      `Are you sure you want to permanently delete the admin role "${role.displayName}"? This action cannot be undone and may immediately revoke privileges for assigned users.`
    );
    if (!confirmed) return;

    try {
      await adminService.deleteRole(role.id);
      fetchRoles();
    } catch (err: unknown) {
      const error = err as { message?: string };
      alert(error?.message || t("dashboard-admin:roles.deleteError"));
    }
  };

  // Filter roles based on search
  const filteredRoles = roles.filter(
    (role) =>
      role.displayName.toLowerCase().includes(search.toLowerCase()) ||
      role.name.toLowerCase().includes(search.toLowerCase()) ||
      (role.description && role.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6 font-outfit max-w-7xl mx-auto p-4 md:p-6 text-foreground">
      {/* Header / Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Typography type="h2" className="text-2xl font-extrabold tracking-tight flex items-center gap-2 font-display">
            <Shield className="text-accent" size={24} />
            {t("dashboard-admin:roles.title")}
          </Typography>
          <Typography type="body-sm" className="text-muted mt-1 font-outfit">
            {t("dashboard-admin:roles.subtitle")}
          </Typography>
        </div>
        <div className="flex gap-2.5 select-none">
          <button
            onClick={handleRefresh}
            className="px-4 py-2.5 border border-border rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-surface-secondary select-none cursor-pointer transition-colors"
          >
            <RotateCw size={14} className={isRefreshing ? "animate-spin" : ""} />
            {t("dashboard-admin:roles.syncSchemas")}
          </button>
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2.5 bg-foreground text-background font-bold rounded-xl text-xs flex items-center gap-2 hover:bg-foreground/90 transition-all select-none cursor-pointer"
          >
            <Plus size={14} />
            {t("dashboard-admin:roles.createCustomRole")}
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative flex-1 max-w-md select-none">
        <Search size={16} className="absolute left-3.5 top-3.5 text-muted" />
        <input
          type="text"
          placeholder="Search admin roles by name, slug or description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-surface text-xs focus:outline-none focus:ring-2 focus:ring-focus/20"
        />
      </div>

      {/* Roles Directory Table inside Card */}
      <Card className="p-0 overflow-hidden border border-border bg-surface rounded-2xl shadow-surface">
        {isLoading ? (
          <SkeletonLoader rows={6} columns={5} />
        ) : filteredRoles.length === 0 ? (
          <EmptyState
            title="No Roles Found"
            description={search ? "No admin roles match your search query." : "No admin roles configured."}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table aria-label="Admin Roles Table" className="w-full border-collapse text-left">
              <Table.ScrollContainer>
                <Table.Content aria-label="Admin Roles Table Content">
                  <Table.Header>
                    <Table.Column isRowHeader className="font-extrabold uppercase text-[10px] tracking-wider py-4 px-6 text-muted">
                      Role / Slug
                    </Table.Column>
                    <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4 px-6 text-muted">
                      Description
                    </Table.Column>
                    <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4 px-6 text-muted">
                      Inherits From
                    </Table.Column>
                    <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4 px-6 text-muted">
                      Type
                    </Table.Column>
                    <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4 px-6 text-muted">
                      Permissions Count
                    </Table.Column>
                    <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4 px-6 text-right pr-6 text-muted">
                      Actions
                    </Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {filteredRoles.map((role) => {
                      // Find parent role display name
                      const parentRole = roles.find((r) => r.id === role.parentRoleId);

                      return (
                        <Table.Row
                          key={role.id}
                          className="border-b border-separator last:border-none hover:bg-surface-secondary/20 transition-colors"
                        >
                          <Table.Cell className="py-4 px-6">
                            <div className="space-y-0.5">
                              <div className="font-bold text-foreground text-xs flex items-center gap-1.5">
                                {role.isSystem && <Shield size={12} className="text-accent" />}
                                {role.displayName}
                              </div>
                              <div className="text-[10px] font-mono text-muted">@{role.name}</div>
                            </div>
                          </Table.Cell>
                          <Table.Cell className="text-muted text-xs py-4 px-6 max-w-xs truncate">
                            {role.description || <span className="italic opacity-60">No description provided</span>}
                          </Table.Cell>
                          <Table.Cell className="py-4 px-6">
                            {role.parentRoleId ? (
                              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground select-none">
                                <span className="text-muted font-normal text-[10px] font-mono">parent:</span>
                                {parentRole?.displayName || "Custom Role"}
                              </div>
                            ) : (
                              <span className="text-muted/60 text-xs italic select-none">None</span>
                            )}
                          </Table.Cell>
                          <Table.Cell className="py-4 px-6">
                            <Chip
                              color={role.isSystem ? "accent" : "success"}
                              variant="soft"
                              size="sm"
                              className="font-bold text-[9px] uppercase tracking-wider"
                            >
                              {role.isSystem ? "System" : "Custom"}
                            </Chip>
                          </Table.Cell>
                          <Table.Cell className="text-foreground font-semibold text-xs py-4 px-6 select-none">
                            {role.permissions.includes("*:*:*") || role.permissions.includes("*")
                              ? t("dashboard-admin:roles.allPermissions")
                              : t("dashboard-admin:roles.granularPermissions", { count: role.permissions.length })}
                          </Table.Cell>
                          <Table.Cell className="py-4 px-6 text-right pr-6">
                            {role.isSystem ? (
                              <span className="text-muted/50 text-[10px] font-bold uppercase select-none flex items-center justify-end gap-1">
                                <ShieldAlert size={12} className="text-muted/40" />
                                System Locked
                              </span>
                            ) : (
                              <div className="flex items-center justify-end gap-2.5">
                                <TableActionDropdown
                                  actions={[
                                    {
                                      id: "edit",
                                      label: t("dashboard-admin:roles.editMatrix"),
                                      icon: Edit,
                                      onSelect: () => handleOpenEdit(role.id),
                                    },
                                    {
                                      id: "delete",
                                      label: t("dashboard-admin:roles.delete"),
                                      icon: Trash2,
                                      variant: "danger",
                                      requiresConfirmation: true,
                                      confirmationConfig: {
                                        title: "Delete Admin Role",
                                        description: "Are you sure you want to permanently delete this security role? This action cannot be undone and may immediately revoke privileges for assigned users.",
                                        confirmText: "Delete",
                                        cancelText: "Cancel",
                                      },
                                      onSelect: () => handleDeleteRole(role),
                                    },
                                  ]}
                                />
                              </div>
                            )}
                          </Table.Cell>
                        </Table.Row>
                      );
                    })}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          </div>
        )}
      </Card>

      {/* Decoupled Role Editor Modal Dialog */}
      <RoleEditorModal
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        roles={roles}
        roleId={selectedRoleId}
        onClose={() => setSelectedRoleId(null)}
        onSaveSuccess={fetchRoles}
      />
    </div>
  );
}
