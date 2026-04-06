"use client";

import React, { useState, useEffect } from "react";
import { recoveryApi } from "@/features/auth/services/recovery.service";
import {
  Card,
  Typography,
  Button,
  Spinner,
  toast,
  TextField,
  Chip,
  Form,
  Label,
} from "@heroui/react";
import {
  Building2,
  PhoneCall,
  Check,
  X,
  ShieldCheck,
  Search,
  ChevronRight,
  Info,
  Clock,
  History,
  AlertTriangle,
} from "lucide-react";
import axios from "axios";

interface RotationRequest {
  requestId: string;
  organizationId: string;
  companyName: string;
  currentRepresentative: string | null;
  requestedRepresentative: string;
  requestedEmail: string;
  requestedPhone: string;
  reason: string;
  supportApprovalStatus: "pending_review" | "approved" | "rejected";
  adminApprovalStatus: "pending_review" | "approved" | "rejected";
  finalDecision: "pending_review" | "awaiting_admin_approval" | "awaiting_support_approval" | "approved" | "rejected" | "expired";
  verificationCallStatus: "not_started" | "scheduled" | "verified" | "failed";
  verificationCallNotes: string | null;
  optionalSupportingMessage: string | null;
  createdAt: string;
  expiresAt: string;
}

interface HistoryItem {
  historyId: string;
  organizationId: string;
  companyName: string;
  previousRepresentative: string;
  newRepresentative: string;
  rotatedBy: string;
  supportReviewer: string;
  effectiveAt: string;
}

