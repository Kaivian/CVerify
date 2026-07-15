"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Table,
  Card,
  Spinner,
  Tabs,
  Chip,
  toast,
  Button
} from "@heroui/react";
import { SelectDropdown } from "@/components/ui/select-dropdown";
import {
  ShieldAlert,
  Users,
  Search,
  AlertTriangle,
  FileText,
  Clock,
  X,
  ChevronRight,
  RotateCw,
  AlertCircle
} from "lucide-react";
import {
  enterpriseAdminService,
  type OrganizationAdminListItem,
  type EnterpriseWorkflowRequestListItem,
  type EnterpriseWorkflowRequestDetail,
  type OrganizationAdminDetail,
  type WorkflowDashboardStats
} from "../services/enterprise-admin.service";
import { adminService } from "../services/admin.service";
import { type AuditLogListItem } from "@/types/admin.types";
import { useNotificationStore } from "@/stores/use-notification-store";
import { PaginationWrapper } from "@/components/ui/pagination-wrapper";
import { SkeletonLoader, EmptyState } from "@/components/ui/states";
import { useAuthStore } from "@/features/auth/store/use-auth-store";

export function EnterpriseOperationsView() {
  const currentUser = useAuthStore((s) => s.user);
  const notifications = useNotificationStore((s) => s.notifications);

  // Stats
  const [stats, setStats] = useState<WorkflowDashboardStats | null>(null);
  const [isStatsLoading, setIsStatsLoading] = useState(true);

  // Queues data
  const [requests, setRequests] = useState<EnterpriseWorkflowRequestListItem[]>([]);
  const [organizations, setOrganizations] = useState<OrganizationAdminListItem[]>([]);

  // Pagination & Loading
  const [activeTab, setActiveTab] = useState<string>("requests");
  const [isLoading, setIsLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [slaFilter, setSlaFilter] = useState<boolean | undefined>(undefined);

  // Detail Drawer state
  const [selectedRequest, setSelectedRequest] = useState<EnterpriseWorkflowRequestDetail | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<OrganizationAdminDetail | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogListItem[]>([]);
  const [isLogsLoading, setIsLogsLoading] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<string>("info");

  // Interaction Modal states
  const [resolutionStatus, setResolutionStatus] = useState<"Approved" | "Rejected" | "Resolved" | "Dismissed" | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [orgStatusChange, setOrgStatusChange] = useState<string | null>(null);
  const [orgStatusReason, setOrgStatusReason] = useState("");
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch Dashboard Stats
  const fetchStats = async () => {
    setIsStatsLoading(true);
    try {
      const data = await enterpriseAdminService.getStats();
      setStats(data);
    } catch (err) {
      console.error("Failed to load queue metrics", err);
    } finally {
      setIsStatsLoading(false);
    }
  };

  // Fetch Requests Queue
  const fetchRequests = useCallback(async (currentPage: number, silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const result = await enterpriseAdminService.getRequests({
        requestType: typeFilter || undefined,
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        slaBreached: slaFilter,
        page: currentPage,
        pageSize
      });
      setRequests(result.items);
      setTotalCount(result.totalCount);
    } catch (err) {
      console.error("Failed to fetch requests", err);
      toast.danger("Failed to load requests queue", {
        description: "Check your permissions or API service status."
      });
    } finally {
      setIsLoading(false);
    }
  }, [typeFilter, statusFilter, priorityFilter, slaFilter, pageSize]);

  // Fetch Organizations list
  const fetchOrganizations = useCallback(async (currentPage: number, silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const result = await enterpriseAdminService.getOrganizations({
        search: search || undefined,
        status: statusFilter || undefined,
        page: currentPage,
        pageSize
      });
      setOrganizations(result.items);
      setTotalCount(result.totalCount);
    } catch (err) {
      console.error("Failed to fetch organizations", err);
      toast.danger("Failed to load organization directory", {
        description: "Check your permissions or API service status."
      });
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter, pageSize]);

  // Load appropriate data based on active tab
  useEffect(() => {
    setPage(1);
    if (activeTab === "requests") {
      fetchRequests(1);
    } else {
      fetchOrganizations(1);
    }
  }, [activeTab, fetchRequests, fetchOrganizations]);

  // Fetch pagination page changes
  useEffect(() => {
    if (activeTab === "requests") {
      fetchRequests(page);
    } else {
      fetchOrganizations(page);
    }
  }, [page, fetchRequests, fetchOrganizations]);

  // Initial Stats Fetch
  useEffect(() => {
    fetchStats();
  }, []);

  // Listen to SignalR refresh alerts via Zustand store
  useEffect(() => {
    if (notifications.length > 0) {
      const latest = notifications[0];
      const payloadType = (latest.payload as any)?.type || (latest.payload as any)?.Type;
      if (latest.notificationType === "ENTERPRISE_QUEUE_STATS_REFRESH" || payloadType === "ENTERPRISE_QUEUE_STATS_REFRESH") {
        fetchStats();
        if (activeTab === "requests") {
          fetchRequests(page, true);
        } else {
          fetchOrganizations(page, true);
        }
      }
    }
  }, [notifications, activeTab, page, fetchRequests, fetchOrganizations]);

  // Handle row selection - open drawer and load secondary assets
  const handleSelectRequest = async (req: EnterpriseWorkflowRequestListItem) => {
    setSelectedOrg(null);
    setIsDrawerOpen(true);
    setDrawerTab("info");
    try {
      const detail = await enterpriseAdminService.getRequest(req.id);
      setSelectedRequest(detail);
      loadAuditLogs(detail.organizationId);
    } catch (err) {
      console.error("Failed to load request details", err);
      toast.danger("Failed to load details");
    }
  };

  const handleSelectOrg = async (org: OrganizationAdminListItem) => {
    setSelectedRequest(null);
    setIsDrawerOpen(true);
    setDrawerTab("info");
    try {
      const detail = await enterpriseAdminService.getOrganization(org.id);
      setSelectedOrg(detail);
      loadAuditLogs(detail.id);
    } catch (err) {
      console.error("Failed to load organization details", err);
      toast.danger("Failed to load details");
    }
  };

  const loadAuditLogs = async (orgId: string) => {
    setIsLogsLoading(true);
    try {
      const response = await adminService.getAuditLogs({
        organizationId: orgId,
        page: 1,
        pageSize: 10
      });
      setAuditLogs(response.items);
    } catch (err) {
      console.error("Failed to load audit logs", err);
    } finally {
      setIsLogsLoading(false);
    }
  };

  // Actions
  const handleClaim = async () => {
    if (!selectedRequest) return;
    setIsSubmitting(true);
    try {
      await enterpriseAdminService.claimRequest(selectedRequest.id);
      toast.success("Request claimed", { description: "You are now assigned as the reviewer." });
      // Reload
      const detail = await enterpriseAdminService.getRequest(selectedRequest.id);
      setSelectedRequest(detail);
      fetchStats();
      fetchRequests(page, true);
    } catch (err: any) {
      if (err.response?.status === 409) {
        toast.danger("Conflict occurred", { description: "This request has already been claimed by another administrator." });
      } else {
        toast.danger("Failed to claim request");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnclaim = async () => {
    if (!selectedRequest) return;
    setIsSubmitting(true);
    try {
      await enterpriseAdminService.unclaimRequest(selectedRequest.id);
      toast.success("Request released", { description: "The request has been returned to the pending queue." });
      // Reload
      const detail = await enterpriseAdminService.getRequest(selectedRequest.id);
      setSelectedRequest(detail);
      fetchStats();
      fetchRequests(page, true);
    } catch (err) {
      toast.danger("Failed to release request");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEscalate = async () => {
    if (!selectedRequest) return;
    setIsSubmitting(true);
    try {
      await enterpriseAdminService.escalateRequest(selectedRequest.id);
      toast.warning("Request Escalated", { description: "Marked as critical and sent to senior queue." });
      // Reload
      const detail = await enterpriseAdminService.getRequest(selectedRequest.id);
      setSelectedRequest(detail);
      fetchStats();
      fetchRequests(page, true);
    } catch (err) {
      toast.danger("Failed to escalate request");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedRequest || !resolutionStatus) return;
    setIsSubmitting(true);
    try {
      await enterpriseAdminService.resolveRequest(selectedRequest.id, {
        status: resolutionStatus,
        notes: resolutionNotes
      });
      toast.success(`Request ${resolutionStatus}`);
      setResolutionStatus(null);
      setResolutionNotes("");
      setIsDrawerOpen(false);
      fetchStats();
      fetchRequests(page);
    } catch (err) {
      toast.danger("Failed to resolve request");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOrgStatusUpdate = async () => {
    if (!selectedOrg || !orgStatusChange) return;
    setIsSubmitting(true);
    try {
      await enterpriseAdminService.updateOrganizationStatus(selectedOrg.id, {
        status: orgStatusChange,
        reason: orgStatusReason
      });
      toast.success(`Organization status updated to ${orgStatusChange}`);
      setOrgStatusChange(null);
      setOrgStatusReason("");
      setIsDrawerOpen(false);
      fetchOrganizations(page);
    } catch (err) {
      toast.danger("Failed to update organization status");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddComment = async () => {
    if (!selectedRequest || !newComment.trim()) return;
    try {
      const comment = await enterpriseAdminService.addComment(selectedRequest.id, newComment);
      setSelectedRequest({
        ...selectedRequest,
        comments: [...selectedRequest.comments, comment]
      });
      setNewComment("");
    } catch (err) {
      toast.danger("Failed to add note");
    }
  };

  const handleSeedDemo = async () => {
    try {
      await enterpriseAdminService.seedDemoRequests();
      toast.success("Demo Requests Seeded", { description: "Seeded 3 requests. Refreshing data." });
      fetchStats();
      if (activeTab === "requests") fetchRequests(1);
    } catch (err: any) {
      toast.danger("Failed to seed requests", { description: err.response?.data || "Already seeded." });
    }
  };

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("");
    setPriorityFilter("");
    setTypeFilter("");
    setSlaFilter(undefined);
  };

  const getPriorityColor = (p: string): "default" | "success" | "warning" | "danger" | "accent" => {
    switch (p) {
      case "Critical": return "danger";
      case "High": return "warning";
      case "Medium": return "accent";
      default: return "default";
    }
  };

  const getStatusColor = (s: string): "default" | "success" | "warning" | "danger" | "accent" => {
    switch (s) {
      case "Approved":
      case "Resolved":
      case "active":
        return "success";
      case "Pending":
        return "warning";
      case "UnderReview":
        return "accent";
      case "Escalated":
        return "danger";
      case "suspended":
        return "danger";
      default:
        return "default";
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="flex flex-col gap-6 p-6 min-h-screen bg-background text-foreground">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Enterprise Operations</h1>
          <p className="text-sm text-muted">
            Operational center for verifications, lifecycle requests, recoveries, abuse reports, and audits.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSeedDemo}
            className="rounded-xl"
          >
            Seed Demo Requests
          </Button>
          <Button
            size="sm"
            onClick={() => { fetchStats(); if (activeTab === "requests") fetchRequests(page); else fetchOrganizations(page); }}
            className="rounded-xl"
          >
            <RotateCw className="h-4 w-4 mr-1.5" />
            Refresh Data
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 flex flex-row items-center gap-4 bg-default-50 border border-divider">
          <div className="p-3 bg-warning-50 text-warning rounded-lg">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xs text-muted font-bold block uppercase tracking-wider">Pending Requests</span>
            <span className="text-2xl font-black">{isStatsLoading ? <Spinner size="sm" /> : stats?.pendingCount}</span>
          </div>
        </Card>
        <Card className="p-4 flex flex-row items-center gap-4 bg-default-50 border border-divider">
          <div className="p-3 bg-primary-50 text-primary rounded-lg">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xs text-muted font-bold block uppercase tracking-wider">Claimed by Me</span>
            <span className="text-2xl font-black">{isStatsLoading ? <Spinner size="sm" /> : stats?.claimedCount}</span>
          </div>
        </Card>
        <Card className="p-4 flex flex-row items-center gap-4 bg-default-50 border border-divider">
          <div className="p-3 bg-danger-50 text-danger rounded-lg">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xs text-muted font-bold block uppercase tracking-wider">SLA Breaches</span>
            <span className="text-2xl font-black text-danger">{isStatsLoading ? <Spinner size="sm" /> : stats?.slaBreachedCount}</span>
          </div>
        </Card>
        <Card className="p-4 flex flex-row items-center gap-4 bg-default-50 border border-divider">
          <div className="p-3 bg-danger-100 text-danger rounded-lg">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xs text-muted font-bold block uppercase tracking-wider">Critical Risk</span>
            <span className="text-2xl font-black text-danger">{isStatsLoading ? <Spinner size="sm" /> : stats?.highRiskCount}</span>
          </div>
        </Card>
      </div>

      {/* Tabs Menu */}
      <div className="border-b border-divider">
        <Tabs
          aria-label="Enterprise operations queue tabs"
          className="w-full"
          variant="secondary"
          selectedKey={activeTab}
          onSelectionChange={(k) => setActiveTab(k as string)}
        >
          <Tabs.ListContainer>
            <Tabs.List className="flex items-center gap-4 h-10 border-b border-divider w-full">
              <Tabs.Tab id="requests" className="flex items-center justify-center h-full pb-3">
                <span className="font-semibold text-foreground text-sm">Workflow Requests Queue</span>
                <Tabs.Indicator className="bottom-0!" />
              </Tabs.Tab>
              <Tabs.Tab id="organizations" className="flex items-center justify-center h-full pb-3">
                <span className="font-semibold text-foreground text-sm">Organization Directory</span>
                <Tabs.Indicator className="bottom-0!" />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>
      </div>

      {/* Advanced Filtering */}
      <div className="p-4 bg-default-50 border border-divider rounded-xl flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center flex-1 max-w-4xl">
          {activeTab === "organizations" && (
            <div className="relative max-w-xs w-full">
              <Search size={16} className="absolute left-3 top-2.5 text-muted" />
              <input
                type="text"
                placeholder="Search orgs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-1.5 bg-background text-foreground text-sm border border-divider rounded-xl focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          )}

          {activeTab === "requests" && (
            <>
              <div className="w-40">
                <SelectDropdown
                  value={typeFilter}
                  onChange={setTypeFilter}
                  placeholder="All Types"
                  options={[
                    { value: "", label: "All Types" },
                    { value: "Registration", label: "Registration" },
                    { value: "Verification", label: "Verification" },
                    { value: "Recovery", label: "Recovery" },
                    { value: "Report", label: "Abuse Report" },
                    { value: "Appeal", label: "Appeal" },
                    { value: "OwnershipTransfer", label: "Ownership Claim" },
                  ]}
                />
              </div>

              <div className="w-40">
                <SelectDropdown
                  value={priorityFilter}
                  onChange={setPriorityFilter}
                  placeholder="All Priorities"
                  options={[
                    { value: "", label: "All Priorities" },
                    { value: "Low", label: "Low" },
                    { value: "Medium", label: "Medium" },
                    { value: "High", label: "High" },
                    { value: "Critical", label: "Critical" },
                  ]}
                />
              </div>
            </>
          )}

          <div className="w-40">
            <SelectDropdown
              value={statusFilter}
              onChange={setStatusFilter}
              placeholder="All Statuses"
              options={
                activeTab === "requests"
                  ? [
                    { value: "", label: "All Statuses" },
                    { value: "Pending", label: "Pending" },
                    { value: "UnderReview", label: "Under Review" },
                    { value: "Escalated", label: "Escalated" },
                    { value: "Approved", label: "Approved" },
                    { value: "Rejected", label: "Rejected" },
                  ]
                  : [
                    { value: "", label: "All Statuses" },
                    { value: "active", label: "Active" },
                    { value: "suspended", label: "Suspended" },
                  ]
              }
            />
          </div>

          {activeTab === "requests" && (
            <div className="w-40">
              <SelectDropdown
                value={slaFilter === undefined ? "" : slaFilter ? "true" : "false"}
                onChange={(val) => setSlaFilter(val === "" ? undefined : val === "true")}
                placeholder="SLA Status"
                options={[
                  { value: "", label: "SLA Status" },
                  { value: "true", label: "Breached Only" },
                  { value: "false", label: "Healthy Only" },
                ]}
              />
            </div>
          )}
        </div>
        <Button size="sm" variant="secondary" className="rounded-xl" onClick={resetFilters}>Reset Filters</Button>
      </div>

      {/* Main Content Workspace Tables */}
      {isLoading ? (
        <SkeletonLoader rows={6} columns={6} />
      ) : activeTab === "requests" ? (
        requests.length === 0 ? (
          <EmptyState title="No requests found" description="Adjust your filters or query parameters." />
        ) : (
          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label="Requests queue">
                <Table.Header>
                  <Table.Column isRowHeader className="font-extrabold uppercase text-[10px] tracking-wider py-4 px-6 text-muted">ORGANIZATION</Table.Column>
                  <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4 px-6 text-muted">TYPE</Table.Column>
                  <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4 px-6 text-muted">PRIORITY</Table.Column>
                  <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4 px-6 text-muted">STATUS</Table.Column>
                  <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4 px-6 text-muted">REVIEWER</Table.Column>
                  <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4 px-6 text-muted">DUE AT</Table.Column>
                  <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4 px-6 text-muted">SLA STATUS</Table.Column>
                  <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4 px-6 text-muted text-right">ACTION</Table.Column>
                </Table.Header>
                <Table.Body>
                  {requests.map((r) => (
                    <Table.Row
                      key={r.id}
                      onPress={() => handleSelectRequest(r)}
                      className="border-b border-separator last:border-none hover:bg-surface-secondary/40 cursor-pointer transition-colors"
                    >
                      <Table.Cell className="font-bold py-4 px-6">{r.organizationName}</Table.Cell>
                      <Table.Cell className="py-4 px-6">{r.requestType}</Table.Cell>
                      <Table.Cell className="py-4 px-6">
                        <Chip size="sm" color={getPriorityColor(r.priority)} variant="soft">{r.priority}</Chip>
                      </Table.Cell>
                      <Table.Cell className="py-4 px-6">
                        <Chip size="sm" color={getStatusColor(r.status)} variant="soft">{r.status}</Chip>
                      </Table.Cell>
                      <Table.Cell className="text-sm py-4 px-6">{r.assignedReviewerName || <span className="text-default-400">Unassigned</span>}</Table.Cell>
                      <Table.Cell className="text-xs text-muted py-4 px-6">{r.dueAt ? new Date(r.dueAt).toLocaleString() : "-"}</Table.Cell>
                      <Table.Cell className="py-4 px-6">
                        {r.slaBreached ? (
                          <Chip size="sm" color="danger" variant="soft">
                            <span className="flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              Breached
                            </span>
                          </Chip>
                        ) : (
                          <Chip size="sm" color="success" variant="soft">Healthy</Chip>
                        )}
                      </Table.Cell>
                      <Table.Cell className="py-4 px-6 text-right">
                        <span className="inline-flex items-center text-xs font-semibold text-primary">
                          Review <ChevronRight className="h-4 w-4 ml-1" />
                        </span>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        )
      ) : (
        organizations.length === 0 ? (
          <EmptyState title="No organizations found" description="Adjust search query." />
        ) : (
          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label="Organizations directory">
                <Table.Header>
                  <Table.Column isRowHeader className="font-extrabold uppercase text-[10px] tracking-wider py-4 px-6 text-muted">ORGANIZATION NAME</Table.Column>
                  <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4 px-6 text-muted">TAX CODE</Table.Column>
                  <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4 px-6 text-muted">EMAIL</Table.Column>
                  <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4 px-6 text-muted">VERIFICATION LEVEL</Table.Column>
                  <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4 px-6 text-muted">STATUS</Table.Column>
                  <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4 px-6 text-muted">RISK SCORE</Table.Column>
                  <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4 px-6 text-muted text-right">ACTION</Table.Column>
                </Table.Header>
                <Table.Body>
                  {organizations.map((org) => (
                    <Table.Row
                      key={org.id}
                      onPress={() => handleSelectOrg(org)}
                      className="border-b border-separator last:border-none hover:bg-surface-secondary/40 cursor-pointer transition-colors"
                    >
                      <Table.Cell className="font-bold py-4 px-6">{org.name}</Table.Cell>
                      <Table.Cell className="py-4 px-6">{org.taxCode}</Table.Cell>
                      <Table.Cell className="py-4 px-6">{org.email}</Table.Cell>
                      <Table.Cell className="py-4 px-6">
                        <Chip size="sm" color={org.isVerified ? "success" : "default"}>
                          {org.isVerified ? `Level ${org.verificationLevel}` : "Unverified"}
                        </Chip>
                      </Table.Cell>
                      <Table.Cell className="py-4 px-6">
                        <Chip size="sm" color={getStatusColor(org.status)} variant="soft">{org.status}</Chip>
                      </Table.Cell>
                      <Table.Cell className="py-4 px-6">
                        {org.riskScore > 0 ? (
                          <span className={org.riskScore >= 70 ? "text-danger font-bold animate-pulse" : "text-warning font-semibold"}>{org.riskScore} Flags</span>
                        ) : (
                          <span className="text-success">0</span>
                        )}
                      </Table.Cell>
                      <Table.Cell className="py-4 px-6 text-right">
                        <span className="inline-flex items-center text-xs font-semibold text-primary">
                          Manage <ChevronRight className="h-4 w-4 ml-1" />
                        </span>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        )
      )}

      {/* Pagination */}
      {totalCount > pageSize && (
        <div className="flex justify-center mt-4">
          <PaginationWrapper
            page={page}
            totalPages={totalPages}
            totalItems={totalCount}
            itemsPerPage={pageSize}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* Details Drawer */}
      {isDrawerOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end">
          <div className="bg-background w-full max-w-2xl h-full shadow-2xl p-6 overflow-y-auto flex flex-col gap-6">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-divider pb-4">
              <div>
                <h2 className="text-xl font-bold">
                  {selectedRequest ? selectedRequest.organizationName : selectedOrg?.name}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <Chip size="sm" color={getStatusColor(selectedRequest ? selectedRequest.status : selectedOrg?.status || "default")}>
                    {selectedRequest ? selectedRequest.status : selectedOrg?.status}
                  </Chip>
                  {selectedRequest && (
                    <Chip size="sm" variant="soft">{selectedRequest.requestType}</Chip>
                  )}
                </div>
              </div>
              <Button variant="secondary" onClick={() => setIsDrawerOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Drawer Tabs */}
            <Tabs
              aria-label="Request details tabs"
              variant="secondary"
              selectedKey={drawerTab}
              onSelectionChange={(k) => setDrawerTab(k as string)}
            >
              <Tabs.ListContainer>
                <Tabs.List className="flex items-center gap-4 h-10 border-b border-divider w-full">
                  <Tabs.Tab id="info" className="pb-3">
                    <span className="font-semibold text-sm">Overview</span>
                    <Tabs.Indicator className="bottom-0!" />
                  </Tabs.Tab>
                  {selectedOrg && (
                    <Tabs.Tab id="workspaces" className="pb-3">
                      <span className="font-semibold text-sm">Workspaces</span>
                      <Tabs.Indicator className="bottom-0!" />
                    </Tabs.Tab>
                  )}
                  <Tabs.Tab id="timeline" className="pb-3">
                    <span className="font-semibold text-sm">Audit Logs</span>
                    <Tabs.Indicator className="bottom-0!" />
                  </Tabs.Tab>
                  {selectedRequest && (
                    <Tabs.Tab id="notes" className="pb-3">
                      <span className="font-semibold text-sm">Notes & Comments</span>
                      <Tabs.Indicator className="bottom-0!" />
                    </Tabs.Tab>
                  )}
                </Tabs.List>
              </Tabs.ListContainer>
            </Tabs>

            {/* Tab 1: Info */}
            {drawerTab === "info" && (
              <div className="flex flex-col gap-4">
                {selectedRequest && (
                  <div className="grid grid-cols-2 gap-4 p-4 bg-default-50 border border-divider rounded-lg">
                    <div>
                      <span className="text-xs text-muted block font-bold uppercase tracking-wider">Priority</span>
                      <Chip color={getPriorityColor(selectedRequest.priority)} size="sm" variant="soft">{selectedRequest.priority}</Chip>
                    </div>
                    <div>
                      <span className="text-xs text-muted block font-bold uppercase tracking-wider">Due SLA</span>
                      <span className="text-sm font-semibold">
                        {selectedRequest.dueAt ? new Date(selectedRequest.dueAt).toLocaleString() : "No deadline"}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-muted block font-bold uppercase tracking-wider">Reviewer</span>
                      <span className="text-sm font-semibold">{selectedRequest.assignedReviewerName || "Unassigned"}</span>
                    </div>
                    <div>
                      <span className="text-xs text-muted block font-bold uppercase tracking-wider">Created</span>
                      <span className="text-sm font-semibold">{new Date(selectedRequest.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                )}

                {/* Main metadata representation */}
                <div>
                  <h3 className="text-md font-bold mb-2">Metadata Details</h3>
                  <div className="flex flex-col gap-2 p-4 bg-default-50 border border-divider rounded-lg text-sm">
                    {selectedOrg ? (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted">Tax Code:</span>
                          <span className="font-semibold">{selectedOrg.taxCode}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted">Email:</span>
                          <span className="font-semibold">{selectedOrg.email}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted">Website:</span>
                          <span className="font-semibold">{selectedOrg.website || "-"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted">Representative:</span>
                          <span className="font-semibold">{selectedOrg.representativeName || "-"}</span>
                        </div>
                      </>
                    ) : (
                      <pre className="text-xs bg-default-100 p-2 rounded max-h-40 overflow-auto">
                        {JSON.stringify(JSON.parse(selectedRequest?.metadataJson || "{}"), null, 2)}
                      </pre>
                    )}
                  </div>
                </div>

                {/* Attachments Section */}
                {selectedRequest && selectedRequest.attachments.length > 0 && (
                  <div>
                    <h3 className="text-md font-bold mb-2">Uploaded Proof Documents</h3>
                    <div className="flex flex-col gap-2">
                      {selectedRequest.attachments.map((file) => (
                        <div key={file.id} className="flex items-center justify-between p-3 bg-default-50 border border-divider rounded-lg">
                          <div className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-muted" />
                            <span className="text-sm font-medium">{file.fileName}</span>
                          </div>
                          <Button variant="outline">Download</Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action forms inside Overview */}
                <div className="border-t border-divider pt-4 flex flex-col gap-4">
                  {selectedRequest && (
                    <div className="flex gap-2">
                      {selectedRequest.assignedReviewerId === null ? (
                        <Button className="flex-1" variant="primary" onClick={handleClaim} isPending={isSubmitting}>
                          Claim Review
                        </Button>
                      ) : selectedRequest.assignedReviewerId === currentUser?.id ? (
                        <>
                          <Button className="flex-1" variant="secondary" onClick={handleUnclaim} isPending={isSubmitting}>
                            Unclaim
                          </Button>
                          <Button className="flex-1" variant="danger-soft" onClick={handleEscalate} isPending={isSubmitting}>
                            Escalate
                          </Button>
                          <Button className="flex-1" variant="primary" onClick={() => setResolutionStatus("Approved")} isPending={isSubmitting}>
                            Approve
                          </Button>
                          <Button className="flex-1" variant="danger" onClick={() => setResolutionStatus("Rejected")} isPending={isSubmitting}>
                            Reject
                          </Button>
                        </>
                      ) : (
                        <Button className="flex-1" isDisabled variant="outline">
                          Claimed by {selectedRequest.assignedReviewerName}
                        </Button>
                      )}
                    </div>
                  )}

                  {selectedOrg && (
                    <div className="flex gap-2">
                      {selectedOrg.status === "suspended" ? (
                        <Button className="flex-1" variant="primary" onClick={() => { setOrgStatusChange("active"); }} isPending={isSubmitting}>
                          Lift Suspension
                        </Button>
                      ) : (
                        <Button className="flex-1" variant="danger" onClick={() => { setOrgStatusChange("suspended"); }} isPending={isSubmitting}>
                          Suspend Organization
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab 2: Workspaces */}
            {drawerTab === "workspaces" && selectedOrg && (
              <div className="flex flex-col gap-4">
                <h3 className="text-md font-bold">Active Workspaces ({selectedOrg.workspaces.length})</h3>
                {selectedOrg.workspaces.length === 0 ? (
                  <EmptyState title="No workspaces" description="This organization hasn't setup workspaces." />
                ) : (
                  <div className="flex flex-col gap-2">
                    {selectedOrg.workspaces.map((w) => (
                      <div key={w.id} className="p-3 bg-default-50 border border-divider rounded-lg flex justify-between items-center">
                        <div>
                          <span className="font-semibold block">{w.name}</span>
                          <span className="text-xs text-muted block">{w.description || "No description"}</span>
                        </div>
                        <Chip size="sm" variant="soft">{w.memberCount} members</Chip>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Timeline & Audit logs */}
            {drawerTab === "timeline" && (
              <div className="flex flex-col gap-4">
                <h3 className="text-md font-bold">Audit History Trail</h3>
                {isLogsLoading ? (
                  <Spinner />
                ) : auditLogs.length === 0 ? (
                  <EmptyState title="No logs" description="No administrative logs for this organization." />
                ) : (
                  <div className="flex flex-col gap-3">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="p-3 bg-default-50 border border-divider rounded-lg text-sm">
                        <div className="flex justify-between font-bold mb-1">
                          <span>{log.eventType}</span>
                          <span className="text-xs font-normal text-muted">{new Date(log.createdAt).toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-muted mb-1">{log.description}</p>
                        <span className="text-[10px] text-primary">Actor: {log.userEmail || "System"}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 4: Review Comments */}
            {drawerTab === "notes" && selectedRequest && (
              <div className="flex flex-col gap-4">
                <h3 className="text-md font-bold">Review Notes</h3>
                <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
                  {selectedRequest.comments.length === 0 ? (
                    <span className="text-sm text-default-400 text-center py-4">No internal notes added.</span>
                  ) : (
                    selectedRequest.comments.map((comment) => (
                      <div key={comment.id} className="p-3 bg-default-50 border border-divider rounded-lg">
                        <div className="flex justify-between text-xs text-muted mb-1">
                          <span className="font-bold">{comment.authorName}</span>
                          <span>{new Date(comment.createdAt).toLocaleString()}</span>
                        </div>
                        <p className="text-sm">{comment.content}</p>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex flex-col gap-2 pt-4 border-t border-divider">
                  <textarea
                    className="w-full bg-background text-foreground border border-divider rounded-xl p-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary min-h-[80px]"
                    placeholder="Type internal reviewer note..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                  />
                  <div className="flex justify-end">
                    <Button size="sm" variant="primary" onClick={handleAddComment} isDisabled={!newComment.trim()}>
                      Add Note
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Resolution Decision Modal */}
      {resolutionStatus && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-background border border-divider p-6 rounded-xl w-full max-w-md shadow-2xl flex flex-col gap-4">
            <h3 className="text-lg font-bold">Resolve Workflow Request</h3>
            <p className="text-sm text-muted">
              Submit your final decision of <span className="font-semibold text-primary">{resolutionStatus}</span>. This will trigger email alerts and system updates.
            </p>
            <textarea
              className="w-full bg-background text-foreground border border-divider rounded-xl p-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary min-h-[100px]"
              placeholder="Provide policy justification or detail reasons..."
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button size="sm" variant="outline" onClick={() => { setResolutionStatus(null); setResolutionNotes(""); }}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" onClick={handleResolve} isPending={isSubmitting}>
                Submit Decision
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Org Suspension Modal */}
      {orgStatusChange && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-background border border-divider p-6 rounded-xl w-full max-w-md shadow-2xl flex flex-col gap-4">
            <h3 className="text-lg font-bold">
              {orgStatusChange === "suspended" ? "Suspend Organization" : "Lift Suspension"}
            </h3>
            <p className="text-sm text-muted">
              {orgStatusChange === "suspended"
                ? "This will freeze all user access, block invitation processing, and flag jobs as unmoderated."
                : "This will restore full access to all workspaces and activate organization profiles."}
            </p>
            <textarea
              className="w-full bg-background text-foreground border border-divider rounded-xl p-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary min-h-[100px]"
              placeholder="Detail reasons for status change..."
              value={orgStatusReason}
              onChange={(e) => setOrgStatusReason(e.target.value)}
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button size="sm" variant="outline" onClick={() => { setOrgStatusChange(null); setOrgStatusReason(""); }}>
                Cancel
              </Button>
              <Button size="sm" variant="danger" onClick={handleOrgStatusUpdate} isPending={isSubmitting}>
                Confirm Status Change
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
