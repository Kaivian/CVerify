"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Typography,
  Chip,
  Button,
  Spinner,
  Separator,
  toast,
  TextField,
  Label,
  InputGroup,
  FieldError,
  Form,
} from "@heroui/react";
import { Mail, Key, Eye, EyeOff } from "lucide-react";
import { Google } from "@thesvg/react";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import PasswordStrengthMeter from "@/features/auth/components/password-strength-meter";
import { passwordValidation } from "@/features/auth/validators/auth.validator";
import OtpInput from "@/components/ui/otp-input";
import { type LinkedEmail } from "@/types/auth.types";

const passwordFormSchema = z
  .object({
    currentPassword: z.string().optional(),
    newPassword: passwordValidation,
    confirmNewPassword: z.string().min(1, "Please confirm your new password"),
    isOtpVerified: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (
      !data.isOtpVerified &&
      (!data.currentPassword || data.currentPassword.trim() === "")
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Current password is required",
        path: ["currentPassword"],
      });
    }
    if (data.newPassword !== data.confirmNewPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Passwords do not match",
        path: ["confirmNewPassword"],
      });
    }
  });

type PasswordFormValues = z.infer<typeof passwordFormSchema>;

interface SignInMethodProps {
  onChangePassword: () => void;
  userEmail?: string;
}

