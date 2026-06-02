'use client';

import React, { useState, useEffect } from 'react';
import { Button, Input, Spinner } from '@heroui/react';
import { useWorkspaceStore } from '../store/use-workspace-store';
import DialogModal from '@/components/ui/dialog-modal';

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  organizationSlug: string;
  onClose?: () => void;
  onSuccess?: (newWorkspace: any) => void;
}

export const CreateWorkspaceModal: React.FC<CreateWorkspaceModalProps> = ({
  isOpen,
  onOpenChange,
  organizationSlug,
  onClose,
  onSuccess,
}) => {
  const createWorkspace = useWorkspaceStore((s) => s.createWorkspace);

  const [displayName, setDisplayName] = useState('');
  const [slug, setSlug] = useState('');
  const [isAutoSlug, setIsAutoSlug] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setDisplayName('');
      setSlug('');
      setIsAutoSlug(true);
      setErrorMessage(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const slugify = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-+|-+$)/g, '');
  };

  const handleDisplayNameChange = (val: string) => {
    setDisplayName(val);
    if (isAutoSlug) {
      setSlug(slugify(val));
    }
  };

  const handleSlugChange = (val: string) => {
    setSlug(slugify(val));
    setIsAutoSlug(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim() || !slug.trim()) return;

    // Validate slug matching regex ^[a-z0-9-]{3,50}$
    const slugRegex = /^[a-z0-9-]{3,50}$/;
    if (!slugRegex.test(slug)) {
      setErrorMessage('Workspace slug must be between 3 and 50 characters, containing only lowercase letters, numbers, and dashes.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const newWorkspace = await createWorkspace(organizationSlug, {
      displayName: displayName.trim(),
      slug: slug.trim(),
    });

    setIsSubmitting(false);

    if (newWorkspace) {
      onSuccess?.(newWorkspace);
      onClose?.();
      onOpenChange(false);
    } else {
      setErrorMessage('Failed to create workspace. Verify that the slug is unique and not already taken.');
    }
  };

  const footer = (
    <div className="flex gap-3 w-full">
      <Button
        variant="secondary"
        onClick={() => {
          onClose?.();
          onOpenChange(false);
        }}
        className="flex-1 cursor-pointer font-bold rounded-xl py-2.5 text-xs"
        isDisabled={isSubmitting}
      >
        Cancel
      </Button>
      <Button
        type="submit"
        form="create-workspace-form"
        className="flex-1 cursor-pointer bg-foreground text-background font-bold rounded-xl py-2.5 text-xs flex items-center justify-center gap-2"
        isDisabled={isSubmitting || !displayName.trim() || !slug.trim()}
      >
        {isSubmitting ? (
          <>
            <Spinner size="sm" color="current" />
            Creating...
          </>
        ) : (
          'Create Workspace'
        )}
      </Button>
    </div>
  );

  return (
    <DialogModal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title="Create New Workspace"
      size="md"
      footer={footer}
    >
      <form id="create-workspace-form" onSubmit={handleSubmit} className="space-y-4 font-outfit select-none">
        <p className="text-xs text-muted-foreground">
          Workspaces represent separate operational environments (e.g. Recruiting, Engineering) within your company organization.
        </p>

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
            onChange={(e) => handleDisplayNameChange(e.target.value)}
            className="w-full text-xs font-semibold rounded-xl border border-border"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-muted block mb-1">Workspace Slug (System Name)</label>
          <Input
            required
            placeholder="e.g. engineering"
            value={slug}
            onChange={(e) => handleSlugChange(e.target.value)}
            className="w-full text-xs font-semibold rounded-xl border border-border font-mono"
          />
          <span className="text-[10px] text-muted-foreground block mt-1">
            This will be used in your workspace URL, e.g. cverify.com/business/{organizationSlug}/{slug || 'your-slug'}
          </span>
        </div>
      </form>
    </DialogModal>
  );
};

export default CreateWorkspaceModal;
