import React, { useState, useEffect } from "react";
import { DialogModal } from "@/components/ui/dialog-modal";
import { Spinner, Typography } from "@heroui/react";
import { adminService } from "@/services/admin.service";
import { type AuditLogDetail } from "@/types/admin.types";
import {
  FileText,
  User,
  Clock,
  Globe,
  Database,
  Cpu,
  ArrowRight,
  Code
} from "lucide-react";

interface AuditDetailDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  auditId: string | null;
  onClose: () => void;
}

export const AuditDetailDrawer: React.FC<AuditDetailDrawerProps> = ({
  isOpen,
  onOpenChange,
  auditId,
}) => {
  const [detail, setDetail] = useState<AuditLogDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchDetails = async (id: string) => {
      setIsLoading(true);
      try {
        const data = await adminService.getAuditLogDetails(id);
        setDetail(data);
      } catch (err) {
        console.error("Failed to fetch audit log detail", err);
      } finally {
        setIsLoading(false);
      }
    };

    if (isOpen && auditId) {
      fetchDetails(auditId);
    } else {
      setDetail(null);
    }
  }, [isOpen, auditId]);

  const parseDiffs = (oldJson: string | null, newJson: string | null) => {
    if (!oldJson && !newJson) return null;
    try {
      const oldObj = oldJson ? JSON.parse(oldJson) : {};
      const newObj = newJson ? JSON.parse(newJson) : {};
      const diffs: Array<{ field: string; oldVal: string; newVal: string }> = [];

      const keys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)]));
      for (const key of keys) {
        const o = oldObj[key];
        const n = newObj[key];

        const oStr = typeof o === "object" ? JSON.stringify(o, null, 2) : String(o ?? "");
        const nStr = typeof n === "object" ? JSON.stringify(n, null, 2) : String(n ?? "");

        if (oStr !== nStr) {
          diffs.push({
            field: key.replace(/([A-Z])/g, " $1").trim(), // Add spacing to camelCase keys
            oldVal: o === null || o === undefined ? "—" : oStr,
            newVal: n === null || n === undefined ? "—" : nStr,
          });
        }
      }
      return diffs.length > 0 ? diffs : null;
    } catch {
      return null;
    }
  };

  const diffs = detail ? parseDiffs(detail.oldStateJson, detail.newStateJson) : null;

  return (
    <DialogModal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title="Compliance Audit Record Details"
      size="lg"
    >
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted text-xs">
          <Spinner size="md" />
          <span>Resolving audit logs context...</span>
        </div>
      ) : !detail ? (
        <div className="text-center py-10 text-muted text-xs">
          No audit record found.
        </div>
      ) : (
        <div className="space-y-6 text-foreground font-outfit max-h-[85vh] overflow-y-auto pr-1">
          {/* Header Summary */}
          <div className="p-4 rounded-2xl bg-surface/50 border border-border flex flex-col justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-accent/15 text-accent border border-accent/10 font-bold uppercase tracking-wide">
                {detail.category.replace(/([A-Z])/g, " $1").trim()}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface border border-border text-muted">
                Action: {detail.eventType}
              </span>
            </div>
            <h3 className="text-sm font-extrabold text-foreground font-display mt-1">
              {detail.description}
            </h3>
            <div className="text-[10px] text-muted flex items-center gap-1.5 mt-0.5">
              <Clock size={12} />
              <span>Timestamp: {new Date(detail.createdAt).toLocaleString()}</span>
            </div>
          </div>

          {/* Telemetry Columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Context & Scope */}
            <div className="space-y-4">
              <h4 className="text-xs font-extrabold uppercase text-muted tracking-wider">Identity & Workspace</h4>
              <div className="p-4 rounded-2xl bg-surface/30 border border-border space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted flex items-center gap-1.5"><User size={13} /> Actor Email:</span>
                  <span className="font-bold text-foreground truncate max-w-[200px]" title={detail.userEmail || "System"}>
                    {detail.userEmail || "System"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted flex items-center gap-1.5"><Database size={13} /> Workspace:</span>
                  <span className="font-bold text-foreground">
                    {detail.workspaceName || "System Scope"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted flex items-center gap-1.5"><FileText size={13} /> Resource Type:</span>
                  <span className="font-mono text-[11px] font-bold text-foreground">
                    {detail.resourceType || "None"}
                  </span>
                </div>
                {detail.resourceDisplayName && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted flex items-center gap-1.5"><FileText size={13} /> Resource Name:</span>
                    <span className="font-bold text-foreground truncate max-w-[150px]" title={detail.resourceDisplayName}>
                      {detail.resourceDisplayName}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Request context */}
            <div className="space-y-4">
              <h4 className="text-xs font-extrabold uppercase text-muted tracking-wider">HTTP Context & Request Origin</h4>
              <div className="p-4 rounded-2xl bg-surface/30 border border-border space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted flex items-center gap-1.5"><Globe size={13} /> IP Connection:</span>
                  <span className="font-mono text-[11px] font-bold text-foreground">{detail.ipAddress || "Internal"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted flex items-center gap-1.5"><Cpu size={13} /> User Origin:</span>
                  <span className="font-bold text-foreground text-[11px] max-w-[150px] truncate" title={`${detail.device || "Unknown"} / ${detail.browser || "Unknown"}`}>
                    {detail.device || "Unknown"} / {detail.browser || "Unknown"}
                  </span>
                </div>
                {detail.httpMethod && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted flex items-center gap-1.5"><Code size={13} /> HTTP Call:</span>
                    <span className="font-mono text-[11px] font-bold text-foreground uppercase">
                      {detail.httpMethod} {detail.httpPath}
                    </span>
                  </div>
                )}
                {detail.correlationId && detail.correlationId !== "00000000-0000-0000-0000-000000000000" && (
                  <div className="flex flex-col gap-1">
                    <span className="text-muted flex items-center gap-1.5"><Code size={13} /> Correlation Trace ID:</span>
                    <span className="font-mono text-[10px] text-muted select-all truncate bg-surface p-1.5 rounded border border-border">{detail.correlationId}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Change History (Before / After Diffs) */}
          {diffs && (
            <div className="space-y-4">
              <h4 className="text-xs font-extrabold uppercase text-muted tracking-wider">Field-Level Change Set</h4>
              <div className="border border-border rounded-2xl overflow-hidden bg-surface-secondary/20">
                <div className="grid grid-cols-3 gap-4 p-3 bg-surface border-b border-border text-[10px] uppercase font-bold text-muted tracking-wider">
                  <div>Field Name</div>
                  <div>Before Value</div>
                  <div>After Value</div>
                </div>
                <div className="divide-y divide-separator text-xs">
                  {diffs.map((d, index) => (
                    <div key={index} className="grid grid-cols-3 gap-4 p-3 font-mono text-[11px] items-start hover:bg-surface-secondary/40">
                      <div className="font-sans font-bold text-foreground">{d.field}</div>
                      <div className="text-danger truncate max-w-[200px]" title={d.oldVal}>
                        {d.oldVal}
                      </div>
                      <div className="text-success flex items-center gap-2 max-w-[200px]">
                        <ArrowRight size={12} className="text-muted shrink-0" />
                        <span className="truncate" title={d.newVal}>{d.newVal}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Raw Payload Logs */}
          {detail.detailsJson && (
            <div className="space-y-4">
              <h4 className="text-xs font-extrabold uppercase text-muted tracking-wider">Structured JSON Payload</h4>
              <div className="p-4 rounded-2xl bg-surface/50 border border-border">
                <pre className="text-[10px] font-mono text-muted bg-surface/30 p-3 rounded-xl overflow-x-auto border border-border max-h-40">
                  {JSON.stringify(JSON.parse(detail.detailsJson), null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </DialogModal>
  );
};
