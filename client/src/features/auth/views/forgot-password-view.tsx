"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import OtpInput from "@/components/ui/otp-input";
import { useAuth } from "@/features/auth/hooks/use-auth";
import {
  Card,
  Typography,
  Button,
  TextField,
  InputGroup,
  Input,
  Form,
  Label,
  toast,
  Spinner,
} from "@heroui/react";
import {
  Eye,
  EyeOff,
  ShieldCheck,
  Mail,
  ArrowLeft,
  KeyRound,
} from "lucide-react";

export function ForgotPasswordView() {
  const router = useRouter();
  const { sendOtp, verifyOtp, createPassword } = useAuth();

  // Wizard steps: 1 = Enter Email, 2 = Verify OTP, 3 = Reset Password
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [challengeId, setChallengeId] = useState("");
  const [verificationToken, setVerificationToken] = useState("");

  // Cooldowns and states
  const [isLoading, setIsLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // OTP states
  const [otpCode, setOtpCode] = useState("");

  // Password reset states
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isVisible, setIsVisible] = useState(false);
  const [isConfirmVisible, setIsConfirmVisible] = useState(false);

  const validateEmail = (val: string) => {
    return val.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  };
  const isEmailInvalid =
    emailTouched && email.length > 0 && !validateEmail(email);

  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || isEmailInvalid) return;

    setIsLoading(true);
    const result = await sendOtp(email, "ForgotPassword");
    setIsLoading(false);

    if (result.success && result.data) {
      setChallengeId(result.data.challengeId);
      setStep(2);
      setCooldown(60);
      toast.success("Recovery Code Sent", {
        description: `Please check ${email} for your password recovery code.`,
      });
    } else {
      toast.danger("Request Failed", {
        description:
          result.error?.message ||
          "Failed to trigger recovery. Ensure your email is correct.",
      });
    }
  };

  const handleResendOtp = async () => {
    if (cooldown > 0) return;

    setIsLoading(true);
    const result = await sendOtp(email, "ForgotPassword");
    setIsLoading(false);

    if (result.success && result.data) {
      setChallengeId(result.data.challengeId);
      setCooldown(60);
      toast.success("New OTP sent successfully.");
    } else {
      toast.danger(result.error?.message || "Failed to resend OTP.");
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length < 6) return;

    setIsLoading(true);
    const result = await verifyOtp(
      challengeId,
      email,
      otpCode,
      "ForgotPassword",
    );
    setIsLoading(false);

    if (result.success && result.data) {
      setVerificationToken(result.data.verificationToken);
      setStep(3);
      toast.success("Recovery Code Verified", {
        description: "Please establish your new password below.",
      });
    } else {
      toast.danger("Verification Failed", {
        description:
          result.error?.message ||
          "The code entered is invalid or has expired.",
      });
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || password.length < 8) return;
    if (password !== confirmPassword) return;

    setIsLoading(true);
    const result = await createPassword({
      challengeId,
      email,
      verificationToken,
      password,
      confirmPassword,
      fullName: undefined,
    });
    setIsLoading(false);

    if (result.success) {
      toast.success("Password Updated Successfully", {
        description:
          "Your credential has been rotated. You have been automatically authenticated.",
      });
      router.push("/");
    } else {
      toast.danger("Rotation Failed", {
        description:
          result.error?.message ||
          "Failed to reset your password. Please try again.",
      });
    }
  };

  return (
    <Card className="w-full bg-surface border border-border p-8 shadow-xl rounded-2xl">
      {step === 1 && (
        <div className="w-full flex flex-col items-center">
          <div className="w-full flex justify-start mb-6">
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-6 left-4 text-muted"
              onPress={() => {
                router.push("/login");
              }}
            >
              <ArrowLeft className="size-3.5" />
              Return to Login
            </Button>
          </div>

          <div className="w-12 h-12 bg-surface-secondary flex items-center justify-center rounded-xl mb-6">
            <KeyRound className="size-6 text-foreground" />
          </div>

          <div className="text-center w-full mb-8 font-outfit">
            <Typography.Heading
              level={3}
              className="text-2xl font-bold pb-2 text-foreground"
            >
              Recover Credential
            </Typography.Heading>
            <Typography className="text-sm text-muted">
              Enter your email to receive a challenge-based recovery code.
            </Typography>
          </div>

          <Form
            className="w-full flex flex-col gap-4"
            onSubmit={handleRequestOtp}
          >
            <TextField isRequired name="email" isInvalid={isEmailInvalid}>
              <Label className="text-sm font-medium text-foreground/80 pb-1">
                Email Address
              </Label>
              <Input
                placeholder="Enter registered email address"
                className="h-12"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailTouched(true);
                }}
                onBlur={() => setEmailTouched(true)}
              />
              {isEmailInvalid && (
                <div className="text-left w-full mt-1">
                  <span className="text-danger text-xs font-medium">
                    Please enter a valid email address.
                  </span>
                </div>
              )}
            </TextField>

            <Button
              type="submit"
              fullWidth
              isPending={isLoading}
              isDisabled={isEmailInvalid || !email || isLoading}
              className="h-12 rounded-xl bg-foreground text-background font-semibold mt-2 flex items-center justify-center gap-2"
            >
              {isLoading && <Spinner color="current" size="sm" />}
              Request recovery code
            </Button>
          </Form>
        </div>
      )}

      {step === 2 && (
        <div className="w-full flex flex-col items-center">
          <div className="w-12 h-12 bg-surface-secondary flex items-center justify-center rounded-xl mb-6">
            <Mail className="size-6 text-foreground" />
          </div>

          <div className="text-center w-full mb-8 flex flex-col items-center">
            <Typography.Heading
              level={3}
              className="text-2xl font-bold pb-2 text-foreground"
            >
              Confirm email ownership
            </Typography.Heading>
            <Typography className="text-sm text-muted">
              We&apos;ve sent a 6-digit challenge code to{" "}
              <span className="font-semibold text-foreground/80">{email}</span>.
            </Typography>
          </div>

          <Form
            className="w-full flex flex-col gap-5 items-center"
            onSubmit={handleVerifyOtp}
          >
            <div className="flex flex-col gap-2 items-center w-full">
              <Label className="text-sm font-medium text-foreground/80 pb-1">
                One-Time Code
              </Label>
              <OtpInput
                value={otpCode}
                onChange={setOtpCode}
                length={6}
                groups={[3, 3]}
                isDisabled={isLoading}
              />
            </div>

            <Button
              type="submit"
              fullWidth
              isPending={isLoading}
              isDisabled={otpCode.length < 6 || isLoading}
              className="h-12 rounded-xl bg-foreground text-background font-semibold flex items-center justify-center gap-2"
            >
              {isLoading && <Spinner color="current" size="sm" />}
              Verify code
            </Button>
          </Form>

          <div className="text-center text-xs font-medium text-muted pt-6">
            Didn&apos;t receive the email?{" "}
            {cooldown > 0 ? (
              <span className="font-semibold text-muted">
                Resend in {cooldown}s
              </span>
            ) : (
              <button
                onClick={handleResendOtp}
                className="font-semibold text-foreground hover:underline cursor-pointer bg-transparent border-0"
              >
                Resend code
              </button>
            )}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="w-full flex flex-col items-center">
          <div className="w-12 h-12 bg-surface-secondary flex items-center justify-center rounded-xl mb-6">
            <ShieldCheck className="size-6 text-foreground" />
          </div>

          <div className="text-center w-full mb-8">
            <Typography.Heading
              level={3}
              className="text-2xl font-bold pb-2 text-foreground"
            >
              Reset Password
            </Typography.Heading>
            <Typography className="text-sm text-muted">
              Establish a new secure password credential for your CVerify
              account.
            </Typography>
          </div>

          <Form
            className="w-full flex flex-col gap-5"
            onSubmit={handleResetPassword}
          >
            <TextField isRequired name="password" type="password">
              <Label className="text-sm font-medium text-foreground/80 pb-1">
                New Password
              </Label>
              <InputGroup>
                <InputGroup.Input
                  className="h-12"
                  type={isVisible ? "text" : "password"}
                  placeholder="Enter new password (min 8 chars)"
                  value={password}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setPassword(e.target.value)
                  }
                />
                <InputGroup.Suffix>
                  <Button
                    isIconOnly
                    variant="ghost"
                    size="sm"
                    className="text-muted hover:bg-transparent"
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
            </TextField>

            <TextField isRequired name="confirmPassword" type="password">
              <Label className="text-sm font-medium text-foreground/80 pb-1">
                Confirm New Password
              </Label>
              <InputGroup>
                <InputGroup.Input
                  className="h-12"
                  type={isConfirmVisible ? "text" : "password"}
                  placeholder="Repeat your new password"
                  value={confirmPassword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setConfirmPassword(e.target.value)
                  }
                />
                <InputGroup.Suffix>
                  <Button
                    isIconOnly
                    variant="ghost"
                    size="sm"
                    className="text-muted hover:bg-transparent"
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
            </TextField>

            <Button
              type="submit"
              fullWidth
              isPending={isLoading}
              isDisabled={
                !password ||
                password.length < 8 ||
                password !== confirmPassword ||
                isLoading
              }
              className="h-12 rounded-xl bg-foreground text-background font-semibold mt-2 flex items-center justify-center gap-2"
            >
              {isLoading && <Spinner color="current" size="sm" />}
              Reset password
            </Button>
          </Form>
        </div>
      )}
    </Card>
  );
}
