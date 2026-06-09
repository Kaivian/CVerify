"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useWorkspaceStore } from "../store/use-workspace-store";
import { workspaceService } from "../services/workspace.service";
import { type WorkspaceMember } from "../types/workspace.types";
import { Card } from "@/components/ui/card";
import { Table, Typography, Chip } from "@heroui/react";
import { Users, Search, RotateCw, Building2, AlertTriangle } from "lucide-react";
import { SkeletonLoader, EmptyState } from "@/components/ui/states";
import { PaginationWrapper } from "@/components/ui/pagination-wrapper";

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

  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isMembersLoading, setIsMembersLoading] = useState(true);
  const [membersError, setMembersError] = useState<string | null>(null);

  // Fetch workspace metadata details
  useEffect(() => {
    if (organizationSlug) {
      fetchWorkspace(organizationSlug);
    }
  }, [organizationSlug, fetchWorkspace]);

  // Debounced search key updates
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset to page 1 on search change
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [search]);

  // Fetch paginated members list
  const fetchMembers = useCallback(async () => {
    if (!organizationSlug) return;
    setIsMembersLoading(true);
    setMembersError(null);
    try {
      const response = await workspaceService.getWorkspaceMembers(
        organizationSlug,
        {
          page,
          pageSize,
          search: debouncedSearch || undefined,
        }
      );
      setMembers(response.items);
      setTotalCount(response.totalCount);
    } catch (err) {
      console.error("Failed to fetch workspace members", err);
      const errorObject = err as { response?: { data?: { message?: string } }; message?: string };
      const msg = errorObject?.response?.data?.message || errorObject?.message || "Failed to load members";
      setMembersError(msg);
    } finally {
      setIsMembersLoading(false);
    }
  }, [organizationSlug, page, pageSize, debouncedSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMembers();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchMembers]);

  const handleSwitchOrganization = (slug: string) => {
    router.push(`/workspace/${slug}`);
  };

  const getRoleStyle = (role: string) => {
    switch (role.toUpperCase()) {
      case "OWNER":
        return "accent";
      case "REPRESENTATIVE":
        return "accent";
      case "HR":
        return "warning";
      default:
        return "default";
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return "success";
      case "invited":
        return "warning";
      case "suspended":
        return "danger";
      default:
        return "default";
    }
  };

  // 1. Loading state (details or initial members loading)
  if (isDetailsLoading || (isMembersLoading && members.length === 0 && !membersError)) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto p-4 font-outfit text-foreground">
        <div className="h-10 w-48 bg-separator/50 animate-pulse rounded-lg mb-4" />
        <Card className="p-0 overflow-hidden">
          <SkeletonLoader rows={6} columns={4} />
        </Card>
      </div>
    );
  }

  // 2. Access Denied / 403 Forbidden / General Errors State
  const activeError = detailsError || membersError;
  if (activeError) {
    const isAccessDenied = activeError.toLowerCase().includes("forbidden") || activeError.toLowerCase().includes("forbid") || activeError.includes("403");
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
              : activeError}
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

  if (!workspaceDetails) {
    return (
      <div className="max-w-xl mx-auto py-20">
        <EmptyState
          title="Organization Not Found"
          description="We couldn't locate any active organization matching the provided workspace context."
        />
      </div>
    );
  }

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return (
    <div className="space-y-6 font-outfit max-w-7xl mx-auto text-foreground">
      {/* 1. Header context banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-surface border border-border text-foreground select-none">
        <div className="space-y-1">
          <Typography
            type="h2"
            className="text-2xl font-bold flex items-center gap-2 text-foreground"
          >
            <Building2 size={24} className="text-accent" />
            {workspaceDetails.organizationName}
          </Typography>
          <Typography type="body-xs" className="text-muted font-light mt-0.5">
            Workspace context: <span className="font-mono text-accent">@{workspaceDetails.organizationSlug}</span> • My Role: <span className="font-semibold text-foreground">{workspaceDetails.userRole}</span>
          </Typography>
        </div>
      </div>

      {/* 2. Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Members Table Area */}
        <div className="lg:col-span-2 space-y-6">
          {/* Search bar inside Card */}
          <Card className="p-4 bg-surface border border-border rounded-2xl">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-3.5 text-muted" />
              <input
                type="text"
                placeholder="Search members by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-surface/50 text-xs focus:outline-none focus:ring-2 focus:ring-focus/20"
              />
            </div>
          </Card>

          {/* Members Table */}
          <Card className="p-0 overflow-hidden border border-border bg-surface rounded-2xl">
            {isMembersLoading ? (
              <SkeletonLoader rows={5} columns={4} />
            ) : members.length === 0 ? (
              <EmptyState
                title="No Members Found"
                description="We couldn't find any team members matching your search query."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table aria-label="Organization Members Table" className="w-full">
                  <Table.ScrollContainer>
                    <Table.Content aria-label="Organization Members Content">
                      <Table.Header>
                        <Table.Column isRowHeader className="font-extrabold uppercase text-[10px] tracking-wider py-4">
                          Name
                        </Table.Column>
                        <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4">
                          Email
                        </Table.Column>
                        <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4">
                          Role
                        </Table.Column>
                        <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4">
                          Status
                        </Table.Column>
                      </Table.Header>
                      <Table.Body>
                        {members.map((member, index) => (
                          <Table.Row
                            key={member.email || index}
                            className="border-b border-separator last:border-none hover:bg-surface-secondary/20"
                          >
                            <Table.Cell className="font-bold text-foreground text-xs py-4">
                              {member.name}
                            </Table.Cell>
                            <Table.Cell className="text-muted text-xs py-4">
                              {member.email}
                            </Table.Cell>
                            <Table.Cell className="py-4">
                              <Chip
                                color={getRoleStyle(member.role)}
                                variant="soft"
                                size="sm"
                                className="font-semibold text-[10px] uppercase"
                              >
                                {member.role}
                              </Chip>
                            </Table.Cell>
                            <Table.Cell className="py-4">
                              <Chip
                                color={getStatusStyle(member.status)}
                                variant="soft"
                                size="sm"
                                className="font-semibold text-[10px] uppercase"
                              >
                                {member.status}
                              </Chip>
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
              <div className="p-4 border-t border-separator">
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
        </div>

        {/* Right Column: Switching & Linked Accounts Widget */}
        <div className="space-y-6">
          <Card className="p-6 border border-border bg-surface rounded-2xl">
            <Typography
              type="h4"
              className="font-bold text-foreground mb-4 flex items-center gap-2"
            >
              <Users className="text-accent" size={18} />
              Linked Organizations
            </Typography>
            <Typography type="body-xs" className="text-muted leading-relaxed mb-4">
              This overview shows other enterprise tenant configurations linked to your user account.
            </Typography>
            <div className="space-y-2">
              {workspaceDetails.linkedOrganizations.length === 0 ? (
                <div className="text-xs text-muted/60 bg-surface-secondary/40 p-4 rounded-xl text-center">
                  No other linked organizations.
                </div>
              ) : (
                workspaceDetails.linkedOrganizations.map((org) => (
                  <button
                    key={org.slug}
                    onClick={() => handleSwitchOrganization(org.slug)}
                    className="w-full flex items-center justify-between p-3.5 rounded-xl border border-border bg-surface-secondary/30 hover:bg-surface-secondary/80 text-left transition-all group cursor-pointer text-xs font-semibold"
                  >
                    <div>
                      <div className="text-foreground group-hover:text-accent font-bold">
                        {org.name}
                      </div>
                      <div className="text-muted text-[10px] font-mono mt-0.5">
                        @{org.slug}
                      </div>
                    </div>
                    <RotateCw
                      size={14}
                      className="text-muted group-hover:text-accent group-hover:rotate-45 transition-all"
                    />
                  </button>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default WorkspaceMembersView;
