'use client';

import React, { useState, useEffect } from 'react';
import { Button, Input, TextArea, Spinner } from '@heroui/react';
import { workspaceService } from '../services/workspace.service';
import DialogModal from '@/components/ui/dialog-modal';
import SelectDropdown from '@/components/ui/select-dropdown';

interface EditWorkspaceModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  organizationSlug: string;
  workspace: {
    id: string;
    displayName: string;
    slug: string;
    description?: string;
    status: string;
  } | null;
  onSuccess?: () => void;
}

export const EditWorkspaceModal: React.FC<EditWorkspaceModalProps> = ({
  isOpen,
  onOpenChange,
  organizationSlug,
  workspace,
  onSuccess,
}) => {
  const [displayName, setDisplayName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('active');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize fields when workspace is set
  useEffect(() => {
    if (isOpen && workspace) {
      setDisplayName(workspace.displayName);
      setSlug(workspace.slug);
      setDescription(workspace.description || '');
      setStatus(workspace.status);
      setErrorMessage(null);
      setIsSubmitting(false);
    }
  }, [isOpen, workspace]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace) return;
    if (!displayName.trim() || !slug.trim()) return;

    const slugRegex = /^[a-z0-9-]{3,50}$/;
    if (!slugRegex.test(slug)) {
      setErrorMessage('Workspace slug must be between 3 and 50 characters, containing only lowercase letters, numbers, and dashes.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await workspaceService.updateWorkspace(organizationSlug, workspace.id, {
        displayName: displayName.trim(),
        slug: slug.trim(),
        description: description.trim() || undefined,
        status: status
      });
      onSuccess?.();
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      const errMsg = err?.response?.data?.message || err?.message || 'Failed to update workspace.';
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
        form="edit-workspace-form"
        className="flex-1 cursor-pointer bg-foreground text-background font-bold rounded-xl py-2.5 text-xs flex items-center justify-center gap-2"
        isDisabled={isSubmitting || !displayName.trim() || !slug.trim()}
      >
        {isSubmitting ? (
          <>
            <Spinner size="sm" color="current" />
            Saving...
          </>
        ) : (
          'Save Changes'
        )}
      </Button>
    </div>
  );

  return (
    <DialogModal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title="Edit Workspace Settings"
      size="md"
      footer={footer}
    >
      <form id="edit-workspace-form" onSubmit={handleSubmit} className="space-y-4 font-outfit select-none">
        {errorMessage && (
          <div className="p-3 bg-danger/10 text-danger border border-danger/20 rounded-xl text-xs font-semibold">
            {errorMessage}
          </div>
        )}

        <div className="space-y-1">
          <label className="text-xs font-bold text-muted block mb-1">Workspace Display Name</label>
          <Input
            required
            placeholder="e.g. Engineering"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full text-xs font-semibold rounded-xl border border-border"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-muted block mb-1">Workspace Slug (System Name)</label>
          <Input
            required
            placeholder="e.g. engineering"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="w-full text-xs font-semibold rounded-xl border border-border font-mono"
          />
          <span className="text-[10px] text-muted-foreground block mt-1">
            This will change the workspace URL path, e.g. cverify.com/business/{organizationSlug}/{slug}
          </span>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-muted block mb-1">Description (Optional)</label>
          <TextArea
            placeholder="Describe the operational scope of this workspace..."
            value={description}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
            className="w-full text-xs font-semibold rounded-xl border border-border"
            rows={3}
          />
        </div>

        <div className="space-y-1">
          <SelectDropdown
            label="Status"
            value={status}
            onChange={(val) => setStatus(val)}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'archived', label: 'Archived' },
              { value: 'frozen', label: 'Frozen' },
              { value: 'superseded', label: 'Superseded' }
            ]}
          />
        </div>
      </form>
    </DialogModal>
  );
};

export default EditWorkspaceModal;
