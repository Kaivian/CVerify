"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useWorkspaceStore } from "../store/use-workspace-store";
import { membersService } from "../services/members.service";
import { rolesService } from "../services/roles.service";
import { type MemberDetails, type OrganizationInvitation, type PreAssignedRole } from "../types/workspace.types";
import { type BusinessRoleDetailsDto, type AssignScopedRoleDto } from "../types/roles.types";
import { Card } from "@/components/ui/card";
import { Table, Typography, Chip, Button, Spinner, Dropdown, Avatar } from "@heroui/react";
import {
  Users,
  Search,
  RotateCw,
  Building2,
  AlertTriangle,
  Mail,
  UserPlus,
  Trash2,
  ShieldAlert,
  UserX,
  UserCheck,
  CheckCircle,
  Plus,
  MoreVertical,
  Briefcase,
  X
} from "lucide-react";
import { SkeletonLoader, EmptyState } from "@/components/ui/states";
import { PaginationWrapper } from "@/components/ui/pagination-wrapper";
import DialogModal from "@/components/ui/dialog-modal";
import SelectDropdown from "@/components/ui/select-dropdown";

interface WorkspaceMembersViewProps {
  organizationSlug: string;
}

export const WorkspaceMembersView: React.FC<WorkspaceMembersViewProps> = ({
  organizationSlug,
}) => {
  const router = useRouter();
  const fetchWorkspace = useWorkspaceStore((s) => s.fetchWorkspace);
  const workspaceDetails = useWorkspaceStore((s) => s.workspaces[organizationSlug]);
  const isDetailsLoading = useWorkspaceStore((s) => s.loading[organizationSlug]);
  const detailsError = useWorkspaceStore((s) => s.errors[organizationSlug]);

  // Tab State
  const [activeTab, setActiveTab] = useState<"directory" | "invitations">("directory");

  // Member Directory State
  const [members, setMembers] = useState<MemberDetails[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [isMembersLoading, setIsMembersLoading] = useState(true);
  const [membersError, setMembersError] = useState<string | null>(null);

  // Invitation State
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [invPage, setInvPage] = useState(1);
  const [invTotalCount, setInvTotalCount] = useState(0);
  const [isInvLoading, setIsInvLoading] = useState(false);

  // Available Roles & Workspaces for Dropdowns
  const [availableRoles, setAvailableRoles] = useState<BusinessRoleDetailsDto[]>([]);

  // Modals & Submitting States
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Invite Modal Form State
  const [inviteEmails, setInviteEmails] = useState("");
  const [selectedInviteRoleId, setSelectedInviteRoleId] = useState("");
  const [inviteScopeType, setInviteScopeType] = useState<"ORGANIZATION" | "WORKSPACE">("ORGANIZATION");
  const [inviteScopeId, setInviteScopeId] = useState("");
  const [configuredRoles, setConfiguredRoles] = useState<PreAssignedRole[]>([]);

  // Manage Roles Modal Form State
  const [selectedMember, setSelectedMember] = useState<MemberDetails | null>(null);
  const [newRoleId, setNewRoleId] = useState("");
  const [newScopeType, setNewScopeType] = useState<"ORGANIZATION" | "WORKSPACE">("ORGANIZATION");
  const [newScopeId, setNewScopeId] = useState("");

  // Fetch workspace details on mount
  useEffect(() => {
    if (organizationSlug) {
      fetchWorkspace(organizationSlug);
    }
  }, [organizationSlug, fetchWorkspace]);

  // Fetch available roles for filtering and assignment
  const fetchAvailableRoles = useCallback(async () => {
    if (!organizationSlug) return;
    try {
      const roles = await rolesService.getRoles(organizationSlug);
      setAvailableRoles(roles);
    } catch (err) {
      console.error("Failed to fetch roles", err);
    }
  }, [organizationSlug]);

  useEffect(() => {
    fetchAvailableRoles();
  }, [fetchAvailableRoles]);

  // Fetch Members List
  const fetchMembers = useCallback(async () => {
    if (!organizationSlug) return;
    setIsMembersLoading(true);
    setMembersError(null);
    try {
      const response = await membersService.getMembers(organizationSlug, {
        page,
        pageSize,
        search: search || undefined,
        status: statusFilter === "all" ? undefined : statusFilter,
        roleId: roleFilter === "all" ? undefined : roleFilter
      });
      setMembers(response.items);
      setTotalCount(response.totalItems);
    } catch (err) {
      console.error("Failed to fetch members", err);
      setMembersError("Failed to load members directory.");
    } finally {
      setIsMembersLoading(false);
    }
  }, [organizationSlug, page, pageSize, search, statusFilter, roleFilter]);

  // Fetch Invitations List
  const fetchInvitations = useCallback(async () => {
    if (!organizationSlug) return;
    setIsInvLoading(true);
    try {
      const response = await membersService.getInvitations(organizationSlug, {
        page: invPage,
        pageSize
      });
      setInvitations(response.items);
      setInvTotalCount(response.totalItems);
    } catch (err) {
      console.error("Failed to fetch invitations", err);
    } finally {
      setIsInvLoading(false);
    }
  }, [organizationSlug, invPage, pageSize]);

  // Initial loads and tab switching triggers
  useEffect(() => {
    if (activeTab === "directory") {
      fetchMembers();
    } else {
      fetchInvitations();
    }
  }, [activeTab, fetchMembers, fetchInvitations]);

  const handleStatusChange = async (member: MemberDetails, newStatus: string) => {
    if (!organizationSlug) return;
    const confirmed = window.confirm(
      `Are you sure you want to change this member's status to ${newStatus}?`
    );
    if (!confirmed) return;

    try {
      await membersService.updateMember(organizationSlug, member.userId, newStatus);
      fetchMembers();
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to update member status.");
    }
  };

  const handleRemoveMember = async (member: MemberDetails) => {
    if (!organizationSlug) return;
    const confirmed = window.confirm(
      `Are you sure you want to remove ${member.fullName} from this organization? This will revoke all their scoped role assignments.`
    );
    if (!confirmed) return;

    try {
      await membersService.removeMember(organizationSlug, member.userId);
      fetchMembers();
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to remove member.");
    }
  };

  // Invitation Actions
  const handleCancelInvitation = async (invId: string) => {
    if (!organizationSlug) return;
    const confirmed = window.confirm("Are you sure you want to cancel this pending invitation?");
    if (!confirmed) return;

    try {
      await membersService.cancelInvitation(organizationSlug, invId);
      fetchInvitations();
    } catch (err: any) {
      alert("Failed to cancel invitation.");
    }
  };

  const handleResendInvitation = async (invId: string) => {
    if (!organizationSlug) return;
    try {
      await membersService.resendInvitation(organizationSlug, invId);
      alert("Invitation has been successfully resent.");
      fetchInvitations();
    } catch (err: any) {
      alert("Failed to resend invitation.");
    }
  };

  // Invite Member Flow
  const handleOpenInviteModal = () => {
    setInviteEmails("");
    setSelectedInviteRoleId("");
    setInviteScopeType("ORGANIZATION");
    setInviteScopeId("");
    setConfiguredRoles([]);
    setIsInviteModalOpen(true);
  };

  const handleAddInviteRole = () => {
    if (!selectedInviteRoleId || (inviteScopeType === "WORKSPACE" && !inviteScopeId)) {
      alert("Please select both a role and scope boundary.");
      return;
    }
    const resolvedScopeId = inviteScopeType === "ORGANIZATION" ? workspaceDetails.organizationId : inviteScopeId;
    const newRole: PreAssignedRole = {
      roleId: selectedInviteRoleId,
      scopeType: inviteScopeType,
      scopeId: resolvedScopeId
    };

    // Prevent duplicate role definitions in form
    const exists = configuredRoles.some(
      r => r.roleId === newRole.roleId && r.scopeType === newRole.scopeType && r.scopeId === newRole.scopeId
    );

    if (exists) {
      alert("This role assignment is already added to this invitation.");
      return;
    }

    setConfiguredRoles([...configuredRoles, newRole]);
    setSelectedInviteRoleId("");
    setInviteScopeId("");
  };

  const handleRemoveInviteRole = (index: number) => {
    setConfiguredRoles(configuredRoles.filter((_, idx) => idx !== index));
  };

  const handleSendInvitations = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmails.trim() || !organizationSlug) return;

    const emails = inviteEmails
      .split(/[\n,]+/)
      .map(email => email.trim())
      .filter(email => email.length > 0);

    if (emails.length === 0) {
      alert("Please enter at least one valid email address.");
      return;
    }

    if (configuredRoles.length === 0) {
      alert("Please pre-assign at least one business role to this invitation.");
      return;
    }

    setIsSubmitting(true);
    try {
      const invitees = emails.map(email => ({
        email,
        roles: configuredRoles
      }));
      await membersService.inviteMembers(organizationSlug, { invitees });
      setIsInviteModalOpen(false);
      fetchInvitations();
      alert("Invitations sent successfully.");
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to send invitations.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Manage Roles Flow
  const handleOpenManageRoles = (member: MemberDetails) => {
    setSelectedMember(member);
    setNewRoleId("");
    setNewScopeType("ORGANIZATION");
    setNewScopeId("");
    setIsRoleModalOpen(true);
  };

  const handleAddRoleAssignment = async () => {
    if (!selectedMember || !newRoleId || !organizationSlug || !workspaceDetails) return;
    const resolvedScopeId = newScopeType === "ORGANIZATION" ? workspaceDetails.organizationId : newScopeId;

    if (!resolvedScopeId) {
      alert("Please select a workspace.");
      return;
    }

    setIsSubmitting(true);
    try {
      const dto: AssignScopedRoleDto = {
        userId: selectedMember.userId,
        roleId: newRoleId,
        scopeType: newScopeType,
        scopeId: resolvedScopeId
      };
      await rolesService.assignRole(organizationSlug, dto);
      
      // Refresh local roles list in selectedMember
      const rolesList = await rolesService.getRoleAssignments(organizationSlug);
      const updatedAssignments = rolesList.filter(ra => ra.userId === selectedMember.userId);
      const workspaces = (workspaceDetails.workspaces || []).reduce((acc: any, w) => {
        acc[w.id] = w.displayName;
        return acc;
      }, {});

      const updatedRoles = updatedAssignments.map(ra => ({
        roleId: ra.roleId,
        roleName: ra.roleDisplayName.toLowerCase(),
        roleDisplayName: ra.roleDisplayName,
        scopeType: ra.scopeType,
        scopeId: ra.scopeId,
        scopeName: ra.scopeType === "ORGANIZATION" ? "Global Organization" : workspaces[ra.scopeId] || "Workspace"
      }));

      setSelectedMember({
        ...selectedMember,
        roles: updatedRoles
      });
      fetchMembers();
      setNewRoleId("");
      setNewScopeId("");
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to assign role.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevokeRoleAssignment = async (roleId: string, scopeType: "ORGANIZATION" | "WORKSPACE", scopeId: string) => {
    if (!selectedMember || !organizationSlug) return;
    const confirmed = window.confirm("Are you sure you want to revoke this role assignment?");
    if (!confirmed) return;

    setIsSubmitting(true);
    try {
      const dto: AssignScopedRoleDto = {
        userId: selectedMember.userId,
        roleId,
        scopeType,
        scopeId
      };
      await rolesService.revokeRole(organizationSlug, dto);

      // Refresh local state
      const updatedRoles = selectedMember.roles.filter(
        r => !(r.roleId === roleId && r.scopeType === scopeType && r.scopeId === scopeId)
      );

      setSelectedMember({
        ...selectedMember,
        roles: updatedRoles
      });
      fetchMembers();
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to revoke role.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSwitchOrganization = (slug: string) => {
    router.push(`/workspace/${slug}`);
  };

  const getRoleBadgeColor = (roleName: string) => {
    switch (roleName.toLowerCase()) {
      case "owner":
        return "accent";
      case "administrator":
        return "accent";
      case "hr_manager":
        return "warning";
      case "recruiter":
        return "success";
      default:
        return "default";
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return "success";
      case "suspended":
        return "danger";
      case "disabled":
        return "default";
      case "pending":
        return "warning";
      default:
        return "default";
    }
  };

  // Dropdown options mappings
  const roleFilterOptions = [
    { value: "all", label: "All Roles" },
    ...availableRoles.map(r => ({ value: r.id, label: r.displayName }))
  ];

  const statusFilterOptions = [
    { value: "all", label: "All Statuses" },
    { value: "active", label: "Active Only" },
    { value: "suspended", label: "Suspended Only" }
  ];

  const roleOptions = availableRoles.map(r => ({ value: r.id, label: r.displayName }));
  const scopeTypeOptions = [
    { value: "ORGANIZATION", label: "Global Organization" },
    { value: "WORKSPACE", label: "Specific Workspace" }
  ];

  const workspaceOptions = (workspaceDetails?.workspaces || []).map(w => ({
    value: w.id,
    label: w.displayName
  }));

  const getInitials = (name: string) => {
    return name
      ? name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .slice(0, 2)
          .toUpperCase()
      : "U";
  };

  // Loading States
  if (isDetailsLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto p-4 font-outfit text-foreground">
        <div className="h-10 w-48 bg-separator/50 animate-pulse rounded-lg mb-4" />
        <Card className="p-0 overflow-hidden">
          <SkeletonLoader rows={6} columns={4} />
        </Card>
      </div>
    );
  }

  // Access check errors
  if (detailsError) {
    const isAccessDenied = detailsError.toLowerCase().includes("forbidden") || detailsError.includes("403");
    return (
      <div className="max-w-xl mx-auto py-20 font-outfit text-foreground">
        <Card className="p-8 border border-border bg-surface text-center">
          <div className="size-16 rounded-2xl bg-danger/10 flex items-center justify-center border border-danger/20 mx-auto mb-5 text-danger">
            <AlertTriangle size={28} />
          </div>
          <Typography type="h4" className="font-bold text-foreground mb-2">
            {isAccessDenied ? "Access Denied" : "Workspace Loading Error"}
          </Typography>
          <Typography type="body-xs" className="text-muted leading-relaxed mb-6">
            {isAccessDenied 
              ? "You do not have permission to access this organization workspace. Please verify your membership credentials or switch accounts."
              : detailsError}
          </Typography>
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => router.push("/user")}
              className="px-4 py-2 bg-foreground text-background font-bold rounded-xl text-xs cursor-pointer"
            >
              Back to Home
            </button>
          </div>
        </Card>
      </div>
    );
  }

  if (!workspaceDetails) return null;

  const totalPages = Math.ceil((activeTab === "directory" ? totalCount : invTotalCount) / pageSize) || 1;

  return (
    <div className="space-y-6 font-outfit max-w-7xl mx-auto text-foreground">
      {/* 1. Header Context */}
      <div className="relative overflow-hidden rounded-2xl bg-surface border border-border/80 text-foreground select-none shadow-sm">
        {/* Subtle top accent gradient line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent/30 via-accent to-accent/30" />
        
        <div className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-accent/10 border border-accent/20 text-accent shrink-0">
                <Building2 size={22} />
              </div>
              <div>
                <Typography
                  type="h2"
                  className="text-xl md:text-2xl font-bold text-foreground font-outfit leading-tight"
                >
                  {workspaceDetails.organizationName}
                </Typography>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted font-light mt-1.5">
                  <span>Workspace context:</span>
                  <span className="font-mono text-accent bg-accent/5 px-1.5 py-0.5 rounded border border-accent/10">@{workspaceDetails.organizationSlug}</span>
                  <span className="text-separator/60">•</span>
                  <span>My Role:</span>
                  <Chip
                    color="accent"
                    variant="soft"
                    size="sm"
                    className="font-bold text-[9px] uppercase tracking-wider h-5"
                  >
                    {workspaceDetails.userRole || "MEMBER"}
                  </Chip>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            {/* Quick Micro-Stats */}
            <div className="flex gap-4 px-4 py-2 bg-surface-secondary/40 border border-border/40 rounded-xl">
              <div className="text-center min-w-[60px]">
                <div className="text-base font-bold text-foreground">{totalCount}</div>
                <div className="text-[9px] uppercase tracking-wider text-muted font-bold">Members</div>
              </div>
              <div className="w-[1px] bg-separator/60 self-stretch" />
              <div className="text-center min-w-[60px]">
                <div className="text-base font-bold text-foreground">{invTotalCount}</div>
                <div className="text-[9px] uppercase tracking-wider text-muted font-bold">Pending</div>
              </div>
            </div>

            <Button
              onClick={handleOpenInviteModal}
              className="bg-foreground hover:bg-foreground/90 text-background font-bold text-xs py-2.5 px-4 rounded-xl flex items-center gap-2 cursor-pointer shadow-sm transition-all"
            >
              <UserPlus size={14} />
              Invite Member
            </Button>
          </div>
        </div>
      </div>

      {/* Premium Sleek Capsule Tabs */}
      <div className="flex items-center justify-between border-b border-separator/60 pb-3 select-none">
        <div className="flex gap-1 bg-surface-secondary/50 p-1 rounded-xl border border-border/40">
          <button
            onClick={() => {
              setActiveTab("directory");
              setPage(1);
            }}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === "directory"
                ? "bg-surface text-foreground shadow-sm border border-border/30"
                : "text-muted hover:text-foreground hover:bg-surface-secondary/30"
            }`}
          >
            <Users size={13} />
            People Directory
          </button>
          <button
            onClick={() => {
              setActiveTab("invitations");
              setInvPage(1);
            }}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === "invitations"
                ? "bg-surface text-foreground shadow-sm border border-border/30"
                : "text-muted hover:text-foreground hover:bg-surface-secondary/30"
            }`}
          >
            <Mail size={13} />
            Pending Invitations
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">
          {activeTab === "directory" ? (
            <>
              {/* Directory Filter Bar */}
              <div className="p-4 bg-surface border border-border/80 rounded-2xl flex flex-col sm:flex-row gap-4 items-center justify-between select-none shadow-xs">
                <div className="relative flex-1 w-full">
                  <Search size={14} className="absolute left-3.5 top-3.5 text-muted/80" />
                  <input
                    type="text"
                    placeholder="Search members by name or email..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-field-background text-xs focus:outline-none focus:ring-2 focus:ring-accent/15 focus:border-accent transition-all placeholder-muted/60"
                  />
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                  <div className="w-36">
                    <SelectDropdown
                      value={statusFilter}
                      onChange={(val) => {
                        setStatusFilter(val);
                        setPage(1);
                      }}
                      options={statusFilterOptions}
                      placeholder="Status"
                    />
                  </div>
                  <div className="w-40">
                    <SelectDropdown
                      value={roleFilter}
                      onChange={(val) => {
                        setRoleFilter(val);
                        setPage(1);
                      }}
                      options={roleFilterOptions}
                      placeholder="Role"
                    />
                  </div>
                </div>
              </div>

              {/* Members Table */}
              <Card className="p-0 overflow-hidden border border-border/80 bg-surface rounded-2xl shadow-xs">
                {isMembersLoading ? (
                  <SkeletonLoader rows={5} columns={4} />
                ) : members.length === 0 ? (
                  <EmptyState
                    title="No Members Found"
                    description="We couldn't find any team members matching your filter criteria."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <Table aria-label="Organization Members Table" className="w-full">
                      <Table.ScrollContainer>
                        <Table.Content aria-label="Organization Members Content">
                          <Table.Header>
                            <Table.Column isRowHeader className="font-extrabold uppercase text-[10px] tracking-wider py-4">
                              Member Details
                            </Table.Column>
                            <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4">
                              Verification
                            </Table.Column>
                            <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4">
                              Assigned Roles
                            </Table.Column>
                            <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4">
                              Status
                            </Table.Column>
                            <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4 text-right pr-6">
                              Actions
                            </Table.Column>
                          </Table.Header>
                          <Table.Body>
                            {members.map((member) => (
                              <Table.Row
                                key={member.userId}
                                className="border-b border-separator/60 last:border-none hover:bg-surface-secondary/40 transition-colors"
                              >
                                <Table.Cell className="py-4">
                                  <div className="flex items-center gap-3">
                                    <Avatar className="w-8 h-8 rounded-lg bg-surface-secondary shrink-0">
                                      <Avatar.Fallback className="font-bold text-xs text-foreground">
                                        {getInitials(member.fullName)}
                                      </Avatar.Fallback>
                                    </Avatar>
                                    <div className="space-y-0.5 min-w-0">
                                      <div className="font-bold text-foreground text-xs truncate">{member.fullName}</div>
                                      <div className="text-[10px] text-muted truncate">{member.email}</div>
                                    </div>
                                  </div>
                                </Table.Cell>
                                <Table.Cell className="py-4">
                                  <div className="flex items-center gap-2">
                                    <Chip
                                      color={member.identityStatus === "Verified" ? "success" : "default"}
                                      variant="soft"
                                      size="sm"
                                      className="font-bold text-[9px] uppercase tracking-wider"
                                    >
                                      {member.identityStatus}
                                    </Chip>
                                    {member.trustScore !== undefined && member.trustScore !== null && (
                                      <span className="text-[10px] font-bold text-accent bg-accent/5 border border-accent/10 px-1.5 py-0.5 rounded-md">
                                        {member.trustScore.toFixed(0)}%
                                      </span>
                                    )}
                                  </div>
                                </Table.Cell>
                                <Table.Cell className="py-4">
                                  <div className="flex flex-wrap gap-1 max-w-[200px]">
                                    {member.roles.length === 0 ? (
                                      <span className="text-[10px] text-muted font-light">No Roles Assigned</span>
                                    ) : (
                                      member.roles.map((r, idx) => (
                                        <Chip
                                          key={idx}
                                          color={getRoleBadgeColor(r.roleDisplayName)}
                                          variant="soft"
                                          size="sm"
                                          className="font-bold text-[9px] uppercase tracking-wider"
                                          title={`Scope: ${r.scopeName}`}
                                        >
                                          {r.roleDisplayName}
                                        </Chip>
                                      ))
                                    )}
                                  </div>
                                </Table.Cell>
                                <Table.Cell className="py-4">
                                  <Chip
                                    color={getStatusBadgeColor(member.status)}
                                    variant="soft"
                                    size="sm"
                                    className="font-bold text-[9px] uppercase tracking-wider"
                                  >
                                    {member.status}
                                  </Chip>
                                </Table.Cell>
                                <Table.Cell className="py-4 text-right pr-6">
                                  <Dropdown>
                                    <Dropdown.Trigger className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-secondary/80 cursor-pointer inline-flex items-center bg-transparent border-none outline-none transition-colors">
                                      <MoreVertical size={16} />
                                    </Dropdown.Trigger>
                                    <Dropdown.Popover
                                      placement="bottom end"
                                      className="bg-overlay border border-border shadow-overlay rounded-xl p-1.5 min-w-[170px] outline-hidden animate-in fade-in duration-100 z-50 font-outfit"
                                    >
                                      <Dropdown.Menu aria-label="Member Actions">
                                        <Dropdown.Item key="roles" onClick={() => handleOpenManageRoles(member)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer text-foreground hover:bg-surface-secondary focus:bg-surface-secondary outline-none select-none transition-colors duration-150">
                                          <div className="flex items-center gap-2 text-xs font-semibold w-full">
                                            <Briefcase size={14} className="text-muted shrink-0" />
                                            <span>Manage Roles</span>
                                          </div>
                                        </Dropdown.Item>
                                        {member.status === "active" ? (
                                          <Dropdown.Item key="suspend" onClick={() => handleStatusChange(member, "suspended")} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer text-danger hover:bg-danger/10 focus:bg-danger/10 outline-none select-none transition-colors duration-150">
                                            <div className="flex items-center gap-2 text-xs font-semibold w-full text-danger">
                                              <UserX size={14} className="shrink-0" />
                                              <span>Suspend Member</span>
                                            </div>
                                          </Dropdown.Item>
                                        ) : (
                                          <Dropdown.Item key="reactivate" onClick={() => handleStatusChange(member, "active")} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer text-success hover:bg-success/10 focus:bg-success/10 outline-none select-none transition-colors duration-150">
                                            <div className="flex items-center gap-2 text-xs font-semibold w-full text-success">
                                              <UserCheck size={14} className="shrink-0" />
                                              <span>Reactivate Member</span>
                                            </div>
                                          </Dropdown.Item>
                                        )}
                                        <Dropdown.Item key="remove" onClick={() => handleRemoveMember(member)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer text-danger hover:bg-danger/10 focus:bg-danger/10 outline-none select-none transition-colors duration-150">
                                          <div className="flex items-center gap-2 text-xs font-semibold w-full text-danger">
                                            <Trash2 size={14} className="shrink-0" />
                                            <span>Remove Member</span>
                                          </div>
                                        </Dropdown.Item>
                                      </Dropdown.Menu>
                                    </Dropdown.Popover>
                                  </Dropdown>
                                </Table.Cell>
                              </Table.Row>
                            ))}
                          </Table.Body>
                        </Table.Content>
                      </Table.ScrollContainer>
                    </Table>
                  </div>
                )}
                {members.length > 0 && (
                  <div className="p-4 border-t border-separator/60">
                    <PaginationWrapper
                      page={page}
                      totalPages={totalPages}
                      totalItems={totalCount}
                      itemsPerPage={pageSize}
                      onPageChange={(p) => setPage(p)}
                    />
                  </div>
                )}
              </Card>
            </>
          ) : (
            <>
              {/* Invitations Table */}
              <Card className="p-0 overflow-hidden border border-border/80 bg-surface rounded-2xl shadow-xs">
                {isInvLoading ? (
                  <SkeletonLoader rows={5} columns={4} />
                ) : invitations.length === 0 ? (
                  <EmptyState
                    title="No Invitations Found"
                    description="No pending invitations exist for this organization."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <Table aria-label="Invitations Table" className="w-full">
                      <Table.ScrollContainer>
                        <Table.Content aria-label="Invitations Content">
                          <Table.Header>
                            <Table.Column isRowHeader className="font-extrabold uppercase text-[10px] tracking-wider py-4">
                              Invitee Email
                            </Table.Column>
                            <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4">
                              Pre-assigned Roles
                            </Table.Column>
                            <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4">
                              Expiration Date
                            </Table.Column>
                            <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4">
                              Status
                            </Table.Column>
                            <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4 text-right pr-6">
                              Actions
                            </Table.Column>
                          </Table.Header>
                          <Table.Body>
                            {invitations.map((inv) => (
                              <Table.Row
                                key={inv.id}
                                className="border-b border-separator/60 last:border-none hover:bg-surface-secondary/40 transition-colors"
                              >
                                <Table.Cell className="py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-surface-secondary text-muted border border-border/40 shrink-0">
                                      <Mail size={14} />
                                    </div>
                                    <span className="text-xs font-bold text-foreground">{inv.inviteeEmail}</span>
                                  </div>
                                </Table.Cell>
                                <Table.Cell className="py-4">
                                  <div className="flex flex-wrap gap-1 max-w-[200px]">
                                    {inv.preAssignedRoles.map((r, idx) => (
                                      <Chip
                                        key={idx}
                                        color={getRoleBadgeColor(r.roleDisplayName)}
                                        variant="soft"
                                        size="sm"
                                        className="font-bold text-[9px] uppercase tracking-wider"
                                        title={`Scope: ${r.scopeName}`}
                                      >
                                        {r.roleDisplayName}
                                      </Chip>
                                    ))}
                                  </div>
                                </Table.Cell>
                                <Table.Cell className="py-4 text-xs text-muted">
                                  {new Date(inv.expiresAt).toLocaleDateString()}
                                </Table.Cell>
                                <Table.Cell className="py-4">
                                  <Chip
                                    color={getStatusBadgeColor(inv.status)}
                                    variant="soft"
                                    size="sm"
                                    className="font-bold text-[9px] uppercase tracking-wider"
                                  >
                                    {inv.status}
                                  </Chip>
                                </Table.Cell>
                                <Table.Cell className="py-4 text-right pr-6">
                                  {inv.status === "Pending" && (
                                    <div className="flex items-center justify-end gap-2">
                                      <button
                                        onClick={() => handleResendInvitation(inv.id)}
                                        className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-secondary/80 cursor-pointer inline-flex items-center transition-all border border-transparent focus-ring"
                                        title="Resend Invite"
                                      >
                                        <RotateCw size={13} />
                                      </button>
                                      <button
                                        onClick={() => handleCancelInvitation(inv.id)}
                                        className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger/10 cursor-pointer inline-flex items-center transition-all border border-transparent focus-ring"
                                        title="Cancel Invite"
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
                {invitations.length > 0 && (
                  <div className="p-4 border-t border-separator/60">
                    <PaginationWrapper
                      page={invPage}
                      totalPages={totalPages}
                      totalItems={invTotalCount}
                      itemsPerPage={pageSize}
                      onPageChange={(p) => setInvPage(p)}
                    />
                  </div>
                )}
              </Card>
            </>
          )}
        </div>

        {/* Right Column: Organizations switcher */}
        <div className="space-y-6 select-none animate-in fade-in duration-200">
          <Card className="p-6 border border-border/80 bg-surface rounded-2xl shadow-xs">
            <Typography
              type="h4"
              className="font-bold text-foreground mb-4 flex items-center gap-2 font-outfit"
            >
              <Users className="text-accent" size={18} />
              Linked Organizations
            </Typography>
            <Typography type="body-xs" className="text-muted leading-relaxed mb-5 font-light">
              This overview shows other enterprise tenant configurations linked to your user account.
            </Typography>
            <div className="space-y-2.5">
              {workspaceDetails.linkedOrganizations.length === 0 ? (
                <div className="text-xs text-muted/60 bg-surface-secondary/40 p-4 rounded-xl text-center font-semibold border border-border/40">
                  No other linked organizations.
                </div>
              ) : (
                workspaceDetails.linkedOrganizations.map((org) => (
                  <button
                    key={org.slug}
                    onClick={() => handleSwitchOrganization(org.slug)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-border/80 bg-field-background hover:bg-surface-secondary/50 text-left transition-all group cursor-pointer text-xs focus-ring"
                  >
                    <div className="p-2 rounded-lg bg-surface-secondary border border-border/60 text-muted group-hover:text-accent group-hover:border-accent/20 transition-all shrink-0">
                      <Building2 size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-foreground font-bold truncate group-hover:text-accent transition-colors">
                        {org.name}
                      </div>
                      <div className="text-muted text-[10px] font-mono mt-0.5 truncate">
                        @{org.slug}
                      </div>
                    </div>
                    <RotateCw
                      size={13}
                      className="text-muted/60 group-hover:text-accent group-hover:rotate-45 transition-all shrink-0 ml-2"
                    />
                  </button>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Invite Member Modal */}
      <DialogModal
        isOpen={isInviteModalOpen}
        onOpenChange={setIsInviteModalOpen}
        title="Invite Organization Members"
        footer={
          <div className="flex gap-3 w-full">
            <Button
              variant="secondary"
              onClick={() => setIsInviteModalOpen(false)}
              className="flex-1 cursor-pointer font-bold rounded-xl py-2.5 text-xs"
              isDisabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendInvitations}
              className="flex-1 cursor-pointer bg-foreground hover:bg-foreground/90 text-background font-bold rounded-xl py-2.5 text-xs flex items-center justify-center gap-2 transition-colors"
              isDisabled={isSubmitting || !inviteEmails.trim() || configuredRoles.length === 0}
            >
              {isSubmitting ? (
                <>
                  <Spinner size="sm" color="current" />
                  Sending...
                </>
              ) : (
                "Send Invitations"
              )}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSendInvitations} className="space-y-4 font-outfit select-none">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground">Invitee Email(s)</label>
            <textarea
              placeholder="Enter emails separated by commas or newlines..."
              value={inviteEmails}
              onChange={(e) => setInviteEmails(e.target.value)}
              className="w-full h-20 px-3 py-2 text-xs rounded-xl border border-border bg-field-background focus:outline-none focus:ring-2 focus:ring-accent/15 focus:border-accent transition-all resize-none placeholder-muted/60"
            />
          </div>

          <div className="border border-border/80 rounded-xl p-3.5 bg-surface-secondary/20 space-y-3">
            <Typography type="body-xs" className="font-bold text-foreground">
              Configure Role Pre-assignment
            </Typography>

            <div className="grid grid-cols-2 gap-3">
              <SelectDropdown
                value={selectedInviteRoleId}
                onChange={setSelectedInviteRoleId}
                options={roleOptions}
                label="Role"
                placeholder="Select role"
              />
              <SelectDropdown
                value={inviteScopeType}
                onChange={(val) => {
                  setInviteScopeType(val as "ORGANIZATION" | "WORKSPACE");
                  setInviteScopeId("");
                }}
                options={scopeTypeOptions}
                label="Scope"
                placeholder="Select scope"
              />
            </div>

            {inviteScopeType === "WORKSPACE" && (
              <SelectDropdown
                value={inviteScopeId}
                onChange={setInviteScopeId}
                options={workspaceOptions}
                label="Workspace Target"
                placeholder="Choose workspace"
              />
            )}

            <Button
              onClick={handleAddInviteRole}
              className="w-full border border-separator/80 font-bold text-xs py-2 rounded-xl flex items-center justify-center gap-2 cursor-pointer bg-surface hover:bg-surface-secondary transition-all"
            >
              <Plus size={13} />
              Add Pre-assigned Role
            </Button>

            {configuredRoles.length > 0 && (
              <div className="space-y-1.5 pt-2">
                <label className="text-[10px] uppercase tracking-wider font-extrabold text-muted">Added Assignments</label>
                <div className="flex flex-wrap gap-1.5">
                  {configuredRoles.map((cr, idx) => {
                    const rName = availableRoles.find(r => r.id === cr.roleId)?.displayName || "Role";
                    const sName = cr.scopeType === "ORGANIZATION" ? "Global" : workspaceOptions.find(w => w.value === cr.scopeId)?.label || "Workspace";
                    return (
                      <Chip
                        key={idx}
                        color="accent"
                        variant="soft"
                        size="sm"
                        className="font-bold text-[9px] uppercase tracking-wider flex items-center gap-1.5"
                      >
                        <span>{rName} ({sName})</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            handleRemoveInviteRole(idx);
                          }}
                          className="hover:text-danger cursor-pointer ml-1 p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center"
                        >
                          <X size={10} />
                        </button>
                      </Chip>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </form>
      </DialogModal>

      {/* Manage Roles Modal */}
      <DialogModal
        isOpen={isRoleModalOpen}
        onOpenChange={setIsRoleModalOpen}
        title={selectedMember ? `Manage Roles for ${selectedMember.fullName}` : "Manage Member Roles"}
        footer={
          <Button
            variant="secondary"
            onClick={() => setIsRoleModalOpen(false)}
            className="w-full cursor-pointer font-bold rounded-xl py-2.5 text-xs"
          >
            Close
          </Button>
        }
      >
        <div className="space-y-5 font-outfit select-none">
          {/* Active Role Assignments List */}
          <div className="space-y-2">
            <Typography type="body-xs" className="font-bold text-foreground">
              Current Scoped Roles
            </Typography>
            {selectedMember?.roles.length === 0 ? (
              <div className="text-xs text-muted/60 bg-surface-secondary/40 p-4 rounded-xl text-center border border-border/40">
                This member has no active role assignments.
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {selectedMember?.roles.map((r, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 border border-border/80 rounded-xl bg-surface-secondary/30"
                  >
                    <div>
                      <div className="text-xs font-bold text-foreground">{r.roleDisplayName}</div>
                      <div className="text-[10px] text-muted font-medium mt-0.5">Scope: {r.scopeName}</div>
                    </div>
                    <button
                      onClick={() => handleRevokeRoleAssignment(r.roleId, r.scopeType, r.scopeId)}
                      className="p-1 text-muted hover:text-danger hover:bg-danger/10 rounded-lg cursor-pointer transition-colors"
                      title="Revoke Role"
                      disabled={isSubmitting}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add New Scoped Role Section */}
          <div className="border border-border/80 rounded-xl p-3.5 bg-surface-secondary/20 space-y-3">
            <Typography type="body-xs" className="font-bold text-foreground">
              Assign New Role
            </Typography>
            <div className="grid grid-cols-2 gap-3">
              <SelectDropdown
                value={newRoleId}
                onChange={setNewRoleId}
                options={roleOptions}
                label="Role"
                placeholder="Choose role"
              />
              <SelectDropdown
                value={newScopeType}
                onChange={(val) => {
                  setNewScopeType(val as "ORGANIZATION" | "WORKSPACE");
                  setNewScopeId("");
                }}
                options={scopeTypeOptions}
                label="Scope"
                placeholder="Choose scope"
              />
            </div>

            {newScopeType === "WORKSPACE" && (
              <SelectDropdown
                value={newScopeId}
                onChange={setNewScopeId}
                options={workspaceOptions}
                label="Workspace Target"
                placeholder="Choose workspace"
              />
            )}

            <Button
              onClick={handleAddRoleAssignment}
              className="w-full bg-foreground hover:bg-foreground/90 text-background font-bold text-xs py-2 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
              isDisabled={isSubmitting || !newRoleId || (newScopeType === "WORKSPACE" && !newScopeId)}
            >
              {isSubmitting ? (
                <Spinner size="sm" color="current" />
              ) : (
                <>
                  <Plus size={13} />
                  Add Assignment
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogModal>
    </div>
  );
};

export default WorkspaceMembersView;
