"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Typography,
  Chip,
  Button,
  Spinner,
  Separator,
  Avatar,
  toast,
  Modal,
  Link,
} from "@heroui/react";
import { Github, Gitlab } from "@thesvg/react";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { ConfirmationModal } from "./ConfirmationModal";
import {
  Info,
  Trash2,
  PlusCircle,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { type LinkedProviderConnection } from "@/types/auth.types";

export const LinkedAccountsList: React.FC = () => {
  const {
    fetchConnections,
    confirmLink,
    unlinkConnection,
    fetchPendingLinkDetails,
    fetchLinkedProviders,
    user,
  } = useAuth();

  const [connections, setConnections] = useState<LinkedProviderConnection[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Manage panels toggle states
  const [isGithubPanelOpen, setIsGithubPanelOpen] = useState(false);
  const [isGitlabPanelOpen, setIsGitlabPanelOpen] = useState(false);

  // Unlink and safety states
  const [googleConnected, setGoogleConnected] = useState(false);
  const [isUnlinkModalOpen, setIsUnlinkModalOpen] = useState(false);
  const [unlinkTarget, setUnlinkTarget] = useState<LinkedProviderConnection | null>(null);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [blockingError, setBlockingError] = useState<string | null>(null);

  // Modal-based pending link confirmation state
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pendingDetails, setPendingDetails] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [loadingPendingDetails, setLoadingPendingDetails] = useState(false);

  // Fetch all connections from the backend
  const loadConnections = useCallback(async () => {
    try {
      const response = await fetchConnections();
      if (response.success && response.data) {
        setConnections(response.data);
      }
    } catch (err) {
      console.error("Failed to load connections:", err);
    } finally {
      setLoading(false);
    }
  }, [fetchConnections]);

  const loadGoogleStatus = useCallback(async () => {
    try {
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
    loadConnections();
    loadGoogleStatus();
  }, [loadConnections, loadGoogleStatus]);

  // Check query parameters for OAuth link success/error on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const pendingLinkId = params.get("link_pending_id");
      const error = params.get("error");
      const linkSuccess = params.get("link_success") === "true";
      const provider = params.get("provider");

      if (pendingLinkId) {
        setPendingId(pendingLinkId);
        setIsModalOpen(true);
        // Clean URL parameters safely, retaining tab=account
        const newUrl = window.location.pathname + "?tab=account";
        window.history.replaceState({}, document.title, newUrl);
      } else if (linkSuccess && provider) {
        const providerName =
          provider.charAt(0).toUpperCase() + provider.slice(1);
        toast.success(`Successfully linked ${providerName} account.`);
        const newUrl = window.location.pathname + "?tab=account";
        window.history.replaceState({}, document.title, newUrl);
        loadConnections();
      } else if (error) {
        toast.danger(`Failed to link account.`, {
          description: decodeURIComponent(error),
        });
        const newUrl = window.location.pathname + "?tab=account";
        window.history.replaceState({}, document.title, newUrl);
      }
    }
  }, [loadConnections]);

  // Fetch pending link details when pendingId changes
  useEffect(() => {
    if (!pendingId) return;
    const fetchDetails = async () => {
      setLoadingPendingDetails(true);
      try {
        const response = await fetchPendingLinkDetails(pendingId);
        if (response.success && response.data) {
          setPendingDetails(response.data);
        } else {
          toast.danger("Failed to load pending connection details.");
          setIsModalOpen(false);
          setPendingId(null);
        }
      } catch (err: any) {
        console.error(err);
        if (err.status === 410 || err.response?.status === 410) {
          toast.danger("This linking request has expired. Please try again.");
        } else {
          toast.danger("Failed to retrieve pending connection details.");
        }
        setIsModalOpen(false);
        setPendingId(null);
      } finally {
        setLoadingPendingDetails(false);
      }
    };
    fetchDetails();
  }, [pendingId, fetchPendingLinkDetails]);

  const handleConnect = async (provider: string) => {
    setActionLoadingId(`${provider}-link`);
    try {
      const API_URL =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:5247/api";
      window.location.assign(`${API_URL}/auth/connect/${provider}`);
    } catch (err) {
      console.error(err);
      toast.danger(`Failed to initiate ${provider} connection.`);
      setActionLoadingId(null);
    }
  };

  const handleDisconnectClick = (conn: LinkedProviderConnection) => {
    setUnlinkTarget(conn);
    
    // Lockout Prevention Validation
    const hasPassword = !!user?.passwordChangedAt;
    const hasGoogle = googleConnected;
    const otherGitHubCount = connections.filter(
      (c) => c.providerName === "github" && c.connected && c.id !== conn.id
    ).length;
    const otherGitLabCount = connections.filter(
      (c) => c.providerName === "gitlab" && c.connected && c.id !== conn.id
    ).length;

    const totalOtherMethods =
      (hasPassword ? 1 : 0) +
      (hasGoogle ? 1 : 0) +
      (otherGitHubCount > 0 ? 1 : 0) +
      (otherGitLabCount > 0 ? 1 : 0);

    if (totalOtherMethods === 0) {
      setBlockingError(
        "Action Blocked: You must set a login password or connect another authentication provider (Google, GitHub, or GitLab) before disconnecting this provider to prevent locking yourself out of your account."
      );
    } else {
      setBlockingError(null);
    }

    setIsUnlinkModalOpen(true);
  };

  const handleConfirmUnlink = async () => {
    if (!unlinkTarget) return;
    setIsUnlinking(true);
    try {
      const response = await unlinkConnection(unlinkTarget.id);
      if (response.success) {
        toast.success("Account successfully disconnected.");
        // Security Audit Logging (Observability)
        console.log(`[Security Audit Log] Connected OAuth connection ${unlinkTarget.providerName} (@${unlinkTarget.providerUsername}) successfully unlinked for User ID ${user?.id}.`);
        setIsUnlinkModalOpen(false);
        setUnlinkTarget(null);
        await loadConnections();
      } else {
        toast.danger(response.data?.message || "Failed to disconnect account.");
      }
    } catch (err: any) {
      console.error(err);
      toast.danger("An error occurred while unlinking account.");
    } finally {
      setIsUnlinking(false);
    }
  };

  const handleConfirmLink = async () => {
    if (!pendingId) return;
    setConfirming(true);
    try {
      const response = await confirmLink(pendingId);
      if (response.success) {
        toast.success("Account successfully connected!");
        setIsModalOpen(false);
        setPendingId(null);
        setPendingDetails(null);
        await loadConnections();
      } else {
        toast.danger(response.data?.message || "Failed to confirm connection.");
      }
    } catch (err: any) {
      console.error(err);
      toast.danger(
        err.response?.data?.message ||
          "An error occurred while confirming the connection.",
      );
    } finally {
      setConfirming(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 w-full">
        <Spinner size="md" color="accent" />
      </div>
    );
  }

  // Filter connections by provider type
  const githubConnections = connections.filter(
    (c) => c.providerName === "github" && c.connected,
  );
  const gitlabConnections = connections.filter(
    (c) => c.providerName === "gitlab" && c.connected,
  );

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
            Linking GitHub or GitLab grants CVerify secure, read access to your
            public and private repositories, collaborative team history, and
            metadata. This access is required for repository indexing,
            contribution history analysis, and proof-of-work verifications.
            Credentials are securely encrypted at rest.
          </Typography>
        </div>
      </div>

      <Separator className="bg-border/30" />

      {/* GitHub Row */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 flex items-center justify-center">
              <Github className="size-6 text-foreground/80" />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 justify-start">
                <Typography.Heading level={6}>
                  GitHub Integration
                </Typography.Heading>
                {githubConnections.length > 0 ? (
                  <Chip
                    color="success"
                    variant="soft"
                    className="h-4 px-1 text-[9px] font-bold uppercase tracking-wider font-outfit"
                  >
                    {githubConnections.length} Connected
                  </Chip>
                ) : (
                  <Chip
                    color="default"
                    variant="soft"
                    className="h-4 px-1 text-[9px] font-bold uppercase tracking-wider font-outfit"
                  >
                    Unlinked
                  </Chip>
                )}
              </div>
              <Typography type="body-xs" className="text-muted">
                {githubConnections.length > 0
                  ? `${githubConnections.length} linked GitHub account${githubConnections.length !== 1 ? "s" : ""}`
                  : "No GitHub accounts linked"}
              </Typography>
            </div>
          </div>

          <div className="flex items-center shrink-0">
            <Button
              variant="outline"
              onClick={() => setIsGithubPanelOpen((prev) => !prev)}
              className="rounded-xl"
            >
              {isGithubPanelOpen ? "Close" : "Manage"}
            </Button>
          </div>
        </div>

        {isGithubPanelOpen && (
          <div className="flex flex-col gap-4 p-4 bg-background rounded-2xl">
            {githubConnections.length === 0 ? (
              <div className="py-4 text-center flex flex-col items-center gap-3">
                <Typography type="body-xs" className="text-muted">
                  No GitHub accounts linked to your profile yet.
                </Typography>
                <Button
                  isPending={actionLoadingId === "github-link"}
                  onClick={() => handleConnect("github")}
                  className="rounded-xl font-semibold text-xs h-9.5 px-4"
                >
                  Link GitHub Account
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Typography
                    type="body-sm"
                    className="font-bold text-foreground/80 text-left"
                  >
                    {githubConnections.length} linked GitHub account
                    {githubConnections.length !== 1 ? "s" : ""}
                  </Typography>
                  <div className="flex flex-col gap-2">
                    {githubConnections.map((conn) => (
                      <div
                        key={conn.id}
                        className="flex items-center justify-between p-3 bg-foreground/5 rounded-xl border border-foreground/5"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar className="size-9 text-xs border border-border shrink-0">
                            {conn.providerAvatarUrl && (
                              <Avatar.Image
                                src={conn.providerAvatarUrl}
                                alt={
                                  conn.providerDisplayName ||
                                  conn.providerUsername ||
                                  ""
                                }
                              />
                            )}
                            <Avatar.Fallback>
                              {(
                                conn.providerDisplayName ||
                                conn.providerUsername ||
                                "?"
                              )
                                .slice(0, 2)
                                .toUpperCase()}
                            </Avatar.Fallback>
                          </Avatar>
                          <div className="flex flex-col min-w-0 text-left">
                            <span className="font-semibold text-sm truncate text-foreground">
                              {conn.providerDisplayName ||
                                conn.providerUsername}
                            </span>
                            <span className="text-[10px] text-muted truncate">
                              @{conn.providerUsername}{" "}
                              {conn.providerEmail
                                ? `(${conn.providerEmail})`
                                : ""}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {conn.providerProfileUrl && (
                            <a
                              href={conn.providerProfileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 rounded-lg hover:bg-surface text-muted hover:text-foreground transition-colors"
                              title="View Profile"
                              aria-label={`View profile for ${conn.providerUsername}`}
                            >
                              <ExternalLink size={14} />
                            </a>
                          )}
                          <Button
                            size="sm"
                            variant="danger-soft"
                            isPending={isUnlinking && unlinkTarget?.id === conn.id}
                            isDisabled={isUnlinking}
                            onClick={() => handleDisconnectClick(conn)}
                            className="rounded-xl h-8 text-xs font-semibold"
                            aria-label={`Disconnect account @${conn.providerUsername}`}
                          >
                            Disconnect
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator variant="tertiary" />

                <div className="flex items-center justify-between gap-4">
                  {githubConnections.length < 3 ? (
                    <>
                      <Typography
                        type="body-xs"
                        className="text-muted text-[11px]"
                      >
                        You can link up to 3 GitHub accounts (
                        {3 - githubConnections.length} remaining).
                      </Typography>
                      <Button
                        variant="ghost"
                        isPending={actionLoadingId === "github-link"}
                        onClick={() => handleConnect("github")}
                        className="rounded-xl text-xs h-9.5 px-3.5 border-border flex items-center gap-1.5 font-semibold shrink-0"
                      >
                        <PlusCircle size={15} />
                        <span>Link Another GitHub</span>
                      </Button>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 text-warning">
                      <AlertCircle size={14} />
                      <Typography
                        type="body-xs"
                        className="text-warning text-[11px] font-medium"
                      >
                        Maximum limit of 3 linked GitHub accounts reached.
                      </Typography>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <Separator />

      {/* GitLab Row */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 flex items-center justify-center">
              <Gitlab className="size-6 text-foreground/80" />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 justify-start">
                <Typography.Heading level={6}>
                  GitLab Integration
                </Typography.Heading>
                {gitlabConnections.length > 0 ? (
                  <Chip
                    color="success"
                    variant="soft"
                    className="h-4 px-1 text-[9px] font-bold uppercase tracking-wider font-outfit"
                  >
                    {gitlabConnections.length} Connected
                  </Chip>
                ) : (
                  <Chip
                    color="default"
                    variant="soft"
                    className="h-4 px-1 text-[9px] font-bold uppercase tracking-wider font-outfit"
                  >
                    Unlinked
                  </Chip>
                )}
              </div>
              <Typography type="body-xs" className="text-muted">
                {gitlabConnections.length > 0
                  ? `${gitlabConnections.length} linked GitLab account${gitlabConnections.length !== 1 ? "s" : ""}`
                  : "No GitLab accounts linked"}
              </Typography>
            </div>
          </div>

          <div className="flex items-center shrink-0">
            <Button
              variant="outline"
              onClick={() => setIsGitlabPanelOpen((prev) => !prev)}
              className="rounded-xl"
            >
              {isGitlabPanelOpen ? "Close" : "Manage"}
            </Button>
          </div>
        </div>

        {isGitlabPanelOpen && (
          <div className="flex flex-col gap-4 p-4 bg-background rounded-2xl">
            {gitlabConnections.length === 0 ? (
              <div className="py-4 text-center flex flex-col items-center gap-3">
                <Typography type="body-xs" className="text-muted">
                  No GitLab accounts linked to your profile yet.
                </Typography>
                <Button
                  isPending={actionLoadingId === "gitlab-link"}
                  onClick={() => handleConnect("gitlab")}
                  className="rounded-xl font-semibold text-xs h-9.5 px-4"
                >
                  Link GitLab Account
                </Button>

                {/* GitLab Specific Session Switching Alert */}
                <div className="flex gap-2.5 p-3.5 bg-surface-secondary border border-border/40 rounded-xl max-w-lg mt-2 items-start text-left">
                  <Info className="size-4.5 text-accent shrink-0 mt-0.5" />
                  <Typography
                    type="body-xs"
                    className="text-muted text-[10.5px] leading-relaxed"
                  >
                    <strong>Session switching tip:</strong> GitLab OAuth flow
                    caches active GitLab browser sessions. If you want to
                    connect a different GitLab account, please sign out of
                    gitlab.com in another tab before clicking link.
                  </Typography>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Typography
                    type="body-sm"
                    className="font-bold text-foreground/80 text-left"
                  >
                    {gitlabConnections.length} linked GitLab account
                    {gitlabConnections.length !== 1 ? "s" : ""}
                  </Typography>
                  <div className="flex flex-col gap-2">
                    {gitlabConnections.map((conn) => (
                      <div
                        key={conn.id}
                        className="flex items-center justify-between p-3 bg-foreground/5 rounded-xl border border-foreground/5"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar className="size-9 text-xs border border-border shrink-0">
                            {conn.providerAvatarUrl && (
                              <Avatar.Image
                                src={conn.providerAvatarUrl}
                                alt={
                                  conn.providerDisplayName ||
                                  conn.providerUsername ||
                                  ""
                                }
                              />
                            )}
                            <Avatar.Fallback>
                              {(
                                conn.providerDisplayName ||
                                conn.providerUsername ||
                                "?"
                              )
                                .slice(0, 2)
                                .toUpperCase()}
                            </Avatar.Fallback>
                          </Avatar>
                          <div className="flex flex-col min-w-0 text-left">
                            <span className="font-semibold text-sm truncate text-foreground">
                              {conn.providerDisplayName ||
                                conn.providerUsername}
                            </span>
                            <span className="text-[10px] text-muted truncate">
                              @{conn.providerUsername}{" "}
                              {conn.providerEmail
                                ? `(${conn.providerEmail})`
                                : ""}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {conn.providerProfileUrl && (
                            <a
                              href={conn.providerProfileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 rounded-lg hover:bg-surface text-muted hover:text-foreground transition-colors"
                              title="View Profile"
                              aria-label={`View profile for ${conn.providerUsername}`}
                            >
                              <ExternalLink size={14} />
                            </a>
                          )}
                          <Button
                            size="sm"
                            variant="danger-soft"
                            isPending={isUnlinking && unlinkTarget?.id === conn.id}
                            isDisabled={isUnlinking}
                            onClick={() => handleDisconnectClick(conn)}
                            className="rounded-xl h-8 text-xs font-semibold"
                            aria-label={`Disconnect account @${conn.providerUsername}`}
                          >
                            Disconnect
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator variant="tertiary" />

                {/* GitLab Specific Session Switching Alert */}
                <div className="flex gap-2.5 p-3.5 bg-surface-secondary border border-border/40 rounded-xl items-start text-left">
                  <Info className="size-4.5 text-accent shrink-0 mt-0.5" />
                  <Typography
                    type="body-xs"
                    className="text-muted text-[10.5px] leading-relaxed"
                  >
                    <strong>Session switching tip:</strong> GitLab OAuth flow
                    caches active GitLab browser sessions. If you want to
                    connect a different GitLab account, please sign out of
                    gitlab.com in another tab before clicking link.
                  </Typography>
                </div>

                <div className="flex items-center justify-between gap-4">
                  {gitlabConnections.length < 3 ? (
                    <>
                      <Typography
                        type="body-xs"
                        className="text-muted text-[11px]"
                      >
                        You can link up to 3 GitLab accounts (
                        {3 - gitlabConnections.length} remaining).
                      </Typography>
                      <Button
                        variant="ghost"
                        isPending={actionLoadingId === "gitlab-link"}
                        onClick={() => handleConnect("gitlab")}
                        className="rounded-xl text-xs h-9.5 px-3.5 border-border flex items-center gap-1.5 font-semibold shrink-0"
                      >
                        <PlusCircle size={15} />
                        <span>Link Another GitLab</span>
                      </Button>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 text-warning">
                      <AlertCircle size={14} />
                      <Typography
                        type="body-xs"
                        className="text-warning text-[11px] font-medium"
                      >
                        Maximum limit of 3 linked GitLab accounts reached.
                      </Typography>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      <Modal.Backdrop
        isOpen={isModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsModalOpen(false);
            setPendingId(null);
            setPendingDetails(null);
          }
        }}
        isDismissable={false}
        className="bg-background/80 backdrop-blur-sm animate-in fade-in duration-200"
      >
        <Modal.Container size="sm">
          <Modal.Dialog className="w-full max-w-md bg-overlay border border-border rounded-2xl shadow-modal p-6 text-left relative focus-visible:outline-hidden focus:outline-hidden">
            <Modal.Header className="mb-4">
              <div className="flex items-center gap-2">
                {pendingDetails?.providerName === "gitlab" ? (
                  <Gitlab className="size-6 text-[#FC6D26]" />
                ) : (
                  <Github className="size-6 text-foreground" />
                )}
                <span className="font-extrabold text-foreground text-xl">
                  Confirm Account Connection
                </span>
              </div>
            </Modal.Header>
            <Modal.Body className="space-y-4 py-2 text-sm leading-relaxed text-muted">
              {loadingPendingDetails ? (
                <div className="flex flex-col items-center justify-center py-6 gap-2">
                  <Spinner size="md" color="accent" />
                  <Typography type="body-xs" className="text-muted">
                    Retrieving profile details...
                  </Typography>
                </div>
              ) : pendingDetails ? (
                <div className="flex flex-col gap-4">
                  <Typography
                    type="body-xs"
                    className="text-muted leading-relaxed font-sans text-left"
                  >
                    Please verify the identity details of the external account
                    you are connecting to your CVerify profile:
                  </Typography>

                  {/* Account Profile Card */}
                  <div className="flex items-center gap-3.5 p-4 rounded-xl border border-border/60 bg-surface-secondary select-none text-left">
                    <Avatar className="size-12 border border-border shrink-0">
                      {pendingDetails.providerAvatarUrl && (
                        <Avatar.Image
                          src={pendingDetails.providerAvatarUrl}
                          alt={
                            pendingDetails.providerDisplayName ||
                            pendingDetails.providerUsername ||
                            ""
                          }
                        />
                      )}
                      <Avatar.Fallback>
                        {(
                          pendingDetails.providerDisplayName ||
                          pendingDetails.providerUsername ||
                          "?"
                        )
                          .slice(0, 2)
                          .toUpperCase()}
                      </Avatar.Fallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0">
                      <Typography className="font-bold text-sm text-foreground truncate leading-snug">
                        {pendingDetails.providerDisplayName ||
                          pendingDetails.providerUsername}
                      </Typography>
                      <Typography
                        type="body-xs"
                        className="text-muted truncate mt-0.5"
                      >
                        @{pendingDetails.providerUsername}{" "}
                        {pendingDetails.providerEmail
                          ? `(${pendingDetails.providerEmail})`
                          : ""}
                      </Typography>
                    </div>
                  </div>

                  <div className="flex gap-2.5 p-3.5 text-accent bg-accent-soft/10 rounded-xl border border-accent/15 items-start text-left">
                    <Info size={16} className="shrink-0 mt-0.5 text-accent" />
                    <Typography
                      type="body-xs"
                      className="leading-relaxed font-medium"
                    >
                      This action will connect this account to your profile,
                      enabling repository indexing and trust verification. You
                      can disconnect it anytime.
                    </Typography>
                  </div>
                </div>
              ) : (
                <div className="py-4 text-center">
                  <Typography
                    type="body-xs"
                    className="text-danger font-semibold"
                  >
                    Failed to load connection details or request expired.
                  </Typography>
                </div>
              )}
            </Modal.Body>
            <Modal.Footer className="flex justify-end gap-3 pt-4 mt-4 border-t border-separator">
              <Button
                variant="outline"
                onClick={() => {
                  setIsModalOpen(false);
                  setPendingId(null);
                  setPendingDetails(null);
                }}
                className="rounded-xl text-xs h-9.5 px-4 font-semibold text-muted hover:text-foreground"
                isDisabled={confirming}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmLink}
                isPending={confirming}
                isDisabled={!pendingDetails || loadingPendingDetails}
                className="rounded-xl font-bold text-xs h-9.5 px-4"
              >
                Confirm Connection
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      {/* Reusable Provider Disconnect Modal */}
      <ConfirmationModal
        isOpen={isUnlinkModalOpen}
        onOpenChange={setIsUnlinkModalOpen}
        title={`Disconnect ${unlinkTarget?.providerName === "github" ? "GitHub" : "GitLab"} Account`}
        variant="danger"
        confirmText="Disconnect Account"
        isPending={isUnlinking}
        blockingError={blockingError}
        onConfirm={handleConfirmUnlink}
        description={
          <div className="flex flex-col gap-2 text-left">
            <Typography type="body-xs" className="leading-relaxed">
              Are you sure you want to disconnect your {unlinkTarget?.providerName === "github" ? "GitHub" : "GitLab"} integration for{" "}
              <strong>@{unlinkTarget?.providerUsername}</strong>?
            </Typography>
            <Typography type="body-xs" className="leading-relaxed text-muted mt-1">
              This will remove repository indexing, active pull request trails, code trust verifications, and disable single sign-on via this account.
            </Typography>
          </div>
        }
      />
    </div>
  );
};

export default LinkedAccountsList;
