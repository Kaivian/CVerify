"use client";

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/hooks/use-auth';
import {
    Card, Typography, Button, TextField,
    InputGroup, Form, Label, toast, Spinner
} from "@heroui/react";
import { KeyRound, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { Suspense } from 'react';
import PasswordStrengthMeter from '../components/password-strength-meter';
import { evaluatePasswordStrength } from '../security/password-policy';

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  const { resetPassword } = useAuth();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isVisible, setIsVisible] = useState(false);
  const [isConfirmVisible, setIsConfirmVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const isPasswordValid = evaluatePasswordStrength(password, "default").percentage === 100;

  useEffect(() => {
    if (!token) {
      toast.danger("Invalid Link", {
        description: "Password reset token is missing. Please check your recovery email."
      });
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !password || !isPasswordValid) return;
    if (password !== confirmPassword) {
      toast.danger("Mismatch", { description: "Passwords do not match." });
      return;
    }

    setIsLoading(true);
    const result = await resetPassword({
      token,
      password,
      confirmPassword,
    });
    setIsLoading(false);

    if (result.success) {
      setIsSuccess(true);
      toast.success("Password Updated", {
        description: "Your credential has been rotated. Redirecting to workspace..."
      });
      setTimeout(() => {
        router.push('/');
      }, 2000);
    } else {
      toast.danger("Reset Failed", {
        description: result.error?.message || "Failed to update your password."
      });
    }
  };

  return (
    <Card className="w-full bg-surface border border-border p-8 shadow-xl rounded-2xl">
      {!isSuccess ? (
        <div className="w-full flex flex-col items-center">
          <div className="w-12 h-12 bg-surface-secondary flex items-center justify-center rounded-xl mb-6">
            <KeyRound className="size-6 text-foreground" />
          </div>

          <div className="text-center w-full mb-8 font-outfit">
            <Typography.Heading level={3} className="text-2xl font-bold pb-2 text-foreground">
              Reset Password
            </Typography.Heading>
            <Typography className="text-sm text-muted">
              Establish a new password for your verified CVerify profile.
            </Typography>
          </div>

          <Form className="w-full flex flex-col gap-5" onSubmit={handleSubmit}>
            <TextField isRequired name="password" type="password">
              <Label className="text-sm font-medium text-foreground/80 pb-1">New Password</Label>
              <InputGroup>
                <InputGroup.Input
                  className="h-12"
                  type={isVisible ? "text" : "password"}
                  placeholder="Enter new password (min 8 chars)"
                  value={password}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                  disabled={isLoading || !token}
                />
                <InputGroup.Suffix>
                  <Button
                    isIconOnly
                    variant="ghost"
                    size="sm"
                    className="text-muted hover:bg-transparent"
                    onPress={() => setIsVisible(!isVisible)}
                    isDisabled={isLoading || !token}
                  >
                    {isVisible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                  </Button>
                </InputGroup.Suffix>
              </InputGroup>
              <PasswordStrengthMeter value={password} policyId="default" />
            </TextField>

            <TextField isRequired name="confirmPassword" type="password">
              <Label className="text-sm font-medium text-foreground/80 pb-1">Confirm Password</Label>
              <InputGroup>
                <InputGroup.Input
                  className="h-12"
                  type={isConfirmVisible ? "text" : "password"}
                  placeholder="Repeat your new password"
                  value={confirmPassword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
                  disabled={isLoading || !token}
                />
                <InputGroup.Suffix>
                  <Button
                    isIconOnly
                    variant="ghost"
                    size="sm"
                    className="text-muted hover:bg-transparent"
                    onPress={() => setIsConfirmVisible(!isConfirmVisible)}
                    isDisabled={isLoading || !token}
                  >
                    {isConfirmVisible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                  </Button>
                </InputGroup.Suffix>
              </InputGroup>
            </TextField>

            <Button
              type="submit"
              fullWidth
              isPending={isLoading}
              isDisabled={!password || !isPasswordValid || password !== confirmPassword || isLoading || !token}
              className="h-12 rounded-xl bg-foreground text-background font-semibold mt-2 flex items-center justify-center gap-2"
            >
              {isLoading && <Spinner color="current" size="sm" />}
              Update password
            </Button>
          </Form>
        </div>
      ) : (
        <div className="w-full flex flex-col items-center py-6 text-center">
          <div className="w-16 h-16 bg-success/10 flex items-center justify-center rounded-2xl mb-6">
            <ShieldCheck className="size-8 text-success" />
          </div>

          <Typography.Heading level={3} className="text-2xl font-bold pb-2 text-foreground">
            Password Updated
          </Typography.Heading>
          
          <Typography className="text-sm text-muted mb-8 max-w-sm">
            Your password credential has been rotated successfully. You are being navigated to your CVerify workspace...
          </Typography>

          <div className="w-8 h-8 border-2 border-t-foreground border-border rounded-full animate-spin" />
        </div>
      )}
    </Card>
  );
}

export function ResetPasswordView() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center p-8 min-h-[400px]">
        <div className="w-8 h-8 border-2 border-t-foreground border-border rounded-full animate-spin" />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
