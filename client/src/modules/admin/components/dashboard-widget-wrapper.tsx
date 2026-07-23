'use client';

import React, { Component, type ReactNode, useState } from 'react';
import { Card, Skeleton, Chip, Tooltip, Alert, Button } from '@heroui/react';
import { AlertTriangle, RefreshCw, Lock, Terminal, ShieldAlert } from 'lucide-react';
import { WidgetLifecycleState } from '../types/widget-lifecycle.types';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  onRetry?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class WidgetErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[DashboardWidgetWrapper] Rendering Exception:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <Card className="p-5 bg-surface border border-danger/40 rounded-2xl shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-danger font-bold text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{this.props.fallbackTitle || 'Widget Component Exception'}</span>
            </div>
            {this.props.onRetry && (
              <Button
                size="sm"
                variant="danger-soft"
                onPress={this.handleRetry}
                className="cursor-pointer text-xs"
              >
                <RefreshCw className="w-3 h-3 mr-1" /> Retry
              </Button>
            )}
          </div>
          <Alert color="danger" className="text-xs">
            {this.state.error?.message || 'An unexpected rendering error occurred inside this widget container.'}
          </Alert>
        </Card>
      );
    }

    return this.props.children;
  }
}

export interface DashboardWidgetWrapperProps {
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  isLoading?: boolean;
  isFetching?: boolean;
  error?: any;
  hasPermission?: boolean;
  badgeText?: string;
  badgeColor?: 'default' | 'accent' | 'success' | 'warning' | 'danger';
  headerActions?: React.ReactNode;
  onRefresh?: () => void;
  children: React.ReactNode;
  className?: string;
  lastUpdated?: string;
}

