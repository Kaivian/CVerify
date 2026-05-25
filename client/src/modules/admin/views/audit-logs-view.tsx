"use client";

import React, { useState, useEffect, useCallback } from "react";
import { adminService } from "@/services/admin.service";
import { AuditLogListItem } from "@/types/admin.types";
import { Table, Button, Card, Typography } from "@heroui/react";
import { Search, RotateCw, ShieldCheck } from "lucide-react";
import { PaginationWrapper } from "@/components/ui/pagination-wrapper";
import { SkeletonLoader, EmptyState } from "@/components/ui/states";
import { useTranslation } from "react-i18next";

export function AuditLogsView() {
  const { t } = useTranslation(["dashboard-admin", "common"]);
  const [logs, setLogs] = useState<AuditLogListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Debounced search logic to prevent excessive backend queries
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [search]);

  const fetchLogs = useCallback(
    async (currentPage: number, searchString: string, silent = false) => {
      if (!silent) setIsLoading(true);
      try {
        const response = await adminService.getAuditLogs({
          search: searchString || undefined,
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
    [pageSize],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLogs(page, debouncedSearch);
    }, 0);
    return () => clearTimeout(timer);
  }, [page, debouncedSearch, fetchLogs]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchLogs(page, debouncedSearch, true);
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  const getEventTypeStyle = (type: string) => {
    const t = type.toUpperCase();
    if (
      t.includes("FAIL") ||
      t.includes("REVOKE") ||
      t.includes("SUSPEND") ||
      t.includes("BAN")
    ) {
      return { color: "danger" as const, label: type };
    }
    if (
      t.includes("CREATE") ||
      t.includes("SUCCESS") ||
      t.includes("SYNC") ||
      t.includes("LOGIN")
    ) {
      return { color: "success" as const, label: type };
    }
    if (t.includes("UPDATE") || t.includes("EDIT")) {
      return { color: "warning" as const, label: type };
    }
    return { color: "primary" as const, label: type };
  };

  return (
    <div className="space-y-6 font-outfit max-w-7xl mx-auto text-foreground">
      {/* Title block */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Typography
            type="h2"
            className="text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2 font-display"
          >
            <ShieldCheck className="text-accent" size={24} />
            {t("dashboard-admin:auditLogs.title")}
          </Typography>
          <Typography type="body-sm" className="text-muted mt-1 font-outfit">
            {t("dashboard-admin:auditLogs.subtitle")}
          </Typography>
        </div>
        <Button
          variant="secondary"
          onPress={handleRefresh}
          className="w-fit px-4 py-2.5 bg-foreground text-background font-bold rounded-xl text-xs flex items-center gap-2 hover:bg-foreground/90 transition-all select-none cursor-pointer"
        >
          <RotateCw size={14} className={isRefreshing ? "animate-spin" : ""} />
          {t("dashboard-admin:auditLogs.syncRecords")}
        </Button>
      </div>

      {/* Search Filter Banner */}
      <Card className="p-4 bg-surface/70 border border-border rounded-2xl shadow-surface">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-3.5 text-muted" />
          <input
            type="text"
            placeholder={t("dashboard-admin:auditLogs.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-surface/50 text-xs focus:outline-none focus:ring-2 focus:ring-focus/20"
          />
        </div>
      </Card>

      {/* Audit Log Table */}
      <Card className="p-0 overflow-hidden border border-border bg-surface/80 rounded-2xl shadow-surface">
        {isLoading ? (
          <SkeletonLoader rows={6} columns={5} />
        ) : logs.length === 0 ? (
          <EmptyState
            title={t("dashboard-admin:auditLogs.empty.title")}
            description={t("dashboard-admin:auditLogs.empty.description")}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table
              aria-label={t("dashboard-admin:auditLogs.table.ariaLabel")}
              className="w-full"
            >
              <Table.ScrollContainer>
                <Table.Content
                  aria-label={t(
                    "dashboard-admin:auditLogs.table.ariaLabelContent",
                  )}
                >
                  <Table.Header>
                    <Table.Column
                      isRowHeader
                      className="font-extrabold uppercase text-[10px] tracking-wider py-4"
                    >
                      {t("dashboard-admin:auditLogs.table.timestamp")}
                    </Table.Column>
                    <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4">
                      {t("dashboard-admin:auditLogs.table.triggeredBy")}
                    </Table.Column>
                    <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4">
                      {t("dashboard-admin:auditLogs.table.eventType")}
                    </Table.Column>
                    <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4">
                      {t("dashboard-admin:auditLogs.table.actionDetail")}
                    </Table.Column>
                    <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4 hidden md:table-cell">
                      {t("dashboard-admin:auditLogs.table.connectionOrigin")}
                    </Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {logs.map((log) => {
                      const badge = getEventTypeStyle(log.eventType);
                      return (
                        <Table.Row
                          key={log.id}
                          className="border-b border-separator last:border-none hover:bg-surface-secondary/40"
                        >
                          <Table.Cell className="text-muted font-mono text-[11px] py-4 whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleString()}
                          </Table.Cell>
                          <Table.Cell className="font-bold text-foreground text-xs py-4">
                            {log.userEmail || (
                              <span className="text-muted font-normal">
                                {t("dashboard-admin:auditLogs.systemContext")}
                              </span>
                            )}
                          </Table.Cell>
                          <Table.Cell className="py-4">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wide uppercase ${
                                badge.color === "danger"
                                  ? "bg-danger/10 text-danger border border-danger/20"
                                  : badge.color === "success"
                                    ? "bg-success/10 text-success border border-success/20"
                                    : badge.color === "warning"
                                      ? "bg-warning/10 text-warning border border-warning/20"
                                      : "bg-accent/10 text-accent border border-accent/20"
                              }`}
                            >
                              {badge.label}
                            </span>
                          </Table.Cell>
                          <Table.Cell className="text-muted text-xs max-w-md py-4 leading-relaxed font-normal">
                            {log.description}
                          </Table.Cell>
                          <Table.Cell className="py-4 whitespace-nowrap hidden md:table-cell">
                            <div className="flex flex-col text-[10px] text-muted font-mono">
                              <span>IP: {log.ipAddress || "Internal"}</span>
                              <span
                                className="max-w-[150px] truncate"
                                title={log.userAgent || "None"}
                              >
                                UA: {log.userAgent || "None"}
                              </span>
                            </div>
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

        {logs.length > 0 && (
          <PaginationWrapper
            page={page}
            totalPages={totalPages}
            totalItems={totalCount}
            itemsPerPage={pageSize}
            onPageChange={(p) => setPage(p)}
          />
        )}
      </Card>
    </div>
  );
}
