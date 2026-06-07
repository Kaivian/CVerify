"use client";

import React, { useState, useCallback, Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { Google } from "@thesvg/react";
import {
  Card,
  Tabs,
  Typography,
  Button,
  TextField,
  InputGroup,
  Input,
  Form,
  Label,
  FieldError,
  Checkbox,
  toast,
  Spinner,
  CardHeader,
  CardContent,
  Link,
} from "@heroui/react";
import { Eye, EyeOff } from "lucide-react";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    loginWithGoogle,
    login,
    sendOtp,
    resolveEmailAuthState,
    companyLogin,
  } = useAuth();

  // Engineer state
  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);

  useEffect(() => {
    const emailParam = searchParams.get("email");
    if (emailParam) {
      setEmail(emailParam);
      setEmailTouched(true);
    }
  }, [searchParams]);
  const [isEmailLoading, setIsEmailLoading] = useState(false);

  // Engineer identity flow phase: email input → password login (if credentials exist)
  type EmailFlowPhase = "EMAIL_INPUT" | "PASSWORD_LOGIN";
  const [emailFlowPhase, setEmailFlowPhase] =
    useState<EmailFlowPhase>("EMAIL_INPUT");
  const [engineerPassword, setEngineerPassword] = useState("");
  const [isEngineerPasswordVisible, setIsEngineerPasswordVisible] =
    useState(false);
  const [isPasswordLoginLoading, setIsPasswordLoginLoading] = useState(false);

  const validateEmail = (val: string) => {
    return val.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  };
  const isEmailInvalid =
    emailTouched && email.length > 0 && !validateEmail(email);

  // Business state
  const [selectedTab, setSelectedTab] = useState("engineer");
  const [businessUsername, setBusinessUsername] = useState("");
  const [businessPassword, setBusinessPassword] = useState("");
  const [isVisible, setIsVisible] = useState(false);
  const [isBusinessLoading, setIsBusinessLoading] = useState(false);

  // Google SSO logic
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [googleUnlinkedError, setGoogleUnlinkedError] = useState(false);

  const handleGoogleLogin = useCallback(
    async (idToken: string) => {
      setIsGoogleLoading(true);
      try {
        const result = await loginWithGoogle(idToken);

        if (result.success) {
          if (result.isUnverified || result.nextStep === "VERIFY_EMAIL") {
            toast.warning("Verification Pending", {
              description: "Please check your email to complete verification.",
            });
            router.push("/verify-email");
            return;
          }

          if (result.isDeletionPending && result.reactivationToken) {
            toast.warning("Account Deactivated", {
              description: "Your account is currently scheduled for permanent deletion. You can restore it here.",
            });
            router.push(`/auth/reactivate?token=${result.reactivationToken}`);
            return;
          }

          if (result.user) {
            toast.success("Welcome to CVerify!", {
              description: "Successfully logged in via Google SSO.",
            });
            // Navigation is handled by AuthOrchestrator (respects callbackUrl)
          }
        } else if (result.error) {
          if (
            result.error.code === "GOOGLE_PROVIDER_UNLINKED" ||
            result.error.message?.includes("GOOGLE_PROVIDER_UNLINKED") ||
            result.error.message?.includes("unlinked")
          ) {
            setGoogleUnlinkedError(true);
          } else {
            toast.danger("Google Login Failed", {
              description: result.error.message,
            });
          }
        }
      } catch {
        toast.danger("Google SSO Failed", {
          description:
            "An unexpected error occurred during Google authentication.",
        });
      } finally {
        setIsGoogleLoading(false);
      }
    },
    [loginWithGoogle, router],
  );

  const handleGoogleSignIn = () => {
    if (isGoogleLoading) return;
    setIsGoogleLoading(true);
    setGoogleUnlinkedError(false);

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      toast.danger("Configuration Error", {
        description: "Google Client ID is not configured.",
      });
      setIsGoogleLoading(false);
      return;
    }

    const redirectUri = `${window.location.origin}/auth/callback/google`;
    const nonce =
      Math.random().toString(36).substring(2) + Date.now().toString(36);
    const scope = encodeURIComponent("openid profile email");
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri,
    )}&response_type=id_token&scope=${scope}&nonce=${nonce}&state=google-login`;

    const width = 500;
    const height = 650;
    const left = window.screenX + (window.innerWidth - width) / 2;
    const top = window.screenY + (window.innerHeight - height) / 2;

    const popup = window.open(
      authUrl,
      "google-oauth",
      `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes`,
    );

    if (!popup) {
      toast.danger("Popup Blocked", {
        description:
          "Please allow popups for this site to sign in with Google.",
      });
      setIsGoogleLoading(false);
      return;
    }

    const messageListener = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "GOOGLE_OAUTH_SUCCESS" && event.data?.idToken) {
        window.removeEventListener("message", messageListener);
        clearInterval(checkClosed);
        const idToken = event.data.idToken;
        await handleGoogleLogin(idToken);
      } else if (event.data?.type === "GOOGLE_OAUTH_ERROR") {
        window.removeEventListener("message", messageListener);
        clearInterval(checkClosed);
        setIsGoogleLoading(false);
        toast.danger("Google Login Failed", {
          description: event.data.error || "Authentication cancelled.",
        });
      }
    };

    window.addEventListener("message", messageListener);

    const checkClosed = setInterval(() => {
      if (!popup || popup.closed) {
        clearInterval(checkClosed);
        window.removeEventListener("message", messageListener);
        setIsGoogleLoading(false);
      }
    }, 1000);
  };

  const handleContinueWithEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !validateEmail(email)) return;

    setIsEmailLoading(true);

    // Phase 1: Resolve identity state from backend
    const stateResult = await resolveEmailAuthState(email);
    setIsEmailLoading(false);

    if (!stateResult.success || !stateResult.data) {
      toast.danger("Failed to resolve identity", {
        description: stateResult.error?.message || "An error occurred.",
      });
      return;
    }

    const { authState } = stateResult.data;

    switch (authState) {
      case "REQUIRES_AUTHENTICATION":
        // User has password credentials — show inline password form
        setEmailFlowPhase("PASSWORD_LOGIN");
        break;

      case "REQUIRES_ONBOARDING": {
        // New user or Google-only — trigger OTP onboarding
        setIsEmailLoading(true);
        const otpResult = await sendOtp(email, "Authentication");
        setIsEmailLoading(false);
        if (otpResult.success && otpResult.data) {
          toast.success("OTP Code Sent", {
            description: `Please check your email: ${email} for the 6-digit verification code.`,
          });
          router.push(
            `/continue-with-email?email=${encodeURIComponent(email)}&challengeId=${otpResult.data.challengeId}`,
          );
        } else {
          toast.danger("Failed to send OTP", {
            description: otpResult.error?.message || "An error occurred.",
          });
        }
        break;
      }

      case "REQUIRES_VERIFICATION":
        toast.warning("Verification Pending", {
          description: "Please check your email to complete verification.",
        });
        router.push("/verify-email");
        break;

      case "ACCOUNT_RESTRICTED":
        toast.danger("Account Restricted", {
          description:
            "This account has been restricted. Please contact support.",
        });
        break;
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !engineerPassword) return;

    setIsPasswordLoginLoading(true);
    const result = await login({
      email,
      password: engineerPassword,
      rememberMe: false,
    });
    setIsPasswordLoginLoading(false);

    if (result.success) {
      if (result.isUnverified || result.nextStep === "VERIFY_EMAIL") {
        toast.warning("Verification Pending", {
          description: "Please check your email to complete verification.",
        });
        router.push("/verify-email");
        return;
      }

      if (result.isDeletionPending && result.reactivationToken) {
        toast.warning("Account Deactivated", {
          description: "Your account is currently scheduled for permanent deletion. You can restore it here.",
        });
        router.push(`/auth/reactivate?token=${result.reactivationToken}`);
        return;
      }

      toast.success("Welcome back!", {
        description: "Successfully logged in.",
      });
      // Navigation is handled by AuthOrchestrator (respects callbackUrl)
    } else {
      toast.danger("Login Failed", {
        description: result.error?.message || "Invalid email or password.",
      });
    }
  };

  const handleBusinessSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!businessUsername || !businessPassword) return;

    setIsBusinessLoading(true);
    const result = await companyLogin({
      organizationUsername: businessUsername,
      password: businessPassword,
    });
    setIsBusinessLoading(false);

    if (result.success) {
      toast.success("Workspace authenticated", {
        description: `Logged in to organization: ${businessUsername}`,
      });
      // Navigation is handled by AuthOrchestrator (respects callbackUrl)
    } else {
      toast.danger("Authentication Failed", {
        description:
          result.error?.message || "Invalid workspace username or password.",
      });
    }
  };

  const handleBusinessReset = () => {
    setBusinessUsername("");
    setBusinessPassword("");
  };

  return (
    <>
      <Card className="w-full py-6 px-18 rounded-2xl">
        <Tabs
          className="w-full"
          variant="secondary"
          selectedKey={selectedTab}
          onSelectionChange={(key) => setSelectedTab(key as string)}
        >
          <Tabs.ListContainer>
            <Tabs.List aria-label="Options">
              <Tabs.Tab id="engineer" className="pb-3 h-full">
                <Typography.Heading level={6}>Engineer</Typography.Heading>
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="business" className="pb-3 h-full">
                <Typography.Heading level={6}>Business</Typography.Heading>
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>

          <Tabs.Panel className="pt-3 flex justify-center w-full" id="engineer">
            {selectedTab === "engineer" && (
              <Card
                variant="transparent"
                className="w-full flex flex-col items-center"
              >
                <CardHeader className="flex flex-col items-center text-center w-full">
                  <Card.Title className="text-2xl font-bold pb-2">
                    Proof over promises
                  </Card.Title>
                  <Card.Description className="text-md pb-6">
                    Evidence-backed profiles for modern engineering hiring.
                  </Card.Description>
                </CardHeader>

                {googleUnlinkedError && (
                  <div className="w-full bg-danger/10 border border-danger/20 rounded-xl p-4 mb-4 text-left animate-fade-in duration-300">
                    <div className="flex flex-col gap-1">
                      <Typography className="text-sm font-bold text-danger font-outfit">
                        Google Login Disabled
                      </Typography>
                      <Typography type="body-xs" className="text-muted">
                        This Google identity was previously disconnected from your CVerify profile. To recover access:
                      </Typography>
                      <ul className="list-disc pl-4 text-[11px] text-muted flex flex-col gap-1 mt-1 font-outfit">
                        <li>Sign in using your primary email and password below.</li>
                        <li>Go to <strong>Settings &gt; Sign-in Methods</strong> and re-link your Google account.</li>
                      </ul>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="mt-2 self-end text-[10px] h-6 px-2 rounded-lg border-danger/20"
                        onPress={() => setGoogleUnlinkedError(false)}
                      >
                        Dismiss
                      </Button>
                    </div>
                  </div>
                )}

                <Button
                  variant="tertiary"
                  className="rounded-xl"
                  fullWidth
                  onPress={handleGoogleSignIn}
                  isDisabled={
                    isGoogleLoading || isEmailLoading || isPasswordLoginLoading
                  }
                  isPending={isGoogleLoading}
                >
                  {!isGoogleLoading && <Google />}
                  Continue with Google
                </Button>

                <Typography type="body-xs" color="muted" className="pb-2">
                  OR
                </Typography>

                {emailFlowPhase === "EMAIL_INPUT" ? (
                  <Form
                    onSubmit={handleContinueWithEmail}
                    className="w-full flex flex-col items-center gap-6"
                  >
                    <TextField
                      fullWidth
                      isInvalid={isEmailInvalid}
                      aria-label="Email Address"
                    >
                      <Input
                        id="email"
                        type="email"
                        placeholder="Enter your email"
                        value={email}
                        aria-label="Email Address"
                        onChange={(e) => {
                          setEmail(e.target.value);
                          setEmailTouched(true);
                        }}
                        onBlur={() => setEmailTouched(true)}
                      />
                      {isEmailInvalid && (
                        <FieldError>
                          Please enter a valid email address.
                        </FieldError>
                      )}
                    </TextField>

                    <Button
                      type="submit"
                      fullWidth
                      isDisabled={isEmailInvalid || !email || isEmailLoading}
                      isPending={isEmailLoading}
                      className="rounded-xl"
                    >
                      {isEmailLoading && <Spinner color="current" size="sm" />}
                      Continue with email
                    </Button>
                  </Form>
                ) : (
                  <Form
                    onSubmit={handlePasswordLogin}
                    className="w-full flex flex-col items-center gap-6"
                  >
                    <TextField fullWidth aria-label="Email Address">
                      <Input
                        id="email-locked"
                        type="email"
                        value={email}
                        readOnly
                      />
                    </TextField>

                    <TextField
                      isRequired
                      name="password"
                      type="password"
                      fullWidth
                    >
                      <Label>Password</Label>
                      <InputGroup>
                        <InputGroup.Input
                          type={isEngineerPasswordVisible ? "text" : "password"}
                          placeholder="Enter your password"
                          value={engineerPassword}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setEngineerPassword(e.target.value)
                          }
                          autoFocus
                        />
                        <InputGroup.Suffix>
                          <Button
                            isIconOnly
                            aria-label={
                              isEngineerPasswordVisible
                                ? "Hide password"
                                : "Show password"
                            }
                            size="sm"
                            variant="ghost"
                            onPress={() =>
                              setIsEngineerPasswordVisible(
                                !isEngineerPasswordVisible,
                              )
                            }
                          >
                            {isEngineerPasswordVisible ? (
                              <Eye className="size-4" />
                            ) : (
                              <EyeOff className="size-4" />
                            )}
                          </Button>
                        </InputGroup.Suffix>
                      </InputGroup>
                      <FieldError />
                    </TextField>

                    <Button
                      type="submit"
                      fullWidth
                      isDisabled={!engineerPassword || isPasswordLoginLoading}
                      isPending={isPasswordLoginLoading}
                      className="rounded-xl"
                    >
                      {isPasswordLoginLoading && (
                        <Spinner color="current" size="sm" />
                      )}
                      Sign In
                    </Button>

                    <div className="flex items-center justify-between w-full">
                      <button
                        type="button"
                        onClick={() => {
                          setEmailFlowPhase("EMAIL_INPUT");
                          setEngineerPassword("");
                        }}
                        className="text-xs text-muted hover:underline cursor-pointer"
                      >
                        ← Use different email
                      </button>
                      <Link
                        href={`/forgot-password?email=${encodeURIComponent(email)}`}
                        className="text-xs text-muted hover:underline cursor-pointer"
                      >
                        Forgot password?
                      </Link>
                    </div>
                  </Form>
                )}
              </Card>
            )}
          </Tabs.Panel>

          <Tabs.Panel className="pt-4 flex justify-center w-full" id="business">
            {selectedTab === "business" && (
              <Card
                variant="transparent"
                className="w-full flex flex-col items-center"
              >
                <CardHeader className="flex flex-col items-center text-center w-full">
                  <Card.Title className="text-2xl font-bold pb-2">
                    Hire beyond resumes
                  </Card.Title>
                  <Card.Description className="text-md pb-6">
                    Verify engineering talent through real technical evidence.
                  </Card.Description>
                </CardHeader>

                <CardContent className="w-full pb-2">
                  <Form
                    className="flex flex-col gap-6"
                    onSubmit={handleBusinessSubmit}
                    onReset={handleBusinessReset}
                  >
                    <TextField isRequired name="username" type="text">
                      <Label>Organization Slug</Label>
                      <Input
                        placeholder="Enter workspace handle (e.g. fpt-software)"
                        value={businessUsername}
                        onChange={(e) => setBusinessUsername(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                      />
                      <FieldError />
                    </TextField>

                    <TextField isRequired name="password" type="password">
                      <Label>Password</Label>
                      <InputGroup>
                        <InputGroup.Input
                          type={isVisible ? "text" : "password"}
                          placeholder="Enter your password"
                          value={businessPassword}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setBusinessPassword(e.target.value)
                          }
                        />
                        <InputGroup.Suffix>
                          <Button
                            isIconOnly
                            aria-label={
                              isVisible ? "Hide password" : "Show password"
                            }
                            size="sm"
                            variant="ghost"
                            onPress={() => setIsVisible(!isVisible)}
                          >
                            {isVisible ? (
                              <Eye className="size-4" />
                            ) : (
                              <EyeOff className="size-4" />
                            )}
                          </Button>
                        </InputGroup.Suffix>
                      </InputGroup>
                      <FieldError />
                    </TextField>

                    <div className="flex items-center justify-between">
                      <Checkbox id="remember-me">
                        <Checkbox.Control>
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                        <Checkbox.Content>
                          <Label
                            htmlFor="remember-me"
                            className="text-muted cursor-pointer text-xs"
                          >
                            Remember me
                          </Label>
                        </Checkbox.Content>
                      </Checkbox>

                      <Link
                        href="/organization/recovery"
                        className="text-xs text-muted hover:underline cursor-pointer"
                      >
                        Forgot password?
                      </Link>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        fullWidth
                        className="rounded-xl"
                        isDisabled={
                          !businessUsername ||
                          !businessPassword ||
                          isBusinessLoading
                        }
                        isPending={isBusinessLoading}
                      >
                        Sign In
                      </Button>
                      <Button
                        type="reset"
                        variant="secondary"
                        fullWidth
                        className="rounded-xl"
                      >
                        Reset
                      </Button>
                    </div>
                  </Form>
                </CardContent>

                <Typography type="body-xs" color="muted">
                  OR
                </Typography>

                <Typography type="body-xs" color="muted">
                  New to CVerify?{" "}
                  <Link
                    href="/company-verification"
                    className="cursor-pointer font-semibold text-foreground hover:underline text-xs"
                  >
                    Register your company
                    <Link.Icon className="pt-1" />
                  </Link>
                </Typography>
              </Card>
            )}
          </Tabs.Panel>
        </Tabs>
      </Card>
    </>
  );
}

export function LoginView() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-8 min-h-[400px]">
          <div className="w-8 h-8 border-2 border-t-foreground border-border rounded-full animate-spin" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
