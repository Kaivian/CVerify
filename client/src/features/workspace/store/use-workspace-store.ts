import { create } from 'zustand';
import { type WorkspaceDetails, type LinkedOrganization } from '../types/workspace.types';
import { workspaceService } from '../services/workspace.service';
import { rolesService } from '../services/roles.service';
import type {
  BusinessRoleDetailsDto,
  CreateBusinessRoleDto,
  AssignScopedRoleDto,
  RoleAssignmentDto,
  PermissionDto,
  PaginatedAuditLogsResponseDto
} from '../types/roles.types';

interface WorkspaceState {
  workspaces: Record<string, WorkspaceDetails>;
  loading: Record<string, boolean>;
  errors: Record<string, string | null>;
  myOrganizations: LinkedOrganization[] | null;
  fetchWorkspace: (slug: string) => Promise<WorkspaceDetails | null>;
  fetchMyOrganizations: () => Promise<LinkedOrganization[] | null>;
  updateWorkspaceDetails: (slug: string, updates: Partial<WorkspaceDetails>) => void;
  toggleFollowWorkspace: (slug: string) => void;
  invalidateCache: (slug?: string) => void;

  // Business Roles State
  roles: Record<string, BusinessRoleDetailsDto[]>;
  assignments: Record<string, RoleAssignmentDto[]>;
  availablePermissions: Record<string, PermissionDto[]>;
  auditLogs: Record<string, PaginatedAuditLogsResponseDto>;
  rolesLoading: Record<string, boolean>;
  rolesErrors: Record<string, string | null>;

  // Business Roles Actions
  fetchRoles: (orgSlug: string) => Promise<BusinessRoleDetailsDto[] | null>;
  createRole: (orgSlug: string, dto: CreateBusinessRoleDto) => Promise<string | null>;
  updateRole: (orgSlug: string, roleId: string, dto: CreateBusinessRoleDto) => Promise<boolean>;
  deleteRole: (orgSlug: string, roleId: string) => Promise<boolean>;
  fetchRoleAssignments: (orgSlug: string) => Promise<RoleAssignmentDto[] | null>;
  assignRole: (orgSlug: string, dto: AssignScopedRoleDto) => Promise<boolean>;
  revokeRole: (orgSlug: string, dto: AssignScopedRoleDto) => Promise<boolean>;
  fetchAvailablePermissions: (orgSlug: string) => Promise<PermissionDto[] | null>;
  fetchAuditLogs: (orgSlug: string, page?: number, pageSize?: number) => Promise<PaginatedAuditLogsResponseDto | null>;
}

