'use client';

import React, { Component, type ReactNode } from 'react';
import { Card, Skeleton, Chip, Tooltip } from '@heroui/react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Lock } from 'lucide-react';

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
    console.error('[DashboardWidgetWrapper] Widget rendering error:', error, errorInfo);
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
        <Card className="p-5 bg-surface border border-danger/30 rounded-2xl shadow-sm space-y-3">
          <div className="flex items-start justify-between gap-3 select-none">
            <div className="flex items-center gap-2 text-danger font-semibold text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{this.props.fallbackTitle || 'Widget Load Error'}</span>
            </div>
            {this.props.onRetry && (
              <Button
                size="sm"
                variant="flat"
                color="danger"
                onPress={this.handleRetry}
                className="cursor-pointer text-xs"
              >
                <RefreshCw className="w-3 h-3 mr-1" /> Retry
              </Button>
            )}
          </div>
          <p className="text-xs text-muted leading-relaxed">
            {this.state.error?.message || 'An unexpected error occurred while rendering this widget component.'}
          </p>
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
  error?: string | null;
  hasPermission?: boolean;
  badgeText?: string;
  badgeColor?: 'default' | 'accent' | 'success' | 'warning' | 'danger';
  headerActions?: React.ReactNode;
  onRefresh?: () => void;
  children: React.ReactNode;
  className?: string;
}

export function DashboardWidgetWrapper({
  title,
  subtitle,
  icon,
  isLoading = false,
  error = null,
  hasPermission = true,
  badgeText,
  badgeColor = 'default',
  headerActions,
  onRefresh,
  children,
  className = ''
}: DashboardWidgetWrapperProps) {
  if (!hasPermission) {
    return (
      <Card className={`p-6 bg-surface border border-border rounded-2xl shadow-sm opacity-75 ${className}`}>
        <div className="flex flex-col items-center justify-center py-6 text-center space-y-2 select-none">
          <div className="w-10 h-10 rounded-full bg-surface-secondary flex items-center justify-center text-muted">
            <Lock className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-bold text-foreground">Restricted Widget</h4>
          <p className="text-xs text-muted max-w-xs">
            You do not have the required administrative permission to view this widget.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <WidgetErrorBoundary fallbackTitle={title} onRetry={onRefresh}>
      <Card className={`p-6 bg-surface border border-border rounded-2xl shadow-sm space-y-4 ${className}`}>
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
                        {badgeText}
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
                      variant="light"
                      onPress={onRefresh}
                      className="cursor-pointer text-muted hover:text-foreground"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-accent' : ''}`} />
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

        {isLoading ? (
          <div className="space-y-3 py-2">
            <Skeleton className="h-6 w-3/4 rounded-lg bg-surface-secondary" />
            <Skeleton className="h-16 w-full rounded-xl bg-surface-secondary" />
            <Skeleton className="h-10 w-1/2 rounded-lg bg-surface-secondary" />
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-danger/10 border border-danger/20 text-danger space-y-2 select-none">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" /> Failed to load widget data
              </span>
              {onRefresh && (
                <Button size="sm" variant="flat" color="danger" onPress={onRefresh} className="text-xs cursor-pointer">
                  Retry
                </Button>
              )}
            </div>
            <p className="text-xs leading-relaxed opacity-90">{error}</p>
          </div>
        ) : (
          children
        )}
      </Card>
    </WidgetErrorBoundary>
  );
}
