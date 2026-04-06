"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { adminService } from '@/services/admin.service';
import { RoleListItem } from '@/types/admin.types';
import { getPermissionsByModule } from '@/features/auth/permissions/permission.metadata';
import { Spinner, Checkbox, Label, Typography } from '@heroui/react';
import { Shield, Plus, RotateCw, AlertTriangle, Edit, Trash2 } from 'lucide-react';
import { DialogModal } from '@/components/ui/dialog-modal';
import { AccordionWrapper } from '@/components/ui/accordion-wrapper';
import { SkeletonLoader } from '@/components/ui/states';
import { useTranslation } from 'react-i18next';
import { TableActionDropdown } from '@/components/ui/table-action-dropdown';

export function RolesMatrixView() {
  const { t } = useTranslation(['dashboard-admin', 'common']);
  const [roles, setRoles] = useState<RoleListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Edit / Create Dialog State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleListItem | null>(null);
  const [roleName, setRoleName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const permissionModules = getPermissionsByModule();

  const fetchRoles = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const rolesList = await adminService.getRoles();
      setRoles(rolesList);
    } catch (err) {
      console.error('Failed to fetch roles', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRoles();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchRoles]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchRoles(true);
  };

  const handleOpenCreate = () => {
    setEditingRole(null);
    setRoleName('');
    setDisplayName('');
    setDescription('');
    setSelectedPermissions([]);
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (role: RoleListItem) => {
    setEditingRole(role);
    setRoleName(role.name);
    setDisplayName(role.displayName);
    setDescription(role.description || '');
    setSelectedPermissions(role.permissions);
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handlePermissionToggle = (permName: string) => {
    setSelectedPermissions((prev) => {
      if (prev.includes(permName)) {
        return prev.filter((p) => p !== permName);
      } else {
        return [...prev, permName];
      }
    });
  };

  const handleSelectAllInModule = (moduleName: string, permNames: string[]) => {
    setSelectedPermissions((prev) => {
      const others = prev.filter((p) => !permNames.includes(p));
      const allSelected = permNames.every((p) => prev.includes(p));
      if (allSelected) {
        return others;
      } else {
        return [...others, ...permNames];
      }
    });
  };

  const handleSaveRole = async () => {
    if (!displayName) {
      setErrorMsg(t('dashboard-admin:roles.errors.displayNameRequired'));
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    const payload = {
      name: editingRole ? editingRole.name : roleName.toUpperCase().replace(/\s+/g, '_'),
      displayName,
      description: description || null,
      permissions: selectedPermissions,
      version: editingRole?.version
    };

    try {
      if (editingRole) {
        await adminService.updateRole(editingRole.id, payload);
      } else {
        if (!payload.name) {
          setErrorMsg(t('dashboard-admin:roles.errors.codeNameRequired'));
          setIsSaving(false);
          return;
        }
        await adminService.createRole(payload);
      }
      setIsModalOpen(false);
      fetchRoles();
    } catch (err: unknown) {
      console.error('Failed to save role', err);
      const error = err as { code?: string; message?: string };
      if (error?.code === '409' || error?.message?.includes('conflict') || error?.message?.includes('concurrency')) {
        setErrorMsg(t('dashboard-admin:roles.errors.concurrencyConflict'));
      } else {
        setErrorMsg(error?.message || t('dashboard-admin:roles.errors.saveFailed'));
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRoleDirectly = async (id: string) => {
    try {
      await adminService.deleteRole(id);
      fetchRoles();
    } catch (err: unknown) {
      const error = err as { message?: string };
      alert(error?.message || t('dashboard-admin:roles.deleteError'));
    }
  };

  // Convert permission module groups into clean Accordion item list
  const accordionItems = Object.entries(permissionModules).map(([moduleName, perms]) => {
    const permNames = perms.map((p) => p.name);
    const allSelected = permNames.every((p) => selectedPermissions.includes(p));

    return {
      id: moduleName,
      title: t('dashboard-admin:roles.builder.moduleLabel', { name: moduleName.charAt(0).toUpperCase() + moduleName.slice(1) }),
      content: (
        <div className="space-y-4">
          <div className="flex justify-end select-none">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSelectAllInModule(moduleName, permNames);
              }}
              className="text-[9px] font-extrabold uppercase tracking-wider px-2 py-1 rounded border border-border cursor-pointer bg-surface hover:bg-surface-secondary select-none text-muted transition-colors"
            >
              {allSelected ? t('dashboard-admin:roles.builder.clearModule') : t('dashboard-admin:roles.builder.grantModule')}
            </button>
          </div>
          <div className="space-y-2.5">
            {perms.map((perm) => {
              const isChecked = selectedPermissions.includes(perm.name) || selectedPermissions.includes('*:*:*');
              return (
                <div key={perm.name} className="p-1 rounded-xl hover:bg-surface-secondary/40 transition-colors">
                  <Checkbox
                    id={`perm-${perm.name}`}
                    isSelected={isChecked}
                    onChange={() => handlePermissionToggle(perm.name)}
                    isDisabled={selectedPermissions.includes('*:*:*') && perm.name !== '*:*:*'}
                    className="flex items-start gap-3 w-full cursor-pointer select-none"
                  >
                    <Checkbox.Control className="mt-1 border-2 border-border data-[selected=true]:bg-accent data-[selected=true]:border-accent rounded size-4 before:rounded">
                      <Checkbox.Indicator className="text-accent-foreground size-3" />
                    </Checkbox.Control>
                    <Checkbox.Content className="flex flex-col text-left">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Label htmlFor={`perm-${perm.name}`} className="text-xs font-bold text-foreground cursor-pointer">
                          {perm.displayName}
                        </Label>
                        {perm.dangerous && (
                          <span className="px-1.5 py-0.5 rounded bg-danger/10 text-danger border border-danger/20 text-[7px] font-extrabold tracking-wider uppercase">
                            DANGEROUS
                          </span>
                        )}
                        {perm.system && (
                          <span className="px-1.5 py-0.5 rounded bg-accent/10 text-accent border border-accent/20 text-[7px] font-extrabold tracking-wider uppercase">
                            SYSTEM
                          </span>
                        )}
                      </div>
                      <Typography type="body-xs" className="text-muted leading-normal mt-0.5 font-medium font-outfit">
                        {perm.description}
                      </Typography>
                      <span className="font-mono text-[9px] text-muted/80 block mt-1 font-bold">
                        {perm.name}
                      </span>
                    </Checkbox.Content>
                  </Checkbox>
                </div>
              );
            })}
          </div>
        </div>
      ),
    };
  });

  return (
    <div className="space-y-6 font-outfit max-w-7xl mx-auto p-4 md:p-6 text-foreground">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Typography type="h2" className="text-2xl font-extrabold tracking-tight flex items-center gap-2 font-display">
            <Shield className="text-accent" size={24} />
            {t('dashboard-admin:roles.title')}
          </Typography>
          <Typography type="body-sm" className="text-muted mt-1 font-outfit">
            {t('dashboard-admin:roles.subtitle')}
          </Typography>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            className="px-4 py-2.5 border border-border rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-surface-secondary select-none cursor-pointer transition-colors"
          >
            <RotateCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            {t('dashboard-admin:roles.syncSchemas')}
          </button>
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2.5 bg-foreground text-background font-bold rounded-xl text-xs flex items-center gap-2 hover:bg-foreground/90 transition-all select-none cursor-pointer"
          >
            <Plus size={14} />
            {t('dashboard-admin:roles.createCustomRole')}
          </button>
        </div>
      </div>

      {/* Grid List of Roles */}
      {isLoading ? (
        <SkeletonLoader rows={4} columns={3} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {roles.map((role) => (
            <div key={role.id} className="p-6 rounded-2xl border border-border bg-surface/70 backdrop-blur-xl flex flex-col justify-between min-h-[220px] shadow-surface hover:shadow-overlay transition-all duration-200">
              <div>
                <div className="flex justify-between items-start gap-2 mb-3">
                  <div className="space-y-1">
                    <Typography type="body-sm" className="font-extrabold text-foreground tracking-tight">
                      {role.displayName}
                    </Typography>
                    <span className="font-mono text-[10px] text-muted block uppercase font-bold">
                      {role.name}
                    </span>
                  </div>
                  <div className="flex gap-1.5 select-none">
                    {role.isSystem && (
                      <span className="px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20 text-[8px] font-extrabold tracking-wider uppercase">
                        SYSTEM
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-full bg-surface-secondary text-muted border border-border font-mono font-extrabold text-[8px]">
                      v{role.version}
                    </span>
                  </div>
                </div>

                <Typography type="body-xs" className="text-muted font-medium leading-relaxed mb-4">
                  {role.description || t('dashboard-admin:roles.noDescription')}
                </Typography>
              </div>

              <div>
                <div className="border-t border-separator pt-4 mt-2 flex justify-between items-center select-none">
                  <span className="text-[10px] font-extrabold text-muted uppercase tracking-wide">
                    {role.permissions.includes('*:*:*') ? t('dashboard-admin:roles.allPermissions') : t('dashboard-admin:roles.granularPermissions', { count: role.permissions.length })}
                  </span>
                  
                    <TableActionDropdown
                      actions={[
                        {
                          id: 'edit',
                          label: t('dashboard-admin:roles.editMatrix'),
                          icon: Edit,
                          onSelect: () => handleOpenEdit(role),
                        },
                        ...(!role.isSystem ? [{
                          id: 'delete',
                          label: t('dashboard-admin:roles.delete'),
                          icon: Trash2,
                          variant: 'danger' as const,
                          requiresConfirmation: true,
                          confirmationConfig: {
                            title: t('dashboard-admin:roles.deleteConfirm') || 'Delete Role',
                            description: 'Are you sure you want to permanently delete this security role? This action cannot be undone and may immediately revoke privileges for assigned users.',
                            confirmText: 'Delete',
                            cancelText: 'Cancel'
                          },
                          onSelect: () => handleDeleteRoleDirectly(role.id),
                        }] : [])
                      ]}
                    />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Visual Permission Builder Dialog Overlay */}
      <DialogModal
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        title={editingRole ? t('dashboard-admin:roles.builder.editTitle', { name: displayName }) : t('dashboard-admin:roles.builder.createTitle')}
        size="lg"
        footer={
          <>
            <button
              onClick={() => setIsModalOpen(false)}
              disabled={isSaving}
              className="px-4 py-2 border border-border rounded-xl font-bold text-xs hover:bg-surface-secondary disabled:opacity-50 select-none cursor-pointer transition-colors"
            >
              {t('dashboard-admin:roles.builder.close')}
            </button>
            <button
              onClick={handleSaveRole}
              disabled={isSaving}
              className="px-4 py-2 bg-success text-success-foreground hover:bg-success/90 font-bold rounded-xl text-xs hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5 select-none cursor-pointer transition-colors"
            >
              {isSaving && <Spinner size="sm" color="accent" />}
              {editingRole ? t('dashboard-admin:roles.builder.saveChanges') : t('dashboard-admin:roles.builder.createTitle')}
            </button>
          </>
        }
      >
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-danger/10 border border-danger/20 text-danger flex gap-2.5 text-xs font-semibold select-none leading-relaxed">
            <AlertTriangle size={16} className="shrink-0 text-danger" />
            <div>{errorMsg}</div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {!editingRole && (
            <div className="space-y-1">
              <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted">{t('dashboard-admin:roles.builder.roleKey')}</label>
              <input
                type="text"
                placeholder={t('dashboard-admin:roles.builder.roleKeyPlaceholder')}
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-surface font-mono text-xs focus:outline-none focus:border-foreground"
              />
            </div>
          )}
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted">{t('dashboard-admin:roles.builder.displayTitle')}</label>
            <input
              type="text"
              placeholder={t('dashboard-admin:roles.builder.displayTitlePlaceholder')}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-surface text-xs focus:outline-none focus:border-foreground font-bold"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted">{t('dashboard-admin:roles.builder.purposeDesc')}</label>
          <textarea
            placeholder={t('dashboard-admin:roles.builder.purposeDescPlaceholder')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-surface text-xs focus:outline-none focus:border-foreground font-medium"
            rows={2}
          />
        </div>

        {/* Granular visual matrix accordions grouped by modules */}
        <div className="space-y-3">
          <div className="flex justify-between items-center select-none">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted">{t('dashboard-admin:roles.builder.matrixLabel')}</label>
            <button
              onClick={() => setSelectedPermissions(['*:*:*'])}
              className="text-[10px] font-bold text-muted hover:text-foreground cursor-pointer"
            >
              {t('dashboard-admin:roles.builder.bypassWildcard')}
            </button>
          </div>

          <div className="border border-separator rounded-xl overflow-hidden bg-surface-secondary max-h-[300px] overflow-y-auto p-2">
            <AccordionWrapper
              items={accordionItems}
              variant="default"
              allowsMultipleExpanded
            />
          </div>
        </div>
      </DialogModal>
    </div>
  );
}
