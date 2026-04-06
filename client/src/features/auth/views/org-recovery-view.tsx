"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import FormOtpField from "@/components/forms/form-otp-field";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { recoveryApi } from "@/features/auth/services/recovery.service";
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
  FieldError,
} from "@heroui/react";
import {
  Eye,
  EyeOff,
  ShieldCheck,
  Mail,
  ArrowLeft,
  Building2,
} from "lucide-react";
import axios from "axios";
import PasswordStrengthMeter from "../components/password-strength-meter";
import { evaluatePasswordStrength } from "../security/password-policy";

// Step 1 Schema: Tax Code validation
const step1Schema = z.object({
  taxCode: z
    .string()
    .min(5, "Tax code must be at least 5 characters")
    .max(50, "Tax code cannot exceed 50 characters"),
});

// Step 2 Schema: OTP validation
const step2Schema = z.object({
  code: z.string().length(6, "Verification code must be exactly 6 digits"),
});

// Step 3 Schema: Password rotation validation
const step3Schema = z
  .object({
    password: z.string().superRefine((val, ctx) => {
      const evaluation = evaluatePasswordStrength(val, "enterprise");
      if (evaluation.percentage < 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Password does not meet enterprise security requirements.",
        });
      }
    }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type Step1Input = z.infer<typeof step1Schema>;
type Step2Input = z.infer<typeof step2Schema>;
type Step3Input = z.infer<typeof step3Schema>;

export function OrgRecoveryView() {
  const router = useRouter();

  // Wizard steps: 1 = Enter Tax Code, 2 = Verify OTP, 3 = Reset Password
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Recovery credentials resolved on backend
  const [taxCode, setTaxCode] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [verificationToken, setVerificationToken] = useState("");

  // Password visibility triggers
  const [isVisible, setIsVisible] = useState(false);
  const [isConfirmVisible, setIsConfirmVisible] = useState(false);

  // Forms setup with Zod resolvers
  const {
    register: reg1,
    handleSubmit: handleSub1,
    formState: { errors: err1 },
  } = useForm<Step1Input>({
    resolver: zodResolver(step1Schema),
  });

  const { control: control2, handleSubmit: handleSub2 } = useForm<Step2Input>({
    resolver: zodResolver(step2Schema),
    defaultValues: { code: "" },
  });

  const {
    register: reg3,
    handleSubmit: handleSub3,
    formState: { errors: err3 },
    control: control3,
  } = useForm<Step3Input>({
    resolver: zodResolver(step3Schema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const passwordVal = useWatch({ control: control3, name: "password" }) || "";

  // OTP resend cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  // Step 1: Submit Tax Code to generate OTP enqueued backend-side
  const onSubmitTaxCode = async (data: Step1Input) => {
    setIsLoading(true);
    try {
      const response = await recoveryApi.orgForgot(data.taxCode);
      setTaxCode(data.taxCode);
      setChallengeId(response.challengeId);
      setMaskedEmail(response.maskedEmail);
      setCooldown(response.cooldownSeconds);
      setStep(2);
      toast.success("Verification Code Dispatched", {
        description: `OTP code sent to registered corporate mailboxes matching ${response.maskedEmail}.`,
      });
    } catch (err) {
      const errorMessage =
        axios.isAxiosError(err) && err.response?.data?.message
          ? err.response.data.message
          : "Failed to trigger recovery. Ensure your Tax Code is correct.";
      toast.danger("Request Failed", {
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Resend OTP trigger
  const handleResendOtp = async () => {
    if (cooldown > 0 || !taxCode) return;

    setIsLoading(true);
    try {
      const response = await recoveryApi.orgForgot(taxCode);
      setChallengeId(response.challengeId);
      setCooldown(response.cooldownSeconds);
      toast.success("New OTP sent successfully.");
    } catch (err) {
      const errorMessage =
        axios.isAxiosError(err) && err.response?.data?.message
          ? err.response.data.message
          : "Failed to resend OTP.";
      toast.danger(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify OTP
  const onSubmitOtp = async (data: Step2Input) => {
    setIsLoading(true);
    try {
      const response = await recoveryApi.orgVerifyOtp({
        taxCode,
        challengeId,
        code: data.code,
      });
      setVerificationToken(response.verificationToken);
      setStep(3);
      toast.success("OTP Verified Successfully", {
        description:
          "Your corporate administrative identity is linked. Please rotate your password.",
      });
    } catch (err) {
      const errorMessage =
        axios.isAxiosError(err) && err.response?.data?.message
          ? err.response.data.message
          : "The code entered is invalid or has expired.";
      toast.danger("Verification Failed", {
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Rotate corporate admin password
  const onSubmitPassword = async (data: Step3Input) => {
    setIsLoading(true);
    try {
      await recoveryApi.orgResetPassword({
        token: verificationToken,
        newPassword: data.password,
        confirmPassword: data.confirmPassword,
      });
      toast.success("Password rotated successfully!", {
        description:
          "Your corporate credentials have been updated. Please sign in with your new password.",
      });
      router.push("/login?tab=bussiness");
    } catch (err) {
      const errorMessage =
        axios.isAxiosError(err) && err.response?.data?.message
          ? err.response.data.message
          : "Failed to update corporate credentials. Please try again.";
      toast.danger("Rotation Failed", {
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full p-12 rounded-2xl">
      {step === 1 && (
        <div className="w-full flex flex-col items-center">
          <div className="w-full flex justify-start mb-3">
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-6 left-4 text-muted"
              onPress={() => {
                router.push("/login");
              }}
            >
              <ArrowLeft className="size-3 mt-0.5" />
              Return to Login
            </Button>
          </div>

          <div className="w-12 h-12 bg-surface-secondary flex items-center justify-center rounded-xl mb-3">
            <Building2 className="size-6 text-foreground" />
          </div>

          <div className="text-center w-full mb-6 flex flex-col items-center gap-2">
            <Typography.Heading
              level={3}
              className="text-2xl font-bold text-center"
            >
              Corporate Recovery
            </Typography.Heading>
            <Typography className="text-sm text-muted text-center">
              Enter your official Tax Code to verify corporate ownership and
              receive a challenge code.
            </Typography>
          </div>

          <Form
            className="w-full flex flex-col gap-6"
            onSubmit={handleSub1(onSubmitTaxCode)}
          >
            <TextField isRequired name="taxCode" isInvalid={!!err1.taxCode}>
              <Label>Business Tax Code (MST)</Label>
              <Input
                placeholder="Enter company tax code"
                {...reg1("taxCode")}
              />
              {err1.taxCode && <FieldError>{err1.taxCode.message}</FieldError>}
            </TextField>

            <Button
              type="submit"
              fullWidth
              isPending={isLoading}
              isDisabled={isLoading}
              className="rounded-xl"
            >
              {isLoading && <Spinner color="current" size="sm" />}
              Request corporate OTP
            </Button>
          </Form>
        </div>
      )}

      {step === 2 && (
        <div className="w-full flex flex-col items-center">
          <div className="w-12 h-12 bg-surface-secondary flex items-center justify-center rounded-xl mb-3 -my-4">
            <Mail className="size-6 text-foreground" />
          </div>

          <div className="text-center w-full mb-6 flex flex-col items-center gap-2">
            <Typography.Heading
              level={4}
              className="font-bold text-center pb-2"
            >
              Verify Corporate Mailbox
            </Typography.Heading>
            <Typography className="text-xs text-muted leading-normal text-center">
              We sent a 6-digit OTP code to verify ownership of{" "}
              <strong className="text-foreground">{maskedEmail}.</strong>
              <br />
              Enter it below to unlock document uploading.
            </Typography>
          </div>

          <Form
            className="w-full flex flex-col gap-6 items-center"
            onSubmit={handleSub2(onSubmitOtp)}
          >
            <FormOtpField
              name="code"
              control={control2}
              length={6}
              groups={[3, 3]}
              label="One-Time Code"
              isDisabled={isLoading}
            />

            <Button
              type="submit"
              fullWidth
              isPending={isLoading}
              isDisabled={isLoading}
              className="h-12 rounded-2xl"
            >
              {isLoading && <Spinner color="current" size="sm" />}
              Verify corporate identity
            </Button>
          </Form>

          <div className="text-center text-xs font-medium text-muted pt-6 -mb-3">
            Didn&apos;t receive the code?{" "}
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
          <div className="w-12 h-12 bg-surface-secondary flex items-center justify-center rounded-xl mb-3 -my-4">
            <ShieldCheck className="size-6 text-foreground" />
          </div>

          <div className="text-center w-full flex flex-col items-center gap-2">
            <Typography.Heading
              level={3}
              className="text-2xl font-bold text-center"
            >
              Reset Administrator Password
            </Typography.Heading>
            <Typography className="text-sm text-muted text-center">
              Establish your new secure administrative credential for this
              organization workspace.
            </Typography>
          </div>

          <Form
            className="w-full flex flex-col gap-6 pt-6"
            onSubmit={handleSub3(onSubmitPassword)}
          >
            <TextField
              isRequired
              name="password"
              type="password"
              isInvalid={!!err3.password}
            >
              <Label>New Password</Label>
              <InputGroup>
                <InputGroup.Input
                  className="h-12"
                  type={isVisible ? "text" : "password"}
                  placeholder="Enter new secure password"
                  {...reg3("password")}
                />
                <InputGroup.Suffix>
                  <Button
                    isIconOnly
                    variant="ghost"
                    size="sm"
                    className="text-muted"
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
              {err3.password && (
                <FieldError>{err3.password.message}</FieldError>
              )}
              <PasswordStrengthMeter
                value={passwordVal}
                policyId="enterprise"
              />
            </TextField>

            <TextField
              isRequired
              name="confirmPassword"
              type="password"
              isInvalid={!!err3.confirmPassword}
            >
              <Label>Confirm New Password</Label>
              <InputGroup>
                <InputGroup.Input
                  className="h-12"
                  type={isConfirmVisible ? "text" : "password"}
                  placeholder="Repeat your new password"
                  {...reg3("confirmPassword")}
                />
                <InputGroup.Suffix>
                  <Button
                    isIconOnly
                    variant="ghost"
                    size="sm"
                    className="text-muted"
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
              {err3.confirmPassword && (
                <FieldError>{err3.confirmPassword.message}</FieldError>
              )}
            </TextField>

            <Button
              type="submit"
              fullWidth
              isPending={isLoading}
              isDisabled={isLoading}
              className="h-12 rounded-xl"
            >
              {isLoading && <Spinner color="current" size="sm" />}
              Update credentials
            </Button>
          </Form>
        </div>
      )}
    </Card>
  );
}
