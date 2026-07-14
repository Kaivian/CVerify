"use client";

import React from 'react';
import { AlertTriangle, RefreshCcw, FolderOpen } from 'lucide-react';
import { Skeleton, Typography } from '@heroui/react';
import { Button } from './button';

// SKELETON TABLE ROW LOADER
interface SkeletonLoaderProps {
  rows?: number;
  columns?: number;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  rows = 5,
  columns = 5,
}) => {
  return (
    <div className="w-full space-y-4 p-5 select-none pointer-events-none">
      {/* Table Header skeleton */}
      <div className="flex items-center gap-4 py-2 border-b border-separator">
        {Array.from({ length: columns }).map((_, idx) => (
          <Skeleton key={`h-${idx}`} className="h-4 rounded-lg flex-1" />
        ))}
      </div>
      {/* Table Body rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={`r-${rowIdx}`}
          className="flex items-center gap-4 py-4 border-b border-separator"
        >
          {Array.from({ length: columns }).map((_, colIdx) => (
            <Skeleton
              key={`c-${rowIdx}-${colIdx}`}
              className="h-3 rounded-lg flex-1"
              style={{
                width: colIdx === 0 ? "75%" : colIdx === columns - 1 ? "50%" : "100%"
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

// PREMIER EMPTY DIRECTORY STATE
interface EmptyStateProps {
  title: string;
  description: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  action,
}) => {
  return (
    <div className="flex flex-col items-center justify-center text-center p-12 md:p-20 max-w-md mx-auto select-none">
      <div className="size-16 rounded-2xl bg-accent/10 flex items-center justify-center border border-accent/20 mb-5 text-accent">
        <FolderOpen size={28} />
      </div>
      <Typography type="h4" className="font-bold text-foreground mb-2">
        {title}
      </Typography>
      <Typography type="body-xs" className="text-muted leading-relaxed mb-6 select-text text-center">
        {description}
      </Typography>
      {action && <div className="flex justify-center">{action}</div>}
    </div>
  );
};

// PREMIER DATA FETCH ERROR / DISCONNECT STATE
interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  message,
  onRetry,
}) => {
  return (
    <div className="flex flex-col items-center justify-center text-center p-12 md:p-20 max-w-md mx-auto select-none">
      <div className="size-16 rounded-2xl bg-danger/10 flex items-center justify-center border border-danger/20 mb-5 text-danger">
        <AlertTriangle size={28} className="animate-pulse" />
      </div>
      <Typography type="h4" className="font-bold text-foreground mb-2">
        Database Synchronization Failure
      </Typography>
      <Typography type="body-xs" className="text-muted leading-relaxed mb-6 select-text">
        {message || "We encountered a network timeout while attempting to update your administrative data feeds."}
      </Typography>
      {onRetry && (
        <Button
          variant="solid"
          onClick={onRetry}
          className="flex items-center gap-2"
        >
          <RefreshCcw size={14} />
          Retry Connection
        </Button>
      )}
    </div>
  );
};

const States = {
  SkeletonLoader,
  EmptyState,
  ErrorState,
};

export default States;