export function DashboardWidgetWrapper({
  title,
  subtitle,
  icon,
  isLoading = false,
  isFetching = false,
  error = null,
  hasPermission = true,
  badgeText,
  badgeColor = 'default',
  headerActions,
  onRefresh,
  children,
  className = '',
  lastUpdated
}: DashboardWidgetWrapperProps) {
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  // Derive Lifecycle State
  let lifecycleState = WidgetLifecycleState.Loaded;
  if (!hasPermission) {
    lifecycleState = WidgetLifecycleState.Offline;
  } else if (isLoading) {
    lifecycleState = WidgetLifecycleState.Loading;
  } else if (error) {
    lifecycleState = WidgetLifecycleState.Offline;
  } else if (isFetching) {
    lifecycleState = WidgetLifecycleState.Refreshing;
  }

  // Handle Restricted Permission
  if (!hasPermission) {
    return (
      <Card className={`p-6 bg-surface border border-border rounded-2xl shadow-sm opacity-80 ${className}`}>
        <div className="flex flex-col items-center justify-center py-6 text-center space-y-2 select-none">
          <div className="w-10 h-10 rounded-full bg-surface-secondary flex items-center justify-center text-muted">
            <Lock className="w-5 h-5 text-warning" />
          </div>
          <h4 className="text-sm font-bold text-foreground">Restricted Widget</h4>
          <p className="text-xs text-muted max-w-xs leading-relaxed">
            Administrative role claim required to access telemetry and analytics for this component.
          </p>
        </div>
      </Card>
    );
  }

  const fallbackId = useId();
  const errorMessage = error?.response?.data?.message || error?.message || (typeof error === 'string' ? error : null);
  const statusCode = error?.response?.status || 500;
  const correlationId = error?.response?.headers?.['x-correlation-id'] || 'corr-' + fallbackId.replace(/:/g, '');

  return (
    <WidgetErrorBoundary fallbackTitle={title} onRetry={onRefresh}>
      <Card className={`p-6 bg-surface border border-border rounded-2xl shadow-sm space-y-4 relative ${className}`}>
        {/* Refreshing Pulse Top Indicator */}
        {isFetching && !isLoading && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-accent/60 animate-pulse rounded-t-2xl" />
        )}

        {/* Card Header */}
        {(title || headerActions || badgeText || onRefresh) && (
          <div className="flex items-center justify-between gap-3 select-none border-b border-separator pb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              {icon && <div className="text-accent shrink-0">{icon}</div>}
              <div className="truncate">
                {title && (
                  <h3 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
                    {title}
                    {badgeText && (
                      <Chip size="sm" variant="soft" color={badgeColor} className="text-[10px] font-semibold h-5">
                        <Chip.Label>{badgeText}</Chip.Label>
                      </Chip>
                    )}
                    {lifecycleState === WidgetLifecycleState.Refreshing && (
                      <Chip size="sm" variant="soft" color="accent" className="text-[9px] font-bold h-4">
                        <Chip.Label>Refreshing...</Chip.Label>
                      </Chip>
                    )}
                  </h3>
                )}
                {subtitle && <p className="text-xs text-muted truncate mt-0.5">{subtitle}</p>}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {headerActions}
              {onRefresh && (
                <Tooltip delay={0}>
                  <Tooltip.Trigger>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="ghost"
                      onPress={onRefresh}
                      className="cursor-pointer text-muted hover:text-foreground"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-accent' : ''}`} />
                    </Button>
                  </Tooltip.Trigger>
                  <Tooltip.Content className="bg-surface border border-border p-2 shadow-md rounded-lg text-xs text-foreground">
                    Refresh widget data
                  </Tooltip.Content>
                </Tooltip>
              )}
            </div>
          </div>
        )}

        {/* Lifecycle State Content Handling */}
        {isLoading ? (
          <div className="space-y-3 py-2 select-none">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl bg-surface-secondary" />
              <div className="space-y-1 flex-1">
                <Skeleton className="h-4 w-1/3 rounded-md bg-surface-secondary" />
                <Skeleton className="h-3 w-1/2 rounded-md bg-surface-secondary" />
              </div>
            </div>
            <Skeleton className="h-20 w-full rounded-2xl bg-surface-secondary" />
            <div className="grid grid-cols-3 gap-2">
              <Skeleton className="h-8 rounded-lg bg-surface-secondary" />
              <Skeleton className="h-8 rounded-lg bg-surface-secondary" />
              <Skeleton className="h-8 rounded-lg bg-surface-secondary" />
            </div>
          </div>
        ) : error ? (
          <div className="space-y-3 select-none">
            <Alert color="danger" className="p-4 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold flex items-center gap-1.5 text-danger">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>Failed to load widget data (HTTP {statusCode})</span>
                </span>
                {onRefresh && (
                  <Button size="sm" variant="danger-soft" onPress={onRefresh} className="text-xs cursor-pointer h-7">
                    Retry Now
                  </Button>
                )}
              </div>
              <p className="text-xs text-foreground/90 leading-relaxed">
                {errorMessage || 'Operational error preventing backend database aggregation.'}
              </p>
            </Alert>

            {/* Diagnostic Drawer Toggle */}
            <div className="pt-1">
              <Button
                size="sm"
                variant="ghost"
                onPress={() => setShowDiagnostics(!showDiagnostics)}
                className="text-[11px] font-semibold text-muted hover:text-foreground cursor-pointer h-6 px-1"
              >
                <Terminal className="w-3 h-3 mr-1" />
                {showDiagnostics ? 'Hide Diagnostics' : 'Show Diagnostic Info'}
              </Button>

              {showDiagnostics && (
                <Card className="mt-2 p-3 bg-surface-secondary border border-border text-[11px] font-mono space-y-1 text-muted rounded-xl">
                  <div><strong className="text-foreground">Widget ID:</strong> {title || 'widget'}</div>
                  <div><strong className="text-foreground">Correlation ID:</strong> {correlationId}</div>
                  <div><strong className="text-foreground">Status Code:</strong> {statusCode}</div>
                  <div><strong className="text-foreground">Timestamp:</strong> {new Date().toISOString()}</div>
                </Card>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {children}
            {lastUpdated && (
              <div className="text-[10px] text-muted text-right select-none pt-1">
                Data fresh as of {lastUpdated}
              </div>
            )}
          </div>
        )}
      </Card>
    </WidgetErrorBoundary>
  );
}
