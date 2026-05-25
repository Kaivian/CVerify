"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { Card, Typography, Button, toast } from "@heroui/react";
import { ShieldAlert, ShieldCheck, RefreshCw } from 'lucide-react';
import { Suspense } from 'react';

function VerifyLinkContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { verifyCompanyLink } = useAuth();

  const token = searchParams.get('token') || '';

  // Processing state
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [companyDetails, setCompanyDetails] = useState<{
    companyName: string;
    taxCode: string;
    companyEmail: string;
    verificationToken: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!token) {
      const timer = setTimeout(() => {
        setStatus('error');
        setErrorMessage("No token provided. Please check the authorization link sent to your email.");
      }, 0);
      return () => clearTimeout(timer);
    }

    const runVerification = async () => {
      const result = await verifyCompanyLink(token);
      if (result.success && result.data) {
        setCompanyDetails(result.data);
        setStatus('success');
        toast.success("Authorization Verified", {
          description: "Company ownership proven successfully."
        });
      } else {
        setStatus('error');
        setErrorMessage(result.error?.message || "Verification link is invalid, expired, or already consumed.");
        toast.danger("Verification Failed");
      }
    };

    runVerification();
  }, [token, verifyCompanyLink]);

  const handleProceedToWorkspace = () => {
    if (!companyDetails) return;
    const query = new URLSearchParams({
      email: companyDetails.companyEmail,
      token: companyDetails.verificationToken
    }).toString();
    router.push(`/workspace-setup?${query}`);
  };

  return (
    <Card className="w-full bg-surface border border-border p-8 shadow-xl rounded-2xl">
      {status === 'verifying' && (
        <div className="w-full flex flex-col items-center py-8 text-center">
          <RefreshCw className="size-10 text-muted animate-spin mb-6" />
          <Typography.Heading level={3} className="text-xl font-bold pb-2 text-foreground">
            Verifying link...
          </Typography.Heading>
          <Typography className="text-sm text-muted">
            Cryptographically validating company ownership authorization.
          </Typography>
        </div>
      )}

      {status === 'success' && companyDetails && (
        <div className="w-full flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-success/10 flex items-center justify-center rounded-2xl mb-6">
            <ShieldCheck className="size-8 text-success" />
          </div>

          <Typography.Heading level={3} className="text-2xl font-bold pb-2 text-foreground">
            Verification Successful
          </Typography.Heading>
          
          <Typography className="text-sm text-muted mb-8 max-w-sm">
            Company ownership has been proven. You are authorized to setup the company workspace.
          </Typography>

          <div className="w-full bg-surface-secondary border border-border rounded-xl p-5 mb-8 text-left space-y-3 font-outfit">
            <div>
              <span className="text-xs font-semibold uppercase text-muted block">Company Name</span>
              <span className="text-sm font-bold text-foreground/80">{companyDetails.companyName}</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs font-semibold uppercase text-muted block">Tax Code</span>
                <span className="text-sm font-bold text-foreground/80">{companyDetails.taxCode}</span>
              </div>
              <div>
                <span className="text-xs font-semibold uppercase text-muted block">Verified Email</span>
                <span className="text-sm font-bold text-foreground/80 truncate block">{companyDetails.companyEmail}</span>
              </div>
            </div>
          </div>

          <Button
            fullWidth
            className="h-12 rounded-xl bg-foreground text-background font-semibold"
            onPress={handleProceedToWorkspace}
          >
            Set Up Workspace
          </Button>
        </div>
      )}

      {status === 'error' && (
        <div className="w-full flex flex-col items-center text-center py-4">
          <div className="w-16 h-16 bg-danger/10 flex items-center justify-center rounded-2xl mb-6">
            <ShieldAlert className="size-8 text-danger" />
          </div>

          <Typography.Heading level={3} className="text-2xl font-bold pb-2 text-foreground">
            Authorization Failed
          </Typography.Heading>
          
          <Typography className="text-sm text-muted mb-8 max-w-xs">
            {errorMessage}
          </Typography>

          <Button
            variant="secondary"
            className="h-12 rounded-xl text-foreground/80 px-6"
            onPress={() => router.push('/login')}
          >
            Back to Sign In
          </Button>
        </div>
      )}
    </Card>
  );
}

export function CompanyOnboardingVerifyView() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center p-8 min-h-[400px]">
        <div className="w-8 h-8 border-2 border-t-foreground border-border rounded-full animate-spin" />
      </div>
    }>
      <VerifyLinkContent />
    </Suspense>
  );
}
