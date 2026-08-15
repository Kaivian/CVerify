"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@heroui/react";
import { membersService } from "../services/members.service";
import { useWorkspaceStore } from "../store/use-workspace-store";
import { useAuthStore } from "@/features/auth/store/use-auth-store";
import { authApi } from "@/features/auth/services/auth.service";
import { normalizeRole } from "@/lib/utils/auth-utils";
import { type User } from "@/types/auth.types";

export const useInvitationActions = () => {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);

  const rehydrateAfterInvitationAcceptance = async (orgSlug: string) => {
    try {
      const workspaceStore = useWorkspaceStore.getState();
      workspaceStore.invalidateCache(orgSlug);
      const [meResponse] = await Promise.all([
        authApi.fetchMe().catch(() => null),
        workspaceStore.fetchMyOrganizations(),
        workspaceStore.fetchWorkspace(orgSlug),
      ]);

      if (meResponse && meResponse.id) {
        const user: User = {
          id: meResponse.id,
          email: meResponse.email,
          username: meResponse.username,
          fullName: meResponse.fullName,
          avatarUrl: meResponse.avatarUrl,
          role: normalizeRole(meResponse.roles),
          permissions: meResponse.permissions,
          isEmailVerified: meResponse.isEmailVerified,
          passwordChangedAt: meResponse.passwordChangedAt,
          hasPassword: meResponse.hasPassword,
        };
        useAuthStore.getState().login(user);
      }
    } catch (err) {
      console.warn("[Invitation System] Rehydration background task warning:", err);
    }
  };

  const acceptInvitation = async (invitationId: string, onCompleted?: () => void) => {
    setIsProcessing(true);
    try {
      const { orgSlug } = await membersService.acceptInvitationById(invitationId);
      await rehydrateAfterInvitationAcceptance(orgSlug);
      toast.success("Invitation accepted successfully!");
      if (onCompleted) onCompleted();
      router.push(`/business/${orgSlug}/information`);
    } catch (err: any) {
      console.error(err);
      toast.danger(err?.response?.data?.message || "Failed to accept invitation.");
    } finally {
      setIsProcessing(false);
    }
  };

  const declineInvitation = async (invitationId: string, onCompleted?: () => void) => {
    setIsProcessing(true);
    try {
      await membersService.declineInvitationById(invitationId);
      toast.success("Invitation declined.");
      if (onCompleted) onCompleted();
    } catch (err: any) {
      console.error(err);
      toast.danger(err?.response?.data?.message || "Failed to decline invitation.");
    } finally {
      setIsProcessing(false);
    }
  };

  const acceptInvitationByToken = async (token: string) => {
    setIsProcessing(true);
    try {
      const { orgSlug } = await membersService.acceptInvitation(token);
      await rehydrateAfterInvitationAcceptance(orgSlug);
      toast.success("Invitation accepted successfully!");
      router.push(`/business/${orgSlug}/information`);
    } catch (err: any) {
      console.error(err);
      toast.danger(err?.response?.data?.message || "Failed to accept invitation.");
      router.push("/user");
    } finally {
      setIsProcessing(false);
    }
  };

  const declineInvitationByToken = async (token: string) => {
    setIsProcessing(true);
    try {
      await membersService.declineInvitation(token);
      toast.success("Invitation declined.");
      router.push("/user");
    } catch (err: any) {
      console.error(err);
      toast.danger(err?.response?.data?.message || "Failed to decline invitation.");
      router.push("/user");
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    acceptInvitation,
    declineInvitation,
    acceptInvitationByToken,
    declineInvitationByToken,
    isProcessing,
  };
};

