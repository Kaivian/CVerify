"use client";

import React, { useState } from "react";
import { Typography, Chip } from "@heroui/react";
import { Button } from "@/components/ui/button";

// Custom inline brand SVGs for high reliability and zero typescript warnings
const GitHubIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="size-4.5" {...props}>
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
  </svg>
);

const GitLabIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="size-4.5" {...props}>
    <path d="m23.904 13.569-1.262-3.881a.508.508 0 0 0-.166-.234.52.52 0 0 0-.276-.08.52.52 0 0 0-.276.08.508.508 0 0 0-.166.234l-1.262 3.881H3.344l-1.262-3.881a.512.512 0 0 0-.441-.314.512.512 0 0 0-.442.314L.096 13.569a.972.972 0 0 0 .092.834.986.986 0 0 0 .26.27l11.144 8.096a.823.823 0 0 0 .408.131.83.83 0 0 0 .408-.131l11.144-8.096a.986.986 0 0 0 .26-.27.972.972 0 0 0 .092-.834z"/>
  </svg>
);

const GoogleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="size-4.5" {...props}>
    <path d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-6.887 4.114-4.834 0-8.775-3.941-8.775-8.775s3.941-8.775 8.775-8.775c2.316 0 4.398.831 6.002 2.436l3.158-3.158C18.665.986 15.65 0 12.24 0 5.48 0 0 5.48 0 12.24s5.48 12.24 12.24 12.24c6.76 0 11.76-4.76 11.76-11.76 0-.796-.076-1.564-.22-2.316l-11.54.001z"/>
  </svg>
);

const DiscordIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="size-4.5" {...props}>
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.094 13.094 0 0 1-1.873-.894.077.077 0 0 1-.008-.128c.126-.093.252-.19.372-.287a.075.075 0 0 1 .077-.011c3.92 1.793 8.18 1.793 12.061 0a.073.073 0 0 1 .078.009c.12.099.246.195.373.289a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 1-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.156 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.156 2.418z"/>
  </svg>
);

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
      icon: GitHubIcon,
      connected: true,
      username: "cverify-developer",
      email: "developer@cverify.com",
    },
    {
      id: "google",
      name: "Google",
      icon: GoogleIcon,
      connected: true,
      username: "LucFr Developer",
      email: "LucFr.dev@gmail.com",
    },
    {
      id: "gitlab",
      name: "GitLab",
      icon: GitLabIcon,
      connected: false,
    },
    {
      id: "discord",
      name: "Discord",
      icon: DiscordIcon,
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
          return { ...p, connected: false, username: undefined, email: undefined };
        }
        return p;
      })
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
      })
    );
    setLoadingId(null);
  };

  return (
    <div className="flex flex-col gap-3 w-full text-left">
      <div className="divide-y divide-separator/60 border border-separator/85 rounded-xl bg-field-background/50 overflow-hidden">
        {providers.map((provider) => {
          const IconComponent = provider.icon;
          const isLoading = loadingId === provider.id;

          return (
            <div
              key={provider.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 hover:bg-surface-secondary/20 transition-all"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-surface-secondary flex items-center justify-center border border-separator/40 shrink-0 text-muted">
                  <IconComponent className="shrink-0" />
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <Typography
                      type="body-sm"
                      className="font-bold text-foreground font-outfit"
                    >
                      {provider.name}
                    </Typography>
                    {provider.connected ? (
                      <Chip
                        size="sm"
                        color="success"
                        variant="soft"
                        className="h-4.5 px-1.5 text-[9px] font-bold uppercase tracking-wider font-outfit"
                      >
                        Connected
                      </Chip>
                    ) : (
                      <Chip
                        size="sm"
                        color="default"
                        variant="soft"
                        className="h-4.5 px-1.5 text-[9px] font-bold uppercase tracking-wider font-outfit"
                      >
                        Disconnected
                      </Chip>
                    )}
                  </div>
                  {provider.connected ? (
                    <Typography
                      type="body-xs"
                      className="text-muted truncate text-[11px] font-sans mt-0.5"
                    >
                      {provider.username} ({provider.email})
                    </Typography>
                  ) : (
                    <Typography
                      type="body-xs"
                      className="text-muted text-[11px] font-medium font-sans mt-0.5"
                    >
                      Not linked to {provider.name}
                    </Typography>
                  )}
                </div>
              </div>

              <div className="flex items-center shrink-0">
                {provider.connected ? (
                  <Button
                    variant="outline"
                    isLoading={isLoading}
                    onClick={() => handleDisconnect(provider.id)}
                    className="h-8.5 rounded-lg border-separator font-bold text-xs hover:border-danger hover:bg-danger-soft text-foreground hover:text-danger select-none shrink-0"
                  >
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    isLoading={isLoading}
                    onClick={() => handleConnect(provider.id)}
                    className="h-8.5 rounded-lg font-bold text-xs select-none hover:opacity-90 active:scale-[0.98] shrink-0"
                  >
                    Link Account
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LinkedAccountsList;
