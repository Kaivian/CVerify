"use client";

import React, { useState, useRef } from 'react';
import { MoreHorizontal, type LucideIcon } from 'lucide-react';
import { Dropdown, Label, Typography } from '@heroui/react';
import { Button } from './button';
import { DialogModal } from './dialog-modal';

export interface DropdownActionItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  onSelect: () => void | Promise<void>;
  variant?: 'default' | 'danger';
  isDisabled?: boolean;
  requiresConfirmation?: boolean;
  confirmationConfig?: {
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
  };
}

interface TableActionDropdownProps {
  actions: DropdownActionItem[];
  align?: 'start' | 'end';
  triggerAriaLabel?: string;
}

export const TableActionDropdown: React.FC<TableActionDropdownProps> = ({
  actions,
  align = 'end',
  triggerAriaLabel = 'Table Row Actions',
}) => {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<DropdownActionItem | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const handleAction = async (key: React.Key) => {
    const action = actions.find(a => a.id === key);
    if (!action || action.isDisabled) return;

    if (action.requiresConfirmation) {
      setPendingAction(action);
      setConfirmOpen(false); // Make sure to close trigger / dropdown state cleanly
      
      // Delay opening confirmation modal to allow smooth dropdown closing animation
      setTimeout(() => {
        setConfirmOpen(true);
      }, 100);
    } else {
      await action.onSelect();
      // Restore focus to trigger button for optimal keyboard navigation flow
      triggerRef.current?.focus();
    }
  };

  const handleConfirmClose = (open: boolean) => {
    setConfirmOpen(open);
    if (!open) {
      // Restore focus on close or cancel
      setTimeout(() => {
        triggerRef.current?.focus();
      }, 50);
    }
  };

  return (
    <>
      <Dropdown>
        <Button
          ref={triggerRef}
          isIconOnly
          variant="bordered"
          size="sm"
          aria-label={triggerAriaLabel}
          className="h-8 w-8 min-w-8 rounded-lg bg-surface-secondary/40 border border-border/60 hover:bg-surface-secondary text-muted hover:text-foreground cursor-pointer focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-hidden transition-all duration-150 flex items-center justify-center"
        >
          <MoreHorizontal size={15} />
        </Button>
        <Dropdown.Popover 
          placement={align === 'end' ? 'bottom end' : 'bottom start'}
          className="bg-overlay border border-border shadow-overlay rounded-xl p-1.5 min-w-[170px] outline-hidden animate-in fade-in duration-100 z-50 font-outfit"
        >
          <Dropdown.Menu onAction={handleAction}>
            {actions.map((action) => {
              const Icon = action.icon;
              const isDanger = action.variant === 'danger';
              return (
                <Dropdown.Item
                  key={action.id}
                  id={action.id}
                  textValue={action.label}
                  variant={isDanger ? 'danger' : 'default'}
                  className={[
                    "flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer outline-hidden select-none transition-colors duration-150",
                    isDanger 
                      ? "text-danger hover:bg-danger/10 focus:bg-danger/10" 
                      : "text-foreground hover:bg-surface-secondary focus:bg-surface-secondary",
                    action.isDisabled ? "opacity-35 cursor-not-allowed pointer-events-none" : ""
                  ].join(' ')}
                >
                  {Icon && <Icon size={14} className={isDanger ? "text-danger shrink-0" : "text-muted shrink-0"} />}
                  <Label className="font-semibold text-inherit">{action.label}</Label>
                </Dropdown.Item>
              );
            })}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>

      {/* Confirmation Safeguard Modal */}
      {pendingAction && (
        <DialogModal
          isOpen={confirmOpen}
          onOpenChange={handleConfirmClose}
          title={pendingAction.confirmationConfig?.title || 'Confirm Action'}
          size="sm"
        >
          <div className="space-y-5 font-outfit">
            <Typography type="body-sm" className="text-muted-foreground leading-relaxed">
              {pendingAction.confirmationConfig?.description}
            </Typography>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="bordered"
                size="sm"
                className="cursor-pointer font-semibold"
                onClick={() => handleConfirmClose(false)}
              >
                {pendingAction.confirmationConfig?.cancelText || 'Cancel'}
              </Button>
              <Button
                variant={pendingAction.variant === 'danger' ? 'danger' : 'solid'}
                size="sm"
                className="cursor-pointer font-bold"
                onClick={async () => {
                  if (pendingAction.onSelect) {
                    await pendingAction.onSelect();
                  }
                  handleConfirmClose(false);
                }}
              >
                {pendingAction.confirmationConfig?.confirmText || 'Confirm'}
              </Button>
            </div>
          </div>
        </DialogModal>
      )}
    </>
  );
};

export default TableActionDropdown;
