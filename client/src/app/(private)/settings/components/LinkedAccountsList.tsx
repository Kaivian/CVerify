"use client";

import React, { useState } from "react";
import { Typography, Chip, Button, Spinner, Separator } from "@heroui/react";
import { Github, Gitlab } from "@thesvg/react";

interface Provider {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  connected: boolean;
  username?: string;
  email?: string;
}

export const LinkedAccountsList: React.FC = () => {
  // Local state for third-party OAuth providers
  const [providers, setProviders] = useState<Provider[]>([
    {
      id: "github",
      name: "GitHub",
      icon: Github,
      connected: true,
      username: "cverify-developer",
      email: "developer@cverify.com",
    },
    {
      id: "gitlab",
      name: "GitLab",
      icon: Gitlab,
      connected: false,
    },
  ]);

  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleDisconnect = async (id: string) => {
    setLoadingId(id);
    // Simulate API delay for disconnect request
    await new Promise((resolve) => setTimeout(resolve, 800));

    setProviders((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          return {
            ...p,
            connected: false,
            username: undefined,
            email: undefined,
          };
        }
        return p;
      }),
    );
    setLoadingId(null);
  };

  const handleConnect = async (id: string) => {
    setLoadingId(id);
    // Simulate OAuth redirection trigger
    await new Promise((resolve) => setTimeout(resolve, 800));

    setProviders((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          return {
            ...p,
            connected: true,
            username: `mock_${p.id}_user`,
            email: `mock.${p.id}@cverify.com`,
          };
        }
        return p;
      }),
    );
    setLoadingId(null);
  };

  return (
    <div className="flex flex-col gap-6">
      {providers.map((provider, index) => {
        const IconComponent = provider.icon;
        const isLoading = loadingId === provider.id;
        const isLast = index === providers.length - 1;
        return (
          <div key={provider.id} className="flex flex-col gap-6">
            <div className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10">
                  <IconComponent />
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2 justify-start">
                    <Typography.Heading level={6}>
                      {provider.name}
                    </Typography.Heading>
                    {provider.connected ? (
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
                  {provider.connected ? (
                    <Typography type="body-xs" className="text-muted">
                      {provider.username} ({provider.email})
                    </Typography>
                  ) : (
                    <Typography type="body-xs" className="text-muted">
                      Not linked to {provider.name}
                    </Typography>
                  )}
                </div>
              </div>

              <div className="flex items-center shrink-0">
                {provider.id === "google" ? null : provider.connected ? (
                  <Button
                    variant="outline"
                    isPending={isLoading}
                    onClick={() => handleDisconnect(provider.id)}
                    className="rounded-xl"
                  >
                    {({ isPending }) => (
                      <>
                        {isPending ? (
                          <>
                            <Spinner color="current" size="sm" />
                            Disconnecting...
                          </>
                        ) : (
                          "Disconnect"
                        )}
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    isPending={isLoading}
                    onClick={() => handleConnect(provider.id)}
                    className="rounded-xl"
                  >
                    {({ isPending }) => (
                      <>
                        {isPending ? (
                          <>
                            <Spinner color="current" size="sm" />
                            Linking...
                          </>
                        ) : (
                          "Link Account"
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
  );
};

export default LinkedAccountsList;
