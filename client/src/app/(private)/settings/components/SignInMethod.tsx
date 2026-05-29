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
} from "@heroui/react";
import { Mail, Key, Eye, EyeOff } from "lucide-react";
import { Google } from "@thesvg/react";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import PasswordStrengthMeter from "@/features/auth/components/password-strength-meter";

const passwordFormSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmNewPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Passwords do not match",
    path: ["confirmNewPassword"],
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
    forgotPassword,
    changePassword,
    linkGoogleAccount,
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

  const {
    register,
    handleSubmit,
    reset: resetForm,
    watch,
    formState: { errors },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    },
  });

  const watchNewPassword = watch("newPassword");

  const onSubmitPasswordChange = async (data: PasswordFormValues) => {
    setIsSubmitting(true);
    try {
      const response = await changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
        confirmNewPassword: data.confirmNewPassword,
      });

      if (response.success) {
        toast.success("Password updated successfully.");
        setIsFormOpen(false);
        resetForm();
      } else {
        toast.danger(response.data?.message || "Failed to update password.");
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

  const handleManageEmail = async () => {
    setEmailLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 300));
    toast.success("Email configuration settings have been updated.", {
      description: `Primary verified email address: ${userEmail}`,
    });
    setEmailLoading(false);
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

  const handlePasswordResetTrigger = async () => {
    if (!userEmail) return;
    setResetLoading(true);
    try {
      const response = await forgotPassword(userEmail);
      if (response.success) {
        toast.success("Password reset email sent successfully.", {
          description: `A reset link was sent to ${userEmail}.`,
        });
      } else {
        toast.danger(response.error?.message || "Failed to send reset email.");
      }
    } catch (_err) {
      toast.danger("An error occurred trying to send reset link.");
    } finally {
      setResetLoading(false);
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
                1 verified email configured ({userEmail})
              </Typography>
            </div>
          </div>

          <div className="flex items-center shrink-0">
            <Button
              variant="outline"
              isPending={emailLoading}
              onClick={handleManageEmail}
              className="rounded-xl"
            >
              {({ isPending }) => (
                <>
                  {isPending ? (
                    <>
                      <Spinner color="current" size="sm" />
                      Managing...
                    </>
                  ) : (
                    "Manage"
                  )}
                </>
              )}
            </Button>
          </div>
        </div>
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
                Last updated password credentials
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
            <Button
              variant="ghost"
              isPending={resetLoading}
              onClick={handlePasswordResetTrigger}
              className="rounded-xl text-xs"
            >
              {({ isPending }) => (
                <>
                  {isPending ? (
                    <Spinner color="current" size="sm" />
                  ) : (
                    "Send Reset Link"
                  )}
                </>
              )}
            </Button>
          </div>
        </div>

        {isFormOpen && (
          <form
            onSubmit={handleSubmit(onSubmitPasswordChange)}
            className="flex flex-col gap-4 mt-2 p-4 bg-surface-secondary/20 rounded-2xl border border-separator/50 animate-slide-down duration-300"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <TextField
                isRequired
                name="currentPassword"
                isInvalid={!!errors.currentPassword}
              >
                <Label className="text-xs font-semibold text-foreground/80 pb-1">
                  Current Password
                </Label>
                <InputGroup>
                  <InputGroup.Input
                    type={showCurrent ? "text" : "password"}
                    placeholder="Enter current password"
                    {...register("currentPassword")}
                  />
                  <InputGroup.Suffix>
                    <Button
                      isIconOnly
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowCurrent(!showCurrent)}
                      className="text-muted hover:bg-transparent"
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
                <Label className="text-xs font-semibold text-foreground/80 pb-1">
                  New Password
                </Label>
                <InputGroup>
                  <InputGroup.Input
                    type={showNew ? "text" : "password"}
                    placeholder="Min 8 characters"
                    {...register("newPassword")}
                  />
                  <InputGroup.Suffix>
                    <Button
                      isIconOnly
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowNew(!showNew)}
                      className="text-muted hover:bg-transparent"
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
                <Label className="text-xs font-semibold text-foreground/80 pb-1">
                  Confirm New Password
                </Label>
                <InputGroup>
                  <InputGroup.Input
                    type={showConfirm ? "text" : "password"}
                    placeholder="Repeat new password"
                    {...register("confirmNewPassword")}
                  />
                  <InputGroup.Suffix>
                    <Button
                      isIconOnly
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="text-muted hover:bg-transparent"
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

            <div className="flex flex-col gap-2">
              <PasswordStrengthMeter
                value={watchNewPassword || ""}
                policyId="default"
              />
            </div>

            <div className="flex justify-end gap-3 mt-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setIsFormOpen(false);
                  resetForm();
                }}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                isPending={isSubmitting}
                className="bg-foreground text-background rounded-xl font-bold font-outfit"
              >
                Update Password
              </Button>
            </div>
          </form>
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
