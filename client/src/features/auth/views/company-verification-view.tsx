"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { Google } from "@thesvg/react";
import {
  Card,
  Typography,
  Button,
  TextField,
  InputGroup,
  Input,
  Form,
  Label,
  FieldError,
  toast,
  Spinner,
  Description,
  Chip,
  Separator,
  Tabs,
} from "@heroui/react";
import OtpInput from "@/components/ui/otp-input";
import {
  Check,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Mail,
  Search,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  UserCheck,
  Eye,
  EyeOff,
} from "lucide-react";
import PasswordStrengthMeter from "../components/password-strength-meter";
import { evaluatePasswordStrength } from "../security/password-policy";

const RESERVED_SLUGS = [
  "admin",
  "root",
  "support",
  "system",
  "api",
  "cverify",
  "help",
  "billing",
  "status",
  "security",
];

// Lookalike brand checkers (typosquatting prevention)
const isLookalikeSlug = (slug: string): boolean => {
  const normalized = slug
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/vv/g, "w")
    .replace(/l1/g, "ll");

  const criticalBrands = [
    "google",
    "facebook",
    "linkedin",
    "cverify",
    "admin",
    "microsoft",
    "github",
    "stripe",
  ];
  return criticalBrands.some(
    (brand) => normalized.includes(brand) && slug !== brand,
  );
};

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

