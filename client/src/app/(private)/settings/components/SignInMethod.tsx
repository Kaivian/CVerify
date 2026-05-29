"use client";

import React, { useState } from "react";
import { Typography, Chip, Button, Spinner, Separator, toast } from "@heroui/react";
import { Mail, Key } from "lucide-react";
import { Google } from "@thesvg/react";

interface SignInMethodProps {
  onChangePassword: () => void;
  userEmail?: string;
}

export const SignInMethod: React.FC<SignInMethodProps> = ({
  onChangePassword,
  userEmail = "developer@cverify.com",
}) => {
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);

  const handleManageEmail = async () => {
    setEmailLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 600));
    toast.success("Email configuration settings have been updated.", {
      description: `Primary verified email address: ${userEmail}`,
    });
    setEmailLoading(false);
  };

  const handleGoogleToggle = async () => {
    setGoogleLoading(true);
    // Simulate API delay for oauth connection/disconnection
    await new Promise((resolve) => setTimeout(resolve, 800));
    
    if (googleConnected) {
      setGoogleConnected(false);
    } else {
      setGoogleConnected(true);
    }
    setGoogleLoading(false);
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
                <Typography.Heading level={6}>
                  Email
                </Typography.Heading>
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
                <Typography.Heading level={6}>
                  Password
                </Typography.Heading>
                <Chip
                  color="success"
                  variant="soft"
                  className="h-4 px-1 text-[9px] font-bold uppercase tracking-wider font-outfit"
                >
                  Configured
                </Chip>
              </div>
              <Typography type="body-xs" className="text-muted">
                Configured
              </Typography>
            </div>
          </div>

          <div className="flex items-center shrink-0">
            <Button
              variant="outline"
              onClick={onChangePassword}
              className="rounded-xl"
            >
              Change password
            </Button>
          </div>
        </div>
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
                <Typography.Heading level={6}>
                  Google
                </Typography.Heading>
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
                {googleConnected ? `Connected as ${userEmail}` : "Sign in with your Google account"}
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
