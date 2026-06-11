"use client";

import React, { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Spinner, Typography } from "@heroui/react";
import { useInvitationActions } from "@/features/workspace/hooks/use-invitation-actions";

export default function AcceptInvitationPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const { acceptInvitationByToken, isProcessing } = useInvitationActions();
  const calledRef = useRef(false);

  useEffect(() => {
    if (token && !calledRef.current) {
      calledRef.current = true;
      acceptInvitationByToken(token);
    }
  }, [token, acceptInvitationByToken]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center font-outfit select-none text-foreground p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <Spinner size="lg" color="accent" />
        <div className="space-y-2">
          <Typography className="font-bold text-foreground font-outfit text-lg">
            Processing Invitation
          </Typography>
          <Typography className="text-xs text-muted leading-relaxed">
            Please wait while we verify and configure your membership status.
          </Typography>
        </div>
      </div>
    </div>
  );
}