const DEFAULT_DETAILS = {
  description: "Leading technology solutions provider specializing in developer screening, automated credential validation, and AI-driven skill mapping systems. Empowering modern hiring teams worldwide.",
  website: "https://cverify.dev",
  location: "Hanoi, Vietnam",
  industry: "Information Technology & Services",
  founded: "2022",
  companySize: "201-500",
  mission: "To establish a source of technical truth and enable seamless verification for developers and companies globally.",
  vision: "A world where skill validation is instant, verifiable, and free of bias.",
  coreValues: "Trust, integrity, developers first, continuous innovation, and open collaboration.",
  followersCount: 7120,
  isFollowing: false,
};

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: {},
  loading: {},
  errors: {},
  myOrganizations: null,

  // Business Roles initial state
  roles: {},
  assignments: {},
  availablePermissions: {},
  auditLogs: {},
  rolesLoading: {},
  rolesErrors: {},

  fetchMyOrganizations: async () => {
    try {
      const orgs = await workspaceService.getUserOrganizations();
      set({ myOrganizations: orgs });
      return orgs;
    } catch (err) {
      console.error('[Workspace Store] Failed to fetch user organizations', err);
      return null;
    }
  },

  fetchWorkspace: async (slug: string) => {
    const cached = get().workspaces[slug];
    if (cached) {
      // Trigger background refetch for consistency & freshness without UI blocking
      workspaceService.getWorkspaceDetails(slug)
        .then((details) => {
          set((state) => ({
            workspaces: {
              ...state.workspaces,
              [slug]: {
                ...DEFAULT_DETAILS,
                ...details,
                // Keep frontend-only updates during session if already modified
                ...state.workspaces[slug],
              }
            }
          }));
        })
        .catch((err) => {
          console.warn('[Workspace Store] Background details refetch failed', err);
        });
      return cached;
    }

    set((state) => ({
      loading: { ...state.loading, [slug]: true },
      errors: { ...state.errors, [slug]: null }
    }));

    try {
      const details = await workspaceService.getWorkspaceDetails(slug);
      const augmented: WorkspaceDetails = {
        ...DEFAULT_DETAILS,
        ...details,
      };
      set((state) => ({
        workspaces: { ...state.workspaces, [slug]: augmented },
        loading: { ...state.loading, [slug]: false }
      }));
      return augmented;
    } catch (err) {
      const errorObject = err as { response?: { data?: { message?: string } }; message?: string };
      const errMsg = errorObject?.response?.data?.message || errorObject?.message || 'Failed to load workspace';
      set((state) => ({
        errors: { ...state.errors, [slug]: errMsg },
        loading: { ...state.loading, [slug]: false }
      }));
      return null;
    }
  },

  updateWorkspaceDetails: (slug: string, updates: Partial<WorkspaceDetails>) => {
    set((state) => {
      const current = state.workspaces[slug];
      if (!current) return state;
      return {
        workspaces: {
          ...state.workspaces,
          [slug]: {
            ...current,
            ...updates,
          }
        }
      };
    });
  },

  toggleFollowWorkspace: (slug: string) => {
    set((state) => {
      const current = state.workspaces[slug];
      if (!current) return state;
      const isFollowing = !current.isFollowing;
      const followersCount = (current.followersCount ?? 0) + (isFollowing ? 1 : -1);
      return {
        workspaces: {
          ...state.workspaces,
          [slug]: {
            ...current,
            isFollowing,
            followersCount,
          }
        }
      };
    });
  },

  invalidateCache: (slug?: string) => {
    if (slug) {
      set((state) => {
        const { [slug]: _, ...restWorkspaces } = state.workspaces;
        return { workspaces: restWorkspaces };
      });
    } else {
      set({ workspaces: {} });
    }
  },

  // Business Roles Actions Implementation
  fetchRoles: async (orgSlug: string) => {
    set((state) => ({
      rolesLoading: { ...state.rolesLoading, [orgSlug]: true },
      rolesErrors: { ...state.rolesErrors, [orgSlug]: null }
    }));
    try {
      const roles = await rolesService.getRoles(orgSlug);
      set((state) => ({
        roles: { ...state.roles, [orgSlug]: roles },
        rolesLoading: { ...state.rolesLoading, [orgSlug]: false }
      }));
      return roles;
    } catch (err) {
      const errorObject = err as { response?: { data?: { message?: string } }; message?: string };
      const errMsg = errorObject?.response?.data?.message || errorObject?.message || 'Failed to load roles';
      set((state) => ({
        rolesErrors: { ...state.rolesErrors, [orgSlug]: errMsg },
        rolesLoading: { ...state.rolesLoading, [orgSlug]: false }
      }));
      return null;
    }
  },

  createRole: async (orgSlug: string, dto: CreateBusinessRoleDto) => {
    try {
      const newRoleId = await rolesService.createRole(orgSlug, dto);
      await get().fetchRoles(orgSlug);
      return newRoleId;
    } catch (err) {
      console.error('[Workspace Store] Failed to create role', err);
      return null;
    }
  },

  updateRole: async (orgSlug: string, roleId: string, dto: CreateBusinessRoleDto) => {
    try {
      await rolesService.updateRole(orgSlug, roleId, dto);
      await get().fetchRoles(orgSlug);
      return true;
    } catch (err) {
      console.error('[Workspace Store] Failed to update role', err);
      return false;
    }
  },

  deleteRole: async (orgSlug: string, roleId: string) => {
    try {
      await rolesService.deleteRole(orgSlug, roleId);
      await get().fetchRoles(orgSlug);
      return true;
    } catch (err) {
      console.error('[Workspace Store] Failed to delete role', err);
      return false;
    }
  },

  fetchRoleAssignments: async (orgSlug: string) => {
    try {
      const assignments = await rolesService.getRoleAssignments(orgSlug);
      set((state) => ({
        assignments: { ...state.assignments, [orgSlug]: assignments }
      }));
      return assignments;
    } catch (err) {
      console.error('[Workspace Store] Failed to fetch assignments', err);
      return null;
    }
  },

  assignRole: async (orgSlug: string, dto: AssignScopedRoleDto) => {
    try {
      await rolesService.assignRole(orgSlug, dto);
      await get().fetchRoleAssignments(orgSlug);
      return true;
    } catch (err) {
      console.error('[Workspace Store] Failed to assign role', err);
      return false;
    }
  },

  revokeRole: async (orgSlug: string, dto: AssignScopedRoleDto) => {
    try {
      await rolesService.revokeRole(orgSlug, dto);
      await get().fetchRoleAssignments(orgSlug);
      return true;
    } catch (err) {
      console.error('[Workspace Store] Failed to revoke role', err);
      return false;
    }
  },

  fetchAvailablePermissions: async (orgSlug: string) => {
    try {
      const perms = await rolesService.getAvailablePermissions(orgSlug);
      set((state) => ({
        availablePermissions: { ...state.availablePermissions, [orgSlug]: perms }
      }));
      return perms;
    } catch (err) {
      console.error('[Workspace Store] Failed to fetch available permissions', err);
      return null;
    }
  },

  fetchAuditLogs: async (orgSlug: string, page = 1, pageSize = 10) => {
    try {
      const logs = await rolesService.getAuditLogs(orgSlug, page, pageSize);
      set((state) => ({
        auditLogs: { ...state.auditLogs, [orgSlug]: logs }
      }));
      return logs;
    } catch (err) {
      console.error('[Workspace Store] Failed to fetch audit logs', err);
      return null;
    }
  }
}));
