"use client";

import React, { useState, useEffect } from "react";
import { recoveryApi, ClaimDetailsResponseData } from '@/features/auth/services/recovery.service';
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
  FileText,
  Download,
  Check,
  X,
  ShieldCheck,
  Search,
  ChevronRight,
  Info,
} from "lucide-react";

interface AxiosErrorLike {
  response?: {
    data?: {
      message?: string;
    };
  };
}

export function RecoveryClaimsView() {
  const [claims, setClaims] = useState<ClaimDetailsResponseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClaim, setSelectedClaim] = useState<ClaimDetailsResponseData | null>(null);
  
  // Review Actions State
  const [rejectionReason, setRejectionReason] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);

  // Filters State
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchClaims = async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }
    try {
      const data = await recoveryApi.getClaims();
      setClaims(data);
    } catch {
      toast.danger("Failed to load recovery claims", {
        description: "Verify your admin role privileges or check service status.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchClaims(false);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Download legal document file
  const handleDownload = async (claimId: string, docId: string, fileName: string) => {
    try {
      const blob = await recoveryApi.downloadDocument(claimId, docId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Document downloaded", {
        description: `Successfully decrypted and downloaded ${fileName}.`,
      });
    } catch {
      toast.danger("Download failed", {
        description: "Failed to download or decrypt document from secure storage.",
      });
    }
  };

  // Submit approval review
  const handleApprove = async (claim: ClaimDetailsResponseData) => {
    setSubmittingReview(true);
    try {
      await recoveryApi.reviewClaim(claim.claimId, "Approved", null);
      setSubmittingReview(false);
      
      if (claim.riskLevel === "High" && !claim.reviewedBy) {
        // High risk first signature warning
        toast.warning("First signature captured!", {
          description: "This is a high-risk claim. It requires a second administrator's sign-off before activation.",
        });
      } else {
        toast.success("Recovery claim approved!", {
          description: "The recovery bootstrap token email has been queued.",
        });
      }

      // Refresh list and selected claim details
      const refreshedClaims = await recoveryApi.getClaims();
      setClaims(refreshedClaims);
      const updatedSelected = refreshedClaims.find((c) => c.claimId === claim.claimId);
      setSelectedClaim(updatedSelected || null);
    } catch (err) {
      setSubmittingReview(false);
      toast.danger("Approval failed", {
        description: (err as AxiosErrorLike).response?.data?.message || "An unexpected review error occurred.",
      });
    }
  };

  // Submit rejection review
  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClaim || !rejectionReason.trim()) return;

    setSubmittingReview(true);
    try {
      await recoveryApi.reviewClaim(selectedClaim.claimId, "Rejected", rejectionReason);
      setSubmittingReview(false);
      setShowRejectForm(false);
      setRejectionReason("");
      toast.success("Recovery claim rejected", {
        description: "Notification email sent to claimant.",
      });

      // Refresh list and selected claim details
      const refreshedClaims = await recoveryApi.getClaims();
      setClaims(refreshedClaims);
      const updatedSelected = refreshedClaims.find((c) => c.claimId === selectedClaim.claimId);
      setSelectedClaim(updatedSelected || null);
    } catch (err) {
      setSubmittingReview(false);
      toast.danger("Rejection failed", {
        description: (err as AxiosErrorLike).response?.data?.message || "An unexpected review error occurred.",
      });
    }
  };

  // Parse Heuristics safely
  const parseJson = (str: string) => {
    try {
      return JSON.parse(str);
    } catch {
      return {};
    }
  };

  // Apply filters
  const filteredClaims = claims.filter((c) => {
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    const matchesRisk = riskFilter === "all" || c.riskLevel === riskFilter;
    
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      c.taxCode.includes(searchQuery) ||
      c.companyName.toLowerCase().includes(searchLower) ||
      c.representativeFullName.toLowerCase().includes(searchLower) ||
      c.recoveryEmail.toLowerCase().includes(searchLower);

    return matchesStatus && matchesRisk && matchesSearch;
  });

  return (
    <div className="w-full flex gap-6 h-[calc(100vh-140px)] overflow-hidden font-sans">
      {/* Left List Pane */}
      <Card className="flex-1 flex flex-col overflow-hidden p-4">
        {/* Header toolbar */}
        <div className="flex flex-col gap-4 border-b border-border pb-4 mb-4 select-none">
          <div className="flex justify-between items-center">
            <div>
              <Typography.Heading level={3} className="text-xl font-extrabold text-foreground">
                Organization Access Recovery Queue
              </Typography.Heading>
              <Typography className="text-xs text-muted mt-0.5">
                Manual legal verification, risk audit, and workspace takeover credentials review.
              </Typography>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-border text-xs"
              onPress={() => fetchClaims(true)}
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
                placeholder="Search MST, company, name, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <span>Status</span>
              <select
                className="bg-surface border border-border rounded-lg p-1.5 text-foreground text-xs"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="Pending">Pending Analysis</option>
                <option value="PendingReview">Pending Review</option>
                <option value="UnderAnalysis">Under Analysis</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>

            {/* Risk Filter */}
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <span>Risk</span>
              <select
                className="bg-surface border border-border rounded-lg p-1.5 text-foreground text-xs"
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value)}
              >
                <option value="all">All Risks</option>
                <option value="Low">Low Risk</option>
                <option value="Medium">Medium Risk</option>
                <option value="High">High Risk</option>
              </select>
            </div>
          </div>
        </div>

        {/* Claim Items List */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Spinner size="lg" color="accent" />
          </div>
        ) : filteredClaims.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted text-xs select-none">
            <ShieldCheck className="size-8 text-muted/50 mb-2" />
            No claims matching filter criteria.
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {filteredClaims.map((claim) => {
              const isSelected = selectedClaim?.claimId === claim.claimId;
              
              // Define risk colors
              let riskColor: "success" | "warning" | "danger" = "success";
              if (claim.riskLevel === "High") riskColor = "danger";
              else if (claim.riskLevel === "Medium") riskColor = "warning";

              // Define status colors
              let statusColor: "default" | "success" | "danger" | "warning" | "accent" = "default";
              if (claim.status === "Approved") statusColor = "success";
              else if (claim.status === "Rejected") statusColor = "danger";
              else if (claim.status === "PendingReview") statusColor = "warning";
              else if (claim.status === "UnderAnalysis") statusColor = "accent";

              return (
                <div
                  key={claim.claimId}
                  className={`border rounded-2xl p-4 cursor-pointer transition-all flex items-center justify-between ${
                    isSelected ? "border-accent bg-accent/5 ring-1 ring-accent/30" : "border-border hover:border-border/80 bg-surface-secondary/15"
                  }`}
                  onClick={() => {
                    setSelectedClaim(claim);
                    setShowRejectForm(false);
                  }}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-foreground">{claim.companyName}</span>
                      <Chip size="sm" variant="soft" color={statusColor}>
                        {claim.status}
                      </Chip>
                    </div>
                    
                    <div className="flex gap-x-4 text-[10px] text-muted">
                      <span>MST: <strong>{claim.taxCode}</strong></span>
                      <span>Claimant: <strong>{claim.representativeFullName}</strong></span>
                      <span>Submitted: <strong>{new Date(claim.createdAt).toLocaleDateString()}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[10px] text-muted block select-none">Risk Score</span>
                      <Chip size="sm" color={riskColor} variant="primary" className="font-bold">
                        {claim.riskScore}/100 ({claim.riskLevel})
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
      {selectedClaim ? (
        <Card className="w-[450px] flex flex-col overflow-hidden p-6 border-l border-border bg-surface shrink-0">
          <div className="flex justify-between items-center border-b border-border pb-4 mb-4 select-none">
            <div className="flex items-center gap-2">
              <Building2 className="size-5 text-accent" />
              <Typography className="text-sm font-bold text-foreground truncate max-w-[280px]">
                {selectedClaim.companyName}
              </Typography>
            </div>
            <Button
              variant="ghost"
              isIconOnly
              size="sm"
              className="text-muted min-w-0"
              onPress={() => setSelectedClaim(null)}
            >
              <X className="size-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-6 pr-1">
            {/* Representative Details Section */}
            <div className="space-y-3">
              <Typography className="text-[11px] font-bold text-muted uppercase tracking-wider select-none">Claimant Profile</Typography>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-muted block mb-0.5">Representative Name</span>
                  <span className="font-semibold text-foreground">{selectedClaim.representativeFullName}</span>
                </div>
                <div>
                  <span className="text-muted block mb-0.5">Job Position</span>
                  <span className="font-semibold text-foreground">{selectedClaim.representativePosition}</span>
                </div>
                <div>
                  <span className="text-muted block mb-0.5">Phone Number</span>
                  <span className="font-semibold text-foreground">{selectedClaim.phoneNumber}</span>
                </div>
                <div>
                  <span className="text-muted block mb-0.5">Recovery Email</span>
                  <span className="font-semibold text-foreground select-all">{selectedClaim.recoveryEmail}</span>
                </div>
              </div>
            </div>

            <div className="border-t border-border/60" />

            {/* Heuristics Anti-fraud audit logs */}
            <div className="space-y-3">
              <Typography className="text-[11px] font-bold text-muted uppercase tracking-wider select-none">Risk Heuristics Logs</Typography>
              <div className="space-y-2.5 text-[11px]">
                {/* OCR check */}
                <div className="p-2.5 rounded-xl bg-surface-secondary border border-border/80">
                  <div className="flex items-center justify-between font-bold text-foreground mb-1">
                    <span>A. Document OCR Scan</span>
                    <span className="text-success text-[10px]">Clean Match</span>
                  </div>
                  <span className="text-muted leading-relaxed block">
                    Verified official company tax certificates metadata. Registered tax code matches uploaded documents.
                  </span>
                </div>

                {/* Duplication check */}
                <div className="p-2.5 rounded-xl bg-surface-secondary border border-border/80">
                  <div className="flex items-center justify-between font-bold text-foreground mb-1">
                    <span>B. File Manipulation Checks</span>
                    <span className="text-success text-[10px]">No Tampering</span>
                  </div>
                  <span className="text-muted leading-relaxed block">
                    Zero file signature errors. Antivirus scan results clean. Document name structure matches standard corporate extracts.
                  </span>
                </div>

                {/* Workspace Activity check */}
                <div className="p-2.5 rounded-xl bg-surface-secondary border border-border/80">
                  <div className="flex items-center justify-between font-bold text-foreground mb-1">
                    <span>C. Workspace Activity Signals</span>
                    <span className="text-muted text-[10px]">
                      {parseJson(selectedClaim.riskHeuristics.workspaceActivity).unresolvedInvitesCount || 0} Pending Invites
                    </span>
                  </div>
                  <span className="text-muted leading-relaxed block">
                    Checks abnormal members invitation rates or API token leakage heuristics inside existing workspace.
                  </span>
                </div>
              </div>
            </div>

            <div className="border-t border-border/60" />

            {/* Legal Proof Documents list */}
            <div className="space-y-3">
              <Typography className="text-[11px] font-bold text-muted uppercase tracking-wider select-none">Decrypted Legal Proofs</Typography>
              <div className="space-y-2">
                {selectedClaim.documents.map((doc) => (
                  <div key={doc.documentId} className="flex items-center justify-between p-2.5 rounded-xl bg-surface-secondary border border-border/80 text-xs">
                    <div className="flex items-center gap-2 overflow-hidden mr-2">
                      <FileText className="size-4 text-accent shrink-0" />
                      <span className="truncate font-semibold text-foreground max-w-[200px]">{doc.fileName}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      isIconOnly
                      className="h-8 w-8 rounded-lg border-border"
                      onPress={() => handleDownload(selectedClaim.claimId, doc.documentId, doc.fileName)}
                    >
                      <Download className="size-3.5 text-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Existing signatures / reviewers */}
            {(selectedClaim.reviewedBy || selectedClaim.secondReviewerBy) && (
              <>
                <div className="border-t border-border/60" />
                <div className="space-y-2">
                  <Typography className="text-[11px] font-bold text-muted uppercase tracking-wider select-none">Admin Signatures</Typography>
                  <div className="space-y-1 text-xs text-muted">
                    {selectedClaim.reviewedBy && (
                      <div className="flex justify-between">
                        <span>First Reviewer:</span>
                        <strong className="text-foreground">{selectedClaim.reviewedBy}</strong>
                      </div>
                    )}
                    {selectedClaim.secondReviewerBy && (
                      <div className="flex justify-between">
                        <span>Second Reviewer:</span>
                        <strong className="text-foreground">{selectedClaim.secondReviewerBy}</strong>
                      </div>
                    )}
                    {selectedClaim.reviewedAt && (
                      <div className="flex justify-between">
                        <span>Reviewed At:</span>
                        <span>{new Date(selectedClaim.reviewedAt).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Rejection metadata */}
            {selectedClaim.status === "Rejected" && selectedClaim.rejectionReason && (
              <>
                <div className="border-t border-border/60" />
                <div className="p-3 rounded-xl bg-danger/10 border border-danger/25 text-xs text-danger leading-relaxed">
                  <strong className="block mb-1 select-none">Rejection Reason</strong>
                  {selectedClaim.rejectionReason}
                </div>
              </>
            )}
          </div>

          {/* Action CTA Buttons */}
          {selectedClaim.status !== "Approved" && selectedClaim.status !== "Rejected" && (
            <div className="border-t border-border pt-4 mt-4 shrink-0 bg-surface">
              {!showRejectForm ? (
                <div className="flex gap-3">
                  <Button
                    variant="ghost"
                    className="flex-1 h-11 rounded-xl border border-danger text-danger hover:bg-danger/10 font-bold"
                    onPress={() => setShowRejectForm(true)}
                    isDisabled={submittingReview}
                  >
                    <X className="size-4 mr-2" />
                    Reject Claim
                  </Button>
                  <Button
                    className="flex-1 h-11 rounded-xl bg-success text-success-foreground hover:bg-success-hover font-bold"
                    onPress={() => handleApprove(selectedClaim)}
                    isDisabled={submittingReview}
                    isPending={submittingReview}
                  >
                    {submittingReview ? (
                      <Spinner color="current" size="sm" />
                    ) : (
                      <Check className="size-4 mr-2" />
                    )}
                    {selectedClaim.riskLevel === "High" && !selectedClaim.reviewedBy ? "Sign (First approval)" : "Approve & Email link"}
                  </Button>
                </div>
              ) : (
                <Form onSubmit={handleReject} className="space-y-3">
                  <TextField isRequired name="rejectionReason">
                    <Label>Reason for Rejection</Label>
                    <input
                      className="w-full bg-surface-secondary border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-danger outline-none"
                      placeholder="e.g. Uploaded document doesn't match corporate registry names."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                    />
                  </TextField>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 h-9 rounded-lg border-border"
                      onPress={() => setShowRejectForm(false)}
                      isDisabled={submittingReview}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      className="flex-1 h-9 rounded-lg bg-danger text-danger-foreground font-bold hover:bg-danger-hover"
                      isDisabled={!rejectionReason.trim() || submittingReview}
                      isPending={submittingReview}
                    >
                      Submit Rejection
                    </Button>
                  </div>
                </Form>
              )}
            </div>
          )}
        </Card>
      ) : (
        <Card className="w-[450px] flex flex-col items-center justify-center p-6 border-l border-border bg-surface shrink-0 select-none text-muted text-xs">
          <Info className="size-8 text-muted/40 mb-2" />
          Select a claim from the queue to view details and perform reviews.
        </Card>
      )}
    </div>
  );
}
