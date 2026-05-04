"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useWorkspaceStore } from "../store/use-workspace-store";
import { Card, Table, Chip, Typography } from "@heroui/react";
import { Clock, FileText } from "lucide-react";
import { SkeletonLoader, EmptyState } from "@/components/ui/states";
import { PaginationWrapper } from "@/components/ui/pagination-wrapper";
import type { RoleAuditLogDto } from "../types/roles.types";

interface RoleAuditLogsProps {
  organizationSlug: string;
}

export const RoleAuditLogs: React.FC<RoleAuditLogsProps> = ({ organizationSlug }) => {
  const fetchAuditLogs = useWorkspaceStore((s) => s.fetchAuditLogs);
  const auditLogsData = useWorkspaceStore((s) => s.auditLogs[organizationSlug]);

  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [isLoading, setIsLoading] = useState(true);

  const [prevOrgSlug, setPrevOrgSlug] = useState(organizationSlug);
  const [prevPage, setPrevPage] = useState(page);
  const [prevPageSize, setPrevPageSize] = useState(pageSize);

  if (organizationSlug !== prevOrgSlug || page !== prevPage || pageSize !== prevPageSize) {
    setPrevOrgSlug(organizationSlug);
    setPrevPage(page);
    setPrevPageSize(pageSize);
    setIsLoading(true);
  }

  const loadLogs = useCallback(() => {
    if (!organizationSlug) return;
    fetchAuditLogs(organizationSlug, page, pageSize).finally(() => {
      setIsLoading(false);
    });
  }, [organizationSlug, page, pageSize, fetchAuditLogs]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const getActionColor = (action: string) => {
    switch (action.toUpperCase()) {
      case "ROLE_CREATED":
        return "success";
      case "ROLE_UPDATED":
        return "warning";
      case "ROLE_DELETED":
        return "danger";
      case "ROLE_ASSIGNED":
        return "accent";
      case "ROLE_REVOKED":
        return "danger";
      default:
        return "default";
    }
  };

  const formatActionName = (action: string) => {
    return action.replace("ROLE_", "").replace("_", " ");
  };

  const parseAndFormatDetails = (log: RoleAuditLogDto) => {
    const parts: string[] = [];

    if (log.targetUserName) {
      parts.push(`User: ${log.targetUserName}`);
    }

    if (log.scopeType) {
      const scopeLabel =
        log.scopeType.toUpperCase() === "ORGANIZATION"
          ? "Global Organization"
          : "Workspace Boundary";
      parts.push(`Scope: ${scopeLabel}`);
    }

    if (log.detailsJson) {
      try {
        const details = JSON.parse(log.detailsJson);
        if (details.PermissionsCount !== undefined) {
          parts.push(`${details.PermissionsCount} permissions`);
        }
        if (details.DisplayNameChanged) {
          parts.push("Display name updated");
        }
        if (details.ParentRoleChanged) {
          parts.push("Hierarchy modified");
        }
        if (details.PermissionsUpdated) {
          parts.push("Permissions redefined");
        }
        if (details.Description && details.Description.trim()) {
          parts.push(`"${details.Description}"`);
        }
      } catch {
        // Fallback to raw json if parse fails
        parts.push(log.detailsJson);
      }
    }

    return parts.join(" • ") || "No additional parameters";
  };

  const items = auditLogsData?.items || [];
  const totalCount = auditLogsData?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  if (isLoading && items.length === 0) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-separator/50 animate-pulse rounded-lg" />
        <Card className="p-0 overflow-hidden border border-border bg-surface rounded-2xl">
          <SkeletonLoader rows={6} columns={5} />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-4 select-none">
        <div>
          <Typography type="h4" className="font-bold text-foreground">
            Administrative Governance Logs
          </Typography>
          <Typography type="body-xs" className="text-muted mt-1">
            An immutable audit trail of role, permission, and member assignment activities.
          </Typography>
        </div>
      </div>

      <Card className="p-0 overflow-hidden border border-border bg-surface rounded-2xl">
        {items.length === 0 ? (
          <EmptyState
            title="No Governance Logs"
            description="No administrative activities have been logged for this organization yet."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table aria-label="Governance Audit Logs Table" className="w-full">
              <Table.ScrollContainer>
                <Table.Content aria-label="Governance Audit Logs Table Content">
                  <Table.Header>
                    <Table.Column isRowHeader className="font-extrabold uppercase text-[10px] tracking-wider py-4 w-44">
                      Timestamp
                    </Table.Column>
                    <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4 w-52">
                      Administrator
                    </Table.Column>
                    <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4 w-40">
                      Action
                    </Table.Column>
                    <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4 w-52">
                      Target Role
                    </Table.Column>
                    <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4">
                      Context / Details
                    </Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {items.map((log) => (
                      <Table.Row
                        key={log.id}
                        className="border-b border-separator last:border-none hover:bg-surface-secondary/20 transition-colors"
                      >
                        <Table.Cell className="py-4 text-muted text-xs whitespace-nowrap">
                          <div className="flex items-center gap-1.5 select-none">
                            <Clock size={12} className="text-muted/60" />
                            {new Date(log.timestamp).toLocaleString()}
                          </div>
                        </Table.Cell>
                        <Table.Cell className="py-4 font-bold text-foreground text-xs">
                          {log.actorUserName}
                        </Table.Cell>
                        <Table.Cell className="py-4">
                          <Chip
                            color={getActionColor(log.action)}
                            variant="soft"
                            size="sm"
                            className="font-bold text-[9px] uppercase tracking-wider"
                          >
                            {formatActionName(log.action)}
                          </Chip>
                        </Table.Cell>
                        <Table.Cell className="py-4 text-xs font-semibold text-foreground">
                          {log.targetRoleName}
                        </Table.Cell>
                        <Table.Cell className="py-4 text-muted text-xs">
                          {parseAndFormatDetails(log)}
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          </div>
        )}

        {items.length > 0 && (
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
      
      <div className="bg-surface-secondary/40 border border-border rounded-xl p-4 flex gap-3 text-xs text-muted leading-relaxed select-none">
        <FileText size={16} className="text-muted shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-foreground">Compliance Notice:</span> All governance events logged in this panel represent verified transactions on the server and are immutable. Deleted roles and revoked membership bindings will persist in history to comply with enterprise trust intelligence standards.
        </div>
      </div>
    </div>
  );
};
