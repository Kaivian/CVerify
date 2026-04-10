"use client";

import React, { useEffect, useState } from "react";
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
} from "@heroui/react";
import {
  ShieldAlert,
  Laptop,
  Trash2,
  AlertTriangle,
  Info,
  X,
} from "lucide-react";
import { type SessionInfoData } from "@/types/auth.types";
import {
  UnsavedChangesBar,
  isDeepEqual,
} from "@/components/ui/unsaved-changes-bar";
import { useProfile } from "@/hooks/use-profile";
import { type UpdateProfileRequest } from "@/types/profile.types";
import { useProfileStore } from "@/stores/use-profile-store";

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
  const { user, fetchSessions, revokeSession, deleteAccount } = useAuth();
  const { profile, isLoading, updateProfile, updateUsername } = useProfile();

  // Local states
  const [sessions, setSessions] = useState<SessionInfoData[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [profileOrigin, setProfileOrigin] = useState("https://cverify.com");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setProfileOrigin(window.location.origin);
    }
  }, []);

  // Modals state
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRevokeModalOpen, setIsRevokeModalOpen] = useState(false);
  const [sessionToRevoke, setSessionToRevoke] =
    useState<SessionInfoData | null>(null);

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

  const {
    handleSubmit,
    reset,
    setValue,
  } = methods;

  const currentValues = useWatch({ control: methods.control });

  useEffect(() => {
    if (profile && !methods.formState.isDirty) {
      reset({
        username: profile.username || "",
        profileVisibility: (profile.profileVisibility as AccountFormValues["profileVisibility"]) || "public",
        recruiterVisibility: profile.recruiterVisibility ?? true,
        aiTalentDiscovery: (profile.aiTalentDiscovery as AccountFormValues["aiTalentDiscovery"]) || "disabled",
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

  const handleFormSubmit = async (data: AccountFormValues) => {
    try {
      // 1. If username changed, call updateUsername API
      if (data.username !== profile?.username) {
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

      reset(data);
      onSaveSuccess();
    } catch (error: unknown) {
      console.error("Failed to save account settings:", error);
      const axiosError = error as {
        response?: { status?: number; data?: { message?: string } };
        message?: string;
      };
      
      const isConflict = axiosError.response?.status === 409 || 
        axiosError.response?.data?.message?.toLowerCase().includes("taken") ||
        axiosError.response?.data?.message?.toLowerCase().includes("already exists");
        
      if (isConflict) {
        methods.setError("username", {
          type: "manual",
          message: axiosError.response?.data?.message || "This username is already taken."
        });
        return;
      }

      const errMsg =
        axiosError.response?.data?.message ||
        axiosError.message ||
        "Failed to update account settings.";
      toast.danger(errMsg);
    }
  };

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
      const success = await revokeSession(sessionId);
      if (success) {
        setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
      }
    } catch (err) {
      console.error("Failed to revoke session:", err);
    } finally {
      setRevokingId(null);
    }
  };

  // Delete account action
  const handleDeleteAccount = async () => {
    if (deleteConfirmationText !== (profile?.username || "")) return;
    setIsDeleting(true);
    try {
      const response = await deleteAccount();
      if (response.success) {
        setIsDeleteModalOpen(false);
        toast.success("Account successfully deleted.");
        window.location.assign("/login");
      } else {
        toast.danger(response.error?.message || "Failed to delete account.");
        setIsDeleting(false);
      }
    } catch (err) {
      console.error("Failed to delete account:", err);
      toast.danger("An error occurred during account deletion.");
      setIsDeleting(false);
    }
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
                      maxLength={25}
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
                    <FieldError>{methods.formState.errors.username.message}</FieldError>
                  )}
                </TextField>
                <Description>
                  Your public profile link will be:{" "}
                  <span className="font-bold text-foreground">
                    {profileOrigin.replace(/^https?:\/\//, "")}/
                    {currentValues.username || "username"}
                  </span>
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
                  <Tooltip delay={0}>
                    <div className="w-full flex items-center gap-1">
                      <Label>Profile Visibility</Label>
                      <Button
                        isIconOnly
                        variant="ghost"
                        className="rounded-full h-5 w-5"
                      >
                        <Info />
                      </Button>
                    </div>
                    <Tooltip.Content showArrow>
                      Control who can view your public profile page and verified
                      credentials.
                    </Tooltip.Content>
                  </Tooltip>
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
                  <Tooltip delay={0}>
                    <div className="w-full flex items-center gap-1">
                      <Label>AI Talent Discovery</Label>
                      <Button
                        isIconOnly
                        variant="ghost"
                        className="rounded-full h-5 w-5"
                      >
                        <Info />
                      </Button>
                    </div>
                    <Tooltip.Content showArrow>
                      Control whether recruiter AI systems can analyze and rank
                      your profile for talent discovery and job matching.
                    </Tooltip.Content>
                  </Tooltip>
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

        {/* Linked accounts section */}
        <SettingsSection
          title="Linked Auth Accounts"
          description="Manage connected single sign-on authentication methods to access your CVerify workspace."
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
                                {session.deviceName || "Desktop Web browser"}
                              </Typography.Heading>
                              {session.isCurrent && (
                                <Chip
                                  size="sm"
                                  color="accent"
                                  variant="soft"
                                  className="h-4.5 px-1.5 text-[9px] font-extrabold uppercase tracking-wider font-outfit"
                                >
                                  Current
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
                  isDisabled={hasOrganizationOwnership}
                  onClick={() => setIsDeleteModalOpen(true)}
                  className="font-bold text-xs h-9.5 px-4 rounded-xl flex items-center gap-1.5 select-none"
                >
                  <Trash2 size={13} />
                  <span>Delete Account</span>
                </Button>
              </div>
            </div>
          </Card>
        </SettingsSection>

        {/* Sticky Actions Bar */}
        <UnsavedChangesBar
          message="You have unsaved account setting changes."
          onReset={handleReset}
        />

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

        {/* 3. Destructive Account Delete Confirmation Modal */}
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
              <Modal.Body className="space-y-4 py-2 text-sm leading-relaxed text-muted-foreground select-text">
                <div className="flex flex-col gap-4 py-1 select-none text-left">
                  <div className="flex items-start gap-3 text-danger bg-danger/10 rounded-xl p-3.5 border border-danger/20">
                    <AlertTriangle
                      size={20}
                      className="shrink-0 mt-0.5 animate-bounce"
                    />
                    <div className="flex flex-col gap-0.5">
                      <Typography
                        type="body-xs"
                        className="font-bold text-danger leading-normal"
                      >
                        Warning: This action is completely irreversible.
                      </Typography>
                      <Typography
                        type="body-xs"
                        className="text-danger leading-relaxed mt-0.5 font-sans"
                      >
                        All active verified credential claims, audit history
                        logs, portfolio layouts, and login authorizations will
                        be permanently destroyed.
                      </Typography>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-foreground/90 text-xs font-semibold">
                      To confirm deletion, please type your username{" "}
                      <span className="font-bold text-danger font-mono bg-danger-soft border border-danger/20 rounded px-1.5 py-0.5 select-all">
                        {profile?.username || "username"}
                      </span>{" "}
                      below:
                    </label>
                    <input
                      type="text"
                      placeholder="Type your username"
                      value={deleteConfirmationText}
                      onChange={(e) =>
                        setDeleteConfirmationText(e.target.value)
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-field-border focus:border-danger focus:ring-danger bg-field text-foreground text-xs font-semibold focus:outline-hidden cursor-pointer hover:border-border transition-all select-none focus-visible:ring-2 font-sans"
                      autoComplete="off"
                    />
                  </div>
                </div>
              </Modal.Body>
              <Modal.Footer className="flex justify-end gap-3 pt-4 mt-4 border-t border-separator">
                <Button
                  variant="outline"
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="rounded-xl font-bold text-xs h-9 px-4 select-none"
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  isDisabled={
                    isDeleting ||
                    deleteConfirmationText !== (profile?.username || "")
                  }
                  isPending={isDeleting}
                  onClick={handleDeleteAccount}
                  className="rounded-xl font-bold text-xs h-9 px-4 flex items-center gap-1.5 select-none"
                >
                  <Trash2 size={13} />
                  <span>Permanently Erase</span>
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </form>
    </FormProvider>
  );
};

export default AccountTab;
