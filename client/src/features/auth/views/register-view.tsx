"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Typography, Button } from "@heroui/react";
import { Sparkles } from 'lucide-react';

export function RegisterView() {
  const router = useRouter();

  useEffect(() => {
    // SNAPPY redirect to unified sign-in flow after 1.5 seconds
    const timer = setTimeout(() => {
      router.push('/login');
    }, 1500);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <Card className="w-full bg-surface border border-border p-8 shadow-xl rounded-2xl text-center select-none">
      <div className="w-12 h-12 bg-surface-secondary flex items-center justify-center rounded-xl mb-6 mx-auto">
        <Sparkles className="size-6 text-foreground animate-pulse" />
      </div>

      <Typography.Heading level={3} className="text-2xl font-bold pb-2 text-foreground font-outfit">
        Unified Auth Flow
      </Typography.Heading>
      
      <Typography className="text-sm text-muted mb-6 max-w-xs mx-auto">
        We have consolidated our signup and signin experience into a secure, single-step &quot;Continue with Email&quot; flow.
      </Typography>

      <Button
        className="h-12 rounded-xl bg-foreground text-background font-semibold px-6"
        onPress={() => router.push('/login')}
      >
        Go to Unified Sign In
      </Button>
    </Card>
  );
}
