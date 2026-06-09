import { create } from 'zustand';
import { type WorkspaceDetails, type LinkedOrganization } from '../types/workspace.types';
import { workspaceService } from '../services/workspace.service';

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
  }
}));