export const SignInMethod: React.FC<SignInMethodProps> = ({
  onChangePassword: _onChangePassword,
  userEmail = "developer@cverify.com",
}) => {
  const {
    fetchLinkedProviders,
    unlinkProvider,
    changePassword,
    linkGoogleAccount,
    sendRecoveryOtp,
    verifyRecoveryOtp,
    changePasswordViaRecovery,
    fetchLinkedEmails,
    sendLinkEmailOtp,
    verifyLinkEmailOtp,
    makeEmailPrimary,
    deleteLinkedEmail,
    user,
    updateProfile,
  } = useAuth();
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Recovery Flow State Machine
  const [mode, setMode] = useState<"NORMAL" | "OTP_REQUESTED" | "OTP_VERIFIED">(
    "NORMAL",
  );
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);
  const [otpValue, setOtpValue] = useState<string>("");
  const [recoveryToken, setRecoveryToken] = useState<string>("");
  const [isVerifyingOtp, setIsVerifyingOtp] = useState<boolean>(false);

  // Email Management State Machine
  const [isEmailPanelOpen, setIsEmailPanelOpen] = useState(false);
  const [linkedEmails, setLinkedEmails] = useState<LinkedEmail[]>([]);
  const [linkedEmailsLoading, setLinkedEmailsLoading] = useState(false);
  const [addEmailValue, setAddEmailValue] = useState("");
  const [addEmailError, setAddEmailError] = useState<string | null>(null);
  const [isAddEmailPending, setIsAddEmailPending] = useState(false);
  const [addEmailStep, setAddEmailStep] = useState<
    "INPUT" | "OTP_VERIFICATION"
  >("INPUT");
  const [emailOtpValue, setEmailOtpValue] = useState("");
  const [emailOtpChallengeId, setEmailOtpChallengeId] = useState("");
  const [emailOtpCooldown, setEmailOtpCooldown] = useState(0);
  const [isVerifyingEmailOtp, setIsVerifyingEmailOtp] = useState(false);

  const [makePrimaryTarget, setMakePrimaryTarget] =
    useState<LinkedEmail | null>(null);
  const [confirmPasswordValue, setConfirmPasswordValue] = useState("");
  const [showPromotePassword, setShowPromotePassword] = useState(false);
  const [isPromoting, setIsPromoting] = useState(false);

  const {
    register,
    handleSubmit,
    reset: resetForm,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: "",
      isOtpVerified: false,
    },
  });

  const watchNewPassword = watch("newPassword");

  // Restore cooldown/timer state on mount or refresh
  useEffect(() => {
    if (!user?.id) return;
    const storageKey = `cverify:v1:password-recovery:${user.id}`;
    const storedStr = localStorage.getItem(storageKey);
    if (storedStr) {
      try {
        const stored = JSON.parse(storedStr);
        if (stored.cooldownUntil) {
          const until = new Date(stored.cooldownUntil).getTime();
          const now = Date.now();
          if (until > now) {
            const remaining = Math.ceil((until - now) / 1000);
            setCooldownRemaining(remaining);
            setMode("OTP_REQUESTED");
            setIsFormOpen(true);
          } else {
            localStorage.removeItem(storageKey);
          }
        }
      } catch (e) {
        console.error("Failed to parse cooldown storage", e);
      }
    }
  }, [user?.id]);

  // Countdown timer decrement
  useEffect(() => {
    if (cooldownRemaining <= 0) return;
    const timer = setInterval(() => {
      setCooldownRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          if (user?.id) {
            const storageKey = `cverify:v1:password-recovery:${user.id}`;
            localStorage.removeItem(storageKey);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownRemaining, user?.id]);

  const handleRequestForgotPassword = async () => {
    setResetLoading(true);
    try {
      const res = await sendRecoveryOtp();
      if (res.success && res.data) {
        const { cooldownSeconds, cooldownUntil } = res.data;
        setMode("OTP_REQUESTED");
        setCooldownRemaining(cooldownSeconds);
        if (user?.id) {
          const storageKey = `cverify:v1:password-recovery:${user.id}`;
          localStorage.setItem(storageKey, JSON.stringify({ cooldownUntil }));
        }
        toast.success("Verification code sent to your email.");
      } else {
        toast.danger(res.error?.message || "Failed to send verification code.");
      }
    } catch (err) {
      console.error(err);
      toast.danger("An error occurred. Please try again.");
    } finally {
      setResetLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (cooldownRemaining > 0) return;
    setResetLoading(true);
    try {
      const res = await sendRecoveryOtp();
      if (res.success && res.data) {
        const { cooldownSeconds, cooldownUntil } = res.data;
        setCooldownRemaining(cooldownSeconds);
        if (user?.id) {
          const storageKey = `cverify:v1:password-recovery:${user.id}`;
          localStorage.setItem(storageKey, JSON.stringify({ cooldownUntil }));
        }
        toast.success("Verification code resent.");
      } else {
        toast.danger(
          res.error?.message || "Failed to resend verification code.",
        );
      }
    } catch (err) {
      console.error(err);
      toast.danger("An error occurred resending OTP.");
    } finally {
      setResetLoading(false);
    }
  };

  const handleOtpChange = async (val: string) => {
    setOtpValue(val);
    if (val.length === 6) {
      setIsVerifyingOtp(true);
      try {
        const res = await verifyRecoveryOtp(val);
        if (res.success && res.data?.verified) {
          setRecoveryToken(res.data.recoveryToken);
          setMode("OTP_VERIFIED");
          setValue("isOtpVerified", true);
          toast.success("Identity verified via email OTP.");
        } else {
          toast.danger(res.error?.message || "Invalid verification code.");
        }
      } catch (err) {
        console.error(err);
        toast.danger("Verification failed.");
      } finally {
        setIsVerifyingOtp(false);
      }
    }
  };

  const handleCancel = () => {
    setIsFormOpen(false);
    setMode("NORMAL");
    setValue("isOtpVerified", false);
    setOtpValue("");
    setRecoveryToken("");
    if (user?.id) {
      localStorage.removeItem(`cverify:v1:password-recovery:${user.id}`);
    }
    resetForm();
  };

  const onSubmitPasswordChange = async (data: PasswordFormValues) => {
    setIsSubmitting(true);
    try {
      if (mode === "OTP_VERIFIED") {
        if (!recoveryToken) {
          toast.danger(
            "Recovery token is missing. Please verify your OTP again.",
          );
          setIsSubmitting(false);
          return;
        }

        const response = await changePasswordViaRecovery({
          recoveryToken,
          newPassword: data.newPassword,
          confirmPassword: data.confirmNewPassword,
        });

        if (response.success) {
          toast.success("Password updated successfully.");
          setIsFormOpen(false);
          setMode("NORMAL");
          setValue("isOtpVerified", false);
          setOtpValue("");
          setRecoveryToken("");
          if (user?.id) {
            localStorage.removeItem(`cverify:v1:password-recovery:${user.id}`);
          }
          updateProfile({ passwordChangedAt: new Date().toISOString() });
          resetForm();
        } else {
          toast.danger(response.error?.message || "Failed to update password.");
        }
      } else {
        const response = await changePassword({
          currentPassword: data.currentPassword || "",
          newPassword: data.newPassword,
          confirmNewPassword: data.confirmNewPassword,
        });

        if (response.success) {
          toast.success("Password updated successfully.");
          setIsFormOpen(false);
          updateProfile({ passwordChangedAt: new Date().toISOString() });
          resetForm();
        } else {
          toast.danger(response.error?.message || "Failed to update password.");
        }
      }
    } catch (err: unknown) {
      console.error(err);
      toast.danger("An error occurred while updating your password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const loadGoogleStatus = useCallback(async () => {
    try {
      await Promise.resolve(); // Defer state update to avoid set-state-in-effect
      const response = await fetchLinkedProviders();
      if (response.success && response.data) {
        const googleProv = response.data.find(
          (p) => p.providerName === "google",
        );
        setGoogleConnected(googleProv?.connected || false);
      }
    } catch (err) {
      console.error("Failed to load Google status:", err);
    }
  }, [fetchLinkedProviders]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadGoogleStatus();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadGoogleStatus]);

  const loadLinkedEmails = useCallback(async () => {
    setLinkedEmailsLoading(true);
    try {
      const res = await fetchLinkedEmails();
      if (res.success && res.data) {
        setLinkedEmails(res.data);
      } else {
        toast.danger(
          res.error?.message || "Failed to load linked email addresses.",
        );
      }
    } catch (err) {
      console.error(err);
      toast.danger("An error occurred loading email addresses.");
    } finally {
      setLinkedEmailsLoading(false);
    }
  }, [fetchLinkedEmails]);

  // Load emails when panel opens
  useEffect(() => {
    if (isEmailPanelOpen) {
      loadLinkedEmails();
    }
  }, [isEmailPanelOpen, loadLinkedEmails]);

  // Load linked emails on component mount to keep count accurate
  useEffect(() => {
    const fetchEmailsOnMount = async () => {
      try {
        const res = await fetchLinkedEmails();
        if (res.success && res.data) {
          setLinkedEmails(res.data);
        }
      } catch (err) {
        console.error("Failed to prefetch linked emails on mount:", err);
      }
    };
    fetchEmailsOnMount();
  }, [fetchLinkedEmails]);

  // Email OTP Cooldown Timer
  useEffect(() => {
    if (emailOtpCooldown <= 0) return;
    const timer = setInterval(() => {
      setEmailOtpCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [emailOtpCooldown]);

  const handleManageEmail = () => {
    setIsEmailPanelOpen((prev) => !prev);
  };

  const handleAddEmailSubmit = async () => {
    if (!addEmailValue) return;

    // Quick validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(addEmailValue.trim())) {
      setAddEmailError("Please enter a valid email address");
      return;
    }

    setIsAddEmailPending(true);
    setAddEmailError(null);
    try {
      const res = await sendLinkEmailOtp(addEmailValue.trim());
      if (res.success && res.data) {
        setEmailOtpChallengeId(res.data.challengeId);
        setEmailOtpCooldown(res.data.cooldownSeconds || 60);
        setAddEmailStep("OTP_VERIFICATION");
        toast.success("Verification code sent to " + addEmailValue);
      } else {
        setAddEmailError(res.error?.message || "Failed to link email address.");
        toast.danger(res.error?.message || "Failed to send verification code.");
      }
    } catch (err) {
      console.error(err);
      toast.danger("An error occurred sending verification code.");
    } finally {
      setIsAddEmailPending(false);
    }
  };

  const handleResendEmailOtp = async () => {
    if (emailOtpCooldown > 0) return;
    setIsAddEmailPending(true);
    try {
      const res = await sendLinkEmailOtp(addEmailValue.trim());
      if (res.success && res.data) {
        setEmailOtpChallengeId(res.data.challengeId);
        setEmailOtpCooldown(res.data.cooldownSeconds || 60);
        toast.success("Verification code resent.");
      } else {
        toast.danger(
          res.error?.message || "Failed to resend verification code.",
        );
      }
    } catch (err) {
      console.error(err);
      toast.danger("An error occurred resending OTP.");
    } finally {
      setIsAddEmailPending(false);
    }
  };

  const handleEmailOtpChange = async (val: string) => {
    setEmailOtpValue(val);
    if (val.length === 6) {
      setIsVerifyingEmailOtp(true);
      try {
        const res = await verifyLinkEmailOtp(
          emailOtpChallengeId,
          addEmailValue.trim(),
          val,
        );
        if (res.success) {
          toast.success("Email successfully linked!");
          setAddEmailValue("");
          setEmailOtpValue("");
          setAddEmailStep("INPUT");
          await loadLinkedEmails();
        } else {
          toast.danger(res.error?.message || "Invalid verification code.");
        }
      } catch (err) {
        console.error(err);
        toast.danger("Failed to verify OTP.");
      } finally {
        setIsVerifyingEmailOtp(false);
      }
    }
  };

  const handlePromoteEmail = async () => {
    if (!makePrimaryTarget || !confirmPasswordValue) return;
    setIsPromoting(true);
    try {
      const res = await makeEmailPrimary(
        makePrimaryTarget.email,
        confirmPasswordValue,
      );
      if (res.success) {
        toast.success(`Email ${makePrimaryTarget.email} promoted to primary!`);

        // Update user state if the primary email changed
        if (user) {
          updateProfile({ email: makePrimaryTarget.email });
        }

        setMakePrimaryTarget(null);
        setConfirmPasswordValue("");
        await loadLinkedEmails();
      } else {
        toast.danger(
          res.error?.message || "Failed to promote email to primary.",
        );
      }
    } catch (err) {
      console.error(err);
      toast.danger("An error occurred while promoting email.");
    } finally {
      setIsPromoting(false);
    }
  };

  const handleDeleteEmail = async (emailObj: LinkedEmail) => {
    if (emailObj.isPrimary) {
      toast.danger("Primary email cannot be deleted.");
      return;
    }

    if (window.confirm(`Are you sure you want to remove ${emailObj.email}?`)) {
      setLinkedEmailsLoading(true);
      try {
        const res = await deleteLinkedEmail(emailObj.id);
        if (res.success) {
          toast.success("Email removed successfully.");
          await loadLinkedEmails();
        } else {
          toast.danger(res.error?.message || "Failed to remove email.");
        }
      } catch (err) {
        console.error(err);
        toast.danger("An error occurred while removing email.");
      } finally {
        setLinkedEmailsLoading(false);
      }
    }
  };

  const handleGoogleToggle = async () => {
    if (googleLoading) return;
    setGoogleLoading(true);
    try {
      if (googleConnected) {
        const response = await unlinkProvider("google");
        if (response.success) {
          toast.success("Google account successfully disconnected.");
          setGoogleConnected(false);
        } else {
          toast.danger(
            response.error?.message || "Failed to disconnect Google account.",
          );
        }
        setGoogleLoading(false);
      } else {
        const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
        if (!clientId) {
          toast.danger("Configuration Error", {
            description: "Google Client ID is not configured.",
          });
          setGoogleLoading(false);
          return;
        }

        const redirectUri = `${window.location.origin}/auth/callback/google`;
        const nonce =
          Math.random().toString(36).substring(2) + Date.now().toString(36);
        const scope = encodeURIComponent("openid profile email");
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
          redirectUri,
        )}&response_type=id_token&scope=${scope}&nonce=${nonce}&state=google-link`;

        const width = 500;
        const height = 650;
        const left = window.screenX + (window.innerWidth - width) / 2;
        const top = window.screenY + (window.innerHeight - height) / 2;

        const popup = window.open(
          authUrl,
          "google-oauth",
          `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes`,
        );

        if (!popup) {
          toast.danger("Popup Blocked", {
            description:
              "Please allow popups for this site to link Google account.",
          });
          setGoogleLoading(false);
          return;
        }

        const messageListener = async (event: MessageEvent) => {
          if (event.origin !== window.location.origin) return;
          if (
            event.data?.type === "GOOGLE_OAUTH_SUCCESS" &&
            event.data?.idToken
          ) {
            window.removeEventListener("message", messageListener);
            clearInterval(checkClosed);

            const idToken = event.data.idToken;
            try {
              const linkResult = await linkGoogleAccount(idToken);
              if (linkResult.success) {
                toast.success("Google account successfully linked.");
                setGoogleConnected(true);
              } else {
                toast.danger(
                  linkResult.error?.message || "Failed to link Google account.",
                );
              }
            } catch (err) {
              console.error(err);
              toast.danger("An error occurred while linking Google account.");
            } finally {
              setGoogleLoading(false);
            }
          } else if (event.data?.type === "GOOGLE_OAUTH_ERROR") {
            window.removeEventListener("message", messageListener);
            clearInterval(checkClosed);
            setGoogleLoading(false);
            toast.danger("Google Link Failed", {
              description: event.data.error || "Authentication cancelled.",
            });
          }
        };

        window.addEventListener("message", messageListener);

        const checkClosed = setInterval(() => {
          if (!popup || popup.closed) {
            clearInterval(checkClosed);
            window.removeEventListener("message", messageListener);
            setGoogleLoading(false);
          }
        }, 1000);
      }
    } catch (err) {
      console.error(err);
      toast.danger("An error occurred while managing Google connection.");
      setGoogleLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Email Row */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 flex items-center justify-center">
              <Mail className="size-6 text-foreground/80" />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 justify-start">
                <Typography.Heading level={6}>Email</Typography.Heading>
                <Chip
                  color="success"
                  variant="soft"
                  className="h-4 px-1 text-[9px] font-bold uppercase tracking-wider font-outfit"
                >
                  Verified
                </Chip>
              </div>
              <Typography type="body-xs" className="text-muted">
                {linkedEmails.length > 0
                  ? `${linkedEmails.length} linked email address${linkedEmails.length !== 1 ? "es" : ""}`
                  : "1 linked email address"}
              </Typography>
            </div>
          </div>

          <div className="flex items-center shrink-0">
            <Button
              variant="outline"
              onClick={handleManageEmail}
              className="rounded-xl"
            >
              Manage
            </Button>
          </div>
        </div>

        {isEmailPanelOpen && (
          <div className="flex flex-col gap-4 p-4 bg-background rounded-2xl border border-foreground/10 animate-fade-in duration-300">
            {linkedEmailsLoading ? (
              <div className="flex justify-center items-center py-6">
                <Spinner size="md" />
              </div>
            ) : (
              <>
                {/* Email list */}
                <div className="flex flex-col gap-3">
                  <Typography
                    type="body-sm"
                    className="font-bold text-foreground/80"
                  >
                    {linkedEmails.length} linked email address
                    {linkedEmails.length !== 1 ? "es" : ""}
                  </Typography>
                  <div className="flex flex-col gap-2">
                    {linkedEmails.map((emailObj) => (
                      <div
                        key={emailObj.id || emailObj.email}
                        className="flex items-center justify-between p-3 bg-foreground/5 rounded-xl border border-foreground/5"
                      >
                        <div className="flex items-center gap-3">
                          <Typography className="font-medium text-sm">
                            {emailObj.email}
                          </Typography>
                          <div className="flex gap-1.5">
                            {emailObj.isPrimary && (
                              <Chip
                                color="accent"
                                variant="soft"
                                className="h-4 px-1 text-[9px] font-bold uppercase tracking-wider font-outfit"
                              >
                                Primary
                              </Chip>
                            )}
                            {emailObj.isVerified ? (
                              <Chip
                                color="success"
                                variant="soft"
                                className="h-4 px-1 text-[9px] font-bold uppercase tracking-wider font-outfit"
                              >
                                Verified
                              </Chip>
                            ) : (
                              <Chip
                                color="warning"
                                variant="soft"
                                className="h-4 px-1 text-[9px] font-bold uppercase tracking-wider font-outfit"
                              >
                                Unverified
                              </Chip>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {!emailObj.isPrimary && emailObj.isVerified && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setMakePrimaryTarget(emailObj);
                                setConfirmPasswordValue("");
                              }}
                              className="rounded-xl h-8 text-xs font-semibold"
                            >
                              Make Primary
                            </Button>
                          )}
                          {!emailObj.isPrimary && (
                            <Button
                              size="sm"
                              variant="danger-soft"
                              onClick={() => handleDeleteEmail(emailObj)}
                              className="rounded-xl h-8 text-xs font-semibold"
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Promote to Primary Password Form */}
                {makePrimaryTarget && (
                  <div className="flex flex-col gap-3 p-4 bg-foreground/5 rounded-xl border border-foreground/10">
                    <Typography
                      type="body-sm"
                      className="font-bold text-foreground"
                    >
                      Promote {makePrimaryTarget.email} to Primary Email
                    </Typography>
                    <Typography type="body-xs" className="text-muted">
                      For security, please enter your current password to
                      promote this email address. This will update your login
                      credentials.
                    </Typography>
                    <div className="flex flex-col md:flex-row gap-3 items-end">
                      <TextField isRequired className="flex-1">
                        <Label>Current Password</Label>
                        <InputGroup>
                          <InputGroup.Input
                            type={showPromotePassword ? "text" : "password"}
                            placeholder="Enter password"
                            value={confirmPasswordValue}
                            onChange={(e) =>
                              setConfirmPasswordValue(e.target.value)
                            }
                          />
                          <InputGroup.Suffix>
                            <Button
                              type="button"
                              isIconOnly
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setShowPromotePassword(!showPromotePassword)
                              }
                            >
                              {showPromotePassword ? (
                                <EyeOff size={14} />
                              ) : (
                                <Eye size={14} />
                              )}
                            </Button>
                          </InputGroup.Suffix>
                        </InputGroup>
                      </TextField>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setMakePrimaryTarget(null);
                            setConfirmPasswordValue("");
                          }}
                          className="rounded-xl h-9"
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          variant="primary"
                          isPending={isPromoting}
                          isDisabled={!confirmPasswordValue}
                          onClick={handlePromoteEmail}
                          className="rounded-xl h-9"
                        >
                          Promote
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Add Email Section */}
                {!makePrimaryTarget && (
                  <>
                    {linkedEmails.length < 3 ? (
                      <div className="flex flex-col gap-3">
                        <Typography
                          type="body-sm"
                          className="font-bold text-foreground/80"
                        >
                          Link a new email address
                        </Typography>

                        {addEmailStep === "INPUT" ? (
                          <div className="flex flex-col md:flex-row gap-3 items-end">
                            <TextField
                              isRequired
                              className="flex-1"
                              isInvalid={!!addEmailError}
                            >
                              <Label>Email Address</Label>
                              <div className="flex gap-2">
                                <InputGroup className="w-full">
                                  <InputGroup.Input
                                    type="email"
                                    placeholder="e.g. user@domain.com"
                                    value={addEmailValue}
                                    onChange={(e) => {
                                      setAddEmailValue(e.target.value);
                                      setAddEmailError(null);
                                    }}
                                  />
                                </InputGroup>
                                <Button
                                  type="button"
                                  isPending={isAddEmailPending}
                                  isDisabled={!addEmailValue}
                                  onClick={handleAddEmailSubmit}
                                  className="rounded-xl"
                                >
                                  Send Verification Code
                                </Button>
                              </div>

                              {addEmailError && (
                                <FieldError>{addEmailError}</FieldError>
                              )}
                            </TextField>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-4 py-4 bg-foreground/5 rounded-2xl border border-dashed border-foreground/20">
                            <Typography
                              type="body-sm"
                              className="font-bold text-foreground"
                            >
                              OTP Verification for {addEmailValue}
                            </Typography>
                            <Typography
                              type="body-xs"
                              className="text-muted text-center max-w-xs"
                            >
                              We have sent a 6-digit verification code to{" "}
                              <span className="font-semibold text-foreground">
                                {addEmailValue}
                              </span>
                              . Please enter it below.
                            </Typography>
                            <div className="relative">
                              <OtpInput
                                value={emailOtpValue}
                                onChange={handleEmailOtpChange}
                                isDisabled={isVerifyingEmailOtp}
                              />
                              {isVerifyingEmailOtp && (
                                <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-xl">
                                  <Spinner size="sm" />
                                </div>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleResendEmailOtp}
                                isDisabled={
                                  emailOtpCooldown > 0 || isAddEmailPending
                                }
                                className="rounded-xl"
                              >
                                {emailOtpCooldown > 0
                                  ? `Resend in ${emailOtpCooldown}s`
                                  : "Resend OTP"}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setAddEmailStep("INPUT");
                                  setEmailOtpValue("");
                                }}
                                className="rounded-xl"
                              >
                                Change Email
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <Typography
                        type="body-xs"
                        className="text-muted text-center py-2"
                      >
                        You have linked the maximum of 3 email addresses
                        allowed.
                      </Typography>
                    )}
                  </>
                )}

                <div className="flex justify-end gap-2 mt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEmailPanelOpen(false)}
                    className="rounded-xl"
                  >
                    Close
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
        <Separator />
      </div>

      {/* Password Row */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 flex items-center justify-center">
              <Key className="size-6 text-foreground/80" />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 justify-start">
                <Typography.Heading level={6}>Password</Typography.Heading>
                <Chip
                  color="success"
                  variant="soft"
                  className="h-4 px-1 text-[9px] font-bold uppercase tracking-wider font-outfit"
                >
                  Configured
                </Chip>
              </div>
              <Typography type="body-xs" className="text-muted">
                {user?.passwordChangedAt
                  ? `Password last updated: ${new Date(user.passwordChangedAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}`
                  : "Last updated password credentials"}
              </Typography>
            </div>
          </div>

          <div className="flex items-center shrink-0 gap-2">
            {!isFormOpen && (
              <Button
                variant="outline"
                onClick={() => setIsFormOpen(true)}
                className="rounded-xl animate-fade-in duration-300"
              >
                Change Password
              </Button>
            )}
          </div>
        </div>

        {isFormOpen && (
          <Form
            onSubmit={handleSubmit(onSubmitPasswordChange)}
            validationBehavior="aria"
            className="flex flex-col gap-4 p-4 bg-background rounded-2xl animate-fade-in duration-300"
          >
            {mode !== "OTP_VERIFIED" && mode !== "OTP_REQUESTED" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <TextField
                  isRequired
                  name="currentPassword"
                  isInvalid={!!errors.currentPassword}
                >
                  <Label>Current Password</Label>
                  <InputGroup>
                    <InputGroup.Input
                      type={showCurrent ? "text" : "password"}
                      placeholder="Enter current password"
                      {...register("currentPassword")}
                    />
                    <InputGroup.Suffix>
                      <Button
                        type="button"
                        isIconOnly
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowCurrent(!showCurrent)}
                      >
                        {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
                      </Button>
                    </InputGroup.Suffix>
                  </InputGroup>
                  {errors.currentPassword && (
                    <FieldError>{errors.currentPassword.message}</FieldError>
                  )}
                </TextField>

                <TextField
                  isRequired
                  name="newPassword"
                  isInvalid={!!errors.newPassword}
                >
                  <Label>New Password</Label>
                  <InputGroup>
                    <InputGroup.Input
                      type={showNew ? "text" : "password"}
                      placeholder="Min 8 characters"
                      {...register("newPassword")}
                    />
                    <InputGroup.Suffix>
                      <Button
                        type="button"
                        isIconOnly
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowNew(!showNew)}
                      >
                        {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
                      </Button>
                    </InputGroup.Suffix>
                  </InputGroup>
                  {errors.newPassword && (
                    <FieldError>{errors.newPassword.message}</FieldError>
                  )}
                </TextField>

                <TextField
                  isRequired
                  name="confirmNewPassword"
                  isInvalid={!!errors.confirmNewPassword}
                >
                  <Label>Confirm New Password</Label>
                  <InputGroup>
                    <InputGroup.Input
                      type={showConfirm ? "text" : "password"}
                      placeholder="Repeat new password"
                      {...register("confirmNewPassword")}
                    />
                    <InputGroup.Suffix>
                      <Button
                        type="button"
                        isIconOnly
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowConfirm(!showConfirm)}
                      >
                        {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                      </Button>
                    </InputGroup.Suffix>
                  </InputGroup>
                  {errors.confirmNewPassword && (
                    <FieldError>{errors.confirmNewPassword.message}</FieldError>
                  )}
                </TextField>
              </div>
            )}

            {mode === "OTP_VERIFIED" && (
              <>
                <div className="flex items-center">
                  <div className="font-semibold text-xs font-outfit uppercase tracking-wider text-success">
                    ✓ Identity verified via email OTP
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <TextField
                    isRequired
                    name="newPassword"
                    isInvalid={!!errors.newPassword}
                  >
                    <Label>New Password</Label>
                    <InputGroup>
                      <InputGroup.Input
                        type={showNew ? "text" : "password"}
                        placeholder="Min 8 characters"
                        {...register("newPassword")}
                      />
                      <InputGroup.Suffix>
                        <Button
                          type="button"
                          isIconOnly
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowNew(!showNew)}
                        >
                          {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
                        </Button>
                      </InputGroup.Suffix>
                    </InputGroup>
                    {errors.newPassword && (
                      <FieldError>{errors.newPassword.message}</FieldError>
                    )}
                  </TextField>

                  <TextField
                    isRequired
                    name="confirmNewPassword"
                    isInvalid={!!errors.confirmNewPassword}
                  >
                    <Label>Confirm New Password</Label>
                    <InputGroup>
                      <InputGroup.Input
                        type={showConfirm ? "text" : "password"}
                        placeholder="Repeat new password"
                        {...register("confirmNewPassword")}
                      />
                      <InputGroup.Suffix>
                        <Button
                          type="button"
                          isIconOnly
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowConfirm(!showConfirm)}
                        >
                          {showConfirm ? (
                            <EyeOff size={14} />
                          ) : (
                            <Eye size={14} />
                          )}
                        </Button>
                      </InputGroup.Suffix>
                    </InputGroup>
                    {errors.confirmNewPassword && (
                      <FieldError>
                        {errors.confirmNewPassword.message}
                      </FieldError>
                    )}
                  </TextField>
                </div>
              </>
            )}

            {(mode === "NORMAL" || mode === "OTP_VERIFIED") && (
              <PasswordStrengthMeter
                value={watchNewPassword || ""}
                policyId="default"
              />
            )}

            {mode === "OTP_REQUESTED" && (
              <div className="flex flex-col items-center gap-4 py-6 bg-foreground/5 rounded-2xl border border-dashed border-foreground/20">
                <Typography.Heading level={6}>
                  OTP Verification
                </Typography.Heading>
                <Typography
                  type="body-xs"
                  className="text-muted text-center max-w-xs"
                >
                  We have sent a 6-digit verification code to your email. Please
                  enter it below.
                </Typography>
                <div className="relative">
                  <OtpInput
                    value={otpValue}
                    onChange={handleOtpChange}
                    isDisabled={isVerifyingOtp}
                  />
                  {isVerifyingOtp && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-xl">
                      <Spinner size="sm" />
                    </div>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleResendOtp}
                  isDisabled={cooldownRemaining > 0 || resetLoading}
                  className="rounded-xl"
                >
                  {cooldownRemaining > 0
                    ? `Resend in ${cooldownRemaining}s`
                    : "Resend OTP"}
                </Button>
              </div>
            )}

            <div className="flex justify-between items-center mt-2">
              {mode === "NORMAL" ? (
                <Button
                  type="button"
                  variant="outline"
                  isPending={resetLoading}
                  onClick={handleRequestForgotPassword}
                  className="rounded-xl"
                >
                  {({ isPending }) => (
                    <>
                      {isPending ? (
                        <Spinner color="current" size="sm" />
                      ) : (
                        "Request Forgot Password"
                      )}
                    </>
                  )}
                </Button>
              ) : (
                <div />
              )}
              <div className="flex justify-end gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  className="rounded-xl"
                >
                  Cancel
                </Button>
                {mode !== "OTP_REQUESTED" && (
                  <Button
                    type="submit"
                    isPending={isSubmitting}
                    isDisabled={
                      mode === "OTP_VERIFIED"
                        ? !watch("newPassword") ||
                          !watch("confirmNewPassword") ||
                          !!errors.newPassword ||
                          !!errors.confirmNewPassword
                        : !watch("currentPassword") ||
                          !watch("newPassword") ||
                          !watch("confirmNewPassword") ||
                          !!errors.currentPassword ||
                          !!errors.newPassword ||
                          !!errors.confirmNewPassword
                    }
                    className="rounded-xl"
                  >
                    Update Password
                  </Button>
                )}
              </div>
            </div>
          </Form>
        )}
        <Separator />
      </div>

      {/* Google Row */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 flex items-center justify-center">
              <Google className="size-6" />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 justify-start">
                <Typography.Heading level={6}>Google</Typography.Heading>
                {googleConnected ? (
                  <Chip
                    color="success"
                    variant="soft"
                    className="h-4 px-1 text-[9px] font-bold uppercase tracking-wider font-outfit"
                  >
                    Connected
                  </Chip>
                ) : (
                  <Chip
                    size="sm"
                    color="default"
                    variant="soft"
                    className="h-4 px-1 text-[9px] font-bold uppercase tracking-wider font-outfit"
                  >
                    Unlinked
                  </Chip>
                )}
              </div>
              <Typography type="body-xs" className="text-muted">
                {googleConnected
                  ? `Connected as ${userEmail}`
                  : "Sign in with your Google account"}
              </Typography>
            </div>
          </div>

          <div className="flex items-center shrink-0">
            <Button
              variant="outline"
              isPending={googleLoading}
              onClick={handleGoogleToggle}
              className="rounded-xl"
            >
              {({ isPending }) => (
                <>
                  {isPending ? (
                    <>
                      <Spinner color="current" size="sm" />
                      {googleConnected ? "Disconnecting..." : "Connecting..."}
                    </>
                  ) : googleConnected ? (
                    "Disconnect"
                  ) : (
                    "Connect"
                  )}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignInMethod;
