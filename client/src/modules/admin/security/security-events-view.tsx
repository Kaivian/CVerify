import React, { useState, useEffect, useCallback } from "react";
import { securityAdminService } from "@/services/security-admin.service";
import { type SecurityEventListItem } from "@/types/security.types";
import { Table, Button, Card, Typography } from "@heroui/react";
import { Search, RotateCw, ShieldAlert, SlidersHorizontal } from "lucide-react";
import { PaginationWrapper } from "@/components/ui/pagination-wrapper";
import { SkeletonLoader, EmptyState } from "@/components/ui/states";
import { EventDetailDrawer } from "./event-detail-drawer";

export function SecurityEventsView() {
  const [events, setEvents] = useState<SecurityEventListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);

  // Search & Filter state
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [severity, setSeverity] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Debounced search logic to prevent excessive backend queries
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [search]);

  const fetchEvents = useCallback(
    async (currentPage: number, silent = false) => {
      if (!silent) setIsLoading(true);
      try {
        const response = await securityAdminService.getSecurityEvents({
          search: debouncedSearch || undefined,
          severity: severity || undefined,
          category: category || undefined,
          status: status || undefined,
          page: currentPage,
          pageSize,
        });
        setEvents(response.items);
        setTotalCount(response.totalCount);
      } catch (err) {
        console.error("Failed to fetch security events", err);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [debouncedSearch, severity, category, status, pageSize],
  );

  useEffect(() => {
    fetchEvents(page);
  }, [page, fetchEvents]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchEvents(page, true);
  };

  const handleOpenDetails = (id: string) => {
    setSelectedEventId(id);
    setIsDrawerOpen(true);
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  const getSeverityStyle = (sev: string) => {
    const s = sev.toUpperCase();
    if (s === "CRITICAL") {
      return "bg-danger/10 text-danger border border-danger/20 font-bold";
    }
    if (s === "HIGH") {
      return "bg-warning/10 text-warning border border-warning/20 font-bold";
    }
    if (s === "MEDIUM") {
      return "bg-accent/10 text-accent border border-accent/20";
    }
    return "bg-default/10 text-foreground border border-default/20";
  };

  const getStatusStyle = (st: string) => {
    const s = st.toUpperCase();
    if (s === "NEW") return "text-danger border-danger/30 bg-danger/5";
    if (s === "RESOLVED" || s === "CLOSED") return "text-success border-success/30 bg-success/5";
    if (s === "FALSEPOSITIVE") return "text-muted border-border bg-surface";
    return "text-warning border-warning/30 bg-warning/5"; // Investigating, Contained, Acknowledged
  };

  return (
    <div className="space-y-6 text-foreground font-outfit max-w-7xl mx-auto">
      {/* Search & Filter bar */}
      <Card className="p-4 bg-surface/70 border border-border rounded-2xl shadow-surface space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex-1 w-full relative">
            <Search size={16} className="absolute left-3 top-3 text-muted" />
            <input
              type="text"
              placeholder="Search by IP, actor email, event name, or detail..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-surface/50 text-xs focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <Button
            onPress={handleRefresh}
            className="rounded-xl"
          >
            <RotateCw size={14} className={isRefreshing ? "animate-spin" : ""} />
            Sync Logs
          </Button>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap gap-3 items-center text-xs">
          <div className="flex items-center gap-1.5 text-muted">
            <SlidersHorizontal size={13} />
            <span>Filters:</span>
          </div>

          <select
            value={severity}
            onChange={(e) => { setSeverity(e.target.value); setPage(1); }}
            className="rounded-xl border border-border bg-surface text-[11px] p-2 select-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="">All Severities</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          <select
            value={category}
            onChange={(e) => { setCategory(e.target.value); setPage(1); }}
            className="rounded-xl border border-border bg-surface text-[11px] p-2 select-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="">All Categories</option>
            <option value="Auth">Authentication</option>
            <option value="Api">API Telemetry</option>
            <option value="Infrastructure">Infrastructure</option>
            <option value="Intelligence">Intelligence (AI)</option>
            <option value="System">System Control</option>
          </select>

          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="rounded-xl border border-border bg-surface text-[11px] p-2 select-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="">All Statuses</option>
            <option value="New">New</option>
            <option value="Acknowledged">Acknowledged</option>
            <option value="Investigating">Investigating</option>
            <option value="Contained">Contained</option>
            <option value="Resolved">Resolved</option>
            <option value="Closed">Closed</option>
            <option value="FalsePositive">False Positive</option>
          </select>
        </div>
      </Card>

      {/* Security Events Logs Table */}
      <Card className="p-0 overflow-hidden border border-border bg-surface/80 rounded-2xl shadow-surface">
        {isLoading ? (
          <SkeletonLoader rows={6} columns={6} />
        ) : events.length === 0 ? (
          <EmptyState
            title="No Security Logs"
            description="No threat signals or anomalies match the specified filter queries."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table aria-label="Security Logs Table" className="w-full">
              <Table.ScrollContainer>
                <Table.Content aria-label="Security Logs Table Body">
                  <Table.Header>
                    <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4 px-6 text-muted">
                      Log Date
                    </Table.Column>
                    <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4 px-6 text-muted">
                      Threat Signal (Type)
                    </Table.Column>
                    <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4 px-6 text-muted">
                      Severity
                    </Table.Column>
                    <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4 px-6 text-muted">
                      Description
                    </Table.Column>
                    <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4 px-6 text-muted">
                      Network Origin
                    </Table.Column>
                    <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4 px-6 text-muted">
                      Status
                    </Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {events.map((e) => (
                      <Table.Row
                        key={e.id}
                        onClick={() => handleOpenDetails(e.id)}
                        className="border-b border-separator last:border-none hover:bg-surface-secondary/40 select-none cursor-pointer transition-colors"
                      >
                        <Table.Cell className="text-muted font-mono text-[11px] py-4 px-6 whitespace-nowrap">
                          {new Date(e.createdAt).toLocaleString()}
                        </Table.Cell>
                        <Table.Cell className="font-bold text-foreground text-xs py-4 px-6 whitespace-nowrap">
                          <span className="flex items-center gap-1.5">
                            <ShieldAlert size={14} className="text-accent" />
                            {e.eventType.replace(/_/g, " ")}
                          </span>
                        </Table.Cell>
                        <Table.Cell className="py-4 px-6 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] uppercase tracking-wide ${getSeverityStyle(e.severity)}`}>
                            {e.severity}
                          </span>
                        </Table.Cell>
                        <Table.Cell className="text-muted text-xs max-w-xs py-4 px-6 truncate font-normal">
                          {e.description}
                        </Table.Cell>
                        <Table.Cell className="py-4 px-6 whitespace-nowrap">
                          <div className="flex flex-col text-[10px] font-mono text-muted">
                            <span>IP: {e.ipAddress || "Internal"}</span>
                            {e.countryCode && <span>Country: {e.countryCode}</span>}
                          </div>
                        </Table.Cell>
                        <Table.Cell className="py-4 px-6 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusStyle(e.status)}`}>
                            {e.status}
                          </span>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          </div>
        )}

        {events.length > 0 && (
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

      {/* Drawer Overlay for Event Insights */}
      <EventDetailDrawer
        isOpen={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        eventId={selectedEventId}
        onClose={() => { setIsDrawerOpen(false); setSelectedEventId(null); }}
        onUpdateSuccess={() => fetchEvents(page, true)}
      />
    </div>
  );
}
