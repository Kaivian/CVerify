"use client";

import React from "react";
import { Card, Typography, Button } from "@heroui/react";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";

interface RecoveryEmailBlockedStateProps {
  onUseAnotherEmail: () => void;
  onBack: () => void;
}

export function RecoveryEmailBlockedState({
  onUseAnotherEmail,
  onBack,
}: RecoveryEmailBlockedStateProps) {
  return (
    <Card className="w-full relative overflow-hidden flex flex-col p-6">
      {/* Sleek Top Danger Indicator Glow */}
      <div className="absolute top-0 left-0 w-full h-1 bg-danger" />

      <div className="flex flex-col items-center text-center">
        <div className="w-12 h-12 bg-danger-soft flex items-center justify-center rounded-xl mb-6">
          <AlertTriangle className="size-6 text-danger" />
        </div>

        <div className="text-center w-full mb-6 flex flex-col items-center gap-2 px-18">
          <Typography.Heading
            level={3}
            className="text-2xl font-bold text-foreground"
          >
            Recovery Email Blocked
          </Typography.Heading>
          <Typography className="text-xs text-muted text-center leading-relaxed">
            This email cannot be used for account recovery. For security
            reasons, CVerify prohibits the reuse of recovery emails associated
            with previous workspace owners.
          </Typography>
        </div>

        {/* Secure Guidance Box */}
        <div className="w-full space-y-3 p-6 rounded-xl bg-danger-soft/25 text-left">
          <Typography className="text-xs font-bold text-foreground-soft select-none mb-1">
            Secure Recovery Guidelines:
          </Typography>

          <ul className="space-y-3 text-xs text-muted leading-relaxed list-disc pl-4">
            <li>
              Please provide a **different, active corporate domain email
              address** that you currently control.
            </li>
            <li>
              The recovery email must be unique and directly associated with the
              new representative.
            </li>
            <li>
              Workspace configurations, historical evidence logs, and
              dual-review procedures remain strictly active.
            </li>
          </ul>
        </div>

        {/* Premium CTA Actions Hierarchy */}
        <div className="w-full mt-6 flex gap-4">
          <Button variant="outline" className="rounded-xl" onPress={onBack}>
            <ArrowLeft className="size-4 mr-2" />
            Go Back
          </Button>
          <Button
            fullWidth
            className="rounded-xl"
            onPress={onUseAnotherEmail}
            variant="danger-soft"
          >
            <RefreshCw className="size-4 mr-2" />
            Use Another Email Address
          </Button>
        </div>
      </div>
    </Card>
  );
}
