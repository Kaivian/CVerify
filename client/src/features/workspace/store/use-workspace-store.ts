import { create } from 'zustand';
import { type WorkspaceDetails, type LinkedOrganization, type LinkedWorkspace, type Post, type Job } from '../types/workspace.types';
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
  activeWorkspaceIds: Record<string, string>;
  setActiveWorkspaceId: (orgSlug: string, workspaceId: string) => void;
  createWorkspace: (orgSlug: string, workspace: { displayName: string; slug: string }) => Promise<LinkedWorkspace | null>;
  fetchWorkspace: (slug: string) => Promise<WorkspaceDetails | null>;
  fetchMyOrganizations: () => Promise<LinkedOrganization[] | null>;
  updateWorkspaceDetails: (slug: string, updates: Partial<WorkspaceDetails>) => Promise<WorkspaceDetails | null>;
  toggleFollowWorkspace: (slug: string) => Promise<void>;
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

  // Posts & Jobs State
  posts: Record<string, Post[]>;
  postsLoading: Record<string, boolean>;
  postsErrors: Record<string, string | null>;
  jobs: Record<string, Job[]>;
  jobsLoading: Record<string, boolean>;
  jobsErrors: Record<string, string | null>;

  // Posts & Jobs Actions
  fetchPosts: (orgSlug: string) => Promise<Post[] | null>;
  createPostAction: (orgSlug: string, postPayload: { category: string; content: string; images?: string[]; imageUrls?: string[] }) => Promise<Post | null>;
  fetchJobs: (orgSlug: string) => Promise<Job[] | null>;
  createJobAction: (orgSlug: string, jobPayload: Partial<Job>) => Promise<Job | null>;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: {},
  loading: {},
  errors: {},
  myOrganizations: null,
  activeWorkspaceIds: {},

  setActiveWorkspaceId: (orgSlug: string, workspaceId: string) => {
    set((state) => ({
      activeWorkspaceIds: {
        ...(state.activeWorkspaceIds || {}),
        [orgSlug]: workspaceId,
      },
    }));
  },

  createWorkspace: async (orgSlug: string, workspace: { displayName: string; slug: string }) => {
    try {
      const newWorkspace = await workspaceService.createWorkspace(orgSlug, workspace);
      set((state) => {
        const currentDetails = state.workspaces[orgSlug];
        if (!currentDetails) return {};
        return {
          workspaces: {
            ...state.workspaces,
            [orgSlug]: {
              ...currentDetails,
              workspaces: [...(currentDetails.workspaces || []), newWorkspace]
            }
          }
        };
      });
      return newWorkspace;
    } catch (err) {
      console.error('[Workspace Store] Failed to create workspace', err);
      return null;
    }
  },

  // Business Roles initial state
  roles: {},
  assignments: {},
  availablePermissions: {},
  auditLogs: {},
  rolesLoading: {},
  rolesErrors: {},

  // Posts & Jobs initial state
  posts: {},
  postsLoading: {},
  postsErrors: {},
  jobs: {},
  jobsLoading: {},
  jobsErrors: {},

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
        ...details,
        // Map backend followerCount -> store followersCount
        followersCount: details.followerCount ?? details.followersCount ?? 0,
        isFollowing: details.isFollowing ?? false,
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

  updateWorkspaceDetails: async (slug: string, updates: Partial<WorkspaceDetails>) => {
    try {
      const updated = await workspaceService.updateWorkspaceDetails(slug, updates);
      set((state) => ({
        workspaces: {
          ...state.workspaces,
          [slug]: {
            ...state.workspaces[slug],
            ...updated,
          }
        }
      }));
      return updated;
    } catch (err) {
      console.error('[Workspace Store] Failed to update workspace details', err);
      throw err;
    }
  },

  toggleFollowWorkspace: async (slug: string) => {
    const current = get().workspaces[slug];
    if (!current) return;

    // Optimistic update
    const optimisticIsFollowing = !current.isFollowing;
    const optimisticCount = (current.followersCount ?? 0) + (optimisticIsFollowing ? 1 : -1);
    set((state) => ({
      workspaces: {
        ...state.workspaces,
        [slug]: {
          ...state.workspaces[slug],
          isFollowing: optimisticIsFollowing,
          followersCount: optimisticCount,
        }
      }
    }));

    try {
      const result = await workspaceService.toggleFollowWorkspace(slug);
      // Confirm with server-authoritative state
      set((state) => ({
        workspaces: {
          ...state.workspaces,
          [slug]: {
            ...state.workspaces[slug],
            isFollowing: result.isFollowing,
            followersCount: result.followerCount,
          }
        }
      }));
    } catch (err) {
      console.error('[Workspace Store] Follow toggle failed, reverting optimistic update', err);
      // Revert on failure
      set((state) => ({
        workspaces: {
          ...state.workspaces,
          [slug]: {
            ...state.workspaces[slug],
            isFollowing: current.isFollowing,
            followersCount: current.followersCount,
          }
        }
      }));
    }
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
  },

  fetchPosts: async (orgSlug: string) => {
    set((state) => ({
      postsLoading: { ...state.postsLoading, [orgSlug]: true },
      postsErrors: { ...state.postsErrors, [orgSlug]: null }
    }));
    try {
      const posts = await workspaceService.getWorkspacePosts(orgSlug);
      set((state) => ({
        posts: { ...state.posts, [orgSlug]: posts },
        postsLoading: { ...state.postsLoading, [orgSlug]: false }
      }));
      return posts;
    } catch (err) {
      const errorObject = err as { response?: { data?: { message?: string } }; message?: string };
      const errMsg = errorObject?.response?.data?.message || errorObject?.message || 'Failed to load posts';
      set((state) => ({
        postsErrors: { ...state.postsErrors, [orgSlug]: errMsg },
        postsLoading: { ...state.postsLoading, [orgSlug]: false }
      }));
      return null;
    }
  },

  createPostAction: async (orgSlug: string, postPayload: { category: string; content: string; images?: string[]; imageUrls?: string[] }) => {
    try {
      const newPost = await workspaceService.createWorkspacePost(orgSlug, postPayload);
      set((state) => {
        const currentPosts = state.posts[orgSlug] || [];
        return {
          posts: {
            ...state.posts,
            [orgSlug]: [newPost, ...currentPosts]
          }
        };
      });
      return newPost;
    } catch (err) {
      console.error('[Workspace Store] Failed to create post', err);
      return null;
    }
  },

  fetchJobs: async (orgSlug: string) => {
    set((state) => ({
      jobsLoading: { ...state.jobsLoading, [orgSlug]: true },
      jobsErrors: { ...state.jobsErrors, [orgSlug]: null }
    }));
    try {
      const jobs = await workspaceService.getWorkspaceJobs(orgSlug);
      set((state) => ({
        jobs: { ...state.jobs, [orgSlug]: jobs },
        jobsLoading: { ...state.jobsLoading, [orgSlug]: false }
      }));
      return jobs;
    } catch (err) {
      const errorObject = err as { response?: { data?: { message?: string } }; message?: string };
      const errMsg = errorObject?.response?.data?.message || errorObject?.message || 'Failed to load jobs';
      set((state) => ({
        jobsErrors: { ...state.jobsErrors, [orgSlug]: errMsg },
        jobsLoading: { ...state.jobsLoading, [orgSlug]: false }
      }));
      return null;
    }
  },

  createJobAction: async (orgSlug: string, jobPayload: Partial<Job>) => {
    try {
      const newJob = await workspaceService.createWorkspaceJob(orgSlug, jobPayload);
      set((state) => {
        const currentJobs = state.jobs[orgSlug] || [];
        return {
          jobs: {
            ...state.jobs,
            [orgSlug]: [newJob, ...currentJobs]
          }
        };
      });
      return newJob;
    } catch (err) {
      console.error('[Workspace Store] Failed to create job', err);
      return null;
    }
  }
}));
