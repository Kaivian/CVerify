'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/features/auth/hooks/use-auth';
import {
  Card, Typography, Button, TextField,
  Input, Form, Label, toast, Spinner, InputGroup
} from '@heroui/react';
import { LayoutTemplate, Sparkles, Eye, EyeOff } from 'lucide-react';
import PasswordStrengthMeter from '../components/password-strength-meter';
import { evaluatePasswordStrength } from '../security/password-policy';

function CompanySetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setupWorkspace } = useAuth(); // The API action in useAuth still maps to setupWorkspace on the backend, which we keep unchanged for endpoint/auth helper compatibility.

  const email = searchParams.get('email') || '';
  const verificationToken = searchParams.get('token') || '';

  // State values
  const [companyHandle, setCompanyHandle] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const [isConfirmVisible, setIsConfirmVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Realtime handles suggestions
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Route entry parameter validation
  useEffect(() => {
    if (!verificationToken || !email) {
      toast.danger('Access Denied', {
        description: 'Invalid or missing company setup session.',
      });
      router.replace('/company-verification');
    }
  }, [verificationToken, email, router]);

  useEffect(() => {
    if (!email) return;
    
    // Generate handles based on email domain and local part
    const parts = email.split('@');
    const local = parts[0].replace(/[^a-z0-9_]/g, '');
    const domainParts = parts[1].split('.');
    const domain = domainParts[0].replace(/[^a-z0-9_]/g, '');
    
    const candidates = new Set<string>();
    if (domain && domain !== 'gmail' && domain !== 'yahoo' && domain !== 'outlook') {
      candidates.add(domain);
      candidates.add(`${domain}_company`);
      if (local) {
        candidates.add(`${domain}_${local}`);
      }
    } else if (local) {
      candidates.add(local);
      candidates.add(`${local}_company`);
    }
    
    const filteredCandidates = Array.from(candidates).filter(c => c.length >= 3 && c.length <= 30);
    const timer = setTimeout(() => {
      setSuggestions(filteredCandidates);
    }, 0);
    return () => clearTimeout(timer);
  }, [email]);

  const isHandleInvalid = companyHandle.length > 0 && !companyHandle.match(/^[a-z0-9_]{3,30}$/);
  const isPasswordValid = evaluatePasswordStrength(password, 'default').percentage === 100;
  const isPasswordsMatch = password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyHandle || isHandleInvalid) return;
    if (!password || !isPasswordValid) return;
    if (!isPasswordsMatch) {
      toast.danger('Mismatch', { description: 'Passwords do not match.' });
      return;
    }

    setIsLoading(true);
    const result = await setupWorkspace({
      verificationToken,
      companyEmail: email,
      organizationUsername: companyHandle,
      password,
      confirmPassword
    });
    setIsLoading(false);

    if (result.success) {
      toast.success('Company created successfully', {
        description: 'Please sign in or create an account to claim ownership.',
      });
      router.replace(`/login?email=${encodeURIComponent(email)}`);
    } else {
      const isExpired = result.error?.code === 'TOKEN_EXPIRED' || result.error?.message?.toLowerCase().includes('expired');
      if (isExpired) {
        toast.danger('Session Expired', {
          description: 'Your company setup token has expired. Please restart the onboarding process.',
        });
        setCompanyHandle('');
        router.replace('/company-verification');
      } else {
        toast.danger('Setup Failed', {
          description: result.error?.message || 'Failed to provision company organization.',
        });
      }
    }
  };

  return (
    <Card className="w-full bg-surface border border-border p-8 shadow-xl rounded-2xl">
      <div className="w-full flex flex-col items-center">
        <div className="w-12 h-12 bg-surface-secondary flex items-center justify-center rounded-xl mb-6">
          <LayoutTemplate className="size-6 text-foreground" />
        </div>

        <div className="text-center w-full mb-8">
          <Typography.Heading level={3} className="text-2xl font-bold pb-2 text-foreground">
            Company Setup
          </Typography.Heading>
          <Typography className="text-sm text-muted">
            Define your unique CVerify business handle and company security credentials.
          </Typography>
        </div>

        <Form className="w-full flex flex-col gap-5" onSubmit={handleSubmit}>
          {/* Descriptive Disclaimer */}
          <div className="p-3.5 bg-surface-secondary border border-border rounded-xl text-xs text-muted leading-relaxed">
            <strong className="text-foreground font-semibold block mb-0.5">Company Credentials:</strong>
            This password establishes credentials for the Company login page (using handle + password). The ownership verification email is only used as a contact to automatically bootstrap admin permissions on registration, and is not a company user account or authenticated identity.
          </div>

          <TextField isRequired name="companyHandle" isInvalid={isHandleInvalid}>
            <Label className="text-sm font-medium text-foreground/80 pb-1">Business Handle</Label>
            <Input
              placeholder="e.g. fpt_software"
              className="h-12 text-sm lowercase"
              value={companyHandle}
              onChange={(e) => setCompanyHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            />
            {isHandleInvalid && (
              <div className="text-left w-full mt-1">
                <span className="text-danger text-xs font-medium">Handle must be 3-30 lowercase alphanumeric or underscore characters.</span>
              </div>
            )}
          </TextField>

          {/* Realtime Suggestions */}
          {suggestions.length > 0 && (
            <div className="w-full -mt-2">
              <span className="text-[11px] font-semibold text-muted flex items-center gap-1 mb-2">
                <Sparkles className="size-3 text-warning animate-pulse" /> Suggested Business Handles
              </span>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setCompanyHandle(suggestion)}
                    className="text-[11px] font-semibold font-mono bg-surface-secondary hover:bg-surface-secondary/85 border border-border rounded-lg px-2.5 py-1 text-foreground/80 transition-colors cursor-pointer select-none"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Password fields */}
          <TextField isRequired name="password" type="password">
            <Label className="text-sm font-medium text-foreground/80 pb-1">Company Password</Label>
            <InputGroup>
              <InputGroup.Input
                className="h-12 text-sm"
                type={isVisible ? 'text' : 'password'}
                placeholder="Company password (min 8 chars)"
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                disabled={isLoading}
              />
              <InputGroup.Suffix>
                <Button
                  isIconOnly
                  variant="ghost"
                  size="sm"
                  className="text-muted hover:bg-transparent"
                  onPress={() => setIsVisible(!isVisible)}
                  isDisabled={isLoading}
                >
                  {isVisible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                </Button>
              </InputGroup.Suffix>
            </InputGroup>
            <PasswordStrengthMeter value={password} policyId="default" />
          </TextField>

          <TextField isRequired name="confirmPassword" type="password">
            <Label className="text-sm font-medium text-foreground/80 pb-1">Confirm Company Password</Label>
            <InputGroup>
              <InputGroup.Input
                className="h-12 text-sm"
                type={isConfirmVisible ? 'text' : 'password'}
                placeholder="Repeat company password"
                value={confirmPassword}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
              />
              <InputGroup.Suffix>
                <Button
                  isIconOnly
                  variant="ghost"
                  size="sm"
                  className="text-muted hover:bg-transparent"
                  onPress={() => setIsConfirmVisible(!isConfirmVisible)}
                  isDisabled={isLoading}
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
            isDisabled={!companyHandle || isHandleInvalid || !password || !isPasswordValid || !isPasswordsMatch || isLoading}
            className="h-12 rounded-xl bg-foreground text-background font-semibold mt-2 flex items-center justify-center gap-2"
          >
            {isLoading && <Spinner color="current" size="sm" />}
            Create Company
          </Button>
        </Form>
      </div>
    </Card>
  );
}

export function CompanySetupView() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center p-8 min-h-[400px]">
        <div className="w-8 h-8 border-2 border-t-foreground border-border rounded-full animate-spin" />
      </div>
    }>
      <CompanySetupContent />
    </Suspense>
  );
}
export default CompanySetupView;
