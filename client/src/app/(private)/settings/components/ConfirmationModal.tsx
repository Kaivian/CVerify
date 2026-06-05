"use client";
import React, { useState, useEffect } from "react";
import { Modal, Button, Typography } from "@heroui/react";
import { AlertTriangle, X } from "lucide-react";

interface ConfirmationModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void | Promise<void>;
  variant?: "primary" | "danger" | "warning";
  isPending?: boolean;

  // Custom Verification & Safety
  verificationText?: string; // If provided, user must type this exactly to enable Confirm
  verificationPlaceholder?: string;
  verificationLabel?: string;

  // Lockout Blocking Alert
  blockingError?: string | null; // If provided, disables Confirm button and shows alert block
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onOpenChange,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  variant = "primary",
  isPending = false,
  verificationText,
  verificationPlaceholder = "Type to confirm",
  verificationLabel,
  blockingError = null,
}) => {
  const [inputValue, setInputValue] = useState("");

  // Reset input when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      const timer = setTimeout(() => {
        setInputValue("");
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const isVerificationMatched =
    !verificationText || inputValue.trim() === verificationText.trim();
  const isConfirmDisabled =
    isPending || !!blockingError || !isVerificationMatched;

  // Determine colors based on variant
  const getVariantStyles = () => {
    switch (variant) {
      case "danger":
        return {
          headerText: "text-foreground",
          buttonColor: "danger" as const,
          alertBg: "bg-danger/10 border-danger/20 text-danger",
          alertIconColor: "text-danger",
        };
      case "warning":
        return {
          headerText: "text-foreground",
          buttonColor: "warning" as const,
          alertBg: "bg-warning/10 border-warning/20 text-warning",
          alertIconColor: "text-warning",
        };
      default:
        return {
          headerText: "text-foreground",
          buttonColor: "primary" as const,
          alertBg: "bg-accent/10 border-accent/20 text-accent",
          alertIconColor: "text-accent",
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!isPending) {
          onOpenChange(open);
        }
      }}
      isDismissable={!isPending}
      isKeyboardDismissDisabled={isPending}
      className="bg-background/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <Modal.Container size="md">
        <Modal.Dialog className="w-full max-w-lg bg-overlay border border-border rounded-2xl shadow-modal p-6 text-left relative focus-visible:outline-hidden focus:outline-hidden">
          <Modal.CloseTrigger
            aria-label="Close dialog"
            className="absolute right-4 top-4 p-1 rounded-full hover:bg-surface-secondary text-muted hover:text-foreground cursor-pointer transition-colors"
          >
            <X size={15} />
          </Modal.CloseTrigger>

          <Modal.Header className="mb-4">
            <Modal.Heading className="outline-hidden">
              <span
                className={`font-display font-extrabold text-xl ${styles.headerText}`}
              >
                {title}
              </span>
            </Modal.Heading>
          </Modal.Header>

          <Modal.Body className="space-y-4 py-2 text-sm leading-relaxed text-muted-foreground select-text">
            {/* Blocking Error Alert */}
            {blockingError ? (
              <div className="flex items-start gap-2 p-4 rounded-xl border bg-danger/10 border-danger/20 text-danger">
                <AlertTriangle size={20} />
                <Typography
                  type="body-xs"
                  className="font-bold leading-normal text-danger"
                >
                  {blockingError}
                </Typography>
              </div>
            ) : null}

            {/* Standard Warning Icon Banner if dangerous/warning and NOT blocked */}
            {!blockingError &&
            (variant === "danger" || variant === "warning") ? (
              <div
                className={`flex gap-2 p-4 rounded-xl border ${styles.alertBg}`}
              >
                <AlertTriangle
                  size={20}
                  className={`${styles.alertIconColor}`}
                />
                <Typography
                  type="body-xs"
                  className={`font-bold leading-normal ${styles.alertIconColor}`}
                >
                  {variant === "danger"
                    ? "Attention: Destructive Action"
                    : "Attention Required"}
                </Typography>
              </div>
            ) : null}

            {/* Description Text */}
            <div className="text-muted leading-relaxed font-medium font-sans">
              {description}
            </div>

            {/* Verification input field if needed and NOT blocked */}
            {verificationText && !blockingError ? (
              <div className="flex flex-col gap-2 pt-2">
                <label className="text-foreground/90 text-xs font-semibold select-none">
                  {verificationLabel || (
                    <>
                      To confirm this action, please type{" "}
                      <span className="font-bold text-danger font-mono bg-danger-soft border border-danger/20 rounded px-1.5 py-0.5 select-all">
                        {verificationText}
                      </span>{" "}
                      below:
                    </>
                  )}
                </label>
                <input
                  type="text"
                  placeholder={verificationPlaceholder}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-field-border focus:border-danger focus:ring-danger bg-field text-foreground text-xs font-semibold focus:outline-hidden hover:border-border transition-all select-none focus-visible:ring-2 font-sans"
                  autoComplete="off"
                  disabled={isPending}
                />
              </div>
            ) : null}
          </Modal.Body>

          <Modal.Footer className="flex justify-end gap-2 pt-4 mt-4 border-t border-separator">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl"
              isDisabled={isPending}
            >
              {cancelText}
            </Button>
            {!blockingError && (
              <Button
                variant={variant === "danger" ? "danger" : "primary"}
                onClick={onConfirm}
                isDisabled={isConfirmDisabled}
                isPending={isPending}
                className="rounded-xl"
              >
                {confirmText}
              </Button>
            )}
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
};
