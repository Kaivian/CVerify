"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { authApi } from '@/features/auth/services/auth.service';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useAuthStore } from '@/features/auth/store/use-auth-store';
import Link from 'next/link';
import {
  ShieldCheck,
  ShieldAlert,
  Mail,
  ChevronLeft,
  RefreshCw
} from 'lucide-react';
import {
    Card, Typography, Button, TextField, Input, toast, Spinner, Form, Label
} from "@heroui/react";
import { Suspense } from 'react';

type VerifyState = 'pending' | 'verifying' | 'success' | 'failed' | 'expired';

interface AxiosErrorLike {
  response?: {
    data?: {
      message?: string;
    };
  };
}

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  const emailFromUrl = searchParams.get('email');
  const effectRan = useRef(false);
  const { verifyEmail } = useAuth();
  const { pendingVerificationEmail, user } = useAuthStore();

  const targetEmail = pendingVerificationEmail || emailFromUrl || '';

  const [state, setState] = useState<VerifyState>(token ? 'verifying' : 'pending');
  const [errorMessage, setErrorMessage] = useState("");
  const [emailInput, setEmailInput] = useState(targetEmail || user?.email || '');
  const [showManualForm, setShowManualForm] = useState(!targetEmail);
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    const activeEmail = targetEmail || user?.email || '';
    if (activeEmail) {
      const timer = setTimeout(() => {
        setEmailInput(activeEmail);
        if (showManualForm && pendingVerificationEmail) {
          setShowManualForm(false);
        }
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [user, targetEmail, showManualForm, pendingVerificationEmail]);

  useEffect(() => {
    if (!token) return;
    if (effectRan.current) return;

    const verify = async () => {
      const result = await verifyEmail(token);
      if (result.success) {
        setState('success');
        toast.success("Email Verified", {
          description: "Your CVerify email verification is complete."
        });

        setTimeout(() => {
          router.push('/');
        }, 2000);
      } else {
        const error = result.error;
        if (error?.code === 'AUTH_EXPIRED_TOKEN') {
          setState('expired');
        } else {
          setState('failed');
        }
        setErrorMessage(error?.message || "Verification failed. The token is invalid.");
        toast.danger("Verification Failed");
      }
    };

    verify();
    effectRan.current = true;
  }, [token, verifyEmail, router]);

  const onResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput) return;

    setResendLoading(true);
    try {
      await authApi.resendVerification(emailInput);
      toast.success("Verification Link Sent", {
        description: `Please check ${emailInput} for your new verification link.`
      });
      setState('pending');
    } catch (err) {
      const error = err as AxiosErrorLike;
      toast.danger("Resend Failed", {
        description: error.response?.data?.message || "Could not resend the link."
      });
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <Card className="w-full bg-surface border border-border p-8 shadow-xl rounded-2xl">
      {state === 'verifying' && (
        <div className="w-full flex flex-col items-center py-8 text-center select-none">
          <RefreshCw className="size-10 text-muted animate-spin mb-6" />
          <Typography.Heading level={3} className="text-xl font-bold pb-2 text-foreground">
            Verifying email...
          </Typography.Heading>
          <Typography className="text-sm text-muted">
            Completing cryptographic email address validation.
          </Typography>
        </div>
      )}

      {state === 'success' && (
        <div className="w-full flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-success/10 flex items-center justify-center rounded-2xl mb-6">
            <ShieldCheck className="size-8 text-success" />
          </div>

          <Typography.Heading level={3} className="text-2xl font-bold pb-2 text-foreground">
            Verification Successful
          </Typography.Heading>
          
          <Typography className="text-sm text-muted mb-8 max-w-sm">
            Email ownership proven successfully. You are being redirected to your dashboard...
          </Typography>

          <div className="w-8 h-8 border-2 border-t-foreground border-border rounded-full animate-spin" />
        </div>
      )}

      {state === 'expired' && (
        <div className="w-full flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-danger/10 flex items-center justify-center rounded-2xl mb-6">
            <ShieldAlert className="size-8 text-danger" />
          </div>

          <Typography.Heading level={3} className="text-2xl font-bold pb-2 text-foreground">
            Verification Expired
          </Typography.Heading>
          
          <Typography className="text-sm text-muted mb-8 max-w-sm">
            Your verification token has expired. Request a new link to activate your profile.
          </Typography>

          <div className="flex gap-4 w-full">
            <Button
              variant="secondary"
              fullWidth
              className="h-12 rounded-xl text-foreground/80"
              onPress={() => router.push('/login')}
            >
              Back to Login
            </Button>
            <Button
              fullWidth
              className="h-12 rounded-xl bg-foreground text-background font-semibold"
              onPress={() => {
                setState('pending');
                setShowManualForm(true);
              }}
            >
              Request new link
            </Button>
          </div>
        </div>
      )}

      {state === 'failed' && (
        <div className="w-full flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-danger/10 flex items-center justify-center rounded-2xl mb-6">
            <ShieldAlert className="size-8 text-danger" />
          </div>

          <Typography.Heading level={3} className="text-2xl font-bold pb-2 text-foreground">
            Verification Failed
          </Typography.Heading>
          
          <Typography className="text-sm text-muted mb-8 max-w-xs">
            {errorMessage}
          </Typography>

          <div className="flex gap-4 w-full">
            <Button
              variant="secondary"
              fullWidth
              className="h-12 rounded-xl text-foreground/80"
              onPress={() => router.push('/login')}
            >
              Back to Login
            </Button>
            <Button
              fullWidth
              className="h-12 rounded-xl bg-foreground text-background font-semibold"
              onPress={() => {
                setState('pending');
                setShowManualForm(true);
              }}
            >
              Request new link
            </Button>
          </div>
        </div>
      )}

      {state === 'pending' && (
        <div className="w-full flex flex-col items-center select-none font-outfit">
          <div className="w-12 h-12 bg-surface-secondary flex items-center justify-center rounded-xl mb-6">
            <Mail className="size-6 text-foreground" />
          </div>

          <div className="text-center w-full mb-8">
            <Typography.Heading level={3} className="text-2xl font-bold pb-2 text-foreground">
              Verify your email
            </Typography.Heading>
            <Typography className="text-sm text-muted">
              Please click the link sent to your email address to complete verification.
            </Typography>
          </div>

          {emailInput && !showManualForm && (
            <div className="w-full bg-surface-secondary border border-border rounded-xl p-5 mb-6 text-center animate-scale-up">
              <span className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">Sent to Address</span>
              <span className="text-sm font-bold text-foreground/80 block truncate">{emailInput}</span>
            </div>
          )}

          <Form className="w-full flex flex-col gap-4" onSubmit={onResend}>
            {showManualForm && (
              <TextField isRequired name="email">
                <Label className="text-sm font-medium text-foreground/80 pb-1">Email Address</Label>
                <Input
                  type="email"
                  placeholder="name@example.com"
                  className="h-12"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                />
              </TextField>
            )}

            <Button
              type="submit"
              fullWidth
              isPending={resendLoading}
              isDisabled={!emailInput || resendLoading}
              className="h-12 rounded-xl bg-foreground text-background font-semibold flex items-center justify-center gap-2"
            >
              {resendLoading && <Spinner color="current" size="sm" />}
              Resend verification link
            </Button>
          </Form>

          <div className="text-center text-xs font-medium text-muted pt-6 flex flex-col gap-3">
            {emailInput && !showManualForm && (
              <button
                type="button"
                onClick={() => setShowManualForm(true)}
                className="font-semibold text-foreground hover:underline cursor-pointer bg-transparent border-0"
              >
                Use a different email address
              </button>
            )}

            {showManualForm && targetEmail && (
              <button
                type="button"
                onClick={() => {
                  setShowManualForm(false);
                  setEmailInput(targetEmail);
                }}
                className="font-semibold text-foreground hover:underline cursor-pointer bg-transparent border-0 inline-flex items-center justify-center gap-1.5"
              >
                <ChevronLeft size={14} /> Back to sent info
              </button>
            )}

            <div>
              Already verified?{" "}
              <Link href="/login" className="font-semibold text-foreground hover:underline">
                Sign In
              </Link>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

export function VerifyEmailView() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center p-8 min-h-[400px]">
        <div className="w-8 h-8 border-2 border-t-foreground border-border rounded-full animate-spin" />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
