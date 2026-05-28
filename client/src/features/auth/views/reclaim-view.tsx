"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import OtpInput from "@/components/ui/otp-input";
import { recoveryApi } from "@/features/auth/services/recovery.service";
import { authApi } from "@/features/auth/services/auth.service";
import {
  Card,
  Typography,
  Button,
  TextField,
  Input,
  Form,
  Label,
  FieldError,
  toast,
  Spinner,
  Description,
} from "@heroui/react";
import {
  Building2,
  ArrowLeft,
  Mail,
  FileText,
  Upload,
  AlertTriangle,
  ShieldCheck,
  X,
  FileCheck2,
} from "lucide-react";
import { RecoveryEmailBlockedState } from "@/features/auth/components/recovery-email-blocked-state";
import axios from "axios";

export enum ReclaimStep {
  RepresentativeInfo = "REPRESENTATIVE_INFO",
  EmailOwnershipBlocked = "EMAIL_OWNERSHIP_BLOCKED",
  OtpVerification = "OTP_VERIFICATION",
  DocumentsUpload = "DOCUMENTS_UPLOAD",
  SuccessReceipt = "SUCCESS_RECEIPT",
}

interface Level2Request {
  requestId?: string;
  organizationId?: string;
  requestedRepresentative?: string;
  verificationCallStatus?: string;
  adminApprovalStatus?: string;
  supportApprovalStatus?: string;
  finalDecision?: string;
}

