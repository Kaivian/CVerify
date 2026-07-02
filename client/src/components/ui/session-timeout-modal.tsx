"use client";

import React from 'react';
import { Modal } from '@heroui/react';
import { Button } from './button';
import { AlertTriangle, Clock } from 'lucide-react';

interface SessionTimeoutModalProps {
  isOpen: boolean;
  countdown: number; // Seconds remaining
  onExtend: () => void;
  onLogout: () => void;
}

export const SessionTimeoutModal: React.FC<SessionTimeoutModalProps> = ({
  isOpen,
  countdown,
  onExtend,
  onLogout,
}) => {
  const formatTime = (secs: number) => {
    const minutes = Math.floor(secs / 60);
    const seconds = secs % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const isCritical = countdown <= 30;

  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => { if (!open) onLogout(); }}
      isDismissable={false}
      isKeyboardDismissDisabled={true}
      className="bg-background/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <Modal.Container placement="center" size="sm">
        <Modal.Dialog className="w-full max-w-sm bg-overlay border border-border rounded-2xl shadow-modal p-6 text-center focus-visible:outline-hidden focus:outline-hidden">
          <Modal.Header className="flex flex-col items-center justify-center mb-2">
            {/* Animated Glowing Alert Icon */}
            <div
              className={[
                "w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-all duration-300",
                isCritical
                  ? "bg-danger/10 text-danger animate-pulse"
                  : "bg-warning/10 text-warning",
              ].join(' ')}
              style={{
                boxShadow: isCritical
                  ? '0 0 15px color-mix(in srgb, var(--danger) 20%, transparent)'
                  : '0 0 15px color-mix(in srgb, var(--warning) 15%, transparent)',
              }}
            >
              {isCritical ? <AlertTriangle size={24} /> : <Clock size={24} />}
            </div>

            <Modal.Heading className="outline-hidden">
              <span className="font-display font-extrabold text-xl text-foreground block">
                Session Expiring Soon
              </span>
            </Modal.Heading>
          </Modal.Header>

          <Modal.Body className="flex flex-col items-center p-0 select-text">
            <div className="text-sm text-muted leading-relaxed mb-4 text-center font-sans font-medium">
              You have been inactive for a while. For security, your session will automatically lock in:
            </div>

            {/* Time Counter Ticker */}
            <div
              className={[
                "font-display font-extrabold tracking-tight tabular-nums transition-all duration-300 px-6 py-2.5 rounded-xl text-3xl inline-block mx-auto",
                isCritical
                  ? "text-danger bg-danger/10 border border-danger/20 scale-105 animate-pulse"
                  : "text-foreground bg-surface-secondary",
              ].join(' ')}
            >
              {formatTime(countdown)}
            </div>
          </Modal.Body>

          <Modal.Footer className="flex gap-2 pt-4 mt-4 border-t border-separator w-full">
            <Button
              variant="outline"
              onPress={onLogout}
              className="flex-1 rounded-xl font-bold"
            >
              Sign Out
            </Button>
            <Button
              variant={isCritical ? "danger" : "primary"}
              onPress={onExtend}
              className="flex-1 rounded-xl font-bold"
            >
              Extend Session
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
};

export default SessionTimeoutModal;

