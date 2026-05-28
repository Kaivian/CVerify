"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/features/auth/hooks/use-auth";
import {
  Card,
  Typography,
  Button,
  TextField,
  InputGroup,
  Form,
  Label,
  FieldError,
  toast,
  Spinner,
} from "@heroui/react";
import OtpInput from "@/components/ui/otp-input";
import { Eye, EyeOff, ShieldCheck, Mail } from "lucide-react";
import PasswordStrengthMeter from "../components/password-strength-meter";
import { evaluatePasswordStrength } from "../security/password-policy";




function ContinueWithEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { sendOtp, verifyOtp, createPassword } = useAuth();

  const email = searchParams.get("email") || "";
  const initialChallengeId = searchParams.get("challengeId") || "";
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  // Step state: 1 = OTP verification, 2 = Create Password
  const [step, setStep] = useState(1);
  const [challengeId, setChallengeId] = useState(initialChallengeId);
  const [verificationToken, setVerificationToken] = useState("");

  // Step 1: OTP states
  const [otpCode, setOtpCode] = useState("");
  const [isOtpLoading, setIsOtpLoading] = useState(false);
  const [cooldown, setCooldown] = useState(60);

  // Step 2: Password setup states
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isVisible, setIsVisible] = useState(false);
  const [isConfirmVisible, setIsConfirmVisible] = useState(false);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);

  // Timer cooldown ticking
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  const handleResendOtp = async () => {
    if (cooldown > 0) return;

    const result = await sendOtp(email, "Authentication");
    if (result.success && result.data) {
      setChallengeId(result.data.challengeId);
      setCooldown(60);
      toast.success("New OTP sent successfully.");
    } else {
      toast.danger(
        result.error?.message || "Failed to resend OTP. Please try again.",
      );
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.length < 6) {
      toast.danger("Invalid Code", {
        description: "Please enter the full 6-digit OTP code.",
      });
      return;
    }

    setIsOtpLoading(true);
    const result = await verifyOtp(
      challengeId,
      email,
      otpCode,
      "Authentication",
    );
    setIsOtpLoading(false);

    if (result.success && result.data) {
      setVerificationToken(result.data.verificationToken);
      setStep(2);
      toast.success("OTP Verified", {
        description: "Email ownership proven. Please set your password.",
      });
    } else {
      toast.danger("Verification Failed", {
        description:
          result.error?.message ||
          "The OTP code entered is incorrect or expired.",
      });
    }
  };

  const isPasswordValid =
    evaluatePasswordStrength(password, "default").percentage === 100;

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordValid) {
      toast.danger("Weak Password", {
        description:
          "Password must contain at least 8 characters, 1 uppercase, 1 lowercase, 1 number, and 1 special character.",
      });
      return;
    }
    if (password !== confirmPassword) {
      toast.danger("Mismatch", { description: "Passwords do not match." });
      return;
    }

    setIsPasswordLoading(true);
    const result = await createPassword({
      challengeId,
      email,
      verificationToken,
      password,
      confirmPassword,
    });
    setIsPasswordLoading(false);

    if (result.success) {
      toast.success("Identity Setup Complete", {
        description:
          "Welcome to CVerify! You have been logged in successfully.",
      });
      router.push(callbackUrl);
    } else {
      let errorMsg =
        result.error?.message || "Failed to establish password credential.";
      if (result.error?.errors) {
        const details = Object.values(result.error.errors).flat().join(" ");
        if (details) {
          errorMsg = details;
        }
      }
      toast.danger("Setup Failed", {
        description: errorMsg,
      });
    }
  };

  return (
    <Card className="w-full bg-surface border border-border py-6 px-12 shadow-xl rounded-2xl">
      {step === 1 ? (
        <div className="w-full flex flex-col items-center">
          <div className="w-12 h-12 bg-accent-soft flex items-center justify-center rounded-xl my-6">
            <Mail className="size-6 text-accent" />
          </div>

          <div className="text-center w-full mb-6 flex flex-col items-center gap-2">
            <Typography.Heading
              level={3}
              className="text-2xl font-bold text-foreground"
            >
              Confirm email ownership
            </Typography.Heading>
            <Typography className="text-sm text-muted">
              We&apos;ve sent a 6-digit verification code to{" "}
              <span className="font-bold text-foreground-soft">{email}</span>.
            </Typography>
          </div>

          <Form
            className="w-full flex flex-col gap-6 items-center px-12"
            onSubmit={handleVerifyOtp}
          >
            <div className="flex flex-col gap-2 items-center w-full">
              <Label className="text-muted">One-Time Code</Label>
              <OtpInput
                value={otpCode}
                onChange={setOtpCode}
                length={6}
                groups={[3, 3]}
                isDisabled={isOtpLoading}
              />
            </div>

            <Button
              type="submit"
              fullWidth
              isPending={isOtpLoading}
              isDisabled={otpCode.length < 6 || isOtpLoading}
              className="rounded-xl"
            >
              {isOtpLoading && <Spinner color="current" size="sm" />}
              Verify code
            </Button>
          </Form>

          <div className="text-center text-xs font-medium text-muted my-6">
            Didn&apos;t receive the email?{" "}
            {cooldown > 0 ? (
              <span className="font-bold">Resend in {cooldown}s</span>
            ) : (
              <button
                onClick={handleResendOtp}
                className="font-bold text-foreground hover:underline cursor-pointer bg-transparent border-0"
              >
                Resend code
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="w-full flex flex-col items-center">
          <div className="w-12 h-12 bg-accent-soft flex items-center justify-center rounded-xl my-6">
            <ShieldCheck className="size-6 text-accent" />
          </div>

          <div className="text-center w-full flex flex-col items-center gap-2">
            <Typography.Heading
              level={3}
              className="text-2xl font-bold text-foreground"
            >
              Establish Password
            </Typography.Heading>
            <Typography className="text-sm text-muted">
              Secure your new CVerify engineer profile credential.
            </Typography>
          </div>

          <Form
            className="w-full flex flex-col gap-6 p-12"
            onSubmit={handlePasswordSubmit}
          >
            <TextField isRequired name="password" type="password">
              <Label className="text-sm font-medium text-foreground/80 pb-1">
                Password
              </Label>
              <InputGroup>
                <InputGroup.Input
                  type={isVisible ? "text" : "password"}
                  placeholder="Create password"
                  value={password}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setPassword(e.target.value)
                  }
                />
                <InputGroup.Suffix>
                  <Button
                    isIconOnly
                    aria-label={isVisible ? "Hide password" : "Show password"}
                    size="sm"
                    variant="ghost"
                    className="text-muted hover:text-foreground"
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
              <PasswordStrengthMeter value={password} policyId="default" />
              <FieldError />
            </TextField>

            <TextField isRequired name="confirmPassword" type="password">
              <Label className="text-sm font-medium text-foreground/80 pb-1">
                Confirm Password
              </Label>
              <InputGroup>
                <InputGroup.Input
                  type={isConfirmVisible ? "text" : "password"}
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setConfirmPassword(e.target.value)
                  }
                />
                <InputGroup.Suffix>
                  <Button
                    isIconOnly
                    aria-label={isVisible ? "Hide password" : "Show password"}
                    size="sm"
                    variant="ghost"
                    className="text-muted hover:text-foreground"
                    onPress={() => setIsConfirmVisible(!isConfirmVisible)}
                  >
                    {isConfirmVisible ? (
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
              isPending={isPasswordLoading}
              isDisabled={
                !isPasswordValid ||
                password !== confirmPassword ||
                isPasswordLoading
              }
              className="rounded-xl"
            >
              {({ isPending }) => (
                <>
                  {isPending && <Spinner color="current" size="sm" />}
                  {isPending
                    ? "Complete Registration..."
                    : "Complete Registration"}
                </>
              )}
            </Button>
          </Form>
        </div>
      )}
    </Card>
  );
}

export function ContinueWithEmailView() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-8 min-h-[400px]">
          <div className="w-8 h-8 border-2 border-t-foreground border-border rounded-full animate-spin" />
        </div>
      }
    >
      <ContinueWithEmailContent />
    </Suspense>
  );
}
