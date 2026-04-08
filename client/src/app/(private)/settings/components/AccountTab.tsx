"use client";

import React, { useEffect, useState } from "react";
import { useForm, FormProvider, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SelectDropdown } from "@/components/ui/select-dropdown";
import { FormInput } from "@/components/forms/form-input";
import { SettingsSection } from "./SettingsSection";
import { LinkedAccountsList } from "./LinkedAccountsList";
import { DialogModal } from "@/components/ui/dialog-modal";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { Typography, Switch, Chip, Spinner, toast } from "@heroui/react";
import {
  ShieldAlert,
  Key,
  Laptop,
  Trash2,
  AlertTriangle,
  ShieldX,
} from "lucide-react";
import { type SessionInfoData } from "@/types/auth.types";
import { UnsavedChangesBar, isDeepEqual } from "@/components/ui/unsaved-changes-bar";
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
  profileVisibility: z.enum(["public", "members", "private"]),
  recruiterVisibility: z.boolean(),
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
  const { user, fetchSessions, revokeSession } = useAuth();
  const { profile, isLoading, updateProfile, updateUsername } = useProfile();

  // Local states
  const [sessions, setSessions] = useState<SessionInfoData[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // Modals state
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Form methods setup
  const methods = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      username: "",
      profileVisibility: "public",
      recruiterVisibility: true,
    },
    mode: "onChange",
  });

  const {
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = methods;

  const currentValues = useWatch({ control: methods.control });

  // Reset form when profile data loads from DB
  useEffect(() => {
    if (profile && !methods.formState.isDirty) {
      reset({
        username: profile.username || "",
        profileVisibility: (profile.profileVisibility as any) || "public",
        recruiterVisibility: profile.recruiterVisibility ?? true,
      });
    }
  }, [profile, reset]);

  useEffect(() => {
    const hasChanges = !isDeepEqual(currentValues, methods.formState.defaultValues);
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
        data.recruiterVisibility !== profile?.recruiterVisibility
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
          socialLinks: profile?.socialLinks || [],
          version: useProfileStore.getState().profile?.version || profile?.version || 0,
        };
        await updateProfile(request);
      }

      reset(data);
      onSaveSuccess();
    } catch (error: any) {
      console.error("Failed to save account settings:", error);
      const errMsg = error.response?.data?.message || error.message || "Failed to update account settings.";
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
    if (deleteConfirmationText !== "DELETE") return;
    setIsDeleting(true);
    try {
      // Simulate delete call
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setIsDeleteModalOpen(false);
      // Force trigger logout and redirect
      window.location.href = "/login";
    } catch (err) {
      console.error("Failed to delete account:", err);
      setIsDeleting(false);
    }
  };

  const visibilityOptions = [
    { value: "public", label: "Public" },
    { value: "members", label: "Members Only" },
    { value: "private", label: "Private" },
  ];

  // Simulating check for organization ownership restrictions
  const hasOrganizationOwnership =
    user?.role === "ADMIN" ||
    user?.fullName?.toLowerCase().includes("owner") ||
    false;

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={handleSubmit(handleFormSubmit)}
        className="space-y-10 pb-20"
      >
        {/* Username section */}
        <SettingsSection
          title="Profile Path & Username"
          description="Customize your public username. This affects your unique URL signature used for shareable identity verification."
        >
          <Card className="text-left gap-4 flex flex-col">
            <div className="flex flex-col gap-1.5 w-full md:max-w-md">
              <FormInput
                name="username"
                label="Username"
                placeholder="lowercase_username"
                autoComplete="off"
              />
              {!errors.username && (
                <div className="flex flex-col gap-1 pl-1 select-none">
                  <Typography
                    type="body-xs"
                    className="text-muted text-[10.5px] font-semibold mt-0.5"
                  >
                    Your public profile link will be:
                  </Typography>
                  <Typography
                    type="body-xs"
                    className="text-accent font-bold font-mono text-[10px] break-all"
                  >
                    cverify.com/{currentValues.username || "username"}
                  </Typography>
                </div>
              )}
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

        {/* Security / Password section */}
        <SettingsSection
          title="Security Credentials"
          description="Manage passwords and cryptographic identity verification credentials."
        >
          <Card className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-6 text-left">
            <div className="flex flex-col gap-0.5 max-w-md select-none">
              <div className="flex items-center gap-2">
                <Typography
                  type="body-sm"
                  className="font-bold text-foreground font-outfit"
                >
                  Password Auth
                </Typography>
                <Key size={14} className="text-accent shrink-0" />
              </div>
              <Typography type="body-xs" className="text-muted leading-relaxed">
                Update or set a robust password to ensure security when logging
                in outside OAuth single sign-on flows.
              </Typography>
            </div>
            <Button
              variant="outline"
              onClick={() => setIsPasswordModalOpen(true)}
              className="rounded-xl border-separator font-bold text-xs h-9 px-4 shrink-0 select-none"
            >
              Change Password
            </Button>
          </Card>
        </SettingsSection>

        {/* Active sessions section */}
        <SettingsSection
          title="Active Devices & Sessions"
          description="View active sessions logged into your account. You can revoke older or unrecognized sessions here."
        >
          <Card className="text-left flex flex-col gap-4">
            <Typography
              type="body-sm"
              className="font-bold text-foreground font-outfit select-none"
            >
              Login Sessions
            </Typography>

            {loadingSessions ? (
              <div className="flex flex-col gap-2.5">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-14 w-full rounded-xl bg-surface-secondary animate-pulse"
                  />
                ))}
              </div>
            ) : sessions.length > 0 ? (
              <div className="divide-y divide-separator/60 border border-separator/85 rounded-xl bg-field-background/50 overflow-hidden">
                {sessions.map((session) => (
                  <div
                    key={session.sessionId}
                    className="flex items-center justify-between gap-4 p-4 hover:bg-surface-secondary/10 transition-all"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-surface-secondary flex items-center justify-center border border-separator/40 shrink-0 text-muted">
                        <Laptop size={18} />
                      </div>
                      <div className="flex flex-col min-w-0 select-none">
                        <div className="flex items-center gap-2">
                          <Typography
                            type="body-sm"
                            className="font-bold text-foreground font-outfit"
                          >
                            {session.deviceName || "Desktop Web browser"}
                          </Typography>
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
                          className="text-muted text-[11px] font-sans truncate mt-0.5"
                        >
                          IP: {session.ipAddress || "Unknown IP"} • OS:{" "}
                          {session.userAgent || "Web Session"}
                        </Typography>
                      </div>
                    </div>

                    {!session.isCurrent && (
                      <Button
                        variant="outline"
                        isLoading={revokingId === session.sessionId}
                        onClick={() => handleRevokeSession(session.sessionId)}
                        className="h-8 rounded-lg border-separator font-bold text-[10.5px] hover:border-danger hover:bg-danger-soft text-foreground hover:text-danger select-none shrink-0"
                      >
                        Revoke
                      </Button>
                    )}
                  </div>
                ))}
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

        {/* Privacy controls section */}
        <SettingsSection
          title="Privacy Settings"
          description="Control what information is visible on your profile and manage recruiter indexing permissions."
        >
          <Card className="text-left flex flex-col gap-6">
            <div className="flex flex-col gap-1.5 w-full md:max-w-md">
              <SelectDropdown
                label="Profile Visibility"
                value={currentValues.profileVisibility || "public"}
                onChange={(val: string) =>
                  setValue(
                    "profileVisibility",
                    val as "public" | "members" | "private",
                    { shouldDirty: true },
                  )
                }
                options={visibilityOptions}
                placeholder="Select visibility"
              />
            </div>

            <div className="border-t border-separator/60 my-1" />

            <div className="flex items-center justify-between gap-6 select-none">
              <div className="flex flex-col gap-0.5">
                <Typography
                  type="body-sm"
                  className="font-bold text-foreground font-outfit"
                >
                  Recruiter Indexing & Discovery
                </Typography>
                <Typography type="body-xs" className="text-muted max-w-md">
                  Allow corporate recruiter dashboards to query, scan, and
                  discover your verified identity profile for active matching
                  job posts.
                </Typography>
              </div>
              <Switch
                isSelected={currentValues.recruiterVisibility ?? true}
                onChange={(isSelected: boolean) => {
                  setValue("recruiterVisibility", isSelected, {
                    shouldDirty: true,
                  });
                }}
                aria-label="Recruiter visibility toggle"
                className="cursor-pointer"
              >
                {({ isSelected }) => (
                  <Switch.Control className={`w-11 h-6 rounded-full relative flex items-center transition-colors duration-200 ${isSelected ? "bg-success" : "bg-separator"}`}>
                    <Switch.Thumb className={`w-4.5 h-4.5 bg-foreground rounded-full absolute transition-all duration-200 ${isSelected ? "left-[22px]" : "left-0.5"}`} />
                  </Switch.Control>
                )}
              </Switch>
            </div>
          </Card>
        </SettingsSection>

        {/* Danger zone section */}
        <SettingsSection
          title="Danger Zone"
          description="Actions here are completely destructive and permanent. Double-check all considerations before executing."
        >
          <Card className="border border-danger/40 bg-danger/5 dark:bg-danger/2 p-6 flex flex-col gap-5 text-left relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-danger/10 rounded-full blur-2xl -mr-6 -mt-6 pointer-events-none" />
            <div className="flex flex-col gap-1 select-none">
              <div className="flex items-center gap-2">
                <Typography
                  type="body-sm"
                  className="font-extrabold text-danger font-outfit text-xs uppercase tracking-wider"
                >
                  Delete Account
                </Typography>
                <ShieldX
                  size={14}
                  className="text-danger shrink-0 animate-pulse"
                />
              </div>
              <Typography
                type="body-xs"
                className="text-muted max-w-xl leading-relaxed mt-0.5"
              >
                Once deleted, your verified credentials, credentials trail,
                logs, and profile records will be permanently erased. This
                cannot be reversed.
              </Typography>
            </div>

            {hasOrganizationOwnership && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl border border-warning/30 bg-warning/10 dark:bg-warning/2 text-warning max-w-xl select-none animate-fade-in">
                <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                <div className="flex flex-col gap-0.5">
                  <Typography
                    type="body-xs"
                    className="font-bold font-outfit uppercase tracking-wider text-[10px] text-warning"
                  >
                    Organization Ownership Restriction
                  </Typography>
                  <Typography
                    type="body-xs"
                    className="text-muted text-[10.5px] leading-relaxed"
                  >
                    You currently have active organization ownership roles. You
                    must transfer organization ownership to a verified partner
                    before you can delete this account.
                  </Typography>
                </div>
              </div>
            )}

            <div className="flex shrink-0">
              <Button
                variant="danger"
                disabled={hasOrganizationOwnership}
                onClick={() => setIsDeleteModalOpen(true)}
                className="font-bold text-xs h-9.5 px-4 rounded-xl flex items-center gap-1.5 select-none"
              >
                <Trash2 size={13} />
                <span>Delete Account</span>
              </Button>
            </div>
          </Card>
        </SettingsSection>

        {/* Sticky Actions Bar */}
        <UnsavedChangesBar
          message="You have unsaved account setting changes."
          onReset={handleReset}
        />

        {/* 1. Reset Password Mock Confirmation Modal */}
        <DialogModal
          isOpen={isPasswordModalOpen}
          onOpenChange={setIsPasswordModalOpen}
          title="Password Reset Request"
          footer={
            <Button
              variant="solid"
              onClick={() => setIsPasswordModalOpen(false)}
              className="rounded-xl font-bold text-xs h-9 px-4 select-none"
            >
              Understood
            </Button>
          }
        >
          <div className="flex flex-col gap-3 py-1 select-none">
            <div className="flex items-center gap-3 text-accent bg-accent/10 rounded-xl p-3.5 border border-accent/20">
              <ShieldAlert size={20} className="shrink-0" />
              <Typography type="body-xs" className="font-bold leading-normal">
                For security, password modifications must be processed via email
                token authorization.
              </Typography>
            </div>
            <Typography
              type="body-xs"
              className="text-muted leading-relaxed font-medium font-sans"
            >
              We have dispatched a secure password modification link directly to
              your primary verified email address (
              <strong>{user?.email}</strong>). Click the link inside the email
              to complete the setup.
            </Typography>
          </div>
        </DialogModal>

        {/* 2. Destructive Account Delete Confirmation Modal */}
        <DialogModal
          isOpen={isDeleteModalOpen}
          onOpenChange={setIsDeleteModalOpen}
          title="Permanently Delete Account"
          footer={
            <div className="flex items-center gap-2.5 w-full justify-end">
              <Button
                variant="outline"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={isDeleting}
                className="rounded-xl font-bold text-xs h-9 px-4 select-none"
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                disabled={deleteConfirmationText !== "DELETE" || isDeleting}
                isLoading={isDeleting}
                onClick={handleDeleteAccount}
                className="rounded-xl font-bold text-xs h-9 px-4 flex items-center gap-1.5 select-none"
              >
                <Trash2 size={13} />
                <span>Permanently Erase</span>
              </Button>
            </div>
          }
        >
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
                  All active verified credential claims, audit history logs,
                  portfolio layouts, and login authorizations will be
                  permanently destroyed.
                </Typography>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-foreground/90 text-xs font-semibold">
                To confirm deletion, please type{" "}
                <span className="font-bold text-danger font-mono bg-danger-soft border border-danger/20 rounded px-1.5 py-0.5 select-all">
                  DELETE
                </span>{" "}
                below:
              </label>
              <input
                type="text"
                placeholder="Type DELETE"
                value={deleteConfirmationText}
                onChange={(e) => setDeleteConfirmationText(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-field-border focus:border-danger focus:ring-danger bg-field text-foreground text-xs font-semibold focus:outline-hidden cursor-pointer hover:border-border transition-all select-none focus-visible:ring-2 font-sans"
                autoComplete="off"
              />
            </div>
          </div>
        </DialogModal>
      </form>
    </FormProvider>
  );
};

export default AccountTab;
