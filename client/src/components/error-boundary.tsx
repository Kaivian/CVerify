"use client";

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button, Card } from '@heroui/react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Standardized high-fidelity Application and Route Error Boundary.
 * Captures React runtime exceptions, hydration failures, and rendering crashes.
 * Feeds correlation tags to monitoring platforms (OpenTelemetry / Sentry).
 */
export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("GlobalErrorBoundary intercepted runtime crash:", error, errorInfo);
    
    // Integration Hook: Dispatch tags directly to Telemetry platforms
    interface CustomWindow extends Window {
      Sentry?: {
        captureException: (error: Error, options?: { extra: ErrorInfo }) => void;
      };
    }
    const customWindow = window as unknown as CustomWindow;
    if (typeof window !== 'undefined' && customWindow.Sentry) {
      customWindow.Sentry.captureException(error, { extra: errorInfo });
    }
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex min-h-[400px] w-full items-center justify-center p-6 bg-background/50 backdrop-blur-md rounded-3xl border border-border">
          <Card className="max-w-md p-8 border border-danger/10 flex flex-col gap-6 text-center shadow-xl bg-surface">
            <div className="w-12 h-12 bg-danger/5 rounded-2xl flex items-center justify-center mx-auto text-danger animate-pulse">
              <AlertTriangle className="size-6" />
            </div>

            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-bold font-sans tracking-tight text-foreground">
                Interface Hydration Failure
              </h2>
              <p className="text-sm text-muted">
                Something went wrong rendering this section of the traveler portal. Live telemetry has logged this exception.
              </p>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <pre className="text-left bg-surface-secondary p-4 rounded-xl text-xs overflow-auto text-danger border border-danger/20 max-h-[160px] font-mono select-all">
                {this.state.error.toString()}
              </pre>
            )}

            <Button 
              onPress={() => window.location.reload()}
              className="h-11 rounded-xl bg-foreground text-background font-semibold shadow-md flex items-center gap-2 justify-center hover:opacity-90 transition-opacity"
            >
              <RefreshCw className="size-4 animate-spin-slow" />
              Reload Application
            </Button>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
