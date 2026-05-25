"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/features/auth/hooks/use-auth';
import {
    Card, Typography, Button, TextField,
    InputGroup, Input, Form, Label, toast, Spinner
} from "@heroui/react";
import { Eye, EyeOff, LayoutTemplate, Sparkles } from 'lucide-react';
import { Suspense } from 'react';
import PasswordStrengthMeter from '../components/password-strength-meter';
import { evaluatePasswordStrength } from '../security/password-policy';

function WorkspaceSetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setupWorkspace } = useAuth();

  const email = searchParams.get('email') || '';
  const verificationToken = searchParams.get('token') || '';
  const callbackUrl = searchParams.get('callbackUrl') || '/';

  // State values
  const [workspaceName, setWorkspaceName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isVisible, setIsVisible] = useState(false);
  const [isConfirmVisible, setIsConfirmVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Realtime handles suggestions
  const [suggestions, setSuggestions] = useState<string[]>([]);

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
      candidates.add(`${domain}_workspace`);
      if (local) {
        candidates.add(`${domain}_${local}`);
      }
    } else if (local) {
      candidates.add(local);
      candidates.add(`${local}_workspace`);
    }
    
    const filteredCandidates = Array.from(candidates).filter(c => c.length >= 3 && c.length <= 30);
    const timer = setTimeout(() => {
      setSuggestions(filteredCandidates);
    }, 0);
    return () => clearTimeout(timer);
  }, [email]);

  const isWorkspaceInvalid = workspaceName.length > 0 && !workspaceName.match(/^[a-z0-9_]{3,30}$/);
  const isPasswordValid = evaluatePasswordStrength(password, "enterprise").percentage === 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceName || !password || !confirmPassword) return;
    if (isWorkspaceInvalid || !isPasswordValid || password !== confirmPassword) return;

    setIsLoading(true);
    const result = await setupWorkspace({
      verificationToken,
      companyEmail: email,
      organizationUsername: workspaceName,
      password,
      confirmPassword
    });
    setIsLoading(false);

    if (result.success) {
      toast.success("Workspace Established", {
        description: `Successfully provisioned company workspace: ${workspaceName}`
      });
      router.push(callbackUrl);
    } else {
      toast.danger("Setup Failed", {
        description: result.error?.message || "Failed to provision organization workspace."
      });
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
            Setup workspace
          </Typography.Heading>
          <Typography className="text-sm text-muted">
            Define your unique CVerify organization handle and workspace security.
          </Typography>
        </div>

        <Form className="w-full flex flex-col gap-5" onSubmit={handleSubmit}>
          <TextField isRequired name="workspaceName" isInvalid={isWorkspaceInvalid}>
            <Label className="text-sm font-medium text-foreground/80 pb-1">Workspace Handle</Label>
            <Input
              placeholder="e.g. fpt_software"
              className="h-12 text-sm lowercase"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            />
            {isWorkspaceInvalid && (
              <div className="text-left w-full mt-1">
                <span className="text-danger text-xs font-medium">Handle must be 3-30 lowercase alphanumeric or underscore characters.</span>
              </div>
            )}
          </TextField>

          {/* Realtime Suggestions */}
          {suggestions.length > 0 && (
            <div className="w-full -mt-2">
              <span className="text-[11px] font-semibold text-muted flex items-center gap-1 mb-2">
                <Sparkles className="size-3 text-warning animate-pulse" /> Suggested Workspace Handles
              </span>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setWorkspaceName(suggestion)}
                    className="text-[11px] font-semibold font-mono bg-surface-secondary hover:bg-surface-secondary/85 border border-border rounded-lg px-2.5 py-1 text-foreground/80 transition-colors cursor-pointer select-none"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          <TextField isRequired name="password" type="password">
            <Label className="text-sm font-medium text-foreground/80 pb-1">Workspace Password</Label>
            <InputGroup>
              <InputGroup.Input
                className="h-12"
                type={isVisible ? "text" : "password"}
                placeholder="Password (min 12 chars)"
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
              />
              <InputGroup.Suffix>
                <Button
                  isIconOnly
                  variant="ghost"
                  size="sm"
                  className="text-muted hover:bg-transparent"
                  onPress={() => setIsVisible(!isVisible)}
                >
                  {isVisible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                </Button>
              </InputGroup.Suffix>
            </InputGroup>
            <PasswordStrengthMeter value={password} policyId="enterprise" />
          </TextField>

          <TextField isRequired name="confirmPassword" type="password">
            <Label className="text-sm font-medium text-foreground/80 pb-1">Confirm Password</Label>
            <InputGroup>
              <InputGroup.Input
                className="h-12"
                type={isConfirmVisible ? "text" : "password"}
                placeholder="Repeat your password"
                value={confirmPassword}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
              />
              <InputGroup.Suffix>
                <Button
                  isIconOnly
                  variant="ghost"
                  size="sm"
                  className="text-muted hover:bg-transparent"
                  onPress={() => setIsConfirmVisible(!isConfirmVisible)}
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
            isDisabled={!workspaceName || isWorkspaceInvalid || !password || !isPasswordValid || password !== confirmPassword || isLoading}
            className="h-12 rounded-xl bg-foreground text-background font-semibold mt-2 flex items-center justify-center gap-2"
          >
            {isLoading && <Spinner color="current" size="sm" />}
            Provision workspace
          </Button>
        </Form>
      </div>
    </Card>
  );
}

export function WorkspaceSetupView() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center p-8 min-h-[400px]">
        <div className="w-8 h-8 border-2 border-t-foreground border-border rounded-full animate-spin" />
      </div>
    }>
      <WorkspaceSetupContent />
    </Suspense>
  );
}
