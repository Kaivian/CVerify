"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { adminService } from '@/services/admin.service';
import { type UserListItem, type RoleListItem } from '@/types/admin.types';
import { Spinner, Checkbox, Label, Typography, Table, Card } from '@heroui/react';
import { Search, RotateCw, Users, Edit2, AlertCircle } from 'lucide-react';
import { DialogModal } from '@/components/ui/dialog-modal';
import { SelectDropdown } from '@/components/ui/select-dropdown';
import { PaginationWrapper } from '@/components/ui/pagination-wrapper';
import { SkeletonLoader, EmptyState } from '@/components/ui/states';
import { TableActionDropdown } from '@/components/ui/table-action-dropdown';

export function UsersManagementView() {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [roles, setRoles] = useState<RoleListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Edit State
  const [selectedUser, setSelectedUser] = useState<UserListItem | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editStatus, setEditStatus] = useState('ACTIVE');
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Debounced Search Handler
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [search]);

  const fetchUsers = useCallback(async (currentPage: number, searchVal = debouncedSearch, silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const response = await adminService.getUsers({
        search: searchVal || undefined,
        status: statusFilter || undefined,
        roleName: roleFilter || undefined,
        page: currentPage,
        pageSize
      });
      setUsers(response.items);
      setTotalCount(response.totalCount);
    } catch (err) {
      console.error('Failed to fetch users', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [debouncedSearch, statusFilter, roleFilter, pageSize]);

  const fetchRoles = useCallback(async () => {
    try {
      const rolesList = await adminService.getRoles();
      setRoles(rolesList);
    } catch (err) {
      console.error('Failed to fetch roles', err);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers(page, debouncedSearch);
    }, 0);
    return () => clearTimeout(timer);
  }, [page, debouncedSearch, fetchUsers]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRoles();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchRoles]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchUsers(page, debouncedSearch, true);
  };

  const handleEditClick = (user: UserListItem) => {
    setSelectedUser(user);
    setEditStatus(user.status);
    setEditRoles(user.roles);
    setIsEditOpen(true);
  };

  const handleSaveUser = async () => {
    if (!selectedUser) return;
    setIsSaving(true);
    try {
      await adminService.updateUser(selectedUser.id, {
        status: editStatus,
        roles: editRoles
      });
      setIsEditOpen(false);
      fetchUsers(page);
    } catch (err) {
      console.error('Failed to update user', err);
      alert('Failed to update user. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  const getUserStatusStyle = (status: string) => {
    switch (status.toUpperCase()) {
      case 'ACTIVE':
        return 'bg-success/10 text-success border border-success/20';
      case 'SUSPENDED':
        return 'bg-warning/10 text-warning border border-warning/20';
      case 'BANNED':
        return 'bg-danger/10 text-danger border border-danger/20';
      default:
        return 'bg-surface-secondary text-muted border border-border';
    }
  };

  const handleRoleToggle = (roleName: string) => {
    setEditRoles(prev => 
      prev.includes(roleName) 
        ? prev.filter(r => r !== roleName) 
        : [...prev, roleName]
    );
  };

  return (
    <div className="space-y-6 font-outfit max-w-7xl mx-auto p-4 md:p-6 text-foreground">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Typography type="h2" className="text-2xl font-extrabold tracking-tight flex items-center gap-2 font-display">
            <Users className="text-accent" size={24} />
            User Account Directory
          </Typography>
          <Typography type="body-sm" className="text-muted mt-1 font-outfit">
            Manage user accounts, toggle access, adjust permissions, and track status.
          </Typography>
        </div>
        <button
          onClick={handleRefresh}
          className="w-fit px-4 py-2.5 bg-foreground text-background rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-foreground/90 transition-all select-none cursor-pointer"
        >
          <RotateCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          Sync Records
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-5 rounded-2xl bg-surface/70 border border-border shadow-surface">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2 relative">
            <Search size={16} className="absolute left-3 top-3.5 text-muted" />
            <input
              type="text"
              placeholder="Search users by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-surface/50 text-xs focus:outline-none focus:ring-2 focus:ring-focus/20"
            />
          </div>
          <div>
            <SelectDropdown
              value={statusFilter}
              onChange={(val) => {
                setStatusFilter(val);
                setPage(1);
              }}
              options={[
                { value: "", label: "All Statuses" },
                { value: "ACTIVE", label: "Active" },
                { value: "SUSPENDED", label: "Suspended" },
                { value: "BANNED", label: "Banned" },
              ]}
              placeholder="All Statuses"
            />
          </div>
          <div>
            <SelectDropdown
              value={roleFilter}
              onChange={(val) => {
                setRoleFilter(val);
                setPage(1);
              }}
              options={[
                { value: "", label: "All Roles" },
                ...roles.map((r) => ({ value: r.name, label: r.displayName })),
              ]}
              placeholder="All Roles"
            />
          </div>
        </div>
      </div>

      {/* User Directory Table */}
      <Card className="p-0 overflow-hidden border border-border bg-surface/80 rounded-2xl shadow-surface">
        {isLoading ? (
          <SkeletonLoader rows={6} columns={6} />
        ) : users.length === 0 ? (
          <EmptyState
            title="No Users Found"
            description="No accounts match your specified filter query."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table aria-label="Users Directory Table" className="w-full">
              <Table.ScrollContainer>
                <Table.Content aria-label="Users Directory Content">
                  <Table.Header>
                    <Table.Column isRowHeader className="font-extrabold uppercase text-[10px] tracking-wider py-4 px-6 text-muted">Full Name</Table.Column>
                    <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4 px-6 text-muted">Email Address</Table.Column>
                    <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4 px-6 text-muted">Status</Table.Column>
                    <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4 px-6 text-muted hidden sm:table-cell">Assigned Roles</Table.Column>
                    <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4 px-6 text-center text-muted hidden md:table-cell">Session V</Table.Column>
                    <Table.Column className="font-extrabold uppercase text-[10px] tracking-wider py-4 px-6 text-right text-muted">Actions</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {users.map((u) => (
                      <Table.Row key={u.id} className="border-b border-separator last:border-none hover:bg-surface-secondary/40 transition-colors">
                        <Table.Cell className="font-bold text-xs py-4 px-6">
                          {u.fullName}
                        </Table.Cell>
                        <Table.Cell className="text-muted font-medium text-xs py-4 px-6 font-mono">
                          {u.email}
                        </Table.Cell>
                        <Table.Cell className="py-4 px-6">
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide ${getUserStatusStyle(u.status)}`}>
                            {u.status}
                          </span>
                        </Table.Cell>
                        <Table.Cell className="py-4 px-6 hidden sm:table-cell">
                          <div className="flex flex-wrap gap-1.5">
                            {u.roles.map((r) => (
                              <span key={r} className="px-2 py-0.5 rounded border border-border text-[10px] font-bold text-muted bg-surface/50">
                                {r}
                              </span>
                            ))}
                          </div>
                        </Table.Cell>
                        <Table.Cell className="text-center font-mono font-bold text-xs py-4 px-6 text-muted hidden md:table-cell">
                          v{u.sessionVersion}
                        </Table.Cell>
                        <Table.Cell className="text-right py-4 px-6">
                          <TableActionDropdown
                            actions={[
                              {
                                id: 'edit',
                                label: "Adjust Settings",
                                icon: Edit2,
                                onSelect: () => handleEditClick(u),
                              }
                            ]}
                          />
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          </div>
        )}

        {users.length > 0 && (
          <div className="p-4 border-t border-separator/60">
            <PaginationWrapper
              page={page}
              totalPages={totalPages}
              totalItems={totalCount}
              itemsPerPage={pageSize}
              onPageChange={(p) => setPage(p)}
            />
          </div>
        )}
      </Card>

      {/* Edit User Modal Dialog */}
      <DialogModal
        isOpen={isEditOpen}
        onOpenChange={setIsEditOpen}
        title="Adjust User Parameters"
        size="md"
        footer={
          <>
            <button
              onClick={() => setIsEditOpen(false)}
              disabled={isSaving}
              className="px-4 py-2 border border-border rounded-xl font-bold text-xs hover:bg-surface-secondary disabled:opacity-50 select-none cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveUser}
              disabled={isSaving}
              className="px-4 py-2 bg-accent text-accent-foreground hover:bg-accent/90 font-bold rounded-xl text-xs hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5 select-none cursor-pointer transition-colors"
            >
              {isSaving && <Spinner size="sm" color="accent" />}
              Apply Changes
            </button>
          </>
        }
      >
        <div className="p-4 rounded-xl bg-warning/10 border border-warning/20 text-warning flex gap-3 text-xs leading-relaxed select-none">
          <AlertCircle size={18} className="shrink-0 text-warning mt-0.5" />
          <div>
            <span className="font-extrabold block mb-0.5">Operational Precaution Warning</span>
            Modifying roles or status values may immediately terminate active sessions. Proceed with caution.
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted">Target Account Details</label>
          <div className="p-3.5 rounded-xl border border-border bg-surface-secondary text-xs font-medium space-y-1">
            <div className="flex justify-between">
              <span className="text-muted">Name</span>
              <span className="font-bold text-foreground">{selectedUser?.fullName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Email</span>
              <span className="font-mono font-bold text-foreground">{selectedUser?.email}</span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <SelectDropdown
            value={editStatus}
            onChange={(val) => setEditStatus(val)}
            options={[
              { value: "ACTIVE", label: "Active" },
              { value: "SUSPENDED", label: "Suspended" },
              { value: "BANNED", label: "Banned" },
            ]}
            label="Account Status"
          />
        </div>

        <div className="space-y-2.5">
          <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted">Roles Hierarchy</label>
          <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
            {roles.map((role) => {
              const isChecked = editRoles.includes(role.name);
              return (
                <div key={role.id} className="p-1 rounded-xl hover:bg-surface-secondary transition-colors">
                  <Checkbox
                    id={`role-${role.id}`}
                    isSelected={isChecked}
                    onChange={() => handleRoleToggle(role.name)}
                    className="flex items-start gap-3 w-full cursor-pointer select-none"
                  >
                    <Checkbox.Control className="mt-1 border-2 border-border data-[selected=true]:bg-accent data-[selected=true]:border-accent rounded size-4 before:rounded">
                      <Checkbox.Indicator className="text-accent-foreground size-3" />
                    </Checkbox.Control>
                    <Checkbox.Content className="flex flex-col text-left">
                      <Label htmlFor={`role-${role.id}`} className="text-xs font-bold text-foreground cursor-pointer">
                        {role.displayName}
                      </Label>
                      <Typography type="body-xs" className="text-muted leading-normal">
                        {role.description}
                      </Typography>
                    </Checkbox.Content>
                  </Checkbox>
                </div>
              );
            })}
          </div>
        </div>
      </DialogModal>
    </div>
  );
}
