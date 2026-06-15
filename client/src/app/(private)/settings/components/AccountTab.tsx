"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useForm, FormProvider, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card } from "@/components/ui/card";
import { SettingsSection } from "./SettingsSection";
import { LinkedAccountsList } from "./LinkedAccountsList";
import { SignInMethod } from "./SignInMethod";
import { useAuth } from "@/features/auth/hooks/use-auth";
import {
  Typography,
  Chip,
  toast,
  Spinner,
  TextField,
  Label,
  InputGroup,
  Description,
  Select,
  ListBox,
  Tooltip,
  Button,
  Separator,
  Modal,
  FieldError,
  Checkbox,
  Link,
} from "@heroui/react";
import {
  ShieldAlert,
  Laptop,
  Trash2,
  AlertTriangle,
  Info,
  X,
  CheckCircle2,
  ArrowRight,
  Mail,
  KeyRound,
} from "lucide-react";
import { type SessionInfoData } from "@/types/auth.types";
import {
  UnsavedChangesBar,
  isDeepEqual,
} from "@/components/ui/unsaved-changes-bar";
import { useProfile } from "@/hooks/use-profile";
import { type UpdateProfileRequest } from "@/types/profile.types";
import { useProfileStore } from "@/stores/use-profile-store";
import { ConfirmationModal } from "./ConfirmationModal";
import { useRouter, useSearchParams } from "next/navigation";
import { authApi } from "@/features/auth/services/auth.service";
import { OtpInput } from "@/components/ui/otp-input";
import { SelectDropdown } from "@/components/ui/select-dropdown";

// Reserved usernames
const RESERVED_USERNAMES = [
  "admin",
  "api",
  "support",
  "settings",
  "login",
  "organizations",
];

// 1. Zod account schema
const accountSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(32, "Username must be under 32 characters")
    .regex(
      /^[a-z0-9_]+$/,
      "Username must contain only lowercase letters, numbers, and underscores",
    )
    .refine(
      (val) => !RESERVED_USERNAMES.includes(val),
      "This username is reserved",
    ),
  profileVisibility: z.enum(["public", "connections", "private"]),
  recruiterVisibility: z.boolean(),
  aiTalentDiscovery: z.enum(["enabled", "limited", "disabled"]),
});

type AccountFormValues = z.infer<typeof accountSchema>;

interface AccountTabProps {
  onDirtyChange: (isDirty: boolean) => void;
  onSaveSuccess: () => void;
}

