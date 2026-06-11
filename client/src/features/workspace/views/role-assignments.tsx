"use client";

import React, { useEffect, useState } from "react";
import { useWorkspaceStore } from "../store/use-workspace-store";
import { workspaceService } from "../services/workspace.service";
import { Button, Card, Chip, Table, Spinner } from "@heroui/react";
import { Search, Plus, Trash2, Edit3 } from "lucide-react";
import { SkeletonLoader, EmptyState } from "@/components/ui/states";
import DialogModal from "@/components/ui/dialog-modal";
import SelectDropdown from "@/components/ui/select-dropdown";
import type { RoleAssignmentDto, AssignScopedRoleDto } from "../types/roles.types";
import type { WorkspaceMember } from "../types/workspace.types";

interface RoleAssignmentsProps {
  organizationSlug: string;
}

export const RoleAssignments: React.FC<RoleAssignmentsProps> = ({ organizationSlug }) => {
  const fetchRoleAssignments = useWorkspaceStore((s) => s.fetchRoleAssignments);
  const fetchRoles = useWorkspaceStore((s) => s.fetchRoles);
  const assignRole = useWorkspaceStore((s) => s.assignRole);
  const revokeRole = useWorkspaceStore((s) => s.revokeRole);

  const assignments = useWorkspaceStore((s) => s.assignments[organizationSlug]) || [];
  const roles = useWorkspaceStore((s) => s.roles[organizationSlug]) || [];
  const workspaceDetails = useWorkspaceStore((s) => s.workspaces[organizationSlug]);

  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [targetUserId, setTargetUserId] = useState("");
  const [targetRoleId, setTargetRoleId] = useState("");
  const [scopeType, setScopeType] = useState<"ORGANIZATION" | "WORKSPACE">("ORGANIZATION");
  const [targetWorkspaceId, setTargetWorkspaceId] = useState("");

  const [editingAssignment, setEditingAssignment] = useState<RoleAssignmentDto | null>(null);

  // Members List State for selection
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  const [prevOrgSlug, setPrevOrgSlug] = useState(organizationSlug);
  if (organizationSlug !== prevOrgSlug) {
    setPrevOrgSlug(organizationSlug);
    setIsLoading(true);
  }

  const [prevIsModalOpen, setPrevIsModalOpen] = useState(isModalOpen);
  if (isModalOpen !== prevIsModalOpen) {
    setPrevIsModalOpen(isModalOpen);
    if (isModalOpen) {
      setIsLoadingMembers(true);
    }
  }

  useEffect(() => {
    if (organizationSlug) {
      Promise.all([
        fetchRoleAssignments(organizationSlug),
        fetchRoles(organizationSlug)
      ]).finally(() => {
        setIsLoading(false);
      });
    }
  }, [organizationSlug, fetchRoleAssignments, fetchRoles]);

  // Fetch members when modal is opened
  useEffect(() => {
    if (isModalOpen && organizationSlug) {
      workspaceService
        .getWorkspaceMembers(organizationSlug, { page: 1, pageSize: 100 })
        .then((res) => {
          setMembers(res.items);
        })
        .catch((err) => {
          console.error("Failed to fetch members for role assignment", err);
        })
        .finally(() => {
          setIsLoadingMembers(false);
        });
    }
  }, [isModalOpen, organizationSlug]);

  const handleOpenModal = () => {
    setEditingAssignment(null);
    setTargetUserId("");
    setTargetRoleId("");
    setScopeType("ORGANIZATION");
    setTargetWorkspaceId("");
    setIsModalOpen(true);
  };

  const handleEditAssignment = (assign: RoleAssignmentDto) => {
    setEditingAssignment(assign);
    setTargetUserId(assign.userId);
    setTargetRoleId(assign.roleId);
    setScopeType(assign.scopeType);
    setTargetWorkspaceId(assign.scopeType === "WORKSPACE" ? assign.scopeId : "");
    setIsModalOpen(true);
  };

  const handleAssignRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUserId || !targetRoleId || !workspaceDetails) return;

    const resolvedScopeId =
      scopeType === "ORGANIZATION"
        ? workspaceDetails.organizationId
        : targetWorkspaceId;

    if (!resolvedScopeId) {
      alert("Please select a workspace for workspace-scoped roles.");
      return;
    }

    setIsSubmitting(true);

    if (editingAssignment) {
      const revokeDto: AssignScopedRoleDto = {
        userId: editingAssignment.userId,
        roleId: editingAssignment.roleId,
        scopeType: editingAssignment.scopeType,
        scopeId: editingAssignment.scopeId,
      };
      const revokeSuccess = await revokeRole(organizationSlug, revokeDto);
      if (!revokeSuccess) {
        alert("Failed to update assignment: could not revoke previous role assignment.");
        setIsSubmitting(false);
        return;
      }
    }

    const dto: AssignScopedRoleDto = {
      userId: targetUserId,
      roleId: targetRoleId,
      scopeType,
      scopeId: resolvedScopeId,
    };

    const success = await assignRole(organizationSlug, dto);
    setIsSubmitting(false);

    if (success) {
      setIsModalOpen(false);
    } else {
      alert("Failed to assign role. It may already be assigned under this scope.");
    }
  };

  const handleRevokeRole = async (assignment: RoleAssignmentDto) => {
    const confirmed = window.confirm(
      `Are you sure you want to revoke the role "${assignment.roleDisplayName}" from "${assignment.userName}" under scope "${assignment.scopeName}"?`
    );
    if (!confirmed) return;

    const dto: AssignScopedRoleDto = {
      userId: assignment.userId,
      roleId: assignment.roleId,
      scopeType: assignment.scopeType,
      scopeId: assignment.scopeId,
    };

    const success = await revokeRole(organizationSlug, dto);
    if (!success) {
      alert("Failed to revoke role assignment. Please try again.");
    }
  };

  const filteredAssignments = assignments.filter(
    (assign) =>
      assign.userName.toLowerCase().includes(search.toLowerCase()) ||
      assign.userEmail.toLowerCase().includes(search.toLowerCase()) ||
      assign.roleDisplayName.toLowerCase().includes(search.toLowerCase()) ||
      assign.scopeName.toLowerCase().includes(search.toLowerCase())
  );

  const getScopeBadgeColor = (type: string) => {
    return type.toUpperCase() === "ORGANIZATION" ? "accent" : "warning";
  };

  const memberOptions = members.map((m) => ({
    value: m.userId,
    label: `${m.name} (${m.email})`,
  }));

  const roleOptions = roles.map((r) => ({
    value: r.id,
    label: r.displayName,
  }));

  const scopeTypeOptions = [
    { value: "ORGANIZATION", label: "Organization-wide (Global)" },
    { value: "WORKSPACE", label: "Workspace-specific" },
  ];

  const workspaceOptions = (workspaceDetails?.workspaces || []).map((w) => ({
    value: w.id,
    label: w.displayName,
  }));

  if (isLoading) {
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

  return (
    <div className="space-y-6">
      {/* Search and Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between select-none">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3.5 top-3.5 text-muted" />
          <input
            type="text"
            placeholder="Search assignments by member name, email, role or scope..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-surface text-xs focus:outline-none focus:ring-2 focus:ring-focus/20"
          />
        </div>
        <Button
          onClick={handleOpenModal}
          className="bg-foreground text-background font-bold text-xs py-2 px-4 rounded-xl flex items-center gap-2 cursor-pointer"
        >
          <Plus size={14} />
          Assign Scoped Role
        </Button>
      </div>

      {/* Assignments Table */}
      <Card className="p-0 overflow-hidden border border-border bg-surface rounded-2xl">
        {filteredAssignments.length === 0 ? (
          <EmptyState
            title="No Assignments Found"
            description={search ? "No role assignments match your search query." : "No business roles are currently assigned."}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table aria-label="Role Assignments Table" className="w-full">
              <Table.ScrollContainer>
                <Table.Content aria-label="Role Assignments Table Content">
                  <Table.Header>
                    <Table.Column isRowHeader className="font-extrabold uppercase text-[10px] tracking-wider py-4">
                      Member
                    </Table.Column>
                    <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4">
                      Assigned Role
                    </Table.Column>
                    <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4">
                      Scope Type
                    </Table.Column>
                    <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4">
                      Target Boundary
                    </Table.Column>
                    <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4">
                      Assigned At
                    </Table.Column>
                    <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4 text-right pr-6">
                      Actions
                    </Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {filteredAssignments.map((assign) => (
                      <Table.Row
                        key={assign.id}
                        className="border-b border-separator last:border-none hover:bg-surface-secondary/20 transition-colors"
                      >
                        <Table.Cell className="py-4">
                          <div className="space-y-0.5">
                            <div className="font-bold text-foreground text-xs">{assign.userName}</div>
                            <div className="text-[10px] text-muted">{assign.userEmail}</div>
                          </div>
                        </Table.Cell>
                        <Table.Cell className="py-4 font-semibold text-xs text-foreground">
                          {assign.roleDisplayName}
                        </Table.Cell>
                        <Table.Cell className="py-4">
                          <Chip
                            color={getScopeBadgeColor(assign.scopeType)}
                            variant="soft"
                            size="sm"
                            className="font-bold text-[9px] uppercase tracking-wider"
                          >
                            {assign.scopeType}
                          </Chip>
                        </Table.Cell>
                        <Table.Cell className="py-4 text-xs font-semibold text-foreground">
                          {assign.scopeName}
                        </Table.Cell>
                        <Table.Cell className="py-4 text-muted text-xs">
                          {new Date(assign.assignedAt).toLocaleDateString()}
                        </Table.Cell>
                        <Table.Cell className="py-4 text-right pr-6">
                          <div className="flex items-center justify-end gap-2.5">
                            <button
                              onClick={() => handleEditAssignment(assign)}
                              className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-secondary/80 transition-all cursor-pointer inline-flex items-center justify-center"
                              title="Edit Assignment"
                            >
                              <Edit3 size={13} />
                            </button>
                            <button
                              onClick={() => handleRevokeRole(assign)}
                              className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-all cursor-pointer inline-flex items-center justify-center"
                              title="Revoke Assignment"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
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

      {/* Assignment Dialog Modal */}
      <DialogModal
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        title={editingAssignment ? "Edit Scoped Business Role" : "Assign Scoped Business Role"}
        footer={
          <div className="flex gap-3 w-full">
            <Button
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
              className="flex-1 cursor-pointer font-bold rounded-xl py-2.5 text-xs"
              isDisabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssignRole}
              className="flex-1 cursor-pointer bg-foreground text-background font-bold rounded-xl py-2.5 text-xs flex items-center justify-center gap-2"
              isDisabled={isSubmitting || !targetUserId || !targetRoleId || (scopeType === "WORKSPACE" && !targetWorkspaceId)}
            >
              {isSubmitting ? (
                <>
                  <Spinner size="sm" color="current" />
                  {editingAssignment ? "Updating..." : "Assigning..."}
                </>
              ) : (
                editingAssignment ? "Save Changes" : "Confirm Assignment"
              )}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleAssignRole} className="space-y-4 font-outfit select-none">
          {isLoadingMembers ? (
            <div className="flex justify-center py-6">
              <Spinner size="sm" />
            </div>
          ) : (
            <div className="space-y-4">
              <SelectDropdown
                value={targetUserId}
                onChange={setTargetUserId}
                options={memberOptions}
                label="Target Organization Member"
                placeholder="Choose member..."
                isDisabled={!!editingAssignment}
              />

              <SelectDropdown
                value={targetRoleId}
                onChange={setTargetRoleId}
                options={roleOptions}
                label="Select Role"
                placeholder="Choose role..."
              />

              <SelectDropdown
                value={scopeType}
                onChange={(val) => {
                  setScopeType(val as "ORGANIZATION" | "WORKSPACE");
                  setTargetWorkspaceId("");
                }}
                options={scopeTypeOptions}
                label="Assignment Scope"
                placeholder="Choose scope type..."
              />

              {scopeType === "WORKSPACE" && (
                <SelectDropdown
                  value={targetWorkspaceId}
                  onChange={setTargetWorkspaceId}
                  options={workspaceOptions}
                  label="Select Workspace Target"
                  placeholder="Choose workspace..."
                />
              )}
            </div>
          )}
        </form>
      </DialogModal>
    </div>
  );
};
