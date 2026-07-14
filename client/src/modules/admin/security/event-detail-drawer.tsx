import React, { useState, useEffect } from "react";
import { DialogModal } from "@/components/ui/dialog-modal";
import { Button, Spinner, Checkbox, toast } from "@heroui/react";
import { securityAdminService } from "@/services/security-admin.service";
import { adminService } from "@/services/admin.service";
import { type SecurityEventDetail } from "@/types/security.types";
import { type UserListItem } from "@/types/admin.types";
import {
  ShieldAlert,
  User,
  MapPin,
  Globe,
  Clock,
  Copy,
  Check,
  UserMinus,
  Ban,
  Send,
  Link,
  Laptop
} from "lucide-react";

interface EventDetailDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string | null;
  onClose: () => void;
  onUpdateSuccess: () => void;
}

export const EventDetailDrawer: React.FC<EventDetailDrawerProps> = ({
  isOpen,
  onOpenChange,
  eventId,
  onClose,
  onUpdateSuccess,
}) => {
  const [detail, setDetail] = useState<SecurityEventDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [commentText, setCommentText] = useState("");
  const [copiedId, setCopiedId] = useState(false);

  // Fetch event details
  const fetchDetails = async (id: string) => {
    setIsLoading(true);
    try {
      const data = await securityAdminService.getSecurityEventDetails(id);
      setDetail(data);
    } catch (err) {
      console.error("Failed to fetch event detail", err);
      toast.danger("Failed to load security event details.");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch potential assignees (Active admin-related users)
  const fetchUsers = async () => {
    try {
      const response = await adminService.getUsers({ page: 1, pageSize: 50 });
      setUsers(response.items);
    } catch (err) {
      console.error("Failed to fetch admin users list", err);
    }
  };

  useEffect(() => {
    if (isOpen && eventId) {
      fetchDetails(eventId);
      fetchUsers();
    } else {
      setDetail(null);
      setCommentText("");
    }
  }, [isOpen, eventId]);

  const handleCopyCorrelationId = () => {
    if (!detail) return;
    navigator.clipboard.writeText(detail.correlationId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 200);
    toast.success("Correlation ID copied to clipboard.");
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!detail) return;
    setIsActionLoading("status");
    try {
      await securityAdminService.updateEventStatus(detail.id, {
        status: newStatus,
        commentText: `Status manually updated via Security Portal.`
      });
      toast.success(`Event status updated to ${newStatus}.`);
      await fetchDetails(detail.id);
      onUpdateSuccess();
    } catch (err: any) {
      const msg = err.response?.data?.message || "Failed to update status.";
      toast.danger(msg);
    } finally {
      setIsActionLoading(null);
    }
  };

  const handleAssign = async (userId: string | null) => {
    if (!detail) return;
    setIsActionLoading("assign");
    try {
      await securityAdminService.assignEvent(detail.id, {
        assignedToUserId: userId
      });
      toast.success(userId ? "Investigator assigned successfully." : "Investigator assignment cleared.");
      await fetchDetails(detail.id);
      onUpdateSuccess();
    } catch (err) {
      toast.danger("Failed to assign investigator.");
    } finally {
      setIsActionLoading(null);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail || !commentText.trim()) return;
    setIsActionLoading("comment");
    try {
      await securityAdminService.addEventComment(detail.id, {
        commentText: commentText.trim()
      });
      setCommentText("");
      toast.success("Comment recorded.");
      await fetchDetails(detail.id);
    } catch (err) {
      toast.danger("Failed to add comment.");
    } finally {
      setIsActionLoading(null);
    }
  };

  const handleContainmentAction = async (actionType: 'UserSuspend' | 'IpBlock') => {
    if (!detail) return;
    const confirmMsg = actionType === 'UserSuspend'
      ? `Are you sure you want to suspend user ${detail.actorUserEmail || detail.actorUserId}? This will terminate all active JWT sessions.`
      : `Are you sure you want to block IP ${detail.ipAddress} in Redis cache for 12 hours?`;

    if (!window.confirm(confirmMsg)) return;

    setIsActionLoading(actionType);
    try {
      const response = await securityAdminService.triggerContainment(detail.id, actionType);
      toast.success(response.message);
      await fetchDetails(detail.id);
      onUpdateSuccess();
    } catch (err: any) {
      const msg = err.response?.data?.message || "Containment action failed.";
      toast.danger(msg);
    } finally {
      setIsActionLoading(null);
    }
  };

  const getSeverityStyle = (severity: string) => {
    const s = severity.toUpperCase();
    if (s === "CRITICAL") return "bg-danger/10 text-danger border border-danger/20 font-bold";
    if (s === "HIGH") return "bg-warning/10 text-warning border border-warning/20 font-bold";
    if (s === "MEDIUM") return "bg-accent/10 text-accent border border-accent/20";
    return "bg-default/10 text-foreground border border-default/20";
  };

  return (
    <DialogModal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title="Security Event Insights"
      size="lg"
    >
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted text-xs">
          <Spinner size="md" />
          <span>Syncing threat signals...</span>
        </div>
      ) : !detail ? (
        <div className="text-center py-10 text-muted text-xs">
          No details resolved for this security event identifier.
        </div>
      ) : (
        <div className="space-y-6 text-foreground font-outfit max-h-[80vh] overflow-y-auto pr-1">
          {/* Header Summary */}
          <div className="p-4 rounded-2xl bg-surface/50 border border-border flex flex-col md:flex-row justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex px-2 py-0.5 rounded text-[10px] uppercase tracking-wide ${getSeverityStyle(detail.severity)}`}>
                  {detail.severity}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface border border-border text-muted">
                  Category: {detail.category}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface border border-border text-muted">
                  Occurrences: {detail.occurrenceCount}
                </span>
              </div>
              <h3 className="text-sm font-extrabold text-foreground font-display mt-2">
                {detail.eventType.replace(/_/g, " ")}
              </h3>
              <p className="text-xs text-muted leading-relaxed">
                {detail.description}
              </p>
            </div>

            <div className="flex flex-col gap-2 min-w-[150px] justify-center">
              <span className="text-[10px] text-muted font-bold block">Status Workflow</span>
              <select
                value={detail.status}
                disabled={isActionLoading === "status"}
                onChange={(e) => handleUpdateStatus(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface text-xs p-2 select-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <option value="New">New / Unacknowledged</option>
                <option value="Acknowledged">Acknowledged</option>
                <option value="Investigating">Investigating</option>
                <option value="Contained">Contained</option>
                <option value="Resolved">Resolved</option>
                <option value="Closed">Closed</option>
                <option value="FalsePositive">False Positive</option>
              </select>
            </div>
          </div>

          {/* Telemetry Columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Identity & Origin */}
            <div className="space-y-4">
              <h4 className="text-xs font-extrabold uppercase text-muted tracking-wider">Identity & Scope</h4>
              <div className="p-4 rounded-2xl bg-surface/30 border border-border space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted flex items-center gap-1.5"><User size={13} /> Actor Email:</span>
                  <span className="font-bold text-foreground truncate max-w-[200px]" title={detail.actorUserEmail || "None"}>
                    {detail.actorUserEmail || <span className="text-muted font-normal">System Trigger</span>}
                  </span>
                </div>
                {detail.targetUserEmail && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted flex items-center gap-1.5"><User size={13} /> Target Email:</span>
                    <span className="font-bold text-foreground truncate max-w-[200px]" title={detail.targetUserEmail}>
                      {detail.targetUserEmail}
                    </span>
                  </div>
                )}
                {detail.organizationName && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted flex items-center gap-1.5"><Globe size={13} /> Organization:</span>
                    <span className="font-bold text-foreground">{detail.organizationName}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-muted flex items-center gap-1.5"><MapPin size={13} /> Network IP:</span>
                  <span className="font-mono text-foreground">{detail.ipAddress || "Internal"}</span>
                </div>
                {detail.countryCode && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted flex items-center gap-1.5"><Globe size={13} /> Country:</span>
                    <span className="font-bold text-foreground">{detail.countryCode}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Device & Diagnostics */}
            <div className="space-y-4">
              <h4 className="text-xs font-extrabold uppercase text-muted tracking-wider">Device & Diagnostics</h4>
              <div className="p-4 rounded-2xl bg-surface/30 border border-border space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted flex items-center gap-1.5"><Laptop size={13} /> Device Platform:</span>
                  <span className="font-bold text-foreground">{detail.device || "Unknown"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted flex items-center gap-1.5"><Laptop size={13} /> User Browser:</span>
                  <span className="font-bold text-foreground">{detail.browser || "Unknown"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted flex items-center gap-1.5"><Clock size={13} /> Risk Quotient:</span>
                  <span className="font-mono text-foreground font-bold">{detail.riskScore}% Risk / {detail.confidenceScore}% Confidence</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted flex items-center gap-1.5"><Clock size={13} /> Log Time:</span>
                  <span className="text-muted">{new Date(detail.createdAt).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Trace Metadata */}
          <div className="p-4 rounded-2xl bg-surface/30 border border-border space-y-3 text-xs">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted flex items-center gap-1.5 whitespace-nowrap"><Link size={13} /> Trace Correlation ID:</span>
              <div className="flex items-center gap-1.5 font-mono text-muted text-[10px]">
                <span className="truncate max-w-[280px]" title={detail.correlationId}>{detail.correlationId}</span>
                <button
                  onClick={handleCopyCorrelationId}
                  className="p-1 rounded hover:bg-surface-secondary text-muted hover:text-foreground cursor-pointer"
                >
                  {copiedId ? <Check size={11} className="text-success" /> : <Copy size={11} />}
                </button>
              </div>
            </div>
            {detail.incidentId && (
              <div className="flex items-center justify-between">
                <span className="text-muted flex items-center gap-1.5"><ShieldAlert size={13} /> Incident Linkage:</span>
                <span className="font-bold text-accent">{detail.incidentTitle}</span>
              </div>
            )}
          </div>

          {/* Investigator Assignment */}
          <div className="space-y-3">
            <h4 className="text-xs font-extrabold uppercase text-muted tracking-wider">Investigator Assignment</h4>
            <div className="p-4 rounded-2xl bg-surface/30 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="text-xs">
                <span className="text-muted block">Current Assignee</span>
                <span className="font-bold text-foreground">
                  {detail.assignedToUserEmail || "Unassigned"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={detail.assignedToUserId || ""}
                  disabled={isActionLoading === "assign"}
                  onChange={(e) => handleAssign(e.target.value || null)}
                  className="rounded-xl border border-border bg-surface text-xs p-2.5 select-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  <option value="">-- Set Assignee --</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.email}</option>
                  ))}
                </select>
                {detail.assignedToUserId && (
                  <Button
                    variant="secondary"
                    onPress={() => handleAssign(null)}
                    isDisabled={isActionLoading === "assign"}
                    className="p-2.5 bg-surface text-foreground border border-border rounded-xl text-xs flex items-center gap-1.5 cursor-pointer hover:bg-surface-secondary select-none"
                  >
                    <UserMinus size={14} />
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Containment Operations */}
          <div className="space-y-3">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-danger">Containment Protocols</h4>
            <div className="p-4 rounded-2xl bg-danger/5 border border-danger/10 flex flex-wrap gap-3">
              {detail.actorUserId && (
                <Button
                  onPress={() => handleContainmentAction('UserSuspend')}
                  isDisabled={isActionLoading !== null}
                  className="px-4 py-2.5 bg-danger text-white font-bold rounded-xl text-xs flex items-center gap-2 select-none cursor-pointer hover:bg-danger/90 transition-colors"
                >
                  <Ban size={14} />
                  Suspend Compromised Actor
                </Button>
              )}
              {detail.ipAddress && (
                <Button
                  onPress={() => handleContainmentAction('IpBlock')}
                  isDisabled={isActionLoading !== null}
                  className="px-4 py-2.5 bg-danger text-white font-bold rounded-xl text-xs flex items-center gap-2 select-none cursor-pointer hover:bg-danger/90 transition-colors"
                >
                  <Ban size={14} />
                  Block Origin Network IP
                </Button>
              )}
              {!detail.actorUserId && !detail.ipAddress && (
                <span className="text-xs text-muted">No automated containment protocols applicable to this alert vector.</span>
              )}
            </div>
          </div>

          {/* Timeline Audit Logs & Comments */}
          <div className="space-y-4">
            <h4 className="text-xs font-extrabold uppercase text-muted tracking-wider">Investigation Log & Activity</h4>
            <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1">
              {detail.comments.length === 0 ? (
                <div className="text-center py-6 text-muted text-xs bg-surface/20 rounded-2xl border border-dashed border-border">
                  No activity comments logged yet.
                </div>
              ) : (
                detail.comments.map((comment) => (
                  <div key={comment.id} className="p-3 rounded-2xl border border-border bg-surface/50 text-xs space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-muted">
                      <span className="font-bold text-foreground truncate max-w-[200px]" title={comment.authorUserEmail}>
                        {comment.authorUserEmail}
                      </span>
                      <span>{new Date(comment.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-muted leading-relaxed">{comment.commentText}</p>
                  </div>
                ))
              )}
            </div>

            {/* Comment Form */}
            <form onSubmit={handleAddComment} className="flex gap-2">
              <input
                type="text"
                placeholder="Log notes or add audit observations..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                disabled={isActionLoading === "comment"}
                className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-surface text-xs focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <Button
                type="submit"
                isDisabled={isActionLoading === "comment" || !commentText.trim()}
                className="px-4 py-2.5 bg-foreground text-background font-bold rounded-xl text-xs flex items-center gap-1.5 select-none cursor-pointer hover:bg-foreground/90 transition-all"
              >
                <Send size={12} />
                Post
              </Button>
            </form>
          </div>
        </div>
      )}
    </DialogModal>
  );
};
