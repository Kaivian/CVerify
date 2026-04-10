"use client";

import React, { Component, ErrorInfo, ReactNode, useState } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { OtpInput } from "../ui/otp-input";
import { AlertCircle, RotateCcw, Smartphone, Tablet, Monitor } from "lucide-react";

// ============================================================================
// 1. Safe Error Boundary for Live Component Sandbox Previews
// ============================================================================
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class PreviewErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[Sandbox Execution Error]:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 rounded-2xl bg-danger/10 border-2 border-dashed border-danger/30 text-danger space-y-4">
          <div className="flex items-center gap-3">
            <AlertCircle size={24} className="shrink-0 animate-bounce" />
            <h4 className="font-bold text-base font-outfit">Sandbox Execution Failure</h4>
          </div>
          <p className="text-xs font-mono bg-background/50 p-3 rounded-lg border border-danger/25 select-text overflow-x-auto max-h-32">
            {this.state.error?.toString()}
          </p>
          <Button variant="danger" size="sm" onClick={this.handleReset} className="cursor-pointer">
            <RotateCcw size={14} className="mr-1.5" />
            Reset Container
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

// ============================================================================
// 2. Mock Interactive Wrapper Providers (Translators / Routers)
// ============================================================================
const MockSandboxProviders: React.FC<{ children: ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

// ============================================================================
// 3. Interactive Mock Previews definitions
// ============================================================================
interface PreviewProps {
  componentId: string;
  theme: "light" | "dark" | "high-contrast";
}

const ButtonPreview: React.FC = () => {
  const [clickCount, setClickCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const triggerLoading = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 2000);
  };

  return (
    <div className="flex flex-col gap-6 items-center p-4">
      <div className="flex flex-wrap gap-4 justify-center items-center">
        <Button variant="solid" onClick={() => setClickCount(c => c + 1)}>
          Solid Action ({clickCount})
        </Button>
        
        <Button variant="bordered" onClick={() => setClickCount(c => c + 1)}>
          Outline Bordered
        </Button>

        <Button variant="secondary" onClick={() => setClickCount(c => c + 1)}>
          Secondary Flat
        </Button>

        <Button variant="danger" onClick={() => setClickCount(c => c + 1)}>
          Danger Action
        </Button>
      </div>

      <div className="flex flex-wrap gap-4 justify-center items-center border-t border-border/30 pt-4 w-full">
        <Button variant="solid" isLoading={isLoading} onClick={triggerLoading}>
          {isLoading ? "Processing..." : "Trigger Async Operation"}
        </Button>

        <Button variant="solid" disabled>
          Disabled State
        </Button>
      </div>
    </div>
  );
};

const CardPreview: React.FC = () => {
  const [isGlowing, setIsGlowing] = useState(true);

  return (
    <div className="flex flex-col gap-6 items-center p-4 w-full max-w-md mx-auto">
      <Button variant="outline" size="sm" onClick={() => setIsGlowing(!isGlowing)} className="self-end">
        Toggle Glow Effects
      </Button>

      <Card glow={isGlowing} className="w-full">
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-extrabold uppercase bg-accent/15 text-accent px-2 py-0.5 rounded-md border border-accent/20">
              Atom Block
            </span>
            <span className="text-xs text-muted">stable</span>
          </div>
          <h3 className="text-lg font-bold text-foreground">Interactive Card</h3>
          <p className="text-xs text-muted leading-relaxed">
            This card is rendering live inside the visual sandbox container. Hover to inspect depth animations and glowing linear offsets.
          </p>
          <div className="border-t border-border/30 pt-3 flex justify-between items-center text-xs text-muted">
            <span>Dependency Risk: 1</span>
            <span>Usage Count: 28</span>
          </div>
        </div>
      </Card>
    </div>
  );
};

