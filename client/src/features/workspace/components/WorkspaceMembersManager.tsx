'use client';

import React, { useState, useEffect } from 'react';
import { Button, Spinner, Card } from '@heroui/react';
import { workspaceService } from '../services/workspace.service';
import { Users, UserPlus, ShieldAlert, Trash2 } from 'lucide-react';
import SelectDropdown from '@/components/ui/select-dropdown';

interface WorkspaceMembersManagerProps {
  organizationSlug: string;
  workspaceId: string;
  workspaceName: string;
}

export const WorkspaceMembersManager: React.FC<WorkspaceMembersManagerProps> = ({
  organizationSlug,
  workspaceId,
  workspaceName,
}) => {
  const [members, setMembers] = useState<any[]>([]);
  const [orgMembers, setOrgMembers] = useState<any[]>([]);
  const [selectedOrgUserId, setSelectedOrgUserId] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('member');
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch workspace members and organization members
  const loadData = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const wsMembers = await workspaceService.getWorkspaceLevelMembers(organizationSlug, workspaceId);
      setMembers(wsMembers);

      // Fetch organization members to populate the add dropdown
      const orgData = await workspaceService.getWorkspaceMembers(organizationSlug, { pageSize: 100 });
      // Filter out users already in the workspace
      const currentMemberIds = wsMembers.map((m: any) => m.userId);
      const availableUsers = (orgData.items || []).filter((u: any) => !currentMemberIds.includes(u.userId));
      setOrgMembers(availableUsers);
    } catch (err: any) {
      console.error(err);
      setErrorMessage('Failed to load workspace members data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (workspaceId) {
      loadData();
      setSelectedOrgUserId('');
      setSelectedRole('member');
    }
  }, [workspaceId]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrgUserId) return;

    setIsAdding(true);
    setErrorMessage(null);
    try {
      await workspaceService.addWorkspaceLevelMember(organizationSlug, workspaceId, {
        userId: selectedOrgUserId,
        role: selectedRole,
      });
      await loadData();
      setSelectedOrgUserId('');
      setSelectedRole('member');
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err?.response?.data?.message || err?.message || 'Failed to add member to workspace.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdatingUserId(userId);
    setErrorMessage(null);
    try {
      await workspaceService.updateWorkspaceLevelMemberRole(organizationSlug, workspaceId, userId, {
        role: newRole,
      });
      await loadData();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err?.response?.data?.message || err?.message || 'Failed to update member role.');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!window.confirm('Are you sure you want to remove this member from the workspace?')) {
      return;
    }
    setUpdatingUserId(userId);
    setErrorMessage(null);
    try {
      await workspaceService.removeWorkspaceLevelMember(organizationSlug, workspaceId, userId);
      await loadData();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err?.response?.data?.message || err?.message || 'Failed to remove member from workspace.');
    } finally {
      setUpdatingUserId(null);
    }
  };

  return (
    <div className="space-y-6 font-outfit select-none">
      <div className="flex items-center gap-2 pb-4 border-b border-border/40">
        <Users size={20} className="text-accent" />
        <h2 className="text-sm font-bold text-foreground">
          Workspace Members &bull; <span className="text-accent">{workspaceName}</span>
        </h2>
      </div>

      {errorMessage && (
        <div className="p-3 bg-danger/10 text-danger border border-danger/20 rounded-xl text-xs font-semibold">
          {errorMessage}
        </div>
      )}

      {/* Add Member Form */}
      {orgMembers.length > 0 && (
        <form onSubmit={handleAddMember} className="flex flex-col sm:flex-row gap-3 items-end p-4 rounded-xl border border-border bg-surface-secondary/20">
          <div className="flex-1 w-full space-y-1">
            <SelectDropdown
              label="Select Organization Member"
              value={selectedOrgUserId}
              onChange={setSelectedOrgUserId}
              placeholder="Search or select member..."
              options={orgMembers.map((u) => ({
                value: u.userId,
                label: `${u.name} (${u.email})`
              }))}
            />
          </div>

          <div className="w-full sm:w-48 space-y-1">
            <SelectDropdown
              label="Workspace Role"
              value={selectedRole}
              onChange={setSelectedRole}
              options={[
                { value: 'member', label: 'Member' },
                { value: 'editor', label: 'Editor' },
                { value: 'manager', label: 'Manager' },
                { value: 'workspace_admin', label: 'Workspace Admin' }
              ]}
            />
          </div>

          <Button
            type="submit"
            className="w-full sm:w-auto cursor-pointer bg-foreground text-background font-bold rounded-xl h-9 text-xs flex items-center justify-center gap-1.5"
            isDisabled={isAdding || !selectedOrgUserId}
          >
            {isAdding ? <Spinner size="sm" color="current" /> : <UserPlus size={14} />}
            <span>Add Member</span>
          </Button>
        </form>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10">
          <Spinner size="md" color="accent" />
          <span className="text-xs text-muted font-semibold">Loading workspace members...</span>
        </div>
      ) : (
        <div className="space-y-2">
          {members.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-border rounded-xl text-xs text-muted">
              No members assigned to this workspace.
            </div>
          ) : (
            members.map((member) => (
              <Card key={member.userId} className="p-3.5 border border-border bg-surface flex flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  {member.avatarUrl ? (
                    <img src={member.avatarUrl} alt={member.name} className="w-9 h-9 rounded-xl object-cover" />
                  ) : (
                    <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center font-bold text-xs">
                      {member.name[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex flex-col">
                    <span className="text-xs font-bold text-foreground truncate">{member.name}</span>
                    <span className="text-[10px] text-muted truncate">{member.email}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {updatingUserId === member.userId ? (
                    <Spinner size="sm" color="accent" />
                  ) : (
                    <>
                      <SelectDropdown
                        value={member.role}
                        onChange={(val) => handleRoleChange(member.userId, val)}
                        className="w-36"
                        options={[
                          { value: 'member', label: 'Member' },
                          { value: 'editor', label: 'Editor' },
                          { value: 'manager', label: 'Manager' },
                          { value: 'workspace_admin', label: 'Workspace Admin' }
                        ]}
                      />

                      <Button
                        isIconOnly
                        variant="secondary"
                        onClick={() => handleRemoveMember(member.userId)}
                        className="w-8 h-8 rounded-xl border border-border hover:bg-danger/10 hover:text-danger cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default WorkspaceMembersManager;
