"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RotateCcw, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  sceneId: string;
  onSkip?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class SceneErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[SceneErrorBoundary] Caught crash in Scene ID "${this.props.sceneId}":`, error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-8 bg-surface/30 backdrop-blur-md rounded-2xl border border-danger/20 max-w-md mx-auto my-auto text-center gap-6 shadow-2xl">
          <div className="p-4 bg-danger/10 text-danger rounded-full">
            <AlertTriangle className="h-10 w-10" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-foreground">Scene Render Error</h3>
            <p className="text-xs text-muted max-w-sm">
              An error occurred while loading this interactive showcase. You can try reloading it, or skip to the next section.
            </p>
            {this.state.error && (
              <pre className="text-[10px] p-2 bg-black/40 text-danger-400 rounded-md overflow-x-auto text-left max-h-24 select-text">
                {this.state.error.message}
              </pre>
            )}
          </div>
          <div className="flex items-center gap-3 w-full">
            <Button
              size="sm"
              variant="outline"
              onPress={this.handleReset}
              className="flex-1 text-xs border-border hover:bg-surface-secondary cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5 inline" />
              Retry
            </Button>
            {this.props.onSkip && (
              <Button
                size="sm"
                variant="danger"
                onPress={this.props.onSkip}
                className="flex-1 text-xs cursor-pointer"
              >
                Skip Scene
                <ArrowRight className="h-3.5 w-3.5 ml-1.5 inline" />
              </Button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