export function ReclaimView() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Route parameters
  const taxCode = searchParams.get("taxCode") || "";
  const companyName = searchParams.get("companyName") || "";

  // Step state: strongly typed
  const [step, setStep] = useState<ReclaimStep>(ReclaimStep.RepresentativeInfo);
  const [isValidatingOwnership, setIsValidatingOwnership] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Form State
  const [fullName, setFullName] = useState("");
  const [position, setPosition] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");

  // Touched Validation States
  const [fullNameTouched, setFullNameTouched] = useState(false);
  const [positionTouched, setPositionTouched] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);

  // OTP State
  const [challengeId, setChallengeId] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [emailVerificationToken, setEmailVerificationToken] = useState("");
  const [ownershipValidated, setOwnershipValidated] = useState(false);
  const [lastValidatedEmail, setLastValidatedEmail] = useState("");

  // Clean Reset Helper
  const resetOtpFlowState = (clearEmail: boolean = false) => {
    console.log(`[ReclaimFlow] resetOtpFlowState invoked. ClearEmail: ${clearEmail}`);
    setChallengeId("");
    setOtpCode("");
    setCooldown(0);
    setOwnershipValidated(false);
    setLastValidatedEmail("");
    setEmailVerificationToken("");
    if (clearEmail) {
      setRecoveryEmail("");
      setEmailTouched(false);
    }
  };

  // Diagnostic Logs for step transitions
  useEffect(() => {
    console.log(`[ReclaimFlow] Transitioning to step: ${step}`);
  }, [step]);

  // Reset/Invalidate validation state if email input changes
  useEffect(() => {
    const trimmedEmail = recoveryEmail.trim().toLowerCase();
    const trimmedLastEmail = lastValidatedEmail.trim().toLowerCase();
    if (trimmedEmail !== trimmedLastEmail) {
      if (ownershipValidated || challengeId || cooldown > 0) {
        console.log(`[ReclaimFlow] Email changed from "${lastValidatedEmail}" to "${recoveryEmail}". Invalidating validation and OTP states.`);
        setOwnershipValidated(false);
        setChallengeId("");
        setOtpCode("");
        setCooldown(0);
        setEmailVerificationToken("");
      }
    }
  }, [recoveryEmail, lastValidatedEmail, ownershipValidated, challengeId, cooldown]);

  // Defensive guard to prevent premature OTP verification view rendering
  useEffect(() => {
    if (step === ReclaimStep.OtpVerification) {
      if (!ownershipValidated || !challengeId) {
        console.warn("[ReclaimFlow] Guard triggered: attempted to enter OTP verification without valid session/ownership validation. Redirecting back to RepresentativeInfo.");
        setStep(ReclaimStep.RepresentativeInfo);
      }
    }
  }, [step, ownershipValidated, challengeId]);

  // Document Upload State
  const [files, setFiles] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Level 2 Representative Rotation Flow States
  const [isLevel2, setIsLevel2] = useState(false);
  const [level2Loading, setLevel2Loading] = useState(true);
  const [level2Step, setLevel2Step] = useState(1); // 1 = Form, 2 = Progress Dashboard
  const [newRepName, setNewRepName] = useState("");
  const [newRepPosition, setNewRepPosition] = useState("");
  const [newRepEmail, setNewRepEmail] = useState("");
  const [newRepPhone, setNewRepPhone] = useState("");
  const [rotationReason, setRotationReason] = useState(
    "representative resigned",
  );
  const [optionalMsg, setOptionalMsg] = useState("");
  const [isSubmittingLevel2, setIsSubmittingLevel2] = useState(false);
  const [level2Request, setLevel2Request] = useState<Level2Request | null>(null);

  // Recovery Receipt Data
  const [receipt, setReceipt] = useState<{
    claimId: string;
    riskScore: number;
    riskLevel: string;
    status: string;
  } | null>(null);

  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);

  // Validation formulas
  const isFullNameValid = fullName.trim().length >= 3;
  const isPositionValid = position.trim().length >= 2;
  const isPhoneValid = /^[0-9+]{9,15}$/.test(phoneNumber);
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recoveryEmail);

  const isStep1Valid =
    isFullNameValid && isPositionValid && isPhoneValid && isEmailValid;

  // Level 2 Validation formulas
  const isNewRepNameValid = newRepName.trim().length >= 3;
  const isNewRepPositionValid = newRepPosition.trim().length >= 2;
  const isNewRepEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newRepEmail);
  const isNewRepPhoneValid = /^[0-9+]{9,15}$/.test(newRepPhone);
  const isLevel2FormValid =
    isNewRepNameValid &&
    isNewRepPositionValid &&
    isNewRepEmailValid &&
    isNewRepPhoneValid;

  const fetchLevel2Status = React.useCallback(async () => {
    if (!taxCode) {
      setLevel2Loading(false);
      return;
    }
    try {
      const checkRes = await recoveryApi.level2Check(taxCode);
      if (checkRes.currentEmail) {
        setRegisteredEmail(checkRes.currentEmail);
      }
      if (checkRes.isLevel2) {
        setIsLevel2(true);
        // Look up if an active rotation request already exists in system to resume tracking
        const queue = (await recoveryApi.level2GetRequests()) as Level2Request[];
        const activeReq = queue.find(
          (r) =>
            r.organizationId &&
            r.finalDecision !== "rejected" &&
            r.finalDecision !== "expired" &&
            r.finalDecision !== "approved",
        );
        if (activeReq) {
          setLevel2Request(activeReq);
          setLevel2Step(2);
        }
      }
    } catch (err) {
      console.error("Failed to check organization Level 2 status", err);
    } finally {
      setLevel2Loading(false);
    }
  }, [taxCode]);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchLevel2Status();
    });
  }, [fetchLevel2Status]);

  const handleSubmitLevel2 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLevel2FormValid) return;

    setIsSubmittingLevel2(true);
    try {
      const response = (await recoveryApi.level2RequestRotation({
        taxCode,
        newRepresentativeFullName: newRepName,
        newRepresentativePosition: newRepPosition,
        newRepresentativeEmail: newRepEmail,
        newRepresentativePhone: newRepPhone,
        reasonForRepresentativeChange: rotationReason,
        optionalSupportingMessage: optionalMsg,
      })) as Level2Request;

      setLevel2Request(response);
      setLevel2Step(2); // Advance to tracking dashboard!
      toast.success("Rotation Request Registered!", {
        description:
          "Your governance rotation request has been enqueued for review and dual-approval.",
      });
    } catch (err) {
      const errorMessage =
        axios.isAxiosError(err) && err.response?.data?.message
          ? err.response.data.message
          : "Failed to initiate Representative Rotation. Please verify details.";
      toast.danger("Initiation Failed", {
        description: errorMessage,
      });
    } finally {
      setIsSubmittingLevel2(false);
    }
  };

  // Timer cooldown ticking for OTP
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  // Dispatch OTP code securely to verify corporate email domain ownership before claiming
  const handleSendOtp = async () => {
    setEmailTouched(true);
    if (!isEmailValid) {
      console.warn("[ReclaimFlow] handleSendOtp: Invalid email address pattern.");
      return;
    }

    const currentEmail = recoveryEmail.trim();

    // Direct client check (identical check for UX convenience)
    if (
      registeredEmail &&
      currentEmail.toLowerCase() === registeredEmail.trim().toLowerCase()
    ) {
      console.log("[ReclaimFlow] handleSendOtp client block: recoveryEmail matches registeredEmail.");
      setStep(ReclaimStep.EmailOwnershipBlocked);
      return;
    }

    // Scenario 2: If we already have a valid session for the SAME email, reuse it.
    if (
      ownershipValidated &&
      challengeId &&
      currentEmail.toLowerCase() === lastValidatedEmail.trim().toLowerCase()
    ) {
      console.log(`[ReclaimFlow] handleSendOtp: Reusing existing valid OTP session for "${currentEmail}".`);
      setStep(ReclaimStep.OtpVerification);
      return;
    }

    console.log(`[ReclaimFlow] handleSendOtp: Dispatching OTP sequence for "${currentEmail}"...`);
    // Abort controller for navigation cancellation support
    const controller = new AbortController();

    setIsValidatingOwnership(true);
    try {
      // 1. Call backend to validate recovery email ownership
      console.log(`[ReclaimFlow] Calling ValidateRecoveryEmailOwnership for "${currentEmail}"...`);
      const checkRes = await recoveryApi.validateRecoveryEmailOwnership(
        taxCode,
        currentEmail,
        controller.signal
      );

      console.log("[ReclaimFlow] Ownership validation response:", checkRes);

      if (checkRes.isDuplicate) {
        console.log("[ReclaimFlow] Ownership validation result: duplicate detected.");
        setStep(ReclaimStep.EmailOwnershipBlocked);
        setIsValidatingOwnership(false);
        // Make sure to reset session state as we enter blocked state
        resetOtpFlowState(false); // keep the email so the user can see/edit it
        return;
      }

      // Ownership is valid! Update states.
      setOwnershipValidated(true);
      setLastValidatedEmail(currentEmail);

      // 2. Call re-validated backend API to send reclaim OTP
      setIsValidatingOwnership(false);
      setIsSendingOtp(true);

      console.log(`[ReclaimFlow] Requesting sendReclaimOtp for "${currentEmail}"...`);
      const result = await recoveryApi.sendReclaimOtp(
        taxCode,
        currentEmail,
        controller.signal
      );

      console.log("[ReclaimFlow] sendReclaimOtp response success. ChallengeId:", result.challengeId);
      setChallengeId(result.challengeId);
      setCooldown(result.cooldownSeconds);
      setStep(ReclaimStep.OtpVerification); // Go to OTP step
      toast.success("Security OTP sent!", {
        description: `Verification code dispatched to your recovery email ${currentEmail}.`,
      });
    } catch (err: any) {
      if (err.name === "CanceledError" || err.name === "AbortError" || axios.isCancel(err)) {
        console.log("[ReclaimFlow] OTP sending process was aborted/cancelled.");
        return; // Request was aborted, ignore state updates
      }
      
      const errorMessage =
        axios.isAxiosError(err) && err.response?.data?.message
          ? err.response.data.message
          : "Please verify that the Recovery Email is correct and try again.";
      
      console.error("[ReclaimFlow] OTP sending process failed:", errorMessage, err);
      toast.danger("Action failed", {
        description: errorMessage,
      });
    } finally {
      setIsValidatingOwnership(false);
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length < 6 || !challengeId) return;

    setIsLoading(true);
    try {
      const response = await recoveryApi.reclaimVerifyOtp({
        taxCode,
        challengeId,
        email: recoveryEmail,
        code: otpCode,
        purpose: "Reclaim",
      });

      setEmailVerificationToken(response.verificationToken);
      setStep(ReclaimStep.DocumentsUpload); // Advance to upload step
      toast.success("OTP verified successfully!", {
        description: "Your claimant corporate identity is securely verified.",
      });
    } catch (err) {
      const errorMessage =
        axios.isAxiosError(err) && err.response?.data?.message
          ? err.response.data.message
          : "The OTP code entered is incorrect or has expired.";
      toast.danger("OTP Verification failed", {
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Document management
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const selectedFiles = Array.from(e.target.files);

    // File validation: PDF/JPG/PNG only, max 10MB per file
    const invalidFile = selectedFiles.find(
      (f) =>
        !["application/pdf", "image/jpeg", "image/png"].includes(f.type) ||
        f.size > 10 * 1024 * 1024,
    );

    if (invalidFile) {
      setUploadError(
        "Files must be PDF, JPG, or PNG, and smaller than 10MB each.",
      );
      return;
    }

    setUploadError(null);
    setFiles((prev) => [...prev, ...selectedFiles]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit Claim & Upload files
  const handleStep3Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) {
      setUploadError(
        "You must upload at least one legal verification document.",
      );
      return;
    }

    setIsLoading(true);
    try {
      const response = await recoveryApi.submitClaim({
        representativeFullName: fullName,
        representativePosition: position,
        phoneNumber,
        recoveryEmail,
        taxCode,
        emailVerificationToken,
        documents: files,
      });

      setReceipt(response);
      setStep(ReclaimStep.SuccessReceipt); // Display success receipt
      toast.success("Disputed Reclaim Claim Submitted!", {
        description:
          "Our compliance managers have enqueued your legal business evidence for audit.",
      });
    } catch (err) {
      const errorMessage =
        axios.isAxiosError(err) && err.response?.data?.message
          ? err.response.data.message
          : "An unexpected error occurred during document submission.";
      toast.danger("Failed to submit claim", {
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Dedicated Blocked warning screen
  if (step === ReclaimStep.EmailOwnershipBlocked) {
    return (
      <RecoveryEmailBlockedState
        onUseAnotherEmail={() => {
          console.log("[ReclaimFlow] Blocked State: Using another email address. Resetting OTP flow and clearing email input.");
          resetOtpFlowState(true);
          setStep(ReclaimStep.RepresentativeInfo);
        }}
        onBack={() => {
          console.log("[ReclaimFlow] Blocked State: Going back to input form. Resetting OTP flow but preserving email input.");
          resetOtpFlowState(false);
          setStep(ReclaimStep.RepresentativeInfo);
        }}
      />
    );
  }

  // STEP 4: Success Receipt
  if (step === ReclaimStep.SuccessReceipt && receipt) {
    return (
      <Card className="w-full relative overflow-hidden max-h-[85vh] flex flex-col premium-glass border-accent/20">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-success shrink-0" />
        <div className="flex flex-col items-center p-8 overflow-y-auto">
          <div className="w-16 h-16 bg-success/15 flex items-center justify-center rounded-2xl mb-6 border border-success/35 animate-bounce">
            <ShieldCheck className="size-8 text-success" />
          </div>

          <Typography.Heading
            level={3}
            className="text-2xl font-extrabold text-foreground text-center"
          >
            Disputed Ownership Reclaim Registered
          </Typography.Heading>

          <Typography className="text-sm text-muted text-center mt-2 max-w-md leading-relaxed">
            Your enterprise ownership reclaim has been registered. The
            anti-fraud verification engine has queued your legal proofs for
            manual auditor sign-off.
          </Typography>

          <div className="w-full mt-6 space-y-4 p-5 rounded-2xl bg-surface-secondary border border-border">
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted">Claim Reference ID</span>
              <span className="font-mono font-semibold text-foreground select-all">
                {receipt.claimId}
              </span>
            </div>

            <div className="border-t border-border/60 my-2" />

            <div className="flex justify-between items-center text-xs">
              <span className="text-muted">Target Tax Code</span>
              <span className="font-semibold text-foreground">{taxCode}</span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-muted">Official Company Name</span>
              <span className="font-semibold text-foreground">
                {companyName}
              </span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-muted">Representative Claimant</span>
              <span className="font-semibold text-foreground">
                {fullName} ({position})
              </span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-muted">Risk Assessment Queue</span>
              <span className="font-semibold text-warning">
                Compliance Dual-Review Enforced
              </span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-muted">Review Status</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-warning/15 text-warning border border-warning/20">
                {receipt.status}
              </span>
            </div>
          </div>

          <div className="w-full mt-8 flex flex-col gap-3">
            <Button
              className="h-12 rounded-xl bg-foreground text-background font-bold w-full"
              onPress={() => router.push("/login")}
            >
              Return to Login
            </Button>
            <Typography className="text-[10px] text-muted text-center leading-normal">
              You will receive an administrative bootstrap link at{" "}
              <strong className="text-foreground">{recoveryEmail}</strong> once
              compliance validation is approved (typically under 24 hours).
            </Typography>
          </div>
        </div>
      </Card>
    );
  }

  if (level2Loading) {
    return (
      <Card className="w-full p-12 flex flex-col items-center justify-center min-h-[300px]">
        <Spinner size="lg" />
        <Typography className="text-sm text-muted mt-4 select-none">
          Securing cryptographic trust layer...
        </Typography>
      </Card>
    );
  }

  if (isLevel2) {
    return (
      <Card className="w-full relative overflow-hidden max-h-[85vh] flex flex-col">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-accent shrink-0" />

        {/* Premium Wizard Header */}
        <div className="w-full flex items-center justify-between px-6 py-4 border-b border-border shrink-0 select-none">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center border border-accent/20">
              <Building2 className="size-4 text-accent" />
            </div>
            <div>
              <Typography className="text-sm font-bold text-foreground leading-none">
                Level 2 Access Recovery
              </Typography>
              <Typography className="text-[10px] text-muted font-medium mt-1 leading-none">
                MST: {taxCode} | Governed Representative Rotation
              </Typography>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted text-[11px]"
            onPress={() => {
              if (level2Step > 1 && !level2Request) {
                setLevel2Step(1);
              } else {
                router.push("/company-verification");
              }
            }}
          >
            <ArrowLeft className="size-3.5 mr-1" />
            Return
          </Button>
        </div>

        {level2Step === 1 ? (
          <Form
            className="w-full flex flex-col flex-1 overflow-hidden"
            onSubmit={handleSubmitLevel2}
          >
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
              <div className="p-4 rounded-xl bg-surface-secondary border border-border select-none text-center mb-2">
                <Typography className="text-[11px] text-muted">
                  Legal Identity Immutability Block
                </Typography>
                <Typography className="font-bold text-foreground mt-0.5">
                  {companyName || "Verified Organization"}
                </Typography>
                <Typography className="text-[10px] text-muted/80 mt-1 leading-normal">
                  All workspace databases, settings, memberships, integrations,
                  and invoices remain strictly intact.
                </Typography>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <TextField
                  isRequired
                  name="newRepName"
                  isInvalid={newRepName.length > 0 && !isNewRepNameValid}
                >
                  <Label>New Representative Full Name</Label>
                  <Input
                    placeholder="John Doe"
                    value={newRepName}
                    onChange={(e) => setNewRepName(e.target.value)}
                    className="h-11 rounded-xl"
                  />
                  <FieldError>Must be at least 3 characters.</FieldError>
                </TextField>

                <TextField
                  isRequired
                  name="newRepPosition"
                  isInvalid={
                    newRepPosition.length > 0 && !isNewRepPositionValid
                  }
                >
                  <Label>Representative Position</Label>
                  <Input
                    placeholder="CEO / Managing Director"
                    value={newRepPosition}
                    onChange={(e) => setNewRepPosition(e.target.value)}
                    className="h-11 rounded-xl"
                  />
                  <FieldError>Must be at least 2 characters.</FieldError>
                </TextField>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <TextField
                  isRequired
                  name="newRepEmail"
                  isInvalid={newRepEmail.length > 0 && !isNewRepEmailValid}
                >
                  <Label>Corporate Email</Label>
                  <Input
                    placeholder="ceo@company.com"
                    value={newRepEmail}
                    onChange={(e) => setNewRepEmail(e.target.value)}
                    className="h-11 rounded-xl"
                  />
                  <FieldError>Please enter a valid corporate email.</FieldError>
                </TextField>

                <TextField
                  isRequired
                  name="newRepPhone"
                  isInvalid={newRepPhone.length > 0 && !isNewRepPhoneValid}
                >
                  <Label>Corporate Phone</Label>
                  <Input
                    placeholder="+84901234567"
                    value={newRepPhone}
                    onChange={(e) => setNewRepPhone(e.target.value)}
                    className="h-11 rounded-xl"
                  />
                  <FieldError>Please enter a valid phone number.</FieldError>
                </TextField>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Reason for Representative Change</Label>
                <select
                  value={rotationReason}
                  onChange={(e) => setRotationReason(e.target.value)}
                  className="w-full h-11 bg-surface-secondary border border-border rounded-xl px-3 text-sm font-medium text-foreground focus:outline-none"
                >
                  <option value="representative resigned">
                    Representative resigned
                  </option>
                  <option value="lost access">Lost access</option>
                  <option value="representative replaced">
                    Representative replaced
                  </option>
                  <option value="internal security incident">
                    Internal security incident
                  </option>
                  <option value="organizational restructuring">
                    Organizational restructuring
                  </option>
                </select>
              </div>

              <TextField name="optionalMsg">
                <Label>Optional Supporting Message</Label>
                <textarea
                  placeholder="Provide any additional context or notes here..."
                  value={optionalMsg}
                  onChange={(e) => setOptionalMsg(e.target.value)}
                  className="w-full min-h-[80px] p-3 rounded-xl bg-surface-secondary border border-border text-sm focus:outline-none text-foreground"
                />
              </TextField>
            </div>

            <div className="p-4 border-t border-border shrink-0 bg-surface">
              <Button
                type="submit"
                fullWidth
                className="h-12 bg-accent hover:bg-accent-hover text-accent-foreground font-bold"
                isDisabled={!isLevel2FormValid || isSubmittingLevel2}
                isPending={isSubmittingLevel2}
              >
                {isSubmittingLevel2 ? (
                  <Spinner color="current" size="sm" />
                ) : (
                  <ShieldCheck className="size-4 mr-2" />
                )}
                Initiate Representative Rotation
              </Button>
            </div>
          </Form>
        ) : (
          <div className="w-full flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              <div className="text-center">
                <Typography.Heading
                  level={4}
                  className="text-lg font-bold text-foreground"
                >
                  Governance Change Request Active
                </Typography.Heading>
                <Typography className="text-xs text-muted mt-1 select-none">
                  Request Reference:{" "}
                  <span className="font-mono font-bold text-foreground/80 select-all">
                    {level2Request?.requestId}
                  </span>
                </Typography>
              </div>

              {/* STUNNING STEP LIFECYCLE PROGRESS DASHBOARD */}
              <div className="w-full space-y-4 p-5 rounded-2xl bg-surface-secondary/40 border border-border">
                {/* 1. SUBMITTED */}
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-success text-success-foreground flex items-center justify-center text-xs shrink-0 font-bold">
                    ✓
                  </div>
                  <div>
                    <Typography className="text-xs font-bold text-foreground">
                      1. Rotation Request Registered
                    </Typography>
                    <Typography className="text-[10px] text-muted mt-0.5">
                      Submitted by Nominee Successor{" "}
                      {level2Request?.requestedRepresentative}
                    </Typography>
                  </div>
                </div>

                <div className="h-4 w-0.5 bg-success ml-3" />

                {/* 2. LIVE CALL VERIFICATION */}
                <div className="flex items-start gap-3">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 font-bold ${level2Request?.verificationCallStatus === "verified"
                      ? "bg-success text-success-foreground"
                      : level2Request?.verificationCallStatus === "failed"
                        ? "bg-danger text-danger-foreground"
                        : "bg-warning/15 text-warning border border-warning/20"
                      }`}
                  >
                    {level2Request?.verificationCallStatus === "verified"
                      ? "✓"
                      : "2"}
                  </div>
                  <div>
                    <Typography className="text-xs font-bold text-foreground">
                      2. Support Live Verification Process
                    </Typography>
                    <Typography
                      className={`text-[10px] font-semibold mt-0.5 ${level2Request?.verificationCallStatus === "verified"
                        ? "text-success"
                        : level2Request?.verificationCallStatus === "failed"
                          ? "text-danger"
                          : "text-warning"
                        }`}
                    >
                      {level2Request?.verificationCallStatus === "verified" &&
                        "✓ Completed Verification Call"}
                      {level2Request?.verificationCallStatus === "failed" &&
                        "✗ Verification Call Failed"}
                      {level2Request?.verificationCallStatus === "scheduled" &&
                        "⚡ Call Scheduled - Check your corporate calendar"}
                      {level2Request?.verificationCallStatus ===
                        "not_started" &&
                        "⏱ Awaiting call scheduling by auditor..."}
                    </Typography>
                  </div>
                </div>

                <div
                  className={`h-4 w-0.5 ml-3 ${level2Request?.verificationCallStatus === "verified" ? "bg-success" : "bg-border"}`}
                />

                {/* 3. ADMIN GOVERNANCE VOTE */}
                <div className="flex items-start gap-3">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 font-bold ${level2Request?.adminApprovalStatus === "approved"
                      ? "bg-success text-success-foreground"
                      : level2Request?.adminApprovalStatus === "rejected"
                        ? "bg-danger text-danger-foreground"
                        : "bg-border text-muted border border-border"
                      }`}
                  >
                    {level2Request?.adminApprovalStatus === "approved"
                      ? "✓"
                      : "3"}
                  </div>
                  <div>
                    <Typography className="text-xs font-bold text-foreground">
                      3. Existing Admin Governance Vote
                    </Typography>
                    <Typography
                      className={`text-[10px] font-semibold mt-0.5 ${level2Request?.adminApprovalStatus === "approved"
                        ? "text-success"
                        : level2Request?.adminApprovalStatus === "rejected"
                          ? "text-danger"
                          : "text-muted"
                        }`}
                    >
                      {level2Request?.adminApprovalStatus === "approved" &&
                        "✓ Approved by Predecessor Authority"}
                      {level2Request?.adminApprovalStatus === "rejected" &&
                        "✗ Rejected by Predecessor Authority"}
                      {level2Request?.adminApprovalStatus ===
                        "pending_review" &&
                        "⏱ Awaiting existing administrator vote..."}
                    </Typography>
                  </div>
                </div>

                <div
                  className={`h-4 w-0.5 ml-3 ${level2Request?.adminApprovalStatus === "approved" ? "bg-success" : "bg-border"}`}
                />

                {/* 4. SUPPORT AUDITOR REVIEW */}
                <div className="flex items-start gap-3">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 font-bold ${level2Request?.supportApprovalStatus === "approved"
                      ? "bg-success text-success-foreground"
                      : level2Request?.supportApprovalStatus === "rejected"
                        ? "bg-danger text-danger-foreground"
                        : "bg-border text-muted border border-border"
                      }`}
                  >
                    {level2Request?.supportApprovalStatus === "approved"
                      ? "✓"
                      : "4"}
                  </div>
                  <div>
                    <Typography className="text-xs font-bold text-foreground">
                      4. CVerify Support Sign-off
                    </Typography>
                    <Typography
                      className={`text-[10px] font-semibold mt-0.5 ${level2Request?.supportApprovalStatus === "approved"
                        ? "text-success"
                        : level2Request?.supportApprovalStatus === "rejected"
                          ? "text-danger"
                          : "text-muted"
                        }`}
                    >
                      {level2Request?.supportApprovalStatus === "approved" &&
                        "✓ Support Review Completed"}
                      {level2Request?.supportApprovalStatus === "rejected" &&
                        "✗ Rejected by Support Auditor"}
                      {level2Request?.supportApprovalStatus ===
                        "pending_review" &&
                        "⏱ Awaiting Auditor final review..."}
                    </Typography>
                  </div>
                </div>

                <div
                  className={`h-4 w-0.5 ml-3 ${level2Request?.finalDecision === "approved" ? "bg-success" : "bg-border"}`}
                />

                {/* 5. EXECUTION */}
                <div className="flex items-start gap-3">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 font-bold ${level2Request?.finalDecision === "approved"
                      ? "bg-success text-success-foreground"
                      : level2Request?.finalDecision === "rejected"
                        ? "bg-danger text-danger-foreground"
                        : "bg-border text-muted border border-border"
                      }`}
                  >
                    {level2Request?.finalDecision === "approved" ? "✓" : "5"}
                  </div>
                  <div>
                    <Typography className="text-xs font-bold text-foreground">
                      5. Representative Rotation Execution
                    </Typography>
                    <Typography className="text-[10px] text-muted mt-0.5">
                      {level2Request?.finalDecision === "approved" &&
                        "✓ Complete! Credentials enabled for new representative"}
                      {level2Request?.finalDecision === "rejected" &&
                        "✗ Request Rejected. Change aborted."}
                      {level2Request?.finalDecision === "pending_review" &&
                        "⏱ Awaiting final execution conditions..."}
                    </Typography>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-border shrink-0 bg-surface flex gap-3 w-full">
              <Button
                variant="secondary"
                className="flex-1 h-12 rounded-xl border border-border"
                onPress={() => router.push("/login")}
              >
                Return to Login
              </Button>
              <Button
                className="flex-1 h-12 rounded-xl bg-foreground text-background font-bold"
                onPress={fetchLevel2Status}
              >
                Refresh Status
              </Button>
            </div>
          </div>
        )}
      </Card>
    );
  }

  return (
    <Card className="w-full relative overflow-hidden max-h-[75vh] flex flex-col">
      <div className="absolute top-0 left-0 w-full h-1.5 bg-accent shrink-0" />

      {/* Premium Wizard Header */}
      <div className="w-full flex items-center justify-between px-6 py-4 border-b border-border shrink-0 select-none">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center border border-accent/20">
            <Building2 className="size-4 text-accent" />
          </div>
          <div>
            <Typography className="text-sm font-bold text-foreground leading-none">
              Reclaim Organization Ownership
            </Typography>
            <Typography className="text-[10px] text-muted font-medium mt-1 leading-none">
              MST: {taxCode} | Exceptional Recovery
            </Typography>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted text-[11px]"
          onPress={() => {
            if (step === ReclaimStep.OtpVerification) {
              setStep(ReclaimStep.RepresentativeInfo);
            } else if (step === ReclaimStep.DocumentsUpload) {
              setStep(ReclaimStep.OtpVerification);
            } else {
              router.push("/company-verification");
            }
          }}
        >
          <ArrowLeft className="size-3.5 mr-1" />
          {step !== ReclaimStep.RepresentativeInfo ? "Previous" : "Cancel"}
        </Button>
      </div>

      {/* PROGRESS TIMELINE */}
      <div className="w-full h-1 bg-surface-secondary shrink-0">
        <div
          className="h-full bg-accent transition-all duration-300"
          style={{
            width:
              step === ReclaimStep.RepresentativeInfo
                ? "33.3%"
                : step === ReclaimStep.OtpVerification
                ? "66.6%"
                : "100%",
          }}
        />
      </div>

      {/* STEP 1: CLAIMANT POSITION & EMAIL CHALLENGE */}
      {step === ReclaimStep.RepresentativeInfo && (
        <Form
          className="w-full flex flex-col flex-1 overflow-hidden"
          onSubmit={(e) => {
            e.preventDefault();
            handleSendOtp();
          }}
        >
          <div className="flex-1 overflow-y-auto px-6 space-y-6">
            <div className="px-4 py-2 rounded-xl bg-surface-secondary border border-border">
              <Typography className="text-[11px] text-muted">
                Target Disputed Entity: <span className="font-bold text-foreground">
                  {companyName}
                </span>
              </Typography>

            </div>

            <TextField
              isRequired
              name="fullName"
              isInvalid={fullNameTouched && !isFullNameValid}
            >
              <Label>Claimant Full Name</Label>
              <Input
                placeholder="Enter your official full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                onBlur={(e) => setFullNameTouched(e.target.value.length > 0)}
              />
              <FieldError>Full name must be at least 3 characters.</FieldError>
            </TextField>

            <div className="grid grid-cols-2 gap-4">
              <TextField
                isRequired
                name="position"
                isInvalid={positionTouched && !isPositionValid}
              >
                <Label>Your Position / Job Title</Label>
                <Input
                  placeholder="e.g. CEO, Director"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  onBlur={(e) => setPositionTouched(e.target.value.length > 0)}
                />
                <FieldError>
                  Job title must be at least 2 characters.
                </FieldError>
              </TextField>

              <TextField
                isRequired
                name="phoneNumber"
                isInvalid={phoneTouched && !isPhoneValid}
              >
                <Label>Contact Phone Number</Label>
                <Input
                  placeholder="e.g. +84901234567"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  onBlur={(e) => setPhoneTouched(e.target.value.length > 0)}
                />
                <FieldError>Phone format is invalid.</FieldError>
              </TextField>
            </div>

            <TextField
              isRequired
              name="recoveryEmail"
              isInvalid={emailTouched && !isEmailValid}
            >
              <Label>Secure Recovery Email Address</Label>
              <Input
                placeholder="representative@yourcompany.com"
                value={recoveryEmail}
                onChange={(e) => setRecoveryEmail(e.target.value)}
                onBlur={(e) => setEmailTouched(e.target.value.length > 0)}
              />
              <Description>
                Must be an active corporate domain matching official business
                registry details.
              </Description>
              <FieldError>Invalid email address format.</FieldError>
            </TextField>
          </div>

          <div className="p-6">
            <Button
              type="submit"
              fullWidth
              className="rounded-xl"
              isDisabled={!isStep1Valid || isValidatingOwnership || isSendingOtp}
              isPending={isValidatingOwnership || isSendingOtp}
            >
              {isValidatingOwnership ? (
                <>
                  <Spinner color="current" size="sm" className="mr-2" />
                  Validating email ownership...
                </>
              ) : isSendingOtp ? (
                <>
                  <Spinner color="current" size="sm" className="mr-2" />
                  Sending secure OTP...
                </>
              ) : (
                <>
                  <Mail className="size-4 mr-2" />
                  Send Email OTP Challenge
                </>
              )}
            </Button>
          </div>
        </Form>
      )}

      {/* STEP 2: OTP VERIFICATION */}
      {step === ReclaimStep.OtpVerification && (
        <Form
          className="w-full flex flex-col flex-1 overflow-hidden"
          onSubmit={handleVerifyOtp}
        >
          <div className="flex-1 overflow-y-auto px-6 pb-6 pt-3 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-12 h-12 bg-accent/10 flex items-center justify-center rounded-xl border border-accent/20">
              <Mail className="size-6 text-accent" />
            </div>

            <div>
              <Typography.Heading
                level={4}
                className="font-bold text-center pb-3"
              >
                Confirm Claimant Email Ownership
              </Typography.Heading>
              <Typography className="text-xs text-muted text-center leading-relaxed pb-6">
                We&apos;ve sent a 6-digit verification code to{" "}
                <span className="font-bold text-foreground-soft">{recoveryEmail}</span>.<br />
                Enter it below to unlock document uploading.
              </Typography>
            </div>
            <Label className="text-xs font-semibold text-foreground/80">
              Enter 6-Digit OTP Code
            </Label>
            <OtpInput
              value={otpCode}
              onChange={setOtpCode}
              length={6}
              groups={[3, 3]}
              isDisabled={isLoading}
            />

            <div className="text-center text-xs font-semibold text-muted select-none shrink-0">
              Didn&apos;t receive the OTP?{" "}
              {cooldown > 0 ? (
                <span className="text-foreground/80">
                  Resend in {cooldown}s
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleSendOtp}
                  className="text-foreground hover:underline cursor-pointer bg-transparent border-0 font-bold"
                >
                  Resend code
                </button>
              )}
            </div>
          </div>

          <div className="p-4 border-t border-border shrink-0 w-full bg-surface">
            <Button
              type="submit"
              fullWidth
              className="rounded-xl"
              isDisabled={otpCode.length < 6 || isLoading}
              isPending={isLoading}
            >
              {isLoading ? (
                <Spinner color="current" size="sm" />
              ) : (
                "Verify claimant Identity"
              )}
            </Button>
          </div>
        </Form>
      )}

      {/* STEP 3: DISPUTED EVIDENCE PDF UPLOADER */}
      {step === ReclaimStep.DocumentsUpload && (
        <Form
          className="w-full flex flex-col flex-1 overflow-hidden"
          onSubmit={handleStep3Submit}
        >
          <div className="flex-1 overflow-y-auto px-6 space-y-3 flex flex-col pb-6">
            <div className="text-center shrink-0 mb-3">
              <Typography className="text-sm font-semibold text-center">
                Provide Legal Business Ownership Evidence
              </Typography>
              <Typography className="text-[11px] text-muted leading-normal text-center -mt-1 mb-1">
                Upload tax extracts, active business licenses, or legal
                representation credentials.
              </Typography>
            </div>

            <div className="relative border-2 border-dashed border-border hover:border-accent/40 rounded-xl p-3 flex flex-col items-center justify-center bg-surface-secondary/40 select-none cursor-pointer group transition-colors max-h-[100px]">
              <input
                type="file"
                multiple
                accept=".pdf,image/jpeg,image/png"
                className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={handleFileChange}
              />
              <Upload className="size-6 text-muted group-hover:text-accent transition-colors" />
              <Typography className="text-xs font-bold text-foreground">
                Drag & drop files or click to browse
              </Typography>
              <Typography className="text-[10px] text-muted">
                PDF, JPG, PNG up to 10MB per file
              </Typography>
            </div>

            {uploadError && (
              <div className="p-3 rounded-lg bg-danger/10 border border-danger/25 flex items-start gap-2 select-none text-[11px] text-danger font-medium leading-normal animate-pulse">
                <AlertTriangle className="size-4 shrink-0 text-danger mt-0.5" />
                <span>{uploadError}</span>
              </div>
            )}

            {files.length > 0 && (
              <div className="flex-1 overflow-hidden border border-border/80 rounded-xl mb-3 bg-surface flex flex-col">
                {/* Sticky Header */}
                <div className="sticky top-0 z-10 border-b border-border/70 bg-surface-secondary/40 px-3 py-1">
                  <Typography className="text-[11px] font-bold text-muted select-none">
                    Uploaded Proofs ({files.length})
                  </Typography>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {files.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-2 p-2 rounded-lg border border-border/70 text-xs group"
                    >
                      {/* Left */}
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <FileText className="size-4 text-accent shrink-0" />

                        <div className="flex flex-col min-w-0 flex-1">
                          {/* File Name */}
                          <span title={file.name}>{file.name}</span>

                          {/* Size */}
                          <span className="text-[10px] text-muted">
                            {(file.size / (1024 * 1024)).toFixed(2)} MB
                          </span>
                        </div>
                      </div>

                      {/* Right */}
                      <Button
                        variant="ghost"
                        isIconOnly
                        size="sm"
                        className="text-muted min-w-0 p-1 shrink-0"
                        onPress={() => removeFile(idx)}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {files.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center border border-border/50 rounded-xl bg-surface-secondary/10 py-6 select-none text-muted text-xs">
                <FileCheck2 className="size-6 mb-1 text-muted/60" />
                No documents uploaded yet
              </div>
            )}
          </div>

          <div className="p-4 border-t border-border w-full">
            <Button
              type="submit"
              fullWidth
              className="rounded-xl"
              isDisabled={files.length === 0 || isLoading}
              isPending={isLoading}
            >
              {isLoading ? (
                <Spinner color="current" size="sm" />
              ) : (
                "Submit Reclaim for legal compliance audit"
              )}
            </Button>
          </div>
        </Form>
      )}
    </Card>
  );
}
