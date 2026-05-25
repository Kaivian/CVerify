"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../../../../features/auth/hooks/use-auth";
import { recoveryApi, VerifyBootstrapResponseData } from "../../../../features/auth/services/recovery.service";
import {
  Card,
  Typography,
  Button,
  TextField,
  Input,
  InputGroup,
  Form,
  Label,
  FieldError,
  toast,
  Spinner,
} from "@heroui/react";
import {
  Check,
  Eye,
  EyeOff,
  AlertTriangle,
  RefreshCw,
  Settings2,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";

// Normalized Suggested Slugs Generator based on Vietnamese accents removal
const generateSuggestedSlug = (name: string): string => {
  let slug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Strip accents
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s-]/g, "") // Strip punctuation
    .trim()
    .replace(/\s+/g, "-") // Replace space with dash
    .replace(/-+/g, "-"); // Deduplicate dashes

  if (slug.length < 4) {
    slug = slug.padEnd(4, "0");
  }
  return slug.substring(0, 32);
};

interface AxiosErrorLike {
  response?: {
    data?: {
      message?: string;
    };
  };
}

export default function RecoveryBootstrapPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { initializeSession } = useAuth();
  
  const token = searchParams.get("token") || "";

  // Wizard States: 'verifying' | 'verify_failed' | 'setup_credentials' | 'select_strategy' | 'executing' | 'success'
  const [stage, setStage] = useState<"verifying" | "verify_failed" | "setup_credentials" | "select_strategy" | "executing" | "success">("verifying");
  const [bootstrapInfo, setBootstrapInfo] = useState<VerifyBootstrapResponseData | null>(null);
  
  // Credentials stage state
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmVisible, setIsConfirmVisible] = useState(false);
  const [sessionToken, setSessionToken] = useState("");
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);

  // Strategy Execution stage state
  const [strategy, setStrategy] = useState("OptionB"); // Default takeover
  const [displayName, setDisplayName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  const [isLoading, setIsLoading] = useState(false);

  // Verify recovery link token on load
  useEffect(() => {
    if (!token) {
      const timer = setTimeout(() => {
        setStage("verify_failed");
      }, 0);
      return () => clearTimeout(timer);
    }

    const verifyToken = async () => {
      try {
        const data = await recoveryApi.verifyBootstrap(token);
        if (data.isValid) {
          setBootstrapInfo(data);
          setStrategy(data.suggestedStrategy);
          setDisplayName(data.organizationName);
          
          // Generate clean slug using Vietnamese helper
          const normalizedSlug = data.organizationSlug || generateSuggestedSlug(data.organizationName);
          setSlug(normalizedSlug);

          setStage("setup_credentials");
        } else {
          setStage("verify_failed");
        }
      } catch {
        setStage("verify_failed");
      }
    };

    verifyToken();
  }, [token]);

  // Password rules validation
  const isPasswordValid =
    password.length >= 12 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password) &&
    /[@$!%*?&#^()_\-+=\[\]{}|\\:;""'<>,.?/~`]/.test(password);

  const isConfirmValid = password === confirmPassword;

  // Handle Step 1: Credentials Setup
  const handleSetupCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordValid || !isConfirmValid) return;

    setIsLoading(true);
    try {
      const response = await recoveryApi.setupCredentials({
        token,
        newPassword: password,
      });
      setSessionToken(response.sessionToken);
      setIsLoading(false);
      setStage("select_strategy");
      toast.success("Administrator credentials configured!", {
        description: "Please confirm your recovery strategy execution details.",
      });
    } catch (err) {
      setIsLoading(false);
      toast.danger("Failed to configure credentials", {
        description: (err as AxiosErrorLike).response?.data?.message || "Please try again later.",
      });
    }
  };

  // Slug rules validation
  const isSlugValid = /^[a-z0-9-]{4,32}$/.test(slug);

  // Handle Step 2: Strategy Execution
  const handleExecuteRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSlugValid || !displayName.trim()) return;

    setIsLoading(true);
    setStage("executing");
    try {
      await recoveryApi.executeRecovery({
        sessionToken,
        strategy,
        displayName,
        slug,
      });

      // Synchronize session details in Zustand auth store
      await initializeSession();

      setStage("success");
      setIsLoading(false);
      toast.success("Organization successfully reclaimed!", {
        description: `Logged in as ${bootstrapInfo?.approvedRepresentative}`,
      });
      
      // Redirect to Dashboard
      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);
    } catch (err) {
      setIsLoading(false);
      setStage("select_strategy"); // Rollback stage view
      toast.danger("Execution failed", {
        description: (err as AxiosErrorLike).response?.data?.message || "Workspace recovery failed. Please verify credentials or retry.",
      });
    }
  };

  // Verifying token state loader
  if (stage === "verifying") {
    return (
      <Card className="w-full premium-glass max-w-md mx-auto py-12 px-6 flex flex-col items-center justify-center select-none">
        <Spinner size="lg" color="accent" />
        <Typography className="text-sm font-bold text-foreground mt-4">Verifying Recovery Session...</Typography>
        <Typography className="text-xs text-muted mt-1 text-center">Securing link decryption handshake keys.</Typography>
      </Card>
    );
  }

  // Token verify failed fallback view
  if (stage === "verify_failed") {
    return (
      <Card className="w-full premium-glass max-w-md mx-auto py-8 px-6 flex flex-col items-center justify-center border-danger/25">
        <div className="w-12 h-12 bg-danger/10 flex items-center justify-center rounded-xl border border-danger/20 mb-4 select-none animate-pulse">
          <ShieldAlert className="size-6 text-danger" />
        </div>
        <Typography.Heading level={4} className="text-lg font-bold text-foreground text-center">
          Invalid or Expired Link
        </Typography.Heading>
        <Typography className="text-xs text-muted mt-2 text-center max-w-xs leading-normal">
          This bootstrap link has expired (24h validity), been consumed, or revoked by a security admin. Please initiate another recovery.
        </Typography>
        <Button
          className="h-11 rounded-xl bg-accent text-accent-foreground font-bold mt-6 w-full"
          onPress={() => router.push("/login")}
        >
          Return to Login
        </Button>
      </Card>
    );
  }

  // Stage 1: setup new password
  if (stage === "setup_credentials" && bootstrapInfo) {
    return (
      <Card className="w-full max-w-md mx-auto relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-accent" />
        <div className="p-6 space-y-6">
          <div className="text-center">
            <Typography.Heading level={3} className="text-xl font-extrabold text-foreground">
              Configure Administrator Account
            </Typography.Heading>
            <Typography className="text-xs text-muted mt-1.5 leading-normal">
              Setup a fresh secure password for <strong className="text-foreground">{bootstrapInfo.verifiedRecoveryEmail}</strong>.
            </Typography>
          </div>

          <Form className="space-y-4" onSubmit={handleSetupCredentials}>
            <TextField isRequired name="password" isInvalid={passwordTouched && !isPasswordValid}>
              <Label>New Master Password</Label>
              <InputGroup>
                <InputGroup.Input
                  type={isPasswordVisible ? "text" : "password"}
                  placeholder="Enter strong password (min 12 chars)"
                  className="h-11 rounded-xl"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => setPasswordTouched(true)}
                />
                <InputGroup.Suffix>
                  <button type="button" onClick={() => setIsPasswordVisible(!isPasswordVisible)} className="text-muted hover:text-foreground">
                    {isPasswordVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </InputGroup.Suffix>
              </InputGroup>
              <FieldError>Password must be 12+ chars, with upper, lower, number, and special character.</FieldError>
            </TextField>

            <TextField isRequired name="confirmPassword" isInvalid={confirmTouched && !isConfirmValid}>
              <Label>Confirm Password</Label>
              <InputGroup>
                <InputGroup.Input
                  type={isConfirmVisible ? "text" : "password"}
                  placeholder="Verify master password"
                  className="h-11 rounded-xl"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onBlur={() => setConfirmTouched(true)}
                />
                <InputGroup.Suffix>
                  <button type="button" onClick={() => setIsConfirmVisible(!isConfirmVisible)} className="text-muted hover:text-foreground">
                    {isConfirmVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </InputGroup.Suffix>
              </InputGroup>
              <FieldError>Passwords do not match.</FieldError>
            </TextField>

            <Button
              type="submit"
              fullWidth
              className="h-12 rounded-xl bg-accent text-accent-foreground hover:bg-accent-hover font-bold mt-4"
              isDisabled={!isPasswordValid || !isConfirmValid || isLoading}
              isPending={isLoading}
            >
              {isLoading ? <Spinner color="current" size="sm" /> : "Save Credentials"}
              <ChevronRight className="size-4 ml-1" />
            </Button>
          </Form>
        </div>
      </Card>
    );
  }

  // Stage 2: strategy selection and customization
  if (stage === "select_strategy" && bootstrapInfo) {
    return (
      <Card className="w-full max-w-lg mx-auto relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-accent" />
        <div className="p-6 space-y-6">
          <div className="text-center">
            <Typography.Heading level={3} className="text-xl font-extrabold text-foreground">
              Confirm Recovery Strategy
            </Typography.Heading>
            <Typography className="text-xs text-muted mt-1.5 leading-normal">
              Select how CVerify will provision your reclaimed organizational workspace.
            </Typography>
          </div>

          <Form className="space-y-6" onSubmit={handleExecuteRecovery}>
            {/* Strategy Select Selection */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-foreground">Provisioning Strategy</label>
              <div className="grid grid-cols-2 gap-4">
                {/* Option A Card */}
                <div
                  className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${
                    strategy === "OptionA" ? "border-accent bg-accent/5" : "border-border hover:border-border/80"
                  }`}
                  onClick={() => setStrategy("OptionA")}
                >
                  <div className="flex items-center justify-between mb-1 select-none">
                    <span className="text-xs font-bold text-foreground">Option A: Rebuild</span>
                    <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${strategy === "OptionA" ? "border-accent bg-accent" : "border-muted"}`}>
                      {strategy === "OptionA" && <div className="w-1.5 h-1.5 rounded-full bg-accent-foreground" />}
                    </div>
                  </div>
                  <span className="text-[10px] text-muted block leading-relaxed mt-1.5">
                    Deletes current workspace members and settings. Creates a completely fresh workspace binding. Encrypts historical records as a snapshot backup.
                  </span>
                </div>

                {/* Option B Card */}
                <div
                  className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${
                    strategy === "OptionB" ? "border-accent bg-accent/5" : "border-border hover:border-border/80"
                  }`}
                  onClick={() => setStrategy("OptionB")}
                >
                  <div className="flex items-center justify-between mb-1 select-none">
                    <span className="text-xs font-bold text-foreground">Option B: Takeover</span>
                    <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${strategy === "OptionB" ? "border-accent bg-accent" : "border-muted"}`}>
                      {strategy === "OptionB" && <div className="w-1.5 h-1.5 rounded-full bg-accent-foreground" />}
                    </div>
                  </div>
                  <span className="text-[10px] text-muted block leading-relaxed mt-1.5">
                    Swaps legal owner role to you. Retains existing projects, data, and members but revokes all existing API keys, webhooks, and active device sessions.
                  </span>
                </div>
              </div>
            </div>

            {/* Warning Message Card */}
            <div className="p-3.5 rounded-xl bg-warning/10 border border-warning/20 flex items-start gap-2.5 text-[11px] text-warning font-medium leading-normal select-none">
              <AlertTriangle className="size-4 shrink-0 text-warning mt-0.5" />
              <div>
                <span className="font-bold block">Compliance Warning</span>
                {strategy === "OptionA" ? (
                  <span>Executing Option A will terminate access for all existing workspace users. All API integration routes will be immediately broken.</span>
                ) : (
                  <span>Executing Option B will preserve workspace project data, but will force rotate all webhook secrets, database connection keys, and active user logins.</span>
                )}
              </div>
            </div>

            <div className="border-t border-border/80 my-4" />

            {/* Workspace details customization */}
            <div className="space-y-4">
              <TextField isRequired name="displayName">
                <Label>Workspace Display Name</Label>
                <Input
                  className="h-11 rounded-xl"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </TextField>

              <TextField isRequired name="slug" isInvalid={slugTouched && !isSlugValid}>
                <Label>Workspace URL Slug</Label>
                <div className="flex items-center border border-border rounded-xl bg-surface-secondary/40 focus-within:border-accent transition-colors overflow-hidden pr-2">
                  <span className="text-[11px] text-muted pl-3 font-mono select-none">cverify.com/</span>
                  <input
                    className="flex-1 bg-transparent border-0 outline-none text-xs font-mono font-bold py-3 text-foreground"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    onBlur={() => setSlugTouched(true)}
                  />
                </div>
                <FieldError>Slug must be 4-32 characters, lowercase alphanumeric or dash only.</FieldError>
              </TextField>
            </div>

            <Button
              type="submit"
              fullWidth
              className="h-12 rounded-xl bg-accent text-accent-foreground hover:bg-accent-hover font-bold"
              isDisabled={!isSlugValid || !displayName.trim() || isLoading}
              isPending={isLoading}
            >
              {isLoading ? <Spinner color="current" size="sm" /> : <Settings2 className="size-4 mr-2" />}
              Execute Bootstrap Strategy
            </Button>
          </Form>
        </div>
      </Card>
    );
  }

  // Executing transition loader state
  if (stage === "executing" && bootstrapInfo) {
    return (
      <Card className="w-full premium-glass max-w-md mx-auto py-12 px-6 flex flex-col items-center justify-center select-none text-center">
        <Spinner size="lg" color="accent" />
        <Typography className="text-sm font-bold text-foreground mt-4">Executing Strategy: {strategy === "OptionA" ? "Rebuild" : "Takeover"}...</Typography>
        <Typography className="text-xs text-muted mt-1 leading-normal">
          Revoking old JWT tokens, archiving previous workspaces, and registering new owner credentials.
        </Typography>
      </Card>
    );
  }

  // Success completed receipt state
  if (stage === "success" && bootstrapInfo) {
    return (
      <Card className="w-full premium-glass max-w-md mx-auto py-10 px-6 flex flex-col items-center justify-center text-center select-none border-success/35">
        <div className="w-16 h-16 bg-success/15 flex items-center justify-center rounded-2xl mb-4 border border-success/35">
          <Check className="size-8 text-success stroke-[2.5]" />
        </div>
        <Typography.Heading level={4} className="text-xl font-extrabold text-foreground mt-2">
          Bootstrap Complete!
        </Typography.Heading>
        <Typography className="text-xs text-muted mt-1.5 leading-normal max-w-xs">
          Your credentials have been successfully updated. Logging you into workspace <strong>{slug}</strong>.
        </Typography>
        <div className="mt-8 flex items-center gap-1 text-[10px] text-muted">
          <span>Redirecting to Dashboard</span>
          <RefreshCw className="size-3 animate-spin text-accent" />
        </div>
      </Card>
    );
  }

  return null;
}
