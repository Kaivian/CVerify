"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { recoveryApi } from "@/features/auth/services/recovery.service";
import {
  Card,
  Typography,
  Button,
  Form,
  toast,
  Spinner,
} from "@heroui/react";
import {
  ShieldCheck,
  AlertTriangle,
  Building2,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRightLeft,
} from "lucide-react";
import axios from "axios";

// Validation schema for governance vote submission
const voteSchema = z.object({
  decision: z.enum(["approve", "reject"], {
    message: "You must select a decision to submit.",
  }),
});

type VoteInput = z.infer<typeof voteSchema>;

interface ParsedTokenPayload {
  requestId: string;
  approverUserId: string;
  approverRole: string;
  exp: number;
}

export function AdminVoteView() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") || "";

  const [parsedPayload, setParsedPayload] = useState<ParsedTokenPayload | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [voteReceipt, setVoteReceipt] = useState<{
    decision: "approve" | "reject";
    timestamp: string;
  } | null>(null);

  const {
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<VoteInput>({
    resolver: zodResolver(voteSchema),
  });

  const selectedDecision = watch("decision");

  // Client-side base64 token parsing for presentation details
  useEffect(() => {
    if (!token) {
      setTokenError("Security token is missing from the URL. Please verify your voting link.");
      return;
    }

    try {
      const parts = token.split(".");
      if (parts.length !== 2) {
        setTokenError("Cryptographic token has invalid structure.");
        return;
      }

      const payloadBase64 = parts[0];
      const decodedJson = atob(payloadBase64);
      const payload: ParsedTokenPayload = JSON.parse(decodedJson);

      // Verify expiration client-side for UX feedback
      const currentTime = Math.floor(Date.now() / 1000);
      if (currentTime > payload.exp) {
        setTokenError("This voting link has expired (48-hour validity exceeded).");
        return;
      }

      setParsedPayload(payload);
    } catch (err) {
      console.error("Token decoding error", err);
      setTokenError("Failed to parse the cryptographic security token.");
    }
  }, [token]);

  const onSubmitVote = async (data: VoteInput) => {
    setIsSubmitting(true);
    try {
      await recoveryApi.level2SubmitAdminVote({
        token,
        decision: data.decision,
      });

      setVoteReceipt({
        decision: data.decision,
        timestamp: new Date().toISOString(),
      });

      toast.success("Governance Vote Recorded", {
        description: `Your ${data.decision === "approve" ? "approval" : "rejection"} vote has been securely recorded.`,
      });
    } catch (err) {
      const errorMessage =
        axios.isAxiosError(err) && err.response?.data?.message
          ? err.response.data.message
          : "Failed to record your vote. The token may be expired or already used.";
      toast.danger("Vote Submission Failed", {
        description: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. Error / Invalid token layout
  if (tokenError) {
    return (
      <Card className="w-full relative overflow-hidden max-h-[85vh] flex flex-col premium-glass border-danger/20">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-danger shrink-0" />
        <div className="flex flex-col items-center p-8 overflow-y-auto">
          <div className="w-16 h-16 bg-danger/15 flex items-center justify-center rounded-2xl mb-6 border border-danger/35 animate-pulse">
            <XCircle className="size-8 text-danger" />
          </div>

          <Typography.Heading level={3} className="text-2xl font-extrabold text-foreground text-center">
            Invalid Voting Link
          </Typography.Heading>

          <Typography className="text-sm text-muted text-center mt-2 max-w-sm leading-relaxed">
            {tokenError}
          </Typography>

          <div className="w-full mt-8 flex flex-col gap-3">
            <Button
              className="h-12 rounded-xl bg-foreground text-background font-bold w-full"
              onPress={() => router.push("/login")}
            >
              Return to Login
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  // 2. Success / Reclaim decision cast layout
  if (voteReceipt) {
    const isApproved = voteReceipt.decision === "approve";
    return (
      <Card className="w-full relative overflow-hidden max-h-[85vh] flex flex-col premium-glass border-accent/20">
        <div className={`absolute top-0 left-0 w-full h-1.5 shrink-0 ${isApproved ? "bg-success" : "bg-danger"}`} />
        <div className="flex flex-col items-center p-8 overflow-y-auto">
          <div className={`w-16 h-16 flex items-center justify-center rounded-2xl mb-6 border ${
            isApproved
              ? "bg-success/15 border-success/35 text-success"
              : "bg-danger/15 border-danger/35 text-danger"
          }`}>
            {isApproved ? <CheckCircle2 className="size-8" /> : <XCircle className="size-8" />}
          </div>

          <Typography.Heading level={3} className="text-2xl font-extrabold text-foreground text-center">
            Decision Successfully Registered
          </Typography.Heading>

          <Typography className="text-sm text-muted text-center mt-2 max-w-md leading-relaxed">
            Your decision has been digitally signed and logged in the immutable compliance audit logs.
          </Typography>

          <div className="w-full mt-6 space-y-4 p-5 rounded-2xl bg-surface-secondary border border-border select-none">
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted">Decision Action</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                isApproved
                  ? "bg-success/15 text-success border-success/20"
                  : "bg-danger/15 text-danger border-danger/20"
              }`}>
                {isApproved ? "Approved Representative Change" : "Rejected Representative Change"}
              </span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-muted">Approver Role</span>
              <span className="font-mono font-semibold text-foreground uppercase">
                {parsedPayload?.approverRole.replace("_", " ")}
              </span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-muted">Transaction ID</span>
              <span className="font-mono text-muted select-all">
                {parsedPayload?.requestId}
              </span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-muted">Logged Timestamp</span>
              <span className="font-semibold text-foreground">
                {new Date(voteReceipt.timestamp).toLocaleString()}
              </span>
            </div>
          </div>

          <div className="w-full mt-8">
            <Button
              className="h-12 rounded-xl bg-foreground text-background font-bold w-full"
              onPress={() => router.push("/login")}
            >
              Return to Login
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  // 3. Loading state while decoding token
  if (!parsedPayload) {
    return (
      <Card className="w-full p-12 flex flex-col items-center justify-center min-h-[300px]">
        <Spinner size="lg" />
        <Typography className="text-sm text-muted mt-4 select-none">
          Securing cryptographic trust layer...
        </Typography>
      </Card>
    );
  }

  // 4. Main Voting Form
  return (
    <Card className="w-full relative overflow-hidden max-h-[85vh] flex flex-col premium-glass border-accent/20">
      <div className="absolute top-0 left-0 w-full h-1.5 bg-accent shrink-0" />
      
      {/* Premium Governance Header */}
      <div className="w-full flex items-center justify-between px-6 py-4 border-b border-border shrink-0 select-none">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center border border-accent/20">
            <ShieldCheck className="size-4 text-accent" />
          </div>
          <div>
            <Typography className="text-sm font-bold text-foreground leading-none">
              Governance Voting Dashboard
            </Typography>
            <Typography className="text-[10px] text-muted font-medium mt-1 leading-none">
              Level 2 Representative Rotation Authority
            </Typography>
          </div>
        </div>
      </div>

      <Form
        className="w-full flex flex-col flex-1 overflow-hidden"
        onSubmit={handleSubmit(onSubmitVote)}
      >
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
          {/* Trust Alert */}
          <div className="p-4 rounded-xl bg-warning/10 border border-warning/20 flex gap-3 text-left items-start select-none">
            <AlertTriangle className="size-5 text-warning shrink-0 mt-0.5" />
            <div>
              <Typography className="text-xs font-bold text-warning">Irreversible Administrative Override</Typography>
              <Typography className="text-[10px] text-muted mt-1 leading-normal">
                Approving this action authorizes a complete rotation of the official representative. Active user sessions, refresh tokens, and integration credentials will be revoked to secure workspace transition.
              </Typography>
            </div>
          </div>

          {/* Request Metadata Details */}
          <div className="p-5 rounded-2xl bg-surface-secondary border border-border space-y-4">
            <div className="flex items-center gap-3">
              <Building2 className="size-5 text-muted shrink-0" />
              <div>
                <Typography className="text-[10px] text-muted leading-none">Registered Role</Typography>
                <Typography className="text-sm font-bold text-foreground mt-1 capitalize leading-none">
                  {parsedPayload.approverRole.replace("_", " ")}
                </Typography>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Clock className="size-5 text-muted shrink-0" />
              <div>
                <Typography className="text-[10px] text-muted leading-none">Link Validity Expiration</Typography>
                <Typography className="text-xs font-semibold text-foreground mt-1 leading-none">
                  {new Date(parsedPayload.exp * 1000).toLocaleString()}
                </Typography>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <ArrowRightLeft className="size-5 text-muted shrink-0" />
              <div>
                <Typography className="text-[10px] text-muted leading-none">Governance Request ID</Typography>
                <Typography className="text-[10px] font-mono font-bold text-muted/80 mt-1 select-all leading-none">
                  {parsedPayload.requestId}
                </Typography>
              </div>
            </div>
          </div>

          {/* Dynamic Interactive Decision Panel */}
          <div className="space-y-3">
            <Typography className="text-xs font-bold text-foreground select-none">
              Cast Your Administrative Vote
            </Typography>

            <div className="grid grid-cols-2 gap-4">
              <div
                onClick={() => setValue("decision", "approve")}
                className={`cursor-pointer p-4 rounded-xl border flex flex-col items-center justify-center text-center transition-all ${
                  selectedDecision === "approve"
                    ? "bg-success/15 border-success text-success shadow-lg shadow-success/15"
                    : "bg-surface-secondary border-border text-muted hover:border-border-hover"
                }`}
              >
                <CheckCircle2 className="size-6 mb-2" />
                <span className="text-xs font-bold">Approve Rotation</span>
                <span className="text-[9px] text-muted/80 mt-1 leading-normal">
                  Validate successor and execute credential takeover.
                </span>
              </div>

              <div
                onClick={() => setValue("decision", "reject")}
                className={`cursor-pointer p-4 rounded-xl border flex flex-col items-center justify-center text-center transition-all ${
                  selectedDecision === "reject"
                    ? "bg-danger/15 border-danger text-danger shadow-lg shadow-danger/15"
                    : "bg-surface-secondary border-border text-muted hover:border-border-hover"
                }`}
              >
                <XCircle className="size-6 mb-2" />
                <span className="text-xs font-bold">Reject Request</span>
                <span className="text-[9px] text-muted/80 mt-1 leading-normal">
                  Abort change authority and alert the compliance team.
                </span>
              </div>
            </div>
            {errors.decision && (
              <p className="text-[10px] text-danger font-medium mt-1 select-none">
                {errors.decision.message}
              </p>
            )}
          </div>
        </div>

        {/* Submit Actions */}
        <div className="p-4 border-t border-border shrink-0 bg-surface">
          <Button
            type="submit"
            fullWidth
            className={`h-12 text-foreground font-bold transition-all ${
              selectedDecision === "approve"
                ? "bg-success hover:bg-success/90 text-success-foreground"
                : selectedDecision === "reject"
                  ? "bg-danger hover:bg-danger/90 text-danger-foreground"
                  : "bg-foreground text-background"
            }`}
            isDisabled={isSubmitting || !selectedDecision}
          >
            {isSubmitting ? (
              <Spinner color="current" size="sm" />
            ) : (
              <>
                <ShieldCheck className="size-4 mr-2" />
                Submit Digital Vote
              </>
            )}
          </Button>
        </div>
      </Form>
    </Card>
  );
}
