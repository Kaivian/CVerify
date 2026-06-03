"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authApi } from "@/features/auth/services/auth.service";
import { normalizeRole } from "@/lib/utils/auth-utils";
import {
  Card,
  Typography,
  Button,
  Spinner,
  toast,
} from "@heroui/react";
import { useAuthStore } from "@/features/auth/store/use-auth-store";
import { ShieldCheck, AlertCircle, ArrowRight } from "lucide-react";
import { type User } from "@/types/auth.types";

function ReactivateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const login = useAuthStore((s) => s.login);
  
  const [isReactivating, setIsReactivating] = useState(false);

  const handleReactivate = async () => {
    if (!token) {
      toast.danger("Missing Reactivation Token", {
        description: "Please request a new link or try signing in again.",
      });
      return;
    }

    setIsReactivating(true);
    try {
      const response = await authApi.reactivateAccount({ reactivationToken: token });
      
      const user: User = {
        id: response.id,
        email: response.email,
        fullName: response.fullName,
        avatarUrl: response.avatarUrl,
        role: normalizeRole(response.roles),
        permissions: response.permissions,
        isEmailVerified: response.isEmailVerified,
        passwordChangedAt: response.passwordChangedAt,
        hasPassword: response.hasPassword,
      };

      // Set global authentication state via Zustand
      login(user);

      toast.success("Welcome Back!", {
        description: "Your CVerify account has been fully reactivated.",
      });

      // Redirect user to their role-based home dashboard
      const dashboardMap: Record<string, string> = {
        ADMIN: "/admin",
        BUSINESS: "/business",
        USER: "/user",
      };
      const target = dashboardMap[user.role] || "/";
      router.replace(target);
    } catch (err: any) {
      console.error("Reactivation failed:", err);
      const errMsg = err.response?.data?.message || "Failed to reactivate account. Token may be expired or invalid.";
      toast.danger("Reactivation Failed", {
        description: errMsg,
      });
    } finally {
      setIsReactivating(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background relative overflow-hidden font-sans">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-accent/5 rounded-full blur-3xl pointer-events-none select-none" />

      <Card className="w-full max-w-md p-8 border border-border shadow-modal rounded-3xl relative z-10 flex flex-col items-center text-center select-none animate-in fade-in zoom-in-95 duration-300">
        <div className="w-14 h-14 rounded-2xl bg-warning-soft border border-warning-soft/20 flex items-center justify-center text-warning mb-6">
          <AlertCircle size={28} />
        </div>

        <Typography.Heading level={3} className="font-display font-extrabold text-foreground pb-2 tracking-tight">
          Account Deactivation Pending
        </Typography.Heading>

        <Typography type="body-sm" className="text-muted leading-relaxed pb-8 px-2 font-medium">
          Your profile and verified credentials are currently hidden. You are within the 14-day deactivation grace period. Reactivate now to instantly restore all active verifications and dashboard access.
        </Typography>

        {!token ? (
          <div className="w-full p-4 rounded-xl border border-danger bg-danger-soft text-danger text-left text-xs mb-6">
            <strong>Error:</strong> Reactivation token is missing. Please attempt to sign in again to receive a valid reactivation prompt.
          </div>
        ) : null}

        <Button
          isDisabled={!token || isReactivating}
          isPending={isReactivating}
          onClick={handleReactivate}
          className="w-full font-bold text-xs h-11 px-6 rounded-xl flex items-center justify-center gap-2 bg-foreground text-background hover:bg-foreground/90 transition-colors"
        >
          {isReactivating ? (
            <>
              <Spinner size="sm" color="current" />
              Restoring Profile...
            </>
          ) : (
            <>
              <ShieldCheck size={16} />
              Reactivate Account
              <ArrowRight size={14} className="ml-1" />
            </>
          )}
        </Button>

        <button
          type="button"
          onClick={() => router.replace("/login")}
          className="mt-6 text-xs text-muted font-bold font-outfit uppercase tracking-wider hover:text-foreground cursor-pointer select-none transition-colors"
        >
          Cancel and return to login
        </button>
      </Card>
    </div>
  );
}

export default function ReactivatePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Spinner size="lg" color="accent" />
        </div>
      }
    >
      <ReactivateContent />
    </Suspense>
  );
}