export const AccountTab: React.FC<AccountTabProps> = ({
  onDirtyChange,
  onSaveSuccess,
}) => {
  const {
    user,
    fetchSessions,
    revokeSession,
    revokeOtherSessions,
    deleteAccount: _deleteAccount,
    initializeSession,
    fetchLinkedEmails,
  } = useAuth();
  const { profile, isLoading, updateProfile, updateUsername, refreshProfile } =
    useProfile();

  // Deletion verified email recovery states
  const [linkedEmails, setLinkedEmails] = useState<{ email: string; isVerified: boolean; isPrimary: boolean }[]>([]);
  const [selectedOtpEmail, setSelectedOtpEmail] = useState<string>("");

  // Local states
  const [sessions, setSessions] = useState<SessionInfoData[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [isBulkRevoking, setIsBulkRevoking] = useState(false);
  const [profileOrigin, setProfileOrigin] = useState("https://cverify.com");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const timer = setTimeout(() => {
        setProfileOrigin(window.location.origin);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, []);

  // Modals state
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRevokeModalOpen, setIsRevokeModalOpen] = useState(false);
  const [isBulkRevokeModalOpen, setIsBulkRevokeModalOpen] = useState(false);
  const [sessionToRevoke, setSessionToRevoke] =
    useState<SessionInfoData | null>(null);

  // Deletion wizard states
  const [deletionStep, setDeletionStep] = useState<number>(1);
  const [deletionRequirements, setDeletionRequirements] = useState<{
    requiresPassword: boolean;
    requiresOAuthReauth: boolean;
    linkedOAuthProvider: string | null;
  } | null>(null);
  const [deletionPassword, setDeletionPassword] = useState("");
  const [deletionAuthToken, setDeletionAuthToken] = useState("");
  const [deletionOtpCode, setDeletionOtpCode] = useState("");
  const [deletionOtpChallengeId, setDeletionOtpChallengeId] = useState<string | null>(null);
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [blockingOrganizations, setBlockingOrganizations] = useState<{
    id: string;
    name: string;
    username: string;
    memberCount: number;
  }[]>([]);
  const [agreeToTerms, setAgreeToTerms] = useState({
    hideProfile: false,
    gracePeriod: false,
    auditAnonymize: false,
  });

  const router = useRouter();
  const searchParams = useSearchParams();

  const loadDeletionRequirements = useCallback(async () => {
    try {
      const reqs = await authApi.getDeletionRequirements();
      setDeletionRequirements(reqs);
    } catch (err) {
      console.error("Failed to load deletion requirements:", err);
      toast.danger("Failed to load account deletion requirements. Please try again.");
    }
  }, []);

  useEffect(() => {
    if (otpCooldown <= 0) return;
    const interval = setInterval(() => {
      setOtpCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [otpCooldown]);

  useEffect(() => {
    const reauthSuccess = searchParams.get("reauth_success");
    const deletionToken = searchParams.get("deletion_authorize_token");
    const error = searchParams.get("error");

    if (reauthSuccess === "true" && deletionToken) {
      const timer = setTimeout(() => {
        setDeletionAuthToken(deletionToken);
        loadDeletionRequirements();
        setIsDeleteModalOpen(true);
        setDeletionStep(3);
        setAgreeToTerms({
          hideProfile: true,
          gracePeriod: true,
          auditAnonymize: true,
        });
      }, 0);

      const params = new URLSearchParams(window.location.search);
      params.delete("reauth_success");
      params.delete("deletion_authorize_token");
      params.delete("tab");
      const cleanSearch = params.toString() ? `?${params.toString()}` : "";
      window.history.replaceState(null, "", window.location.pathname + cleanSearch);

      toast.success("OAuth re-authentication verified successfully.");
      return () => clearTimeout(timer);
    } else if (error === "reauth_failed") {
      const details = searchParams.get("details");
      toast.danger(`Re-authentication failed: ${details || "Access Denied"}`);
      const params = new URLSearchParams(window.location.search);
      params.delete("error");
      params.delete("details");
      params.delete("tab");
      const cleanSearch = params.toString() ? `?${params.toString()}` : "";
      window.history.replaceState(null, "", window.location.pathname + cleanSearch);
    }
  }, [searchParams, loadDeletionRequirements]);

  // New Username Change modal state
  const [isUsernameConfirmOpen, setIsUsernameConfirmOpen] = useState(false);
  const [pendingFormData, setPendingFormData] =
    useState<AccountFormValues | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form methods setup
  const methods = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      username: "",
      profileVisibility: "public",
      recruiterVisibility: true,
      aiTalentDiscovery: "disabled",
    },
    mode: "onChange",
  });

  const { handleSubmit, reset, setValue } = methods;

  const currentValues = useWatch({ control: methods.control });

  useEffect(() => {
    if (profile && !methods.formState.isDirty) {
      reset({
        username: profile.username || "",
        profileVisibility:
          (profile.profileVisibility as AccountFormValues["profileVisibility"]) ||
          "public",
        recruiterVisibility: profile.recruiterVisibility ?? true,
        aiTalentDiscovery:
          (profile.aiTalentDiscovery as AccountFormValues["aiTalentDiscovery"]) ||
          "disabled",
      });
    }
  }, [profile, reset, methods.formState.isDirty]);

  useEffect(() => {
    const hasChanges = !isDeepEqual(
      currentValues,
      methods.formState.defaultValues,
    );
    onDirtyChange(hasChanges);
  }, [currentValues, methods.formState.defaultValues, onDirtyChange]);

  // Load active sessions from hook
  useEffect(() => {
    const loadSessionsList = async () => {
      setLoadingSessions(true);
      try {
        const activeSessions = await fetchSessions();
        setSessions(activeSessions || []);
      } catch (err) {
        console.error("Failed to load sessions:", err);
      } finally {
        setLoadingSessions(false);
      }
    };
    loadSessionsList();
  }, [fetchSessions]);

  const handleReset = () => {
    reset();
  };

  const executeFormSubmit = async (data: AccountFormValues) => {
    setIsSaving(true);
    try {
      const normCurrent = data.username?.trim().toLowerCase();
      const normOrigin = profile?.username?.trim().toLowerCase();
      const isUsernameChanged = normCurrent !== normOrigin;

      // 1. If username changed, call updateUsername API
      if (isUsernameChanged) {
        await updateUsername(data.username);
      }

      // 2. If visibility preferences changed, call updateProfile API
      if (
        data.profileVisibility !== profile?.profileVisibility ||
        data.recruiterVisibility !== profile?.recruiterVisibility ||
        data.aiTalentDiscovery !== profile?.aiTalentDiscovery
      ) {
        const request: UpdateProfileRequest = {
          fullName: profile?.fullName || user?.fullName || null,
          bio: profile?.bio || null,
          location: profile?.location || null,
          phoneNumber: profile?.phoneNumber || null,
          birthDate: profile?.birthDate || null,
          headline: profile?.headline || null,
          company: profile?.company || null,
          pronouns: profile?.pronouns || null,
          customPronouns: profile?.customPronouns || null,
          publicEmail: profile?.publicEmail || null,
          profileVisibility: data.profileVisibility,
          recruiterVisibility: data.recruiterVisibility,
          aiTalentDiscovery: data.aiTalentDiscovery,
          socialLinks: profile?.socialLinks || [],
          version:
            useProfileStore.getState().profile?.version ||
            profile?.version ||
            0,
        };
        await updateProfile(request);
      }

      // Security Audit Logging (Observability)
      console.log(
        `[Security Audit Log] Account settings successfully updated for User ID ${user?.id}. Username changed: ${isUsernameChanged}`,
      );

      // 4. Force state refreshes to synchronize immediate UI states across components
      if (typeof refreshProfile === "function") {
        await refreshProfile();
      }
      if (typeof initializeSession === "function") {
        await initializeSession(true);
      }

      reset(data);
      onSaveSuccess();
      toast.success("Account settings updated successfully.");
    } catch (error: unknown) {
      console.error("Failed to save account settings:", error);
      const axiosError = error as {
        response?: { status?: number; data?: { message?: string } };
        message?: string;
      };

      const isConflict =
        axiosError.response?.status === 409 ||
        axiosError.response?.data?.message?.toLowerCase().includes("taken") ||
        axiosError.response?.data?.message
          ?.toLowerCase()
          .includes("already exists");

      if (isConflict) {
        methods.setError("username", {
          type: "manual",
          message:
            axiosError.response?.data?.message ||
            "This username is already taken.",
        });
        return;
      }

      const errMsg =
        axiosError.response?.data?.message ||
        axiosError.message ||
        "Failed to update account settings.";
      toast.danger(errMsg);
    } finally {
      setIsSaving(false);
      setIsUsernameConfirmOpen(false);
      setPendingFormData(null);
    }
  };

  const handleFormSubmit = async (data: AccountFormValues) => {
    const normCurrent = data.username?.trim().toLowerCase();
    const normOrigin = profile?.username?.trim().toLowerCase();
    const isUsernameChanged = normCurrent !== normOrigin;

    if (isUsernameChanged) {
      setPendingFormData(data);
      setIsUsernameConfirmOpen(true);
    } else {
      await executeFormSubmit(data);
    }
  };

  const loadLinkedEmails = useCallback(async () => {
    try {
      const res = await fetchLinkedEmails();
      if (res.success && res.data) {
        type LinkedEmailType = { email: string; isVerified: boolean; isPrimary: boolean };
        const verified = res.data.filter((e: LinkedEmailType) => e.isVerified);
        setLinkedEmails(verified);
        if (verified.length > 0) {
          const primary = verified.find((e: LinkedEmailType) => e.isPrimary);
          setSelectedOtpEmail(primary ? primary.email : verified[0].email);
        } else if (user?.email) {
          setLinkedEmails([{ email: user.email, isVerified: true, isPrimary: true }]);
          setSelectedOtpEmail(user.email);
        }
      } else if (user?.email) {
        setLinkedEmails([{ email: user.email, isVerified: true, isPrimary: true }]);
        setSelectedOtpEmail(user.email);
      }
    } catch (err) {
      console.error("Failed to load linked emails:", err);
      if (user?.email) {
        setLinkedEmails([{ email: user.email, isVerified: true, isPrimary: true }]);
        setSelectedOtpEmail(user.email);
      }
    }
  }, [fetchLinkedEmails, user]);

  if (isLoading && !profile) {
    return (
      <div className="flex items-center justify-center py-20 w-full h-full">
        <Spinner size="lg" color="accent" />
      </div>
    );
  }

  // Revoke active session action
  const handleRevokeSession = async (sessionId: string) => {
    setRevokingId(sessionId);
    try {
      const result = await revokeSession(sessionId);
      if (result.success) {
        toast.success("Session revoked successfully.");
        const session = sessions.find((s) => s.sessionId === sessionId);
        if (session?.isCurrent) {
          // If self-revoking current session, redirect immediately
          window.location.assign("/login");
        } else {
          // Refetch active sessions from server to get absolute source of truth
          const activeSessions = await fetchSessions();
          setSessions(activeSessions || []);
        }
      } else {
        toast.danger(result.error || "Failed to revoke session.");
      }
    } catch (err) {
      console.error("Failed to revoke session:", err);
      toast.danger("An unexpected error occurred while revoking session.");
    } finally {
      setRevokingId(null);
    }
  };

  // Revoke all other sessions action
  const handleRevokeOtherSessions = async () => {
    setIsBulkRevoking(true);
    try {
      const result = await revokeOtherSessions();
      if (result.success) {
        toast.success("All other sessions revoked successfully.");
        // Refetch active sessions from server to get absolute source of truth
        const activeSessions = await fetchSessions();
        setSessions(activeSessions || []);
      } else {
        toast.danger(result.error || "Failed to revoke other sessions.");
      }
    } catch (err) {
      console.error("Failed to revoke other sessions:", err);
      toast.danger(
        "An unexpected error occurred while revoking other sessions.",
      );
    } finally {
      setIsBulkRevoking(false);
    }
  };

  // Delete account action
  const handleDeleteAccount = async () => {
    if (deleteConfirmationText !== "delete my account") return;
    setIsDeleting(true);
    try {
      const payload = {
        password: deletionRequirements?.requiresPassword ? deletionPassword : undefined,
        deletionAuthorizeToken: deletionAuthToken || undefined,
        fallbackOtpCode: deletionRequirements?.requiresOAuthReauth && isOtpSent ? deletionOtpCode : undefined,
        fallbackOtpChallengeId: deletionRequirements?.requiresOAuthReauth && isOtpSent ? (deletionOtpChallengeId ? deletionOtpChallengeId : undefined) : undefined,
        confirmationPhrase: deleteConfirmationText,
      };

      const response = await authApi.initiateDeletionRequest(payload);
      if (response.success) {
        setIsDeleteModalOpen(false);
        toast.success("Account successfully scheduled for deletion. Active sessions invalidated.");
        window.location.assign("/login");
      } else {
        if (response.errorCode === "ORGANIZATION_OWNER_PREVENT_DELETE" && response.blockingOrganizations) {
          setBlockingOrganizations(response.blockingOrganizations);
          setDeletionStep(1); // Force to Step 1 to show remediation cards
          toast.danger("Cannot delete account: You own active organizations.");
        } else {
          toast.danger(response.message || "Failed to delete account.");
        }
      }
    } catch (err: unknown) {
      console.error("Failed to delete account:", err);
      const axiosError = err as { response?: { data?: { message?: string } } };
      const errMsg = axiosError.response?.data?.message || "An error occurred during account deletion.";
      toast.danger(errMsg);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSendFallbackOtp = async () => {
    setIsSendingOtp(true);
    try {
      const targetEmail = selectedOtpEmail || user?.email || "";
      const response = await authApi.sendFallbackOtp(targetEmail);
      setDeletionOtpChallengeId(response.challengeId);
      setIsOtpSent(true);
      setOtpCooldown(response.cooldownSeconds);
      toast.success(`Email OTP code sent to ${targetEmail}.`);
    } catch (err: unknown) {
      console.error("Failed to send fallback OTP:", err);
      const axiosError = err as { response?: { data?: { message?: string } } };
      const errMsg = axiosError.response?.data?.message || "Failed to send fallback OTP code.";
      toast.danger(errMsg);
    } finally {
      setIsSendingOtp(false);
    }
  };

  const _handleOAuthReauth = () => {
    const provider = deletionRequirements?.linkedOAuthProvider || "google";
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
    window.location.assign(`${apiUrl}/users/me/connect-reauth/${provider}`);
  };

  const visibilityOptions = [
    { value: "public", label: "Public" },
    { value: "connections", label: "Connections Only" },
    { value: "private", label: "Private" },
  ];

  const AITalentDiscoveryOptions = [
    { value: "enabled", label: "Enabled" },
    { value: "limited", label: "Limited" },
    { value: "disabled", label: "Disabled" },
  ];

  // Simulating check for organization ownership restrictions
  const hasOrganizationOwnership =
    user?.role === "ADMIN" ||
    user?.fullName?.toLowerCase().includes("owner") ||
    false;

  return (
    <FormProvider {...methods}>
      <div className="space-y-6">
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          {/* Username section */}
          <SettingsSection
            title="Username & Profile Privacy"
            description="Customize your public username and control who can view your profile."
          >
            <Card className="text-left gap-4 flex flex-col">
              <div className="flex gap-3 w-full">
                <div className="flex flex-col gap-2 w-full">
                  <TextField
                    className="w-full"
                    isInvalid={!!methods.formState.errors.username}
                    name="username"
                  >
                    <Label>Username</Label>
                    <InputGroup>
                      <InputGroup.Input
                        maxLength={32}
                        value={currentValues.username || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          const normalized = val.toLowerCase().trim();
                          setValue("username", normalized, {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                        }}
                      />
                    </InputGroup>
                    {methods.formState.errors.username && (
                      <FieldError>
                        {methods.formState.errors.username.message}
                      </FieldError>
                    )}
                  </TextField>
                  <Description>
                    Your public profile link will be:{" "}
                    <Link href={`${profileOrigin}/${currentValues.username || "username"}`} className="font-bold text-foreground text-xs">
                      {profileOrigin.replace(/^https?:\/\//, "")}/
                      {currentValues.username || "username"}
                    </Link>
                  </Description>
                </div>
                <div className="w-full flex gap-2">
                  <Select
                    className="w-9/20"
                    value={currentValues.profileVisibility || "public"}
                    onChange={(val) =>
                      setValue(
                        "profileVisibility",
                        val as "public" | "connections" | "private",
                        { shouldDirty: true },
                      )
                    }
                  >
                    <Label>
                      <div className="w-full flex items-center gap-1">
                        <span>Profile Visibility</span>
                        <Tooltip delay={0}>
                          <Tooltip.Trigger>
                            <Button
                              isIconOnly
                              variant="ghost"
                              className="rounded-full h-5 w-5"
                              type="button"
                            >
                              <Info className="size-3.5" />
                            </Button>
                          </Tooltip.Trigger>
                          <Tooltip.Content showArrow>
                            Control who can view your public profile page and
                            verified credentials.
                          </Tooltip.Content>
                        </Tooltip>
                      </div>
                    </Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {visibilityOptions.map((option) => (
                          <ListBox.Item
                            key={option.value}
                            id={option.value}
                            textValue={option.label}
                          >
                            {option.label}
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                  <Select
                    className="w-11/20"
                    value={currentValues.aiTalentDiscovery || "disabled"}
                    onChange={(val) =>
                      setValue(
                        "aiTalentDiscovery",
                        val as "enabled" | "limited" | "disabled",
                        { shouldDirty: true },
                      )
                    }
                  >
                    <Label>
                      <div className="w-full flex items-center gap-1">
                        <span>AI Talent Discovery</span>
                        <Tooltip delay={0}>
                          <Tooltip.Trigger>
                            <Button
                              isIconOnly
                              variant="ghost"
                              className="rounded-full h-5 w-5"
                              type="button"
                            >
                              <Info className="size-3.5" />
                            </Button>
                          </Tooltip.Trigger>
                          <Tooltip.Content showArrow>
                            Control whether recruiter AI systems can analyze and
                            rank your profile for talent discovery and job matching.
                          </Tooltip.Content>
                        </Tooltip>
                      </div>
                    </Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {AITalentDiscoveryOptions.map((option) => (
                          <ListBox.Item
                            key={option.value}
                            id={option.value}
                            textValue={option.label}
                          >
                            {option.label}
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>
              </div>
            </Card>
          </SettingsSection>

          {/* Sticky Actions Bar */}
          <UnsavedChangesBar
            message="You have unsaved account setting changes."
            onReset={handleReset}
          />
        </form>

        {/* Linked accounts section */}
        <SettingsSection
          title="Source Code Providers"
          description="Connect your GitHub account to enable repository analysis and proof-of-work verifications."
        >
          <Card>
            <LinkedAccountsList />
          </Card>
        </SettingsSection>

        {/* Sign in methods section */}
        <SettingsSection
          title="Sign in methods"
          description="Manage authentication methods used to access your CVerify workspace."
        >
          <Card>
            <SignInMethod
              onChangePassword={() => setIsPasswordModalOpen(true)}
              userEmail={user?.email || undefined}
            />
          </Card>
        </SettingsSection>

        {/* Active sessions section */}
        <SettingsSection
          title="Active Devices & Sessions"
          description="View active sessions logged into your account. You can revoke older or unrecognized sessions here."
        >
          <Card>
            {loadingSessions ? (
              <div className="flex flex-col gap-6">
                {[1, 2].map((i) => (
                  <div key={i} className="flex flex-col gap-6">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 w-full">
                        <div className="w-10 h-10 rounded-xl bg-surface-secondary animate-pulse shrink-0" />
                        <div className="flex flex-col gap-2 w-1/3">
                          <div className="h-4 bg-surface-secondary rounded animate-pulse" />
                          <div className="h-3 bg-surface-secondary rounded w-2/3 animate-pulse" />
                        </div>
                      </div>
                      <div className="h-9 w-20 bg-surface-secondary rounded-xl animate-pulse shrink-0" />
                    </div>
                    {i === 2 ? null : <Separator />}
                  </div>
                ))}
              </div>
            ) : sessions.length > 0 ? (
              <div className="flex flex-col gap-6">
                {sessions.map((session, index) => {
                  const isLast = index === sessions.length - 1;
                  return (
                    <div
                      key={session.sessionId}
                      className="flex flex-col gap-6"
                    >
                      <div className="flex flex-row items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 flex items-center justify-center text-foreground/80">
                            <Laptop className="size-6" />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2 justify-start">
                              <Typography.Heading level={6}>
                                {session.isCurrent
                                  ? `${session.deviceName || "Desktop Web browser"} (Current Session)`
                                  : session.deviceName || "Desktop Web browser"}
                              </Typography.Heading>
                              {session.isCurrent && (
                                <Chip
                                  size="sm"
                                  color="accent"
                                  variant="soft"
                                  className="h-4.5 px-1.5 text-[9px] font-extrabold uppercase tracking-wider font-outfit"
                                >
                                  Current Device
                                </Chip>
                              )}
                            </div>
                            <Typography
                              type="body-xs"
                              className="text-muted text-[10px] font-sans truncate mt-0.5"
                            >
                              IP: {session.ipAddress || "Unknown IP"} • OS:{" "}
                              {session.userAgent || "Web Session"}
                            </Typography>
                          </div>
                        </div>

                        <div className="flex items-center shrink-0">
                          {!session.isCurrent && (
                            <Button
                              variant="outline"
                              isDisabled={revokingId !== null || isBulkRevoking}
                              isPending={revokingId === session.sessionId}
                              onClick={() => {
                                setSessionToRevoke(session);
                                setIsRevokeModalOpen(true);
                              }}
                              className="rounded-xl"
                            >
                              {({ isPending }) => (
                                <>
                                  {isPending ? (
                                    <>
                                      <Spinner color="current" size="sm" />
                                      Revoking...
                                    </>
                                  ) : (
                                    "Revoke"
                                  )}
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                      {isLast ? null : <Separator />}
                    </div>
                  );
                })}
                {sessions.some((s) => !s.isCurrent) && (
                  <>
                    <Separator />
                    <div className="flex justify-end pt-2">
                      <Button
                        variant="danger"
                        isDisabled={revokingId !== null || isBulkRevoking}
                        isPending={isBulkRevoking}
                        onClick={() => setIsBulkRevokeModalOpen(true)}
                        className="rounded-xl font-bold text-xs h-9.5 px-4"
                      >
                        {({ isPending }) => (
                          <>
                            {isPending ? (
                              <>
                                <Spinner color="current" size="sm" />
                                Revoking Others...
                              </>
                            ) : (
                              "Sign out of all other sessions"
                            )}
                          </>
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 px-4 rounded-xl border border-dashed border-separator/80 bg-surface-secondary/40 select-none text-center">
                <ShieldAlert className="text-muted/65 size-5 mb-2" />
                <Typography
                  type="body-xs"
                  className="text-muted text-[11px] font-bold font-outfit uppercase tracking-wider"
                >
                  No other sessions found
                </Typography>
                <Typography
                  type="body-xs"
                  className="text-muted text-[10px] max-w-xs mt-1"
                >
                  You are currently logged in with only this browser device.
                </Typography>
              </div>
            )}
          </Card>
        </SettingsSection>

        {/* Danger zone section */}
        <SettingsSection
          title="Danger Zone"
          description="Actions here are completely destructive and permanent. Double-check all considerations before executing."
        >
          <Card className="border-danger-soft">
            <div className="flex flex-col gap-6 w-full">
              {hasOrganizationOwnership && (
                <div className="flex items-center gap-3 p-4 rounded-xl border border-warning-soft bg-warning-soft text-warning">
                  <AlertTriangle size={32} />
                  <div className="flex flex-col gap-1">
                    <Typography.Heading
                      level={6}
                      className="font-bold font-outfit uppercase tracking-wider text-warning"
                    >
                      Organization Ownership Restriction
                    </Typography.Heading>
                    <Typography
                      type="body-xs"
                      className="text-muted text-xs leading-relaxed"
                    >
                      You currently have active organization ownership roles.
                      You must transfer organization ownership to a verified
                      partner before you can delete this account.
                    </Typography>
                  </div>
                </div>
              )}
              <div className="flex gap-6 justify-between items-center w-full">
                <div className="flex flex-col justify-between">
                  <Typography
                    type="body-sm"
                    className="font-extrabold text-danger font-outfit text-xs uppercase tracking-wider"
                  >
                    Delete Account
                  </Typography>
                  <Typography
                    type="body-xs"
                    className="text-muted max-w-xl leading-relaxed mt-0.5"
                  >
                    Once deleted, your verified credentials, credentials trail,
                    logs, and profile records will be permanently erased. This
                    cannot be reversed.
                  </Typography>
                </div>
                <Button
                  variant="danger"
                  onClick={() => {
                    setDeletionStep(1);
                    setBlockingOrganizations([]);
                    setDeletionPassword("");
                    setDeletionOtpCode("");
                    setIsOtpSent(false);
                    setDeleteConfirmationText("");
                    setAgreeToTerms({
                      hideProfile: false,
                      gracePeriod: false,
                      auditAnonymize: false,
                    });
                    setIsDeleteModalOpen(true);
                    loadDeletionRequirements();
                    loadLinkedEmails();
                  }}
                  className="font-bold text-xs h-9.5 px-4 rounded-xl flex items-center gap-1.5 select-none"
                >
                  <Trash2 size={13} />
                  <span>Delete Account</span>
                </Button>
              </div>
            </div>
          </Card>
        </SettingsSection>

        {/* 1. Reset Password Mock Confirmation Modal */}
        <Modal.Backdrop
          isOpen={isPasswordModalOpen}
          onOpenChange={setIsPasswordModalOpen}
          className="bg-background/80 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <Modal.Container size="md">
            <Modal.Dialog className="w-full max-w-2xl bg-overlay border border-border rounded-2xl shadow-modal p-6 text-left relative focus-visible:outline-hidden focus:outline-hidden">
              <Modal.CloseTrigger
                aria-label="Close dialog"
                className="absolute right-4 top-4 p-1 rounded-full hover:bg-surface-secondary text-muted hover:text-foreground cursor-pointer transition-colors"
              >
                <X size={15} />
              </Modal.CloseTrigger>
              <Modal.Header className="mb-4">
                <Modal.Heading className="outline-hidden">
                  <span className="font-display font-extrabold text-foreground text-xl">
                    Password Reset Request
                  </span>
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body className="space-y-4 py-2 text-sm leading-relaxed text-muted-foreground select-text">
                <div className="flex flex-col gap-3 py-1 select-none">
                  <div className="flex items-center gap-3 text-accent bg-accent/10 rounded-xl p-3.5 border border-accent/20">
                    <ShieldAlert size={20} className="shrink-0" />
                    <Typography
                      type="body-xs"
                      className="font-bold leading-normal"
                    >
                      For security, password modifications must be processed via
                      email token authorization.
                    </Typography>
                  </div>
                  <Typography
                    type="body-xs"
                    className="text-muted leading-relaxed font-medium font-sans"
                  >
                    We have dispatched a secure password modification link
                    directly to your primary verified email address (
                    <strong>{user?.email}</strong>). Click the link inside the
                    email to complete the setup.
                  </Typography>
                </div>
              </Modal.Body>
              <Modal.Footer className="flex justify-end gap-3 pt-4 mt-4 border-t border-separator">
                <Button
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="rounded-xl font-bold text-xs h-9 px-4 select-none"
                >
                  Understood
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>

        {/* 2. Confirm Revoke Session Modal */}
        <Modal.Backdrop
          isOpen={isRevokeModalOpen}
          onOpenChange={setIsRevokeModalOpen}
          className="bg-background/80 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <Modal.Container size="md">
            <Modal.Dialog className="w-full max-w-lg bg-overlay border border-border rounded-2xl shadow-modal p-6 text-left relative focus-visible:outline-hidden focus:outline-hidden">
              <Modal.CloseTrigger
                aria-label="Close dialog"
                className="absolute right-4 top-4 p-1 rounded-full hover:bg-surface-secondary text-muted hover:text-foreground cursor-pointer transition-colors"
              >
                <X size={15} />
              </Modal.CloseTrigger>
              <Modal.Header className="mb-4">
                <Modal.Heading className="outline-hidden">
                  <span className="font-display font-extrabold text-foreground text-xl">
                    Revoke Active Session
                  </span>
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body className="space-y-4 py-2 text-sm leading-relaxed text-muted-foreground select-text">
                <div className="flex flex-col gap-3 py-1 select-none">
                  <div className="flex items-center gap-3 text-warning bg-warning/10 rounded-xl p-3.5 border border-warning/20">
                    <AlertTriangle
                      size={20}
                      className="shrink-0 text-warning"
                    />
                    <Typography
                      type="body-xs"
                      className="font-bold leading-normal text-warning"
                    >
                      Confirm Session Revocation
                    </Typography>
                  </div>
                  <Typography
                    type="body-xs"
                    className="text-muted leading-relaxed font-medium font-sans"
                  >
                    Are you sure you want to revoke the session for device{" "}
                    <strong>
                      {sessionToRevoke?.deviceName || "Desktop Web browser"}
                    </strong>{" "}
                    (IP: {sessionToRevoke?.ipAddress || "Unknown"})? This device
                    will be immediately signed out of your CVerify workspace.
                  </Typography>
                </div>
              </Modal.Body>
              <Modal.Footer className="flex justify-end gap-3 pt-4 mt-4 border-t border-separator">
                <Button
                  variant="outline"
                  onClick={() => setIsRevokeModalOpen(false)}
                  className="rounded-xl font-bold text-xs h-9 px-4 select-none"
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    if (sessionToRevoke) {
                      handleRevokeSession(sessionToRevoke.sessionId);
                    }
                    setIsRevokeModalOpen(false);
                  }}
                  className="rounded-xl font-bold text-xs h-9 px-4 select-none"
                >
                  Revoke Session
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>

        {/* 2b. Confirm Revoke All Other Sessions Modal */}
        <Modal.Backdrop
          isOpen={isBulkRevokeModalOpen}
          onOpenChange={setIsBulkRevokeModalOpen}
          className="bg-background/80 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <Modal.Container>
            <Modal.Dialog className="w-full max-w-lg bg-overlay border border-border rounded-2xl shadow-modal p-6 text-left">
              <Modal.CloseTrigger
                aria-label="Close dialog"
                className="absolute right-6 top-6"
              >
                <X size={15} />
              </Modal.CloseTrigger>
              <Modal.Header>
                <Modal.Heading className="outline-hidden">
                  <span className="font-display font-extrabold text-foreground text-xl">
                    Revoke All Other Sessions
                  </span>
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body className="py-4 text-sm">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2 text-danger bg-danger-soft border border-danger rounded-xl p-4">
                    <AlertTriangle size={20} className="shrink-0 text-danger" />
                    <Typography
                      type="body-xs"
                      className="font-bold leading-normal text-danger"
                    >
                      Warning: Destructive Bulk Revocation
                    </Typography>
                  </div>
                  <Typography
                    type="body-xs"
                    className="text-muted leading-relaxed font-medium"
                  >
                    Are you sure you want to revoke{" "}
                    <strong>all other active sessions</strong>? Every device
                    other than this current browser will be immediately signed
                    out of your CVerify workspace.
                  </Typography>
                </div>
              </Modal.Body>
              <Modal.Footer className="flex justify-end gap-3 pt-4 mt-4 border-t border-separator">
                <Button
                  variant="outline"
                  onClick={() => setIsBulkRevokeModalOpen(false)}
                  className="rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    handleRevokeOtherSessions();
                    setIsBulkRevokeModalOpen(false);
                  }}
                  className="rounded-xl"
                >
                  Revoke All Others
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>

        {/* 3. Destructive Account Delete Confirmation Modal (3-Step Wizard) */}
        <Modal.Backdrop
          isOpen={isDeleteModalOpen}
          onOpenChange={setIsDeleteModalOpen}
          className="bg-background/80 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <Modal.Container size="md">
            <Modal.Dialog className="w-full max-w-2xl bg-overlay border border-border rounded-2xl shadow-modal p-6 text-left relative focus-visible:outline-hidden focus:outline-hidden">
              <Modal.CloseTrigger
                aria-label="Close dialog"
                className="absolute right-4 top-4 p-1 rounded-full hover:bg-surface-secondary text-muted hover:text-foreground cursor-pointer transition-colors"
              >
                <X size={15} />
              </Modal.CloseTrigger>
              <Modal.Header className="mb-4">
                <Modal.Heading className="outline-hidden">
                  <span className="font-display font-extrabold text-foreground text-xl">
                    Permanently Delete Account
                  </span>
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                {/* Step indicator */}
                <div className="flex items-center justify-between px-1 mb-6 select-none">
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${deletionStep >= 1 ? 'bg-accent text-accent-foreground' : 'bg-surface-secondary text-muted'}`}>1</div>
                    <span className={`text-xs font-bold ${deletionStep >= 1 ? 'text-foreground' : 'text-muted'}`}>Understand</span>
                  </div>
                  <div className="h-px bg-separator flex-1 mx-2" />
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${deletionStep >= 2 ? 'bg-accent text-accent-foreground' : 'bg-surface-secondary text-muted'}`}>2</div>
                    <span className={`text-xs font-bold ${deletionStep >= 2 ? 'text-foreground' : 'text-muted'}`}>Verify</span>
                  </div>
                  <div className="h-px bg-separator flex-1 mx-2" />
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${deletionStep >= 3 ? 'bg-accent text-accent-foreground' : 'bg-surface-secondary text-muted'}`}>3</div>
                    <span className={`text-xs font-bold ${deletionStep >= 3 ? 'text-foreground' : 'text-muted'}`}>Confirm</span>
                  </div>
                </div>

                {/* Step 1 Content: Agreements & Org Remediation */}
                {deletionStep === 1 && (
                  <div className="flex flex-col gap-4">
                    {blockingOrganizations.length > 0 ? (
                      <div className="flex flex-col gap-4">
                        <div className="flex items-start gap-3 p-4 rounded-xl border border-danger bg-danger-soft text-danger">
                          <AlertTriangle size={24} className="shrink-0 mt-0.5" />
                          <div className="flex flex-col gap-1">
                            <Typography.Heading level={6} className="font-bold text-danger">
                              Organization Ownership Restriction
                            </Typography.Heading>
                            <Typography type="body-xs" className="text-danger leading-relaxed">
                              You cannot delete your account because you are the owner of active organizations. You must transfer ownership to a verified partner or delete the organizations first.
                            </Typography>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                          {blockingOrganizations.map((org) => (
                            <div key={org.id} className="flex items-center justify-between p-4 rounded-xl border border-separator bg-surface-secondary/40">
                              <div className="flex flex-col gap-0.5">
                                <Typography className="font-bold text-sm text-foreground">{org.name}</Typography>
                                <Typography type="body-xs" className="text-muted text-xs">@{org.username} • {org.memberCount} members</Typography>
                              </div>
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setIsDeleteModalOpen(false);
                                  router.push("/settings");
                                }}
                                className="text-xs rounded-xl"
                              >
                                Manage Ownership
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start gap-3 text-danger bg-danger-soft border border-danger-soft rounded-xl p-4">
                          <AlertTriangle size={20} className="shrink-0 mt-0.5" />
                          <div className="flex flex-col gap-0.5">
                            <Typography type="body-xs" className="font-bold text-danger leading-normal">
                              Warning: This action is completely irreversible.
                            </Typography>
                            <Typography type="body-xs" className="text-danger leading-relaxed">
                              All active verified credential claims, audit history logs, portfolio layouts, and login authorizations will be permanently destroyed.
                            </Typography>
                          </div>
                        </div>

                        <Typography type="body-xs" className="text-muted leading-relaxed mt-2">
                          To proceed, please review and agree to the following terms:
                        </Typography>

                        <div className="flex flex-col gap-3 py-2">
                          <label className="flex items-start gap-3 cursor-pointer select-none group py-0.5">
                            <Checkbox
                              isSelected={agreeToTerms.hideProfile}
                              onChange={(checked: boolean) =>
                                setAgreeToTerms((prev) => ({
                                  ...prev,
                                  hideProfile: checked,
                                }))
                              }
                              aria-label="I understand my profile page and credentials will be hidden immediately."
                              className="cursor-pointer mt-0.5"
                            >
                              <Checkbox.Control className="w-4 h-4 rounded border border-field-border flex items-center justify-center bg-field group-data-[selected=true]:bg-accent group-data-[selected=true]:border-accent transition-all shrink-0 focus-visible:ring-2 focus-visible:ring-focus">
                                <Checkbox.Indicator className="text-accent-foreground flex items-center justify-center">
                                  <svg
                                    className="w-2.5 h-2.5 fill-none stroke-current stroke-3"
                                    viewBox="0 0 24 24"
                                  >
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                </Checkbox.Indicator>
                              </Checkbox.Control>
                            </Checkbox>
                            <span className="text-sm text-muted">I understand my profile page and credentials will be hidden immediately.</span>
                          </label>
                          <label className="flex items-start gap-3 cursor-pointer select-none group py-0.5">
                            <Checkbox
                              isSelected={agreeToTerms.gracePeriod}
                              onChange={(checked: boolean) =>
                                setAgreeToTerms((prev) => ({
                                  ...prev,
                                  gracePeriod: checked,
                                }))
                              }
                              aria-label="I understand my account will enter a 14-day deactivation period where I can reactivate it."
                              className="cursor-pointer mt-0.5"
                            >
                              <Checkbox.Control className="w-4 h-4 rounded border border-field-border flex items-center justify-center bg-field group-data-[selected=true]:bg-accent group-data-[selected=true]:border-accent transition-all shrink-0 focus-visible:ring-2 focus-visible:ring-focus">
                                <Checkbox.Indicator className="text-accent-foreground flex items-center justify-center">
                                  <svg
                                    className="w-2.5 h-2.5 fill-none stroke-current stroke-3"
                                    viewBox="0 0 24 24"
                                  >
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                </Checkbox.Indicator>
                              </Checkbox.Control>
                            </Checkbox>
                            <span className="text-sm text-muted">I understand my account will enter a 14-day deactivation period where I can reactivate it.</span>
                          </label>
                          <label className="flex items-start gap-3 cursor-pointer select-none group py-0.5">
                            <Checkbox
                              isSelected={agreeToTerms.auditAnonymize}
                              onChange={(checked: boolean) =>
                                setAgreeToTerms((prev) => ({
                                  ...prev,
                                  auditAnonymize: checked,
                                }))
                              }
                              aria-label="I understand after 14 days, my account is permanently purged and forensic logs anonymized."
                              className="cursor-pointer mt-0.5"
                            >
                              <Checkbox.Control className="w-4 h-4 rounded border border-field-border flex items-center justify-center bg-field group-data-[selected=true]:bg-accent group-data-[selected=true]:border-accent transition-all shrink-0 focus-visible:ring-2 focus-visible:ring-focus">
                                <Checkbox.Indicator className="text-accent-foreground flex items-center justify-center">
                                  <svg
                                    className="w-2.5 h-2.5 fill-none stroke-current stroke-3"
                                    viewBox="0 0 24 24"
                                  >
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                </Checkbox.Indicator>
                              </Checkbox.Control>
                            </Checkbox>
                            <span className="text-sm text-muted">I understand after 14 days, my account is permanently purged and forensic logs anonymized.</span>
                          </label>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Step 2 Content: Verification */}
                {deletionStep === 2 && deletionRequirements && (
                  <div className="flex flex-col gap-4 py-2">
                    {deletionRequirements.requiresPassword && (
                      <div className="flex flex-col gap-3">
                        <div className="flex items-start gap-3 p-3 rounded-xl border border-separator bg-surface-secondary/20">
                          <KeyRound className="size-5 text-accent mt-0.5 shrink-0" />
                          <Typography type="body-xs" className="text-muted leading-relaxed">
                            For security, please verify your identity by entering your account password.
                          </Typography>
                        </div>
                        <TextField className="w-full">
                          <Label>Password</Label>
                          <InputGroup>
                            <InputGroup.Input
                              type="password"
                              placeholder="••••••••"
                              value={deletionPassword}
                              onChange={(e) => setDeletionPassword(e.target.value)}
                            />
                          </InputGroup>
                        </TextField>
                      </div>
                    )}

                    {deletionRequirements.requiresOAuthReauth && (
                      <div className="flex flex-col gap-4">
                        <div className="flex items-start gap-3 p-3.5 rounded-xl border border-separator bg-surface-secondary/20">
                          <Mail className="size-5 text-accent mt-0.5 shrink-0" />
                          <Typography type="body-xs" className="text-muted leading-relaxed">
                            For security, we must verify your identity. Select a linked verified email address to receive your one-time passcode (OTP).
                          </Typography>
                        </div>

                        {!isOtpSent && !isSendingOtp && (
                          <div className="flex flex-col gap-4 py-2">
                            {linkedEmails.length >= 1 ? (
                              <SelectDropdown
                                label="Verification Destination"
                                value={selectedOtpEmail}
                                onChange={(val) => setSelectedOtpEmail(val)}
                                options={linkedEmails.map((emailObj) => ({
                                  value: emailObj.email,
                                  label: emailObj.email,
                                }))}
                                placeholder="Select verification destination"
                              />
                            ) : (
                              <Card className="p-3.5 flex flex-col gap-1 border border-separator/80 bg-surface-secondary/20">
                                <Typography type="body-xs" className="text-muted font-semibold uppercase tracking-wider text-[9px] font-outfit">
                                  Verification Destination
                                </Typography>
                                <Typography className="text-sm font-bold text-foreground font-sans">
                                  {selectedOtpEmail || user?.email}
                                </Typography>
                              </Card>
                            )}

                            <Button
                              onClick={handleSendFallbackOtp}
                              className="w-full font-bold text-xs h-10 px-4 rounded-xl flex items-center justify-center gap-2 bg-foreground text-background hover:bg-foreground/90 transition-colors select-none mt-2"
                            >
                              <Mail className="size-4" />
                              Send Verification Code
                            </Button>
                          </div>
                        )}

                        {isSendingOtp && !isOtpSent && (
                          <div className="flex flex-col items-center justify-center py-8 gap-3">
                            <Spinner size="md" color="accent" />
                            <Typography type="body-xs" className="text-muted text-xs">
                              Sending verification code to {selectedOtpEmail || user?.email}...
                            </Typography>
                          </div>
                        )}

                        {isOtpSent && (
                          <div className="flex flex-col gap-4 items-center py-2 animate-in fade-in zoom-in-95 duration-200">
                            <div className="flex flex-col gap-1 text-center">
                              <Typography type="body-xs" className="font-bold text-foreground">Verify OTP Code</Typography>
                              <Typography type="body-xs" className="text-muted text-[11px]">We sent a code to {selectedOtpEmail}.</Typography>
                            </div>

                            <OtpInput
                              value={deletionOtpCode}
                              onChange={(val) => setDeletionOtpCode(val)}
                              length={6}
                            />

                            <div className="mt-2 text-center">
                              {otpCooldown > 0 ? (
                                <Typography type="body-xs" className="text-muted text-xs">
                                  Resend code in {otpCooldown}s
                                </Typography>
                              ) : (
                                <Button
                                  variant="ghost"
                                  isDisabled={isSendingOtp}
                                  onClick={handleSendFallbackOtp}
                                  className="text-accent font-bold text-xs"
                                >
                                  Resend verification email
                                </Button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Step 3 Content: Confirmation phrase */}
                {deletionStep === 3 && (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-start gap-3 text-warning bg-warning/5 border border-warning/15 rounded-xl p-4">
                      <CheckCircle2 size={20} className="text-warning shrink-0 mt-0.5" />
                      <div className="flex flex-col gap-0.5">
                        <Typography type="body-xs" className="font-bold text-warning leading-normal">
                          Final Confirmation: Double Consent Required
                        </Typography>
                        <Typography type="body-xs" className="text-muted text-xs leading-relaxed">
                          Your account will be placed in a 14-day deactivation grace period. Type the phrase <strong>delete my account</strong> below to confirm.
                        </Typography>
                      </div>
                    </div>

                    <TextField className="w-full">
                      <Label>
                        Please type <span className="font-bold text-danger font-mono bg-danger-soft border border-danger-soft rounded-md px-1 select-all">delete my account</span> below:
                      </Label>
                      <InputGroup>
                        <InputGroup.Input
                          type="text"
                          placeholder="delete my account"
                          value={deleteConfirmationText}
                          onChange={(e) => setDeleteConfirmationText(e.target.value)}
                          autoComplete="off"
                        />
                      </InputGroup>
                    </TextField>
                  </div>
                )}
              </Modal.Body>
              <Modal.Footer className="flex justify-end gap-3 pt-4 mt-4 border-t border-separator">
                <Button
                  variant="outline"
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="rounded-xl text-xs font-bold"
                >
                  Cancel
                </Button>

                {deletionStep === 1 && (
                  <Button
                    variant="danger"
                    isDisabled={
                      blockingOrganizations.length > 0 ||
                      !agreeToTerms.hideProfile ||
                      !agreeToTerms.gracePeriod ||
                      !agreeToTerms.auditAnonymize
                    }
                    onClick={() => {
                      setDeletionStep(2);
                      if (deletionRequirements?.requiresOAuthReauth && !isOtpSent) {
                        handleSendFallbackOtp();
                      }
                    }}
                    className="rounded-xl text-xs font-bold"
                  >
                    Continue to Verification
                    <ArrowRight size={13} className="ml-1" />
                  </Button>
                )}

                {deletionStep === 2 && (
                  <Button
                    variant="danger"
                    isDisabled={
                      (deletionRequirements?.requiresPassword && !deletionPassword) ||
                      (deletionRequirements?.requiresOAuthReauth && (!isOtpSent || deletionOtpCode.length !== 6))
                    }
                    onClick={() => setDeletionStep(3)}
                    className="rounded-xl text-xs font-bold"
                  >
                    Continue to Confirm
                    <ArrowRight size={13} className="ml-1" />
                  </Button>
                )}

                {deletionStep === 3 && (
                  <Button
                    variant="danger"
                    isDisabled={isDeleting || deleteConfirmationText !== "delete my account"}
                    isPending={isDeleting}
                    onClick={handleDeleteAccount}
                    className="rounded-xl text-xs font-bold"
                  >
                    <Trash2 size={13} />
                    Permanently Erase
                  </Button>
                )}
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>

        {/* Reusable Username Confirmation Modal */}
        <ConfirmationModal
          isOpen={isUsernameConfirmOpen}
          onOpenChange={setIsUsernameConfirmOpen}
          title="Confirm Username Modification"
          variant="warning"
          confirmText="Update Username"
          isPending={isSaving}
          onConfirm={() => {
            if (pendingFormData) {
              executeFormSubmit(pendingFormData);
            }
          }}
          description={
            <div className="flex flex-col gap-2">
              <Typography type="body-xs" className="leading-relaxed text-left">
                Are you sure you want to change your username from{" "}
                <strong>@{profile?.username}</strong> to{" "}
                <strong>@{pendingFormData?.username}</strong>?
              </Typography>
              <Typography
                type="body-xs"
                className="leading-relaxed text-warning font-semibold bg-warning/5 p-3.5 rounded-xl border border-warning/15 mt-1 text-left"
              >
                Warning: Changing your username will immediately change your
                public profile URL to{" "}
                <span className="font-bold text-foreground">
                  {profileOrigin.replace(/^https?:\/\//, "")}/
                  {pendingFormData?.username}
                </span>
                . All active verifications, portfolio shares, and credential
                links using the old URL will break immediately.
              </Typography>
            </div>
          }
        />
      </div>
    </FormProvider>
  );
};

export default AccountTab;
