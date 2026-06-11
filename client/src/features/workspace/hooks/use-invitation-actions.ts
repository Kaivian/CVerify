"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@heroui/react";
import { membersService } from "../services/members.service";

export const useInvitationActions = () => {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);

  const acceptInvitation = async (invitationId: string, onCompleted?: () => void) => {
    setIsProcessing(true);
    try {
      const { orgSlug } = await membersService.acceptInvitationById(invitationId);
      toast.success("Invitation accepted successfully!");
      if (onCompleted) onCompleted();
      router.push(`/workspace/${orgSlug}`);
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
      toast.success("Invitation accepted successfully!");
      router.push(`/workspace/${orgSlug}`);
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
