"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/hooks/use-auth";
import {
  forumApi,
  type ReportResponse
} from "@/services/forum.service";
import {
  Chip,
  Spinner,
  TextArea,
  Button,
  Skeleton
} from "@heroui/react";
import { PaginationWrapper } from "@/components/ui/pagination-wrapper";
import { Card } from "@/components/ui/card";
import {
  ShieldAlert,
  Check,
  XCircle,
  CornerDownRight,
  ChevronLeft,
  Calendar,
  AlertTriangle
} from "lucide-react";
import { PublicPageShell } from "@/components/ui/public-page-shell";

export default function ModerationQueuePage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();

  // States
  const [reports, setReports] = useState<ReportResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination states
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Resolution form states
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Safeguard: only moderators and admins can access this page
  useEffect(() => {
    if (isAuthenticated) {
      if (user && user.role !== "ADMIN") {
        router.push("/forum");
      }
    } else {
      router.push("/login?redirect=/forum/moderation");
    }
  }, [isAuthenticated, user, router]);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await forumApi.getReports(page, pageSize);
      setReports(result.items || []);
      setTotalPages(result.totalPages || 1);
      setTotalItems(result.totalItems || 0);
    } catch (err: any) {
      setError(err?.message || "Failed to load moderation queue.");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    if (isAuthenticated && user && user.role === "ADMIN") {
      loadReports();
    }
  }, [loadReports, isAuthenticated, user]);

  const handleResolve = async (id: string, status: 'RESOLVED' | 'DISMISSED') => {
    setActionLoading(true);
    try {
      await forumApi.resolveReport(id, status, notes.trim() || undefined);
      setResolvingId(null);
      setNotes("");
      // Reload queue
      await loadReports();
    } catch (err) {
      console.error("Failed to resolve report", err);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <PublicPageShell>
      <div className="w-full flex flex-col gap-6 text-left">
        
        {/* Navigation back */}
        <div>
          <Button
            variant="tertiary"
            size="sm"
            onPress={() => router.push("/forum")}
            className="text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="w-4 h-4 mr-1 inline-block align-middle" />
            <span>Back to Forum</span>
          </Button>
        </div>

        {/* Title */}
        <div className="flex flex-col gap-1.5 border-b border-border/40 pb-6">
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-primary" />
            Moderation Queue
          </h1>
          <p className="text-muted-foreground text-sm">
            Review reported discussions, replies, and users flagged for content guidelines violations.
          </p>
        </div>

        {error && (
          <Card className="p-4 bg-danger-950/10 border border-danger/20 text-danger text-sm font-semibold">
            {error}
          </Card>
        )}

        {/* Queue Content */}
        {loading ? (
          <div className="flex flex-col gap-4">
            {[1, 2].map((i) => (
              <Card key={i} className="p-6 border border-border/60 flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <Skeleton className="h-6 rounded-md w-24" />
                  <Skeleton className="h-4 rounded-md w-32" />
                </div>
                <div className="flex flex-col gap-2 p-4 bg-muted/10 rounded-2xl">
                  <Skeleton className="h-4 rounded-md w-1/4" />
                  <Skeleton className="h-5 rounded-md w-full" />
                </div>
                <div className="flex justify-end gap-2">
                  <Skeleton className="h-8 rounded-md w-20" />
                  <Skeleton className="h-8 rounded-md w-20" />
                </div>
              </Card>
            ))}
          </div>
        ) : reports.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground flex flex-col items-center gap-3 border-dashed">
            <Check className="w-12 h-12 text-success/60 bg-success-950/10 p-2.5 rounded-full" />
            <h3 className="text-lg font-bold text-foreground">Moderation queue is clean</h3>
            <p className="text-sm max-w-sm">There are currently no pending abuse or guidelines reports to review. Good job!</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            {reports.map((report) => (
              <Card key={report.id} className="p-6 border border-border/60 text-left flex flex-col gap-4">
                
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Chip
                      size="sm"
                      color={report.status === "PENDING" ? "warning" : report.status === "RESOLVED" ? "success" : "default"}
                      variant="soft"
                    >
                      {report.status}
                    </Chip>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(report.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Reported by: <span className="font-semibold text-foreground">@{report.reporter.username || "reporter"}</span>
                  </div>
                </div>

                {/* Violation Details */}
                <div className="flex flex-col gap-2 bg-muted/20 p-4 rounded-2xl border border-border/40">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Violation Flagged Content
                  </span>
                  
                  {report.topicId && (
                    <div className="text-sm text-foreground">
                      Topic:{" "}
                      <span
                        className="font-bold text-primary hover:underline cursor-pointer"
                        onClick={() => router.push(`/forum/topic/${report.id}`)} // Fallback slug resolve or navigation
                      >
                        {report.topicTitle || "View Discussion Thread"}
                      </span>
                    </div>
                  )}

                  {report.replyId && (
                    <div className="text-sm text-foreground flex flex-col gap-1">
                      <span className="font-semibold text-muted-foreground text-xs flex items-center gap-1">
                        <CornerDownRight className="w-3 h-3" />
                        Reply Excerpt:
                      </span>
                      <p className="italic text-foreground/80 pl-4 border-l-2 border-border/80">
                        {report.replyExcerpt}
                      </p>
                    </div>
                  )}

                  {report.reportedUserId && (
                    <div className="text-sm text-foreground">
                      Reported User: <span className="font-bold text-danger">@{report.reportedUserName}</span>
                    </div>
                  )}

                  <div className="text-sm text-foreground/90 mt-2 flex gap-2 items-start">
                    <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                    <p>
                      <strong>Reason:</strong> {report.reason}
                    </p>
                  </div>
                </div>

                {/* Resolution panel */}
                {report.status === "PENDING" && (
                  <div className="flex flex-col gap-3 mt-2">
                    {resolvingId === report.id ? (
                      <div className="flex flex-col gap-3">
                        <TextArea
                          placeholder="Enter audit/resolution notes for the moderator logs..."
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          rows={2}
                          className="bg-surface text-sm"
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onPress={() => { setResolvingId(null); setNotes(""); }}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            isDisabled={actionLoading}
                            onPress={() => handleResolve(report.id, "RESOLVED")}
                          >
                            {actionLoading ? (
                              <Spinner size="sm" color="current" className="mr-1.5" />
                            ) : (
                              <XCircle className="w-4 h-4 mr-1.5 inline-block align-middle" />
                            )}
                            <span>Resolve (Remove Content)</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            isDisabled={actionLoading}
                            onPress={() => handleResolve(report.id, "DISMISSED")}
                          >
                            {actionLoading ? (
                              <Spinner size="sm" color="current" className="mr-1.5" />
                            ) : (
                              <Check className="w-4 h-4 mr-1.5 inline-block align-middle" />
                            )}
                            <span>Dismiss (Keep Content)</span>
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          variant="primary"
                          onPress={() => setResolvingId(report.id)}
                        >
                          Resolve Report
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Auditor History */}
                {report.status !== "PENDING" && report.resolvedByName && (
                  <div className="text-xs text-muted-foreground/80 mt-2 border-t border-border/40 pt-3">
                    Resolved by: <strong className="text-foreground">{report.resolvedByName}</strong>
                    {report.resolutionNotes && (
                      <p className="mt-1 font-mono bg-muted/20 p-2 rounded-lg italic">
                        Notes: {report.resolutionNotes}
                      </p>
                    )}
                  </div>
                )}

              </Card>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6">
            <PaginationWrapper
              page={page}
              totalPages={totalPages}
              totalItems={totalItems}
              itemsPerPage={pageSize}
              onPageChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            />
          </div>
        )}

      </div>
    </PublicPageShell>
  );
}
