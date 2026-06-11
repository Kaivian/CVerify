"use client";

import React from 'react';
import { Modal, Typography } from '@heroui/react';
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
      className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in"
    >
      <Modal.Container 
        placement="center" 
        className="fixed inset-0 flex items-center justify-center z-50 p-4"
      >
        <Modal.Dialog className="bg-overlay border border-border shadow-modal rounded-2xl max-w-sm w-full mx-auto overflow-hidden outline-hidden animate-scale-up z-50">
          <Modal.Body className="pt-6 px-6 pb-2 text-center flex flex-col items-center select-text">
            {/* Animated Glowing Alert Icon */}
            <div
              className={[
                "w-12 h-12 rounded-full flex items-center justify-center mb-4 transition-all duration-300",
                isCritical
                  ? "bg-danger/10 text-danger animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                  : "bg-warning/10 text-warning shadow-[0_0_15px_rgba(245,158,11,0.15)]",
              ].join(' ')}
            >
              {isCritical ? <AlertTriangle size={24} /> : <Clock size={24} />}
            </div>

            <Typography type="h4" className="font-bold text-foreground mb-1 tracking-tight">
              Session Expiring Soon
            </Typography>
            
            <Typography type="body-sm" className="text-muted-foreground leading-relaxed mb-4">
              You have been inactive for a while. For security, your session will automatically lock in:
            </Typography>

            {/* Time Counter Ticker */}
            <Typography
              type="h2"
              className={[
                "font-extrabold tracking-tight tabular-nums transition-all duration-300 px-4 py-2 rounded-xl mb-3",
                isCritical
                  ? "text-danger bg-danger/10 scale-105"
                  : "text-foreground bg-surface-secondary",
              ].join(' ')}
            >
              {formatTime(countdown)}
            </Typography>
          </Modal.Body>
          
          <Modal.Footer className="flex flex-col sm:flex-row gap-2 px-6 pb-6 pt-2 border-none">
            <Button
              variant="bordered"
              onClick={onLogout}
              className="w-full sm:order-1"
            >
              Sign Out
            </Button>
            <Button
              variant={isCritical ? "danger" : "solid"}
              onClick={onExtend}
              className="w-full sm:order-2"
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
