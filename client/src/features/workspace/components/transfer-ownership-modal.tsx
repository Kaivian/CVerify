'use client';

import React, { useState, useEffect } from 'react';
import { Button, Spinner } from '@heroui/react';
import { workspaceService } from '../services/workspace.service';
import DialogModal from '@/components/ui/dialog-modal';
import SelectDropdown from '@/components/ui/select-dropdown';

interface TransferOwnershipModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  organizationSlug: string;
  workspace: {
    id: string;
    displayName: string;
    ownerId?: string;
  } | null;
  onSuccess?: () => void;
}

export const TransferOwnershipModal: React.FC<TransferOwnershipModalProps> = ({
  isOpen,
  onOpenChange,
  organizationSlug,
  workspace,
  onSuccess,
}) => {
  const [members, setMembers] = useState<any[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch workspace members when modal opens
  useEffect(() => {
    if (isOpen && workspace) {
      setIsLoadingMembers(true);
      setErrorMessage(null);
      setSelectedMemberId('');
      workspaceService.getWorkspaceLevelMembers(organizationSlug, workspace.id)
        .then((data) => {
          setMembers(data);
        })
        .catch((err) => {
          console.error(err);
          setErrorMessage('Failed to load workspace members.');
        })
        .finally(() => {
          setIsLoadingMembers(false);
        });
    }
  }, [isOpen, workspace, organizationSlug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace || !selectedMemberId) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await workspaceService.transferWorkspaceOwnership(organizationSlug, workspace.id, {
        newOwnerId: selectedMemberId,
      });
      onSuccess?.();
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      const errMsg = err?.response?.data?.message || err?.message || 'Failed to transfer ownership.';
      setErrorMessage(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const footer = (
    <div className="flex gap-3 w-full">
      <Button
        variant="secondary"
        onClick={() => onOpenChange(false)}
        className="flex-1 cursor-pointer font-bold rounded-xl py-2.5 text-xs"
        isDisabled={isSubmitting}
      >
        Cancel
      </Button>
      <Button
        type="submit"
        form="transfer-ownership-form"
        className="flex-1 cursor-pointer bg-danger text-danger-foreground font-bold rounded-xl py-2.5 text-xs flex items-center justify-center gap-2"
        isDisabled={isSubmitting || !selectedMemberId || isLoadingMembers}
      >
        {isSubmitting ? (
          <>
            <Spinner size="sm" color="current" />
            Transferring...
          </>
        ) : (
          'Transfer Ownership'
        )}
      </Button>
    </div>
  );

  return (
    <DialogModal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title="Transfer Workspace Ownership"
      size="md"
      footer={footer}
    >
      <form id="transfer-ownership-form" onSubmit={handleSubmit} className="space-y-4 font-outfit select-none">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Transferring workspace ownership is a destructive action. The new owner will have full administrative rights, and your role will remain as a workspace administrator.
        </p>

        {errorMessage && (
          <div className="p-3 bg-danger/10 text-danger border border-danger/20 rounded-xl text-xs font-semibold">
            {errorMessage}
          </div>
        )}

        {isLoadingMembers ? (
          <div className="flex flex-col items-center justify-center gap-2 py-6">
            <Spinner size="md" color="accent" />
            <span className="text-xs text-muted font-semibold">Loading members...</span>
          </div>
        ) : (
          <div className="space-y-1">
            <SelectDropdown
              label="Select New Owner"
              value={selectedMemberId}
              onChange={setSelectedMemberId}
              placeholder="Select a member..."
              options={members.map((m) => ({
                value: m.userId,
                label: `${m.name} (${m.email})`
              }))}
            />
          </div>
        )}
      </form>
    </DialogModal>
  );
};

export default TransferOwnershipModal;
