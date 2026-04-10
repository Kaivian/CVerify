"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Typography, Chip, Button, Spinner, Separator, toast } from "@heroui/react";
import { Github, Gitlab } from "@thesvg/react";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { Info } from "lucide-react";

interface Provider {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  connected: boolean;
  username?: string;
  email?: string;
}

export const LinkedAccountsList: React.FC = () => {
  const { fetchLinkedProviders, unlinkProvider } = useAuth();
  const [providers, setProviders] = useState<Provider[]>([
    { id: "github", name: "GitHub", icon: Github, connected: false },
    { id: "gitlab", name: "GitLab", icon: Gitlab, connected: false },
  ]);
  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const loadProviders = useCallback(async () => {
    try {
      await Promise.resolve(); // Defer state update to avoid set-state-in-effect
      const response = await fetchLinkedProviders();
      if (response.success && response.data) {
        const data = response.data;
        setProviders([
          {
            id: "github",
            name: "GitHub",
            icon: Github,
            connected: data.find(p => p.providerName === "github")?.connected || false,
            username: data.find(p => p.providerName === "github")?.providerUsername || undefined,
            email: data.find(p => p.providerName === "github")?.providerEmail || undefined,
          },
          {
            id: "gitlab",
            name: "GitLab",
            icon: Gitlab,
            connected: data.find(p => p.providerName === "gitlab")?.connected || false,
            username: data.find(p => p.providerName === "gitlab")?.providerUsername || undefined,
            email: data.find(p => p.providerName === "gitlab")?.providerEmail || undefined,
          },
        ]);
      }
    } catch (err) {
      console.error("Failed to load providers:", err);
    } finally {
      setLoading(false);
    }
  }, [fetchLinkedProviders]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadProviders();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadProviders]);

  // Check query parameters for OAuth link success/error on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const linkSuccess = params.get("link_success") === "true";
      const error = params.get("error");
      const provider = params.get("provider");

      if (linkSuccess && provider) {
        const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);
        toast.success(`Successfully linked ${providerName} account.`, {
          description: `Your ${providerName} credentials have been securely connected.`,
        });
        
        // Clean URL parameters safely, retaining tab=account
        const newUrl = window.location.pathname + "?tab=account";
        window.history.replaceState({}, document.title, newUrl);
      } else if (error) {
        toast.danger(`Failed to link account.`, {
          description: decodeURIComponent(error),
        });
        
        // Clean URL parameters safely, retaining tab=account
        const newUrl = window.location.pathname + "?tab=account";
        window.history.replaceState({}, document.title, newUrl);
      }
    }
  }, []);

  const handleDisconnect = async (id: string) => {
    setLoadingId(id);
    try {
      const response = await unlinkProvider(id);
      if (response.success) {
        toast.success(`${id === "github" ? "GitHub" : "GitLab"} successfully disconnected.`);
        await loadProviders();
      } else {
        toast.danger(response.error?.message || `Failed to disconnect ${id}.`);
      }
    } catch (err) {
      console.error(err);
      toast.danger("An error occurred while unlinking provider.");
    } finally {
      setLoadingId(null);
    }
  };

  const handleConnect = async (id: string) => {
    setLoadingId(id);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5247/api';
      window.location.assign(`${API_URL}/auth/connect/${id}`);
    } catch (err) {
      console.error(err);
      toast.danger(`Failed to initiate ${id} connection.`);
      setLoadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6 w-full">
        <Spinner size="md" color="accent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Privacy Notice Disclosure */}
      <div className="flex gap-3 p-4 bg-surface-secondary border border-border/40 rounded-2xl items-start text-left">
        <Info className="size-5 text-accent shrink-0 mt-0.5" />
        <div className="flex flex-col gap-1">
          <Typography className="font-semibold text-xs text-foreground">
            OAuth Permission Transparency
          </Typography>
          <Typography type="body-xs" className="text-muted leading-relaxed">
            Linking GitHub or GitLab grants CVerify secure, read access to your public and private repositories,
            collaborative team history, and metadata. This access is required for repository indexing,
            contribution history analysis, and proof-of-work verifications. Credentials are securely encrypted at rest.
          </Typography>
        </div>
      </div>

      <Separator />

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
                      {provider.username} {provider.email ? `(${provider.email})` : ""}
                    </Typography>
                  ) : (
                    <Typography type="body-xs" className="text-muted">
                      Not linked to {provider.name}
                    </Typography>
                  )}
                </div>
              </div>

              <div className="flex items-center shrink-0">
                {provider.connected ? (
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
