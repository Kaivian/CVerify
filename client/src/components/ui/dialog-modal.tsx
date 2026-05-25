"use client";

import React, { useEffect, useState } from 'react';
import { Modal, Typography } from '@heroui/react';
import { X } from 'lucide-react';

interface DialogModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'cover' | 'full';
  isDismissable?: boolean;
  isKeyboardDismissDisabled?: boolean;
}

export const DialogModal: React.FC<DialogModalProps> = ({
  isOpen,
  onOpenChange,
  title,
  children,
  footer,
  size = 'md',
  isDismissable = true,
  isKeyboardDismissDisabled = false,
}) => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) {
        setIsMounted(true);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  if (!isMounted) return null;

  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable={isDismissable}
      isKeyboardDismissDisabled={isKeyboardDismissDisabled}
      className="bg-background/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <Modal.Container size={size}>
        <Modal.Dialog className="w-full max-w-2xl bg-overlay border border-border rounded-2xl shadow-modal p-[var(--modal-padding)] text-left relative focus-visible:outline-hidden focus:outline-hidden">
          <Modal.CloseTrigger 
            aria-label="Close dialog"
            className="absolute right-4 top-4 p-1 rounded-full hover:bg-surface-secondary text-muted hover:text-foreground cursor-pointer transition-colors"
          >
            <X size={15} />
          </Modal.CloseTrigger>
          <Modal.Header className="mb-4">
            <Modal.Heading className="outline-hidden">
              <Typography type="h4" className="font-extrabold text-foreground font-display">
                {title}
              </Typography>
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body className="space-y-4 py-2 text-sm leading-relaxed text-muted-foreground select-text">
            {children}
          </Modal.Body>
          {footer && (
            <Modal.Footer className="flex justify-end gap-3 pt-4 mt-4 border-t border-separator">
              {footer}
            </Modal.Footer>
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
};

export default DialogModal;