export function CompanyVerificationView() {
  const router = useRouter();
  const {
    verifyCompanyOnboarding,
    sendOtp,
    fetchOtpSession,
    verifyOnboardingOtp,
    verifyOnboardingGoogle,
    completeOnboarding,
  } = useAuth();

  // Unified Wizard Step: 1 = Registry Lookup, 2 = Identity Link, 3 = Workspace Setup
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // STEP 1 State: Legal Business Registry
  const [taxCode, setTaxCode] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [taxCodeTouched, setTaxCodeTouched] = useState(false);
  const [companyNameTouched, setCompanyNameTouched] = useState(false);
  const [verifiedCompanyInfo, setVerifiedCompanyInfo] = useState<{
    officialCompanyName: string;
    taxCode: string;
  } | null>(null);
  const [step1Token, setStep1Token] = useState("");
  const [recoveryInfo, setRecoveryInfo] = useState<{
    organizationDisplayName: string;
    organizationSlug: string;
  } | null>(null);

  // STEP 2 State: Owner Identity Link
  const [activeLinkTab, setActiveLinkTab] = useState<"email" | "google">(
    "email",
  );
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerEmailTouched, setOwnerEmailTouched] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [challengeId, setChallengeId] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [step2Token, setStep2Token] = useState("");
  const [verifiedEmail, setVerifiedEmail] = useState("");

  // STEP 3 State: Workspace Provisioning
  const [companyDisplayName, setCompanyDisplayName] = useState("");
  const [organizationUsername, setOrganizationUsername] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isVisible, setIsVisible] = useState(false);
  const [isConfirmVisible, setIsConfirmVisible] = useState(false);


  // Step names & descriptions
  const steps = [
    { id: 1, label: "Legal Identity", desc: "Company registration check" },
    { id: 2, label: "Owner Ownership", desc: "Prove profile credentials" },
    { id: 3, label: "Workspace Setup", desc: "Configure your space" },
  ];

  // Regex and validators
  const taxCodeRegex = /^\d{10}(-\d{3})?$/;
  const isTaxCodeValid = taxCodeRegex.test(taxCode);
  const isTaxCodeInvalid = taxCodeTouched && !isTaxCodeValid;
  const isCompanyNameInvalid =
    companyNameTouched && companyName.trim().length < 2;

  const validateEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  const isOwnerEmailInvalid = ownerEmailTouched && !validateEmail(ownerEmail);

  // Timer cooldown ticking for OTP
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  // Centralized reset action clearing ALL onboarding state variables and cache artifacts
  const resetOnboardingState = useCallback(() => {
    setStep(1);
    setTaxCode("");
    setCompanyName("");
    setTaxCodeTouched(false);
    setCompanyNameTouched(false);
    setVerifiedCompanyInfo(null);
    setStep1Token("");
    setRecoveryInfo(null);
    setOwnerEmail("");
    setOwnerEmailTouched(false);
    setOtpSent(false);
    setChallengeId("");
    setOtpCode("");
    setCooldown(0);
    setStep2Token("");
    setVerifiedEmail("");
    setCompanyDisplayName("");
    setOrganizationUsername("");
    setSlugTouched(false);
    setPassword("");
    setConfirmPassword("");
    setIsVisible(false);
    setIsConfirmVisible(false);

    if (typeof window !== "undefined") {
      sessionStorage.removeItem("cverify_company_onboarding_state");
    }
  }, []);

  // Sync active OTP session state with backend
  const syncOtpSession = useCallback(async (email: string, chalId: string) => {
    if (!email || !chalId) return;
    try {
      const res = await fetchOtpSession(email, "Onboarding", chalId);
      if (res.success && res.data) {
        const { hasActiveOtp, status, cooldownUntil } = res.data;
        if (hasActiveOtp && status === "ACTIVE") {
          if (cooldownUntil) {
            const cooldownDiff = Math.ceil((new Date(cooldownUntil).getTime() - Date.now()) / 1000);
            setCooldown(cooldownDiff > 0 ? cooldownDiff : 0);
          }
          setOtpSent(true);
        } else {
          resetOnboardingState();
          toast.warning("Active verification session has expired. Please restart the onboarding process.");
        }
      }
    } catch (err) {
      console.error("Failed to sync OTP session with backend", err);
    }
  }, [fetchOtpSession, resetOnboardingState]);

  // Route entry validation
  useEffect(() => {
    if (step === 2 && !step1Token) {
      toast.danger("Access Denied", {
        description: "Please complete the registry verification step first."
      });
      resetOnboardingState();
    } else if (step === 3 && (!step2Token || !verifiedEmail)) {
      toast.danger("Access Denied", {
        description: "Please complete the identity link verification step first."
      });
      resetOnboardingState();
    }
  }, [step, step1Token, step2Token, verifiedEmail, resetOnboardingState]);

  // Clear legacy persisted session storage cache once on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("cverify_company_onboarding_state");
    }
  }, []);

  // Focus & Visibility Synchronization: regain active OTP timers and state instantly on focus regain
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && challengeId && ownerEmail && step === 2) {
        syncOtpSession(ownerEmail, challengeId);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [challengeId, ownerEmail, step, syncOtpSession]);

  // Google SSO logic
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleGoogleLogin = useCallback(
    async (idToken: string) => {
      if (!step1Token) return;
      setIsGoogleLoading(true);
      try {
        const result = await verifyOnboardingGoogle(idToken, step1Token);
        if (result.success && result.data) {
          setStep2Token(result.data.verificationToken);
          setVerifiedEmail(result.data.email || "");
          toast.success("Google link successful!", {
            description: `Verified ownership as ${result.data.email}`,
          });

          // Setup initial default display name and suggested slug from verified company name
          const officialName =
            verifiedCompanyInfo?.officialCompanyName || companyName;
          setCompanyDisplayName(officialName);
          setOrganizationUsername(generateSuggestedSlug(officialName));

          // Advance to step 3 automatically on success
          setStep(3);
        } else {
          toast.danger("Google linking failed", {
            description:
              result.error?.message ||
              "Verify company onboarding state link failed.",
          });
        }
      } catch {
        toast.danger("An unexpected Google error occurred.");
      } finally {
        setIsGoogleLoading(false);
      }
    },
    [step1Token, verifyOnboardingGoogle, verifiedCompanyInfo, companyName],
  );

  const handleGoogleSignIn = () => {
    if (isGoogleLoading) return;
    setIsGoogleLoading(true);

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
    )}&response_type=id_token&scope=${scope}&nonce=${nonce}&state=google-onboarding`;

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
        toast.danger("Google Link Failed", {
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

  // Step 1: Legal Identity validation submission
  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTaxCodeTouched(true);
    setCompanyNameTouched(true);

    if (!isTaxCodeValid || companyName.trim().length < 2) return;

    setIsLoading(true);
    const result = await verifyCompanyOnboarding(companyName, taxCode);
    setIsLoading(false);

    if (result.success && result.data) {
      if (result.data.organizationExists) {
        setRecoveryInfo({
          organizationDisplayName:
            result.data.organizationDisplayName ||
            result.data.officialCompanyName ||
            companyName,
          organizationSlug: result.data.organizationSlug || "",
        });
        toast.warning("This company has already been registered.", {
          description: "Transitioning to workspace access recovery.",
        });
        return;
      }

      setVerifiedCompanyInfo({
        officialCompanyName: result.data.officialCompanyName,
        taxCode: result.data.taxCode,
      });
      setStep1Token(result.data.signedToken || "");
      toast.success("Vietnamese Business Identity verified!", {
        description: "Official legal registry successfully verified.",
      });
    } else {
      toast.danger("Registry Verification Failed", {
        description:
          result.error?.message ||
          "Invalid tax code or company registry match failure.",
      });
    }
  };

  const handleStep1Confirm = () => {
    // Advance to Step 2
    setStep(2);
    setActiveLinkTab("email");
  };

  // Step 2 OTP Dispatches
  const handleSendOtp = async () => {
    if (!ownerEmail || !validateEmail(ownerEmail)) return;
    setIsLoading(true);

    // Generate idempotency key for this request
    const idempotencyKey = crypto.randomUUID();

    const result = await sendOtp(ownerEmail, "Onboarding", idempotencyKey);
    setIsLoading(false);

    if (result.success && result.data) {
      setChallengeId(result.data.challengeId);
      setOtpSent(true);
      setCooldown(result.data.cooldownSeconds || 60);
      toast.success("Verification code dispatched", {
        description: `6-digit OTP code has been sent to ${ownerEmail}.`,
      });
    } else {
      toast.danger("Email validation failed", {
        description:
          result.error?.message ||
          "Invalid domain host resolution or burner email block.",
      });
    }
  };

  // Step 2 OTP Verification
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.length < 6 || !step1Token) return;

    setIsLoading(true);
    const result = await verifyOnboardingOtp(
      challengeId,
      ownerEmail,
      otpCode,
      step1Token,
    );
    setIsLoading(false);

    if (result.success && result.data) {
      setStep2Token(result.data.verificationToken);
      setVerifiedEmail(ownerEmail);
      toast.success("Email OTP verified successfully!", {
        description: "Your business owner credentials are linked.",
      });

      // Setup initial default display name and suggested slug from verified company name
      const officialName =
        verifiedCompanyInfo?.officialCompanyName || companyName;
      setCompanyDisplayName(officialName);
      setOrganizationUsername(generateSuggestedSlug(officialName));

      // Advance to step 3
      setStep(3);
    } else {
      toast.danger("OTP Verification failed", {
        description:
          result.error?.message ||
          "Invalid or expired OTP code code. Please retry.",
      });
    }
  };

  const slugRegex = /^[a-z0-9-]{4,32}$/;
  const isSlugValid = slugRegex.test(organizationUsername);
  const isReservedSlug = RESERVED_SLUGS.includes(organizationUsername);
  const isImpersonating = isLookalikeSlug(organizationUsername);

  const passwordStrength = evaluatePasswordStrength(password, "enterprise");
  const isPasswordValid = passwordStrength.percentage === 100;
  const isPasswordsMatch = password === confirmPassword;

  const isStep3Valid =
    companyDisplayName.trim().length >= 2 &&
    isSlugValid &&
    !isReservedSlug &&
    isPasswordValid &&
    isPasswordsMatch;

  // Step 3: Setup workspace final provisioning
  const handleStep3Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isStep3Valid || !step2Token) return;

    setIsLoading(true);
    const idempotencyKey = crypto.randomUUID();

    const result = await completeOnboarding(
      {
        step2Token,
        organizationUsername,
        companyDisplayName,
        password,
      },
      idempotencyKey,
    );

    setIsLoading(false);

    if (result.success) {
      toast.success("Company created successfully", {
        description:
          "Please sign in or create an account to claim ownership.",
      });
      const targetEmail = verifiedEmail;
      resetOnboardingState();
      router.replace(`/login?email=${encodeURIComponent(targetEmail)}`);
    } else {
      const isExpired = result.error?.code === "TOKEN_EXPIRED" || result.error?.message?.toLowerCase().includes("expired");
      if (isExpired) {
        toast.danger("Session Expired", {
          description: "Your verification token has expired. Please restart the onboarding process."
        });
        resetOnboardingState();
      } else {
        toast.danger("Provisioning failed", {
          description:
            result.error?.message ||
            "Failed to set up workspace organization username.",
        });
      }
    }
  };

  if (recoveryInfo) {
    return (
      <Card className="w-full relative overflow-hidden max-h-[80vh] flex flex-col p-6 pt-12">
        {/* Visual Premium Header Spark */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-accent shrink-0" />

        {/* Top-left Return to Login Button */}
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-6 left-4 text-muted"
          onPress={() => {
            resetOnboardingState();
            router.replace("/login");
          }}
        >
          <ArrowLeft className="size-3.5" />
          Return to Login
        </Button>

        <div className="w-full flex flex-col items-center flex-1 overflow-hidden">
          <div className="flex flex-col items-center shrink-0 w-full mb-6 px-6">
            <div className="w-12 h-12 bg-warning-soft flex items-center justify-center rounded-xl my-6">
              <AlertTriangle className="size-6 text-warning" />
            </div>

            <div className="text-center w-full mb-3 flex flex-col items-center gap-2">
              <Typography.Heading
                level={3}
                className="text-2xl font-bold text-foreground"
              >
                This company has already been registered
              </Typography.Heading>
              <div className="p-4 rounded-2xl bg-surface-secondary border border-border select-none mt-1 w-full">
                <span className="text-xs text-muted block">
                  Registered Workspace
                </span>
                <span className="font-bold block mt-1">
                  {recoveryInfo.organizationDisplayName}
                </span>
                <span className="text-xs text-muted font-mono block mt-1">
                  cverify.com/workspace/{recoveryInfo.organizationSlug}
                </span>
              </div>

              <Typography className="text-xs text-muted leading-relaxed text-center">
                It looks like this organization{" "}
                <span className="underline">already exists</span> on CVerify. If
                your company registered previously and you no longer have
                access, you can request ownership recovery or regain access to
                the workspace.
              </Typography>
            </div>
          </div>

          <div className="flex flex-row gap-3 w-full px-6 pb-6 shrink-0">
            <Button
              className="flex-1 rounded-xl"
              onPress={() =>
                router.push(
                  `/organization/reclaim?taxCode=${taxCode}&companyName=${encodeURIComponent(
                    recoveryInfo.organizationDisplayName,
                  )}`,
                )
              }
            >
              <UserCheck className="size-4 mr-2" />
              Request Access
            </Button>
            <Button
              variant="secondary"
              className="flex-1 rounded-xl"
              onPress={() => window.open("mailto:cverify.career@gmail.com")}
            >
              <Mail className="size-4 mr-2" />
              Contact Support
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card
        className={`w-full relative overflow-hidden transition-all duration-300 max-h-[75vh] flex flex-col`}
      >
        {/* Visual Premium Header Spark */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-accent shrink-0" />

        {/* Dynamic Stepper Header Progress Block */}
        <div className="w-full flex flex-col items-center py-3 border-b border-border select-none shrink-0">
          <div className="flex items-start justify-between w-full max-w-2xl px-2">
            {steps.map((s, idx) => (
              <React.Fragment key={s.id}>
                {/* Step Item */}
                <div className="flex flex-col items-center relative z-10 flex-1">
                  {/* Circle */}
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-300 font-bold font-mono text-xs ${step > s.id
                      ? "bg-accent border-accent text-accent-foreground"
                      : step === s.id
                        ? "border-accent text-accent bg-surface"
                        : "border-border text-muted bg-surface"
                      }`}
                  >
                    {step > s.id ? (
                      <Check className="size-4 stroke-[2.5]" />
                    ) : (
                      s.id
                    )}
                  </div>

                  {/* Labels stacked below */}
                  <div className="flex flex-col items-center mt-3 text-center px-1">
                    <span
                      className={`text-xs font-bold tracking-wide transition-colors whitespace-nowrap ${step >= s.id
                        ? "text-foreground font-semibold"
                        : "text-muted"
                        }`}
                    >
                      {s.label}
                    </span>
                    <span className="text-[10px] text-muted font-medium mt-1 max-w-[120px] hidden sm:block leading-snug">
                      {s.desc}
                    </span>
                  </div>
                </div>

                {/* Connecting Line between steps */}
                {idx < steps.length - 1 && (
                  <div className="flex-1 h-[2px] bg-border mt-[17px] -mx-4 z-0 min-w-[20px] sm:min-w-[40px]">
                    <div
                      className="h-full bg-accent transition-all duration-500"
                      style={{ width: step > s.id ? "100%" : "0%" }}
                    />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* ================= STEP 1: REGISTRY LOOKUP ================= */}
        {step === 1 && (
          <div className="w-full flex flex-col items-center flex-1 overflow-hidden">
            <div className="flex flex-col items-center w-full mb-6 px-12">
              <div className="text-center w-full flex flex-col items-centergap-2">
                <Typography.Heading
                  level={3}
                  className="text-2xl font-bold text-center"
                >
                  Register Your Company
                </Typography.Heading>
                <Typography className="text-xs text-muted text-center">
                  Verify your legal business existence via corporate registry
                  linkage.
                </Typography>
              </div>
            </div>

            {!verifiedCompanyInfo ? (
              <Form
                className="w-full flex flex-col flex-1 overflow-hidden"
                onSubmit={handleStep1Submit}
              >
                <div className="flex-1 overflow-y-auto w-full px-12 pb-6 flex flex-col gap-6">
                  <TextField
                    isRequired
                    name="companyName"
                    type="text"
                    isInvalid={isCompanyNameInvalid}
                  >
                    <Label>Company Name (Registration Name)</Label>
                    <Input
                      placeholder="e.g. FPT Software"
                      value={companyName}
                      onChange={(e) => {
                        setCompanyName(e.target.value);
                        setCompanyNameTouched(e.target.value.length > 0);
                      }}
                    />
                    {isCompanyNameInvalid && (
                      <FieldError>
                        Company name must be at least 2 characters.
                      </FieldError>
                    )}
                  </TextField>

                  <TextField
                    isRequired
                    name="taxCode"
                    type="text"
                    isInvalid={isTaxCodeInvalid}
                  >
                    <Label>Tax Code (Vietnamese MST)</Label>
                    <Input
                      placeholder="e.g. 0312345678"
                      value={taxCode}
                      onChange={(e) => {
                        setTaxCode(e.target.value);
                      }}
                      onBlur={(e) =>
                        setTaxCodeTouched(e.target.value.length > 0)
                      }
                    />
                    <Description>
                      Supports 10-digit codes or 13-digit code branches (e.g.
                      5702225973-003).
                    </Description>
                    {isTaxCodeInvalid && (
                      <FieldError>
                        Tax code format is invalid. Must be exactly 10 digits or
                        10 digits -3 branch code.
                      </FieldError>
                    )}
                  </TextField>
                </div>

                <div className="flex gap-4 px-6 py-6 border-t border-border bg-surface w-full">
                  <Button
                    type="button"
                    variant="secondary"
                    fullWidth
                    className="rounded-xl"
                    onPress={() => {
                      resetOnboardingState();
                      router.replace("/login");
                    }}
                  >
                    Back to Sign In
                  </Button>
                  <Button
                    type="submit"
                    fullWidth
                    className="rounded-xl"
                    isDisabled={
                      !isTaxCodeValid ||
                      companyName.trim().length < 2 ||
                      isLoading
                    }
                    isPending={isLoading}
                  >
                    {isLoading ? (
                      <Spinner color="current" size="sm" />
                    ) : (
                      <Search className="size-4 mr-2" />
                    )}
                    Verify Registry
                  </Button>
                </div>
              </Form>
            ) : (
              <div className="w-full flex flex-col flex-1 overflow-hidden">
                <div className="flex-1 overflow-y-auto w-full px-6 pb-5 flex flex-col gap-6">
                  <div className="w-full p-6 rounded-2xl bg-success-soft/25 flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-success text-success-foreground flex items-center justify-center">
                        <Check className="size-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-success">
                          Company Information Verified
                        </h4>
                        <p className="text-xs text-success/80 font-medium">
                          Verified active registry record found
                        </p>
                      </div>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-1 md:grid-cols-6 gap-4 text-xs">
                      <div className="md:col-span-4">
                        <span className="text-muted font-semibold block uppercase tracking-wider text-[10px]">
                          Official Normalised Name
                        </span>
                        <span className="text-foreground font-bold mt-0.5 block">
                          {verifiedCompanyInfo.officialCompanyName}
                        </span>
                      </div>

                      <div className="md:col-span-2">
                        <span className="text-muted font-semibold block uppercase tracking-wider text-[10px]">
                          Verified Tax Identifier
                        </span>
                        <span className="text-foreground font-mono font-bold mt-0.5 block">
                          {verifiedCompanyInfo.taxCode}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 px-6 py-4 border-t border-border bg-surface shrink-0 w-full">
                  <Button
                    variant="outline"
                    fullWidth
                    className="rounded-xl"
                    onPress={() => setVerifiedCompanyInfo(null)}
                  >
                    Change Registry details
                  </Button>
                  <Button
                    fullWidth
                    className="rounded-xl"
                    onPress={handleStep1Confirm}
                  >
                    Confirm & Continue
                    <ArrowRight className="size-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= STEP 2: OWNER LINK ================= */}
        {step === 2 && (
          <div className="w-full flex flex-col items-center flex-1 overflow-hidden">
            <div className="flex flex-col items-center shrink-0 w-full mb-4 px-6 pt-2">
              <div className="text-center w-full flex flex-col items-centergap-2">
                <Typography.Heading
                  level={3}
                  className="text-2xl font-bold text-center"
                >
                  Link Owner Profile
                </Typography.Heading>
                <Typography className="text-xs text-muted text-center">
                  Prove ownership identity to associate with verified legal
                  business workspace.
                </Typography>
              </div>
            </div>

            {/* HeroUI Tabs horizontal switcher for Email OTP vs Google linking */}
            <Tabs
              className="w-full px-12 mb-6"
              variant="secondary"
              selectedKey={activeLinkTab}
              onSelectionChange={(key) =>
                setActiveLinkTab(key as "email" | "google")
              }
            >
              <Tabs.ListContainer>
                <Tabs.List
                  aria-label="Link Options"
                  className="flex items-center gap-4 h-10 border-b border-divider w-full"
                >
                  <Tabs.Tab
                    id="email"
                    className="flex items-center justify-center h-full pb-3 flex-1 cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Mail className="size-3.5" />
                      <span className="text-xs font-semibold text-foreground">
                        Email Verification
                      </span>
                    </div>
                    <Tabs.Indicator className="bottom-0!" />
                  </Tabs.Tab>
                  <Tabs.Tab
                    id="google"
                    className="flex items-center justify-center h-full pb-3 flex-1 cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Google className="size-3.5" />
                      <span className="text-xs font-semibold text-foreground">
                        Continue with Google
                      </span>
                    </div>
                    <Tabs.Indicator className="bottom-0!" />
                  </Tabs.Tab>
                </Tabs.List>
              </Tabs.ListContainer>
            </Tabs>

            {activeLinkTab === "email" ? (
              // EMAIL OTP SUITE
              !otpSent ? (
                <div className="w-full flex flex-col flex-1 overflow-hidden">
                  <div className="flex-1 overflow-y-auto w-full px-12 pb-6 flex flex-col gap-6">
                    <TextField
                      isRequired
                      name="email"
                      type="email"
                      isInvalid={isOwnerEmailInvalid}
                    >
                      <Label>Professional Business Email</Label>
                      <Input
                        placeholder="Enter professional company email (e.g. ceo@company.vn)"
                        value={ownerEmail}
                        onChange={(e) => {
                          setOwnerEmail(e.target.value);
                          setOwnerEmailTouched(e.target.value.length > 0);
                        }}
                      />
                      {isOwnerEmailInvalid && (
                        <FieldError>
                          Please enter a valid business email.
                        </FieldError>
                      )}
                    </TextField>
                  </div>

                  <div className="flex gap-6 px-12 py-6 w-full border-t border-border">
                    <Button
                      variant="outline"
                      fullWidth
                      className="rounded-xl"
                      onPress={() => resetOnboardingState()}
                    >
                      Back to step 1
                    </Button>
                    <Button
                      fullWidth
                      className="rounded-xl"
                      isDisabled={
                        !ownerEmail || isOwnerEmailInvalid || isLoading
                      }
                      isPending={isLoading}
                      onPress={handleSendOtp}
                    >
                      {isLoading && <Spinner color="current" size="sm" />}
                      Send Verification Code
                    </Button>
                  </div>
                </div>
              ) : (
                // OTP Code Entry Panel
                <Form
                  className="w-full flex flex-col flex-1 overflow-hidden"
                  onSubmit={handleVerifyOtp}
                >
                  <div className="flex-1 overflow-y-auto w-full px-6 pb-6 flex flex-col gap-3 items-center">
                    <Typography className="text-xs text-muted">
                      We&apos;ve sent a 6-digit verification code to{" "}
                      <span className="font-bold text-foreground-soft">
                        {ownerEmail}
                      </span>
                      .
                    </Typography>

                    <div className="flex flex-col gap-3 items-center w-full shrink-0">
                      <Label className="text-xs font-semibold text-foreground/80">
                        Enter 6-Digit OTP Code
                      </Label>
                      <OtpInput
                        value={otpCode}
                        onChange={setOtpCode}
                        length={6}
                        groups={[3, 3]}
                        isDisabled={isLoading}
                      />
                    </div>

                    <div className="text-center text-xs font-semibold text-muted select-none shrink-0">
                      Didn&apos;t receive the OTP?{" "}
                      {cooldown > 0 ? (
                        <span className="text-foreground/80">
                          Resend in {cooldown}s
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={handleSendOtp}
                          className="text-foreground hover:underline cursor-pointer bg-transparent border-0 font-bold"
                        >
                          Resend code
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-4 px-6 py-4 border-t border-border bg-surface shrink-0 w-full mt-auto">
                    <Button
                      variant="secondary"
                      fullWidth
                      className="rounded-xl"
                      onPress={() => setOtpSent(false)}
                    >
                      Change Email
                    </Button>
                    <Button
                      type="submit"
                      fullWidth
                      className="rounded-xl"
                      isDisabled={otpCode.length < 6 || isLoading}
                      isPending={isLoading}
                    >
                      {isLoading ? (
                        <Spinner color="current" size="sm" />
                      ) : (
                        <ShieldCheck className="size-4" />
                      )}
                      Verify OTP Code
                    </Button>
                  </div>
                </Form>
              )
            ) : // GOOGLE SSO LINK SUITE
              verifiedEmail ? (
                // GOOGLE SSO LINK SUITE (LINKED STATE)
                <div className="w-full flex flex-col flex-1 overflow-hidden animate-in fade-in duration-300">
                  <div className="flex-1 overflow-y-auto w-full px-6 pb-4 flex flex-col gap-6">
                    <div className="flex items-center gap-3 bg-success-soft/25 p-4 rounded-xl">
                      <div className="w-8 h-8 rounded-full bg-success text-success-foreground flex items-center justify-center">
                        <Check className="size-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-success">
                          Google Account Linked
                        </h4>
                        <p className="text-xs text-success/80 font-medium">
                          Your identity has been successfully verified.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-4 items-end">
                      <TextField
                        isReadOnly
                        name="linkedGoogleEmail"
                        type="email"
                        className="w-full"
                      >
                        <Label>Linked Google Email</Label>
                        <Input
                          value={verifiedEmail}
                          className="rounded-xl"
                          readOnly
                        />
                      </TextField>

                      <Button
                        variant="outline"
                        className="rounded-xl"
                        onPress={() => {
                          setVerifiedEmail("");
                          setStep2Token("");
                        }}
                      >
                        <RefreshCw className="size-4 mr-2" /> Link another email
                      </Button>
                    </div>
                  </div>

                  <div className="flex gap-4 px-6 py-3 border-t border-border">
                    <Button
                      fullWidth
                      variant="secondary"
                      className="rounded-xl"
                      onPress={() => resetOnboardingState()}
                    >
                      Back to step 1
                    </Button>
                    <Button
                      fullWidth
                      className="rounded-xl"
                      onPress={() => setStep(3)}
                    >
                      Confirm & Continue
                      <ArrowRight className="size-4 ml-2" />
                    </Button>
                  </div>
                </div>
              ) : (
                // GOOGLE SSO LINK SUITE (UNLINKED STATE)
                <div className="w-full flex flex-col flex-1 overflow-hidden">
                  <div className="flex-1 overflow-y-auto w-full px-18 pb-6 flex flex-col gap-6 items-center">
                    <div className="text-center justify-center">
                      <Typography.Heading
                        level={3}
                        className="text-xl font-bold text-foreground text-center justify-center"
                      >
                        Secure OAuth Linking
                      </Typography.Heading>
                      <Typography className="text-xs text-muted text-center leading-relaxed">
                        Authenticate via Google Single Sign-On. Your Google email
                        identity will serve as your primary owner account
                        workspace.
                      </Typography>
                    </div>

                    <Button
                      variant="tertiary"
                      fullWidth
                      className="rounded-xl text-sm"
                      size="lg"
                      onPress={handleGoogleSignIn}
                      isDisabled={isGoogleLoading || isLoading}
                      isPending={isGoogleLoading}
                    >
                      {!isGoogleLoading && <Google />}
                      Link with Google
                    </Button>
                  </div>

                  <div className="flex gap-6 px-18 py-6 border-t border-border bg-surface shrink-0 w-full">
                    <Button
                      fullWidth
                      variant="secondary"
                      className="rounded-xl"
                      onPress={() => resetOnboardingState()}
                    >
                      Back to step 1
                    </Button>
                  </div>
                </div>
              )}
          </div>
        )}

        {/* ================= STEP 3: WORKSPACE CONFIGURATION ================= */}
        {step === 3 && (
          <div className="w-full flex flex-col items-center flex-1 overflow-hidden">
            <div className="flex flex-col items-center shrink-0 w-full mb-6 px-6 pt-2">
              <div className="text-center w-full flex flex-col items-centergap-2">
                <Typography.Heading
                  level={3}
                  className="text-2xl font-bold text-center"
                >
                  Setup Workspace
                </Typography.Heading>
                <Typography className="text-xs text-muted text-center">
                  Create your tenant profile, slug handle, and owner credential
                  settings.
                </Typography>
              </div>
            </div>
            <Form
              className="w-full flex flex-col flex-1 overflow-hidden"
              onSubmit={handleStep3Submit}
            >
              <div className="flex-1 overflow-y-auto w-full px-6 pb-6 flex flex-col gap-6">
                <div className="w-full p-4 rounded-xl bg-surface-secondary border border-border flex items-center justify-between">
                  <div>
                    <span className="text-xs text-muted block">
                      Linked Owner Profile
                    </span>
                    <span className="text-foreground font-medium text-sm block">
                      {verifiedEmail}
                    </span>
                  </div>
                  <Chip color="success" variant="primary">
                    Verified
                  </Chip>
                </div>

                {/* Public Display Name */}
                <TextField isRequired name="companyDisplayName" type="text">
                  <Label>Public Company Name</Label>
                  <Input
                    placeholder="Enter business public name (e.g. FPT Software)"
                    value={companyDisplayName}
                    onChange={(e) => setCompanyDisplayName(e.target.value)}
                  />
                  <Description>
                    Legal default retrieved:{" "}
                    <span className="font-bold">
                      {verifiedCompanyInfo?.officialCompanyName}
                    </span>
                  </Description>
                </TextField>

                {/* Workspace Username Slug */}
                <TextField
                  isRequired
                  name="organizationUsername"
                  type="text"
                  isInvalid={!isSlugValid && slugTouched}
                >
                  <Label> Workspace Handle Slug (URL)</Label>
                  <InputGroup>
                    <InputGroup.Prefix>cverify.com/</InputGroup.Prefix>
                    <Input
                      placeholder="fpt-software"
                      className="rounded-r-xl rounded-l-none w-full"
                      value={organizationUsername}
                      onChange={(e) => {
                        setOrganizationUsername(
                          e.target.value.toLowerCase().replace(/\s+/g, "-"),
                        );
                        setSlugTouched(e.target.value.length > 0);
                      }}
                    />
                  </InputGroup>

                  {/* Slug suggestions or validation blocks */}
                  {isSlugValid && !isReservedSlug && !isImpersonating && (
                    <div className="text-[10px] text-muted mt-1.5 font-medium flex items-center gap-1 select-none">
                      <Check className="size-3 text-success" />
                      Slug handle available:{" "}
                      <span className="font-mono text-foreground/80 font-bold">
                        cverify.com/workspace/{organizationUsername}
                      </span>
                    </div>
                  )}

                  {isReservedSlug && (
                    <div className="text-danger text-[10px] mt-1.5 font-bold flex items-center gap-1">
                      <AlertCircle className="size-3 text-danger shrink-0" />
                      This namespace handle is reserved and cannot be requested.
                    </div>
                  )}

                  {isImpersonating && (
                    <div className="text-warning text-[10px] mt-1.5 font-bold flex items-center gap-1">
                      <AlertTriangle className="size-3 text-warning shrink-0" />
                      Warning: Name resembles a major global brand.
                      Anti-impersonation system checks will run.
                    </div>
                  )}

                  {!isSlugValid && slugTouched && (
                    <FieldError className="text-danger text-xs mt-1">
                      Slug must be 4-32 characters, lowercase alphanumeric or
                      dashes only.
                    </FieldError>
                  )}
                </TextField>

                {/* Workspace Credentials Disclaimer */}
                <div className="p-3.5 bg-surface-secondary border border-border rounded-xl text-xs text-muted leading-relaxed">
                  <strong className="text-foreground font-semibold block mb-0.5">Workspace Credentials:</strong>
                  This password establishes credentials for the Workspace login page (using slug + password). The ownership verification email is only used as a contact to automatically bootstrap admin permissions on registration, and is not a company user account or authenticated identity.
                </div>

                {/* Workspace Password */}
                <TextField isRequired name="password" type="password">
                  <Label>Workspace Password</Label>
                  <InputGroup>
                    <InputGroup.Input
                      type={isVisible ? "text" : "password"}
                      placeholder="Workspace password (min 12 chars)"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                    />
                    <InputGroup.Suffix>
                      <Button
                        isIconOnly
                        variant="ghost"
                        size="sm"
                        className="text-muted"
                        onPress={() => setIsVisible(!isVisible)}
                        isDisabled={isLoading}
                      >
                        {isVisible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                      </Button>
                    </InputGroup.Suffix>
                  </InputGroup>
                  <PasswordStrengthMeter value={password} policyId="enterprise" />
                </TextField>

                {/* Confirm Workspace Password */}
                <TextField isRequired name="confirmPassword" type="password">
                  <Label>Confirm Workspace Password</Label>
                  <InputGroup>
                    <InputGroup.Input
                      type={isConfirmVisible ? "text" : "password"}
                      placeholder="Repeat workspace password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={isLoading}
                    />
                    <InputGroup.Suffix>
                      <Button
                        isIconOnly
                        variant="ghost"
                        size="sm"
                        className="text-muted"
                        onPress={() => setIsConfirmVisible(!isConfirmVisible)}
                        isDisabled={isLoading}
                      >
                        {isConfirmVisible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                      </Button>
                    </InputGroup.Suffix>
                  </InputGroup>
                </TextField>
              </div>

              {/* Pinned Button Footer */}
              <div className="flex gap-4 px-6 py-4 border-t border-border bg-surface shrink-0 w-full">
                <Button
                  variant="secondary"
                  className="rounded-xl"
                  onPress={() => {
                    setStep(2);
                    setStep2Token("");
                    setVerifiedEmail("");
                  }}
                  isDisabled={isLoading}
                >
                  Back to step 2
                </Button>
                <Button
                  type="submit"
                  fullWidth
                  className="rounded-xl"
                  isDisabled={!isStep3Valid || isLoading}
                  isPending={isLoading}
                >
                  {isLoading && <Spinner color="current" size="sm" />}
                  Provision Workspace Organization
                </Button>
              </div>
            </Form>
          </div>
        )}
      </Card>
    </>
  );
}