const OtpInputPreview: React.FC = () => {
  const [otp, setOtp] = useState("");
  const [isInvalid, setIsInvalid] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleOtpChange = (val: string) => {
    setOtp(val);
    setIsInvalid(false);
    setIsSuccess(false);

    if (val.length === 6) {
      if (val === "123456") {
        setIsSuccess(true);
      } else {
        setIsInvalid(true);
      }
    }
  };

  return (
    <div className="flex flex-col gap-6 items-center p-4 max-w-sm mx-auto text-center">
      <div className="space-y-1">
        <h4 className="font-semibold text-sm text-foreground">Mock Multi-Factor Challenge</h4>
        <p className="text-xs text-muted">Enter verification digits (try code "123456" for success state)</p>
      </div>

      <OtpInput
        value={otp}
        onChange={handleOtpChange}
        isInvalid={isInvalid}
        length={6}
      />

      <div className="h-6">
        {isSuccess && (
          <span className="text-xs text-success font-semibold border border-success/20 bg-success/10 px-2.5 py-1 rounded-lg">
            MFA Challenge Verified Successfully
          </span>
        )}
        {isInvalid && (
          <span className="text-xs text-danger font-semibold border border-danger/20 bg-danger/10 px-2.5 py-1 rounded-lg">
            Invalid Verification Code. Please try again.
          </span>
        )}
      </div>

      <Button
        variant="bordered"
        size="sm"
        onClick={() => {
          setOtp("");
          setIsInvalid(false);
          setIsSuccess(false);
        }}
      >
        Clear Fields
      </Button>
    </div>
  );
};

const FallbackComponentPreview: React.FC<{ name: string }> = ({ name }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center text-muted select-none min-h-[140px]">
      <div className="w-12 h-12 rounded-xl bg-surface-secondary border border-border flex items-center justify-center mb-3">
        <Smartphone size={20} className="opacity-60" />
      </div>
      <p className="text-sm font-semibold">{name} Layout Preview Mode</p>
      <p className="text-xs text-muted max-w-xs mt-1">
        This high-level component handles structural route layouts and cannot be isolated inline. Inspect its dependencies in the composition graph.
      </p>
    </div>
  );
};

// ============================================================================
// 4. Primary Preview Sandbox Wrapper Frame
// ============================================================================
interface PreviewSandboxProps {
  componentId: string;
  theme: "light" | "dark" | "high-contrast";
  device: "desktop" | "tablet" | "mobile";
}

export const PreviewSandbox: React.FC<PreviewSandboxProps> = ({
  componentId,
  theme,
  device,
}) => {
  const getThemeClass = () => {
    switch (theme) {
      case "dark":
        return "dark bg-background text-foreground border-border/80";
      case "high-contrast":
        return "bg-black text-[#00ff00] border-2 border-[#00ff00]";
      case "light":
      default:
        return "bg-white text-foreground border-slate-200";
    }
  };

  const getDeviceClass = () => {
    switch (device) {
      case "mobile":
        return "w-[375px] min-h-[280px] shadow-lg rounded-[24px] border-8 border-slate-900 dark:border-slate-800 p-4 transition-all duration-300";
      case "tablet":
        return "w-[768px] min-h-[320px] shadow-md rounded-[16px] border-4 border-slate-700 dark:border-slate-600 p-6 transition-all duration-300";
      case "desktop":
      default:
        return "w-full min-h-[220px] rounded-xl border border-border p-8 transition-all duration-300";
    }
  };

  const renderSelectedComponent = () => {
    switch (componentId) {
      case "button":
        return <ButtonPreview />;
      case "card":
        return <CardPreview />;
      case "otp-input":
        return <OtpInputPreview />;
      case "dialog-modal":
        return <FallbackComponentPreview name="DialogModal" />;
      case "pagination-wrapper":
        return <FallbackComponentPreview name="PaginationWrapper" />;
      case "table-action-dropdown":
        return <FallbackComponentPreview name="TableActionDropdown" />;
      case "unsaved-changes-bar":
        return <FallbackComponentPreview name="UnsavedChangesBar" />;
      case "session-timeout-modal":
        return <FallbackComponentPreview name="SessionTimeoutModal" />;
      case "header":
        return <FallbackComponentPreview name="Header Navigation" />;
      case "sidebar":
        return <FallbackComponentPreview name="Sidebar Workspace" />;
      default:
        return <div className="text-xs text-muted p-4">Preview unavailable for this element.</div>;
    }
  };

  return (
    <div className="flex items-center justify-center p-6 bg-surface-secondary/40 border border-dashed border-border/60 rounded-2xl overflow-hidden min-h-[360px]">
      <div className={`${getDeviceClass()} ${getThemeClass()} flex items-center justify-center overflow-y-auto`}>
        <PreviewErrorBoundary>
          <MockSandboxProviders>
            {renderSelectedComponent()}
          </MockSandboxProviders>
        </PreviewErrorBoundary>
      </div>
    </div>
  );
};

export default PreviewSandbox;