export function AdminRotationReviewView() {
  const [requests, setRequests] = useState<RotationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReq, setSelectedReq] = useState<RotationRequest | null>(null);
  
  // Call Verification state
  const [callNotes, setCallNotes] = useState("");
  const [callStatus, setCallStatus] = useState<"not_started" | "scheduled" | "verified" | "failed">("not_started");
  const [submittingCall, setSubmittingCall] = useState(false);

  // History state
  const [rotationHistory, setRotationHistory] = useState<HistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Review state
  const [submittingReview, setSubmittingReview] = useState(false);

  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [decisionFilter, setDecisionFilter] = useState<string>("all");
  const [callFilter, setCallFilter] = useState<string>("all");

  const fetchRequests = React.useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const data = (await recoveryApi.level2GetRequests()) as RotationRequest[];
      setRequests(data);
    } catch {
      toast.danger("Failed to load requests", {
        description: "Please check your admin session authorization.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchRequests(true);
    });
  }, [fetchRequests]);

  // Fetch organization rotation history when request selection changes
  useEffect(() => {
    Promise.resolve().then(() => {
      if (!selectedReq) {
        setRotationHistory([]);
        return;
      }

      const fetchHistory = async () => {
        setLoadingHistory(true);
        try {
          const historyData = (await recoveryApi.level2GetHistory(selectedReq.organizationId)) as HistoryItem[];
          setRotationHistory(historyData);
        } catch (err) {
          console.error("Failed to load representative history", err);
        } finally {
          setLoadingHistory(false);
        }
      };

      fetchHistory();
      setCallNotes(selectedReq.verificationCallNotes || "");
      setCallStatus(selectedReq.verificationCallStatus);
    });
  }, [selectedReq]);

  // Log / update verification call status
  const handleSaveCallDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReq) return;

    setSubmittingCall(true);
    try {
      await recoveryApi.level2RecordVerificationCall(selectedReq.requestId, {
        notes: callNotes,
        status: callStatus,
      });

      toast.success("Verification Call Logged", {
        description: "Call notes and verification status updated.",
      });

      // Refresh data
      const refreshed = (await recoveryApi.level2GetRequests()) as RotationRequest[];
      setRequests(refreshed);
      const updated = refreshed.find((r) => r.requestId === selectedReq.requestId);
      setSelectedReq(updated || null);
    } catch (err) {
      const msg = axios.isAxiosError(err) && err.response?.data?.message
        ? err.response.data.message
        : "Failed to update verification call details.";
      toast.danger("Submission Failed", {
        description: msg,
      });
    } finally {
      setSubmittingCall(false);
    }
  };

  // Support Auditor dual-approval action
  const handleReviewSupport = async (decision: "approve" | "reject") => {
    if (!selectedReq) return;

    setSubmittingReview(true);
    try {
      await recoveryApi.level2SupportApproval(selectedReq.requestId, { decision });

      toast.success(`Request ${decision === "approve" ? "Approved" : "Rejected"}`, {
        description: `Successfully submitted your support auditor decision.`,
      });

      // Refresh data
      const refreshed = (await recoveryApi.level2GetRequests()) as RotationRequest[];
      setRequests(refreshed);
      const updated = refreshed.find((r) => r.requestId === selectedReq.requestId);
      setSelectedReq(updated || null);
    } catch (err) {
      const msg = axios.isAxiosError(err) && err.response?.data?.message
        ? err.response.data.message
        : "Failed to record approval decision. Ensure call is marked 'verified'.";
      toast.danger("Review Failed", {
        description: msg,
      });
    } finally {
      setSubmittingReview(false);
    }
  };

  const filteredRequests = requests.filter((r) => {
    const matchesDecision = decisionFilter === "all" || r.finalDecision === decisionFilter;
    const matchesCall = callFilter === "all" || r.verificationCallStatus === callFilter;
    
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      r.companyName.toLowerCase().includes(searchLower) ||
      r.requestedRepresentative.toLowerCase().includes(searchLower) ||
      r.requestedEmail.toLowerCase().includes(searchLower) ||
      r.requestId.includes(searchQuery);

    return matchesDecision && matchesCall && matchesSearch;
  });

  return (
    <div className="w-full flex gap-6 h-[calc(100vh-140px)] overflow-hidden font-sans">
      {/* Left List Pane */}
      <Card className="flex-1 flex flex-col overflow-hidden p-4 premium-glass">
        <div className="flex flex-col gap-4 border-b border-border pb-4 mb-4 select-none">
          <div className="flex justify-between items-center">
            <div>
              <Typography.Heading level={3} className="text-xl font-extrabold text-foreground">
                L2 Representative Rotation Queue
              </Typography.Heading>
              <Typography className="text-xs text-muted mt-0.5">
                Enterprise representative access recovery, dual-approval governance reviews, and live call audits.
              </Typography>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-border text-xs"
              onPress={() => fetchRequests(true)}
            >
              Refresh Queue
            </Button>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            {/* Search Input */}
            <div className="flex items-center border border-border bg-surface-secondary/40 rounded-xl px-3 py-2 flex-1 min-w-[200px]">
              <Search className="size-4 text-muted mr-2" />
              <input
                className="bg-transparent border-0 outline-none text-xs text-foreground flex-1"
                placeholder="Search company, nominee, request ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Decision Filter */}
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <span>Decision</span>
              <select
                className="bg-surface border border-border rounded-lg p-1.5 text-foreground text-xs"
                value={decisionFilter}
                onChange={(e) => setDecisionFilter(e.target.value)}
              >
                <option value="all">All Decisions</option>
                <option value="pending_review">Pending Review</option>
                <option value="awaiting_admin_approval">Awaiting Admin Vote</option>
                <option value="awaiting_support_approval">Awaiting Support</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="expired">Expired</option>
              </select>
            </div>

            {/* Call Status Filter */}
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <span>Call</span>
              <select
                className="bg-surface border border-border rounded-lg p-1.5 text-foreground text-xs"
                value={callFilter}
                onChange={(e) => setCallFilter(e.target.value)}
              >
                <option value="all">All Call States</option>
                <option value="not_started">Not Started</option>
                <option value="scheduled">Scheduled</option>
                <option value="verified">Verified</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>
        </div>

        {/* Requests List */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Spinner size="lg" color="accent" />
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted text-xs select-none">
            <ShieldCheck className="size-8 text-muted/50 mb-2" />
            No requests matching filter criteria.
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {filteredRequests.map((req) => {
              const isSelected = selectedReq?.requestId === req.requestId;
              
              // Call status colors
              let callColor: "default" | "warning" | "success" | "danger" = "default";
              if (req.verificationCallStatus === "verified") callColor = "success";
              else if (req.verificationCallStatus === "failed") callColor = "danger";
              else if (req.verificationCallStatus === "scheduled") callColor = "warning";

              // Final decision colors
              let decisionColor: "default" | "success" | "danger" | "warning" | "accent" = "default";
              if (req.finalDecision === "approved") decisionColor = "success";
              else if (req.finalDecision === "rejected" || req.finalDecision === "expired") decisionColor = "danger";
              else if (req.finalDecision === "awaiting_admin_approval" || req.finalDecision === "awaiting_support_approval") decisionColor = "warning";
              else if (req.finalDecision === "pending_review") decisionColor = "accent";

              return (
                <div
                  key={req.requestId}
                  className={`border rounded-2xl p-4 cursor-pointer transition-all flex items-center justify-between ${
                    isSelected ? "border-accent bg-accent/5 ring-1 ring-accent/30" : "border-border hover:border-border/80 bg-surface-secondary/15"
                  }`}
                  onClick={() => setSelectedReq(req)}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-foreground">{req.companyName}</span>
                      <Chip size="sm" variant="soft" color={decisionColor}>
                        {req.finalDecision.replace("_", " ")}
                      </Chip>
                    </div>
                    
                    <div className="flex gap-x-4 text-[10px] text-muted">
                      <span>Successor: <strong>{req.requestedRepresentative}</strong></span>
                      <span>Email: <strong>{req.requestedEmail}</strong></span>
                      <span>Initiated: <strong>{new Date(req.createdAt).toLocaleDateString()}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[10px] text-muted block select-none">Live call</span>
                      <Chip size="sm" color={callColor} variant="soft" className="font-bold uppercase">
                        {req.verificationCallStatus.replace("_", " ")}
                      </Chip>
                    </div>
                    <ChevronRight className="size-4 text-muted" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Right Details Pane */}
      {selectedReq ? (
        <Card className="w-[450px] flex flex-col overflow-hidden p-6 border-l border-border bg-surface shrink-0">
          <div className="flex justify-between items-center border-b border-border pb-4 mb-4 select-none">
            <div className="flex items-center gap-2">
              <Building2 className="size-5 text-accent" />
              <Typography className="text-sm font-bold text-foreground truncate max-w-[280px]">
                {selectedReq.companyName}
              </Typography>
            </div>
            <Button
              variant="ghost"
              isIconOnly
              size="sm"
              className="text-muted min-w-0"
              onPress={() => setSelectedReq(null)}
            >
              <X className="size-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-6 pr-1">
            {/* Request Detail Card */}
            <div className="space-y-3">
              <div className="flex justify-between items-center select-none">
                <Typography className="text-[11px] font-bold text-muted uppercase tracking-wider">Representative Rotation Details</Typography>
                <div className="flex items-center text-[10px] text-muted gap-1">
                  <Clock className="size-3" />
                  <span>Expires: {new Date(selectedReq.expiresAt).toLocaleDateString()}</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-muted block mb-0.5">Predecessor Representative</span>
                  <span className="font-semibold text-foreground">{selectedReq.currentRepresentative || "Not Registered"}</span>
                </div>
                <div>
                  <span className="text-muted block mb-0.5">Successor Nominee</span>
                  <span className="font-bold text-accent">{selectedReq.requestedRepresentative}</span>
                </div>
                <div>
                  <span className="text-muted block mb-0.5">Nominee Position</span>
                  <span className="font-semibold text-foreground">{reqDetailPosition(selectedReq.reason)}</span>
                </div>
                <div>
                  <span className="text-muted block mb-0.5">Nominee Phone</span>
                  <span className="font-semibold text-foreground">{selectedReq.requestedPhone}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted block mb-0.5">Nominee Email</span>
                  <span className="font-semibold text-foreground select-all">{selectedReq.requestedEmail}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted block mb-0.5">Change Reason / Message</span>
                  <span className="font-semibold text-foreground capitalize">{selectedReq.reason.replace("_", " ")}</span>
                  {selectedReq.optionalSupportingMessage && (
                    <div className="mt-1 p-2 rounded-lg bg-surface-secondary text-[11px] text-muted italic border border-border/60">
                      &quot;{selectedReq.optionalSupportingMessage}&quot;
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-border/60" />

            {/* LIVE VERIFICATION CALL LOGGING PANEL */}
            <div className="p-4 rounded-2xl bg-surface-secondary border border-border space-y-3">
              <div className="flex items-center gap-2 select-none text-foreground font-bold text-xs">
                <PhoneCall className="size-4 text-accent" />
                <span>1. Live Audit Verification Call</span>
              </div>
              <Form onSubmit={handleSaveCallDetails} className="space-y-3">
                <div className="flex flex-col gap-1">
                  <Label className="text-[10px] text-muted">Call Status</Label>
                  <select
                    className="w-full h-9 bg-surface border border-border rounded-xl px-2.5 text-xs text-foreground focus:outline-none focus:border-accent"
                    value={callStatus}
                    onChange={(e) => setCallStatus(e.target.value as typeof callStatus)}
                  >
                    <option value="not_started">Not Started</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="verified">Verified (Successful)</option>
                    <option value="failed">Failed Verification</option>
                  </select>
                </div>

                <TextField name="callNotes">
                  <Label className="text-[10px] text-muted">Auditor Call Notes</Label>
                  <textarea
                    placeholder="Enter notes about identity card validation, live call proof details..."
                    className="w-full min-h-[70px] p-2.5 rounded-xl bg-surface border border-border text-xs focus:outline-none focus:border-accent text-foreground"
                    value={callNotes}
                    onChange={(e) => setCallNotes(e.target.value)}
                  />
                </TextField>

                <Button
                  type="submit"
                  size="sm"
                  className="w-full bg-accent text-accent-foreground font-bold rounded-xl h-9 text-xs"
                  isDisabled={submittingCall || selectedReq.finalDecision === "approved" || selectedReq.finalDecision === "rejected"}
                  isPending={submittingCall}
                >
                  Update Call Status
                </Button>
              </Form>
            </div>

            <div className="border-t border-border/60" />

            {/* DUAL-APPROVAL STATUS BLOCK */}
            <div className="space-y-3">
              <Typography className="text-[11px] font-bold text-muted uppercase tracking-wider select-none">2. Dual Governance Sign-offs</Typography>
              <div className="grid grid-cols-2 gap-4 text-xs select-none">
                <div className="p-3 rounded-xl bg-surface-secondary border border-border">
                  <span className="text-muted block text-[10px] mb-1">Predecessor Admin Vote</span>
                  <Chip
                    size="sm"
                    color={
                      selectedReq.adminApprovalStatus === "approved"
                        ? "success"
                        : selectedReq.adminApprovalStatus === "rejected"
                          ? "danger"
                          : "default"
                    }
                    variant="soft"
                    className="font-bold capitalize"
                  >
                    {selectedReq.adminApprovalStatus.replace("_", " ")}
                  </Chip>
                </div>

                <div className="p-3 rounded-xl bg-surface-secondary border border-border">
                  <span className="text-muted block text-[10px] mb-1">Support Auditor Decision</span>
                  <Chip
                    size="sm"
                    color={
                      selectedReq.supportApprovalStatus === "approved"
                        ? "success"
                        : selectedReq.supportApprovalStatus === "rejected"
                          ? "danger"
                          : "default"
                    }
                    variant="soft"
                    className="font-bold capitalize"
                  >
                    {selectedReq.supportApprovalStatus.replace("_", " ")}
                  </Chip>
                </div>
              </div>
            </div>

            <div className="border-t border-border/60" />

            {/* AUDIT LOG REPRESENTATIVE HISTORY */}
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 select-none">
                <History className="size-4 text-muted shrink-0" />
                <Typography className="text-[11px] font-bold text-muted uppercase tracking-wider">Rotation Audit logs</Typography>
              </div>
              
              {loadingHistory ? (
                <div className="flex justify-center py-4">
                  <Spinner size="sm" />
                </div>
              ) : rotationHistory.length === 0 ? (
                <Typography className="text-[10px] text-muted italic select-none">
                  No historical representative rotation logs exist. First authority setup.
                </Typography>
              ) : (
                <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                  {rotationHistory.map((h) => (
                    <div key={h.historyId} className="p-2.5 rounded-xl bg-surface-secondary/40 border border-border text-[10px] space-y-1">
                      <div className="flex justify-between text-muted">
                        <span>Successor: <strong className="text-foreground font-semibold">{h.newRepresentative}</strong></span>
                        <span>{new Date(h.effectiveAt).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between text-[9px] text-muted/80">
                        <span>Predecessor: {h.previousRepresentative}</span>
                        <span>Sign-off: {h.supportReviewer}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Action CTA Buttons for Auditor Review */}
          {selectedReq.finalDecision !== "approved" && selectedReq.finalDecision !== "rejected" && selectedReq.finalDecision !== "expired" && (
            <div className="border-t border-border pt-4 mt-4 shrink-0 bg-surface">
              {selectedReq.verificationCallStatus !== "verified" ? (
                <div className="p-3 rounded-xl bg-warning/10 border border-warning/25 flex gap-2.5 text-xs text-warning items-start select-none">
                  <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                  <span>Review sign-off is locked. Requires verified live support verification call completion first.</span>
                </div>
              ) : (
                <div className="flex gap-3">
                  <Button
                    variant="ghost"
                    className="flex-1 h-11 rounded-xl border border-danger text-danger hover:bg-danger/10 font-bold"
                    onPress={() => handleReviewSupport("reject")}
                    isDisabled={submittingReview}
                  >
                    <X className="size-4 mr-2" />
                    Reject request
                  </Button>
                  <Button
                    className="flex-1 h-11 rounded-xl bg-success text-success-foreground hover:bg-success-hover font-bold"
                    onPress={() => handleReviewSupport("approve")}
                    isDisabled={submittingReview}
                    isPending={submittingReview}
                  >
                    {submittingReview ? (
                      <Spinner color="current" size="sm" />
                    ) : (
                      <Check className="size-4 mr-2" />
                    )}
                    {selectedReq.adminApprovalStatus === "approved" ? "Approve & Execute" : "Approve & Wait"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </Card>
      ) : (
        <Card className="w-[450px] flex flex-col items-center justify-center p-6 border-l border-border bg-surface shrink-0 select-none text-muted text-xs">
          <Info className="size-8 text-muted/40 mb-2" />
          Select a rotation request from the queue to view details, log verification calls, and submit decisions.
        </Card>
      )}
    </div>
  );
}

function reqDetailPosition(reason: string): string {
  // Simple heuristic mapping
  if (reason.toLowerCase().includes("ceo")) return "Chief Executive Officer";
  if (reason.toLowerCase().includes("director")) return "Managing Director";
  return "Official Nominee / Rep";
}
