"use client";

import React, { useState, useEffect, useCallback } from "react";
import { adminService } from "@/services/admin.service";
import { type AuditLogListItem, type AuditLogsStats } from "@/types/admin.types";
import { Table, Button, Card, Typography, Spinner, Dropdown, DatePicker, DateField, Calendar } from "@heroui/react";
import { parseDate } from "@internationalized/date";
import { SelectDropdown } from "@/components/ui/select-dropdown";
import {
  Search,
  RotateCw,
  FileText,
  Settings,
  Users,
  CheckCircle,
  Download,
  Layers,
  ShieldAlert,
  ArrowRight
} from "lucide-react";
import { PaginationWrapper } from "@/components/ui/pagination-wrapper";
import { SkeletonLoader, EmptyState } from "@/components/ui/states";
import { AuditDetailDrawer } from "./audit-detail-drawer";

export function AuditLogsView() {
  const [logs, setLogs] = useState<AuditLogListItem[]>([]);
  const [stats, setStats] = useState<AuditLogsStats | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);

  // Search & Filter state
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedAuditId, setSelectedAuditId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Debounced search logic
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);

    return () => clearTimeout(handler);
  }, [search]);

  // Fetch logs
  const fetchLogs = useCallback(
    async (currentPage: number, silent = false) => {
      if (!silent) setIsLoading(true);
      try {
        const response = await adminService.getAuditLogs({
          search: debouncedSearch || undefined,
          category: category || undefined,
          resourceType: resourceType || undefined,
          startDate: startDate ? new Date(startDate).toISOString() : undefined,
          endDate: endDate ? new Date(endDate).toISOString() : undefined,
          page: currentPage,
          pageSize,
        });
        setLogs(response.items);
        setTotalCount(response.totalCount);
      } catch (err) {
        console.error("Failed to fetch audit logs", err);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [debouncedSearch, category, resourceType, startDate, endDate, pageSize],
  );

  // Fetch stats
  const fetchStats = async () => {
    setIsStatsLoading(true);
    try {
      const response = await adminService.getAuditLogsStats();
      setStats(response);
    } catch (err) {
      console.error("Failed to fetch audit stats", err);
    } finally {
      setIsStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(page);
  }, [page, fetchLogs]);

  useEffect(() => {
    fetchStats();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchLogs(page, true);
    fetchStats();
  };

  const handleOpenDetails = (id: string) => {
    setSelectedAuditId(id);
    setIsDrawerOpen(true);
  };

  const handleExport = (format: "csv" | "json") => {
    const url = adminService.getExportUrl({
      search: debouncedSearch || undefined,
      category: category || undefined,
      resourceType: resourceType || undefined,
      startDate: startDate ? new Date(startDate).toISOString() : undefined,
      endDate: endDate ? new Date(endDate).toISOString() : undefined,
      format,
    });
    window.open(url, "_blank");
    // Re-fetch stats to update the exports count
    setTimeout(() => fetchStats(), 2000);
  };

  const startDateValue = startDate ? parseDate(startDate) : null;
  const endDateValue = endDate ? parseDate(endDate) : null;

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  const getCategoryLabel = (cat: string) => {
    return cat.replace(/([A-Z])/g, " $1").trim();
  };

  return (
    <div className="space-y-6 font-outfit max-w-7xl mx-auto text-foreground p-4">
      {/* Title block */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Typography
            type="h2"
            className="text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2 font-display"
          >
            <FileText className="text-accent" size={24} />
            Compliance Audit Trail
          </Typography>
          <Typography type="body-sm" className="text-muted mt-1 font-outfit">
            Immutable log of administrative operations, configurations, memberships, and role adjustments.
          </Typography>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onPress={handleRefresh}
            className="rounded-xl"
          >
            <RotateCw size={14} className={isRefreshing ? "animate-spin" : ""} />
            Sync Dashboard
          </Button>
        </div>
      </div>

      {/* Stats Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Config Changes */}
        <Card className="p-4 bg-surface border border-border rounded-2xl shadow-surface flex flex-row items-center gap-4">
          <div className="p-3.5 rounded-xl bg-accent/10 text-accent border border-accent/10">
            <Settings size={20} />
          </div>
          <div>
            <span className="text-[10px] text-muted font-bold block uppercase tracking-wider">Config Changes</span>
            {isStatsLoading ? (
              <Spinner size="sm" className="mt-1" />
            ) : (
              <span className="text-xl font-extrabold text-foreground">{stats?.configChangesCount ?? 0}</span>
            )}
            <span className="text-[9px] text-muted block mt-0.5">Last 24 hours</span>
          </div>
        </Card>

        {/* Role Changes */}
        <Card className="p-4 bg-surface border border-border rounded-2xl shadow-surface flex flex-row items-center gap-4">
          <div className="p-3.5 rounded-xl bg-warning/10 text-warning border border-warning/10">
            <Users size={20} />
          </div>
          <div>
            <span className="text-[10px] text-muted font-bold block uppercase tracking-wider">Role Changes</span>
            {isStatsLoading ? (
              <Spinner size="sm" className="mt-1" />
            ) : (
              <span className="text-xl font-extrabold text-foreground">{stats?.roleChangesCount ?? 0}</span>
            )}
            <span className="text-[9px] text-muted block mt-0.5">Last 7 days</span>
          </div>
        </Card>

        {/* Verification Actions */}
        <Card className="p-4 bg-surface border border-border rounded-2xl shadow-surface flex flex-row items-center gap-4">
          <div className="p-3.5 rounded-xl bg-danger/10 text-danger border border-danger/10">
            <ShieldAlert size={20} />
          </div>
          <div>
            <span className="text-[10px] text-muted font-bold block uppercase tracking-wider">Verification Actions</span>
            {isStatsLoading ? (
              <Spinner size="sm" className="mt-1" />
            ) : (
              <span className="text-xl font-extrabold text-foreground">{stats?.pendingVerificationActionsCount ?? 0}</span>
            )}
            <span className="text-[9px] text-muted block mt-0.5">Pending reviewed</span>
          </div>
        </Card>

        {/* Exports */}
        <Card className="p-4 bg-surface border border-border rounded-2xl shadow-surface flex flex-row items-center gap-4">
          <div className="p-3.5 rounded-xl bg-success/10 text-success border border-success/10">
            <CheckCircle size={20} />
          </div>
          <div>
            <span className="text-[10px] text-muted font-bold block uppercase tracking-wider">Data Exports</span>
            {isStatsLoading ? (
              <Spinner size="sm" className="mt-1" />
            ) : (
              <span className="text-xl font-extrabold text-foreground">{stats?.exportsCount ?? 0}</span>
            )}
            <span className="text-[9px] text-muted block mt-0.5">This week</span>
          </div>
        </Card>
      </div>

      {/* Advanced Filter Banner */}
      <Card className="p-5 bg-surface border border-border rounded-2xl shadow-surface space-y-4">
        {/* Row 1: Search & Export */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex-1 w-full relative">
            <Search size={16} className="absolute left-3 top-3 text-muted" />
            <input
              type="text"
              placeholder="Search actor email, action type, description or resource..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-surface/50 text-xs focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div className="flex items-center gap-2">
            <Dropdown>
              <Dropdown.Trigger>
                <Button
                  variant="secondary"
                  className="rounded-xl"
                >
                  <Download size={14} />
                  Export Data
                </Button>
              </Dropdown.Trigger>
              <Dropdown.Popover className="border border-border rounded-xl bg-overlay shadow-overlay overflow-hidden min-w-[150px] z-50">
                <Dropdown.Menu aria-label="Export formats">
                  <Dropdown.Item
                    key="csv"
                    onClick={() => handleExport("csv")}
                    className="flex items-center px-3 py-2 text-xs font-semibold cursor-pointer text-foreground hover:bg-surface-secondary outline-none select-none transition-colors duration-150"
                  >
                    Export CSV
                  </Dropdown.Item>
                  <Dropdown.Item
                    key="json"
                    onClick={() => handleExport("json")}
                    className="flex items-center px-3 py-2 text-xs font-semibold cursor-pointer text-foreground hover:bg-surface-secondary outline-none select-none transition-colors duration-150"
                  >
                    Export JSON
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          </div>
        </div>

        {/* Row 2: Advanced Dropdowns */}
        <div className="flex flex-wrap gap-4 items-center text-xs pt-1 border-t border-separator/40">
          <div className="flex items-center gap-1.5 text-muted">
            <Layers size={13} />
            <span>Refine Audit Logs:</span>
          </div>

          {/* Category */}
          <div className="w-44">
            <SelectDropdown
              value={category}
              onChange={(val) => { setCategory(val); setPage(1); }}
              placeholder="All Categories"
              options={[
                { label: "All Categories", value: "" },
                { label: "Identity & Access", value: "IdentityAndAccess" },
                { label: "Roles & Permissions", value: "RolesAndPermissions" },
                { label: "Workspace Management", value: "WorkspaceManagement" },
                { label: "Verification Operations", value: "VerificationOperations" },
                { label: "Repository Admin", value: "RepositoryAdministration" },
                { label: "Portal Configuration", value: "PortalConfiguration" },
                { label: "Data Governance", value: "DataGovernance" },
                { label: "Rule Configuration", value: "SecurityRuleAdministration" },
                { label: "System Configuration", value: "SystemConfiguration" },
                { label: "Profile Configuration", value: "ProfileConfiguration" }
              ]}
            />
          </div>

          {/* Resource Type */}
          <div className="w-44">
            <SelectDropdown
              value={resourceType}
              onChange={(val) => { setResourceType(val); setPage(1); }}
              placeholder="All Resource Types"
              options={[
                { label: "All Resource Types", value: "" },
                { label: "User", value: "User" },
                { label: "Role", value: "Role" },
                { label: "Workspace", value: "Workspace" },
                { label: "Repository", value: "Repository" },
                { label: "Portal Settings", value: "PortalSettings" },
                { label: "Audit Log", value: "AuditLog" }
              ]}
            />
          </div>

          {/* Date pickers */}
          <div className="flex items-center gap-2">
            <div className="w-36">
              <DatePicker
                value={startDateValue}
                onChange={(val) => {
                  setStartDate(val ? val.toString() : "");
                  setPage(1);
                }}
                aria-label="Start Date"
                className="flex flex-col gap-1 w-full"
              >
                <DateField.Group fullWidth>
                  <DateField.Input>
                    {(segment) => <DateField.Segment segment={segment} />}
                  </DateField.Input>
                  <DateField.Suffix>
                    <DatePicker.Trigger>
                      <DatePicker.TriggerIndicator />
                    </DatePicker.Trigger>
                  </DateField.Suffix>
                </DateField.Group>
                <DatePicker.Popover>
                  <Calendar aria-label="Start Date">
                    <Calendar.Header>
                      <Calendar.YearPickerTrigger>
                        <Calendar.YearPickerTriggerHeading />
                        <Calendar.YearPickerTriggerIndicator />
                      </Calendar.YearPickerTrigger>
                      <Calendar.NavButton slot="previous" />
                      <Calendar.NavButton slot="next" />
                    </Calendar.Header>
                    <Calendar.Grid>
                      <Calendar.GridHeader>
                        {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
                      </Calendar.GridHeader>
                      <Calendar.GridBody>
                        {(date) => <Calendar.Cell date={date} />}
                      </Calendar.GridBody>
                    </Calendar.Grid>
                    <Calendar.YearPickerGrid>
                      <Calendar.YearPickerGridBody>
                        {({ year }) => <Calendar.YearPickerCell year={year} />}
                      </Calendar.YearPickerGridBody>
                    </Calendar.YearPickerGrid>
                  </Calendar>
                </DatePicker.Popover>
              </DatePicker>
            </div>

            <span className="text-muted text-[10px]">to</span>

            <div className="w-36">
              <DatePicker
                value={endDateValue}
                onChange={(val) => {
                  setEndDate(val ? val.toString() : "");
                  setPage(1);
                }}
                aria-label="End Date"
                className="flex flex-col gap-1 w-full"
              >
                <DateField.Group fullWidth>
                  <DateField.Input>
                    {(segment) => <DateField.Segment segment={segment} />}
                  </DateField.Input>
                  <DateField.Suffix>
                    <DatePicker.Trigger>
                      <DatePicker.TriggerIndicator />
                    </DatePicker.Trigger>
                  </DateField.Suffix>
                </DateField.Group>
                <DatePicker.Popover>
                  <Calendar aria-label="End Date">
                    <Calendar.Header>
                      <Calendar.YearPickerTrigger>
                        <Calendar.YearPickerTriggerHeading />
                        <Calendar.YearPickerTriggerIndicator />
                      </Calendar.YearPickerTrigger>
                      <Calendar.NavButton slot="previous" />
                      <Calendar.NavButton slot="next" />
                    </Calendar.Header>
                    <Calendar.Grid>
                      <Calendar.GridHeader>
                        {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
                      </Calendar.GridHeader>
                      <Calendar.GridBody>
                        {(date) => <Calendar.Cell date={date} />}
                      </Calendar.GridBody>
                    </Calendar.Grid>
                    <Calendar.YearPickerGrid>
                      <Calendar.YearPickerGridBody>
                        {({ year }) => <Calendar.YearPickerCell year={year} />}
                      </Calendar.YearPickerGridBody>
                    </Calendar.YearPickerGrid>
                  </Calendar>
                </DatePicker.Popover>
              </DatePicker>
            </div>
          </div>
        </div>
      </Card>

      {/* Trends & Dashboard Context Analytics Grid */}
      {!isStatsLoading && stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Top Admins */}
          <Card className="p-4 bg-surface border border-border rounded-2xl shadow-surface">
            <h3 className="text-xs font-extrabold uppercase text-muted tracking-wider mb-3">Active Administrative Actors</h3>
            <div className="space-y-2">
              {stats.topAdmins.length === 0 ? (
                <div className="text-center py-4 text-muted text-xs">No active administrators recorded.</div>
              ) : (
                stats.topAdmins.map((admin, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs p-2 rounded-xl bg-surface-secondary/40 border border-border/40">
                    <span className="font-bold text-foreground truncate max-w-[250px]">{admin.name}</span>
                    <span className="font-mono text-muted text-[11px]">{admin.count} actions</span>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Top Resources */}
          <Card className="p-4 bg-surface border border-border rounded-2xl shadow-surface">
            <h3 className="text-xs font-extrabold uppercase text-muted tracking-wider mb-3">Frequently Updated Resources</h3>
            <div className="space-y-2">
              {stats.topResources.length === 0 ? (
                <div className="text-center py-4 text-muted text-xs">No resources updated.</div>
              ) : (
                stats.topResources.map((res, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs p-2 rounded-xl bg-surface-secondary/40 border border-border/40">
                    <span className="font-mono text-foreground font-bold">{res.name}</span>
                    <span className="font-mono text-muted text-[11px]">{res.count} modifications</span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Audit Log Table */}
      <Card className="p-0 overflow-hidden border border-border bg-surface/80 rounded-2xl shadow-surface">
        {isLoading ? (
          <SkeletonLoader rows={6} columns={6} />
        ) : logs.length === 0 ? (
          <EmptyState
            title="No Records Found"
            description="No compliance audit entries match the selected filters."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table
              aria-label="Compliance Audit Logs"
              className="w-full text-left"
            >
              <Table.ScrollContainer>
                <Table.Content
                  aria-label="Compliance Audit Logs Body"
                >
                  <Table.Header>
                    <Table.Column
                      isRowHeader
                      className="font-extrabold uppercase text-[10px] tracking-wider py-4 px-6 text-muted"
                    >
                      Timestamp
                    </Table.Column>
                    <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4 px-6 text-muted">
                      Actor
                    </Table.Column>
                    <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4 px-6 text-muted">
                      Action Type
                    </Table.Column>
                    <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4 px-6 text-muted">
                      Target Resource
                    </Table.Column>
                    <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4 px-6 text-muted">
                      Details
                    </Table.Column>
                    <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4 px-6 text-muted">
                      Workspace
                    </Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {logs.map((log) => (
                      <Table.Row
                        key={log.id}
                        onPress={() => handleOpenDetails(log.id)}
                        className="border-b border-separator last:border-none hover:bg-surface-secondary/40 cursor-pointer transition-colors"
                      >
                        <Table.Cell className="text-muted font-mono text-[11px] py-4 px-6 whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString()}
                        </Table.Cell>
                        <Table.Cell className="font-bold text-foreground text-xs py-4 px-6">
                          {log.userEmail || (
                            <span className="text-muted font-normal">System</span>
                          )}
                        </Table.Cell>
                        <Table.Cell className="py-4 px-6">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-accent/10 text-accent border border-accent/20">
                            {log.eventType}
                          </span>
                        </Table.Cell>
                        <Table.Cell className="py-4 px-6 font-semibold text-xs text-foreground max-w-[150px] truncate">
                          {log.resourceType ? `${log.resourceType}: ` : ""}
                          <span className="text-muted font-mono text-[11px] font-normal">{log.resourceDisplayName || "—"}</span>
                        </Table.Cell>
                        <Table.Cell className="text-muted text-xs max-w-sm py-4 px-6 leading-relaxed font-normal truncate">
                          <span title={log.description}>{log.description}</span>
                        </Table.Cell>
                        <Table.Cell className="py-4 px-6 whitespace-nowrap text-xs font-semibold text-foreground">
                          {log.workspaceName || "System"}
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          </div>
        )}

        {logs.length > 0 && (
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

      {/* Detail Slide-out Drawer Modal */}
      <AuditDetailDrawer
        isOpen={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        auditId={selectedAuditId}
        onClose={() => setIsDrawerOpen(false)}
      />
    </div>
  );
}
