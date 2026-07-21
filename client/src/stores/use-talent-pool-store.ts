import { create } from 'zustand';
import { 
  talentPoolApi, 
  type SavedCandidateDto, 
  type TalentPoolAnalytics 
} from '../services/talent-pool.service';

interface TalentPoolFilters {
  query: string;
  location: string;
  minTrustScore: number;
  stage: string;
  sortBy: string;
  page: number;
  pageSize: number;
}

interface TalentPoolState {
  // Filters and Pagination
  query: string;
  location: string;
  minTrustScore: number;
  stage: string;
  sortBy: string;
  page: number;
  pageSize: number;
  totalCount: number;

  // Data List and Detail/Analytics State
  candidates: SavedCandidateDto[];
  analytics: TalentPoolAnalytics | null;
  selectedCandidate: SavedCandidateDto | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setFilters: (filters: Partial<TalentPoolFilters>) => void;
  fetchTalentPool: (orgSlug: string) => Promise<void>;
  fetchAnalytics: (orgSlug: string) => Promise<void>;
  saveCandidate: (orgSlug: string, candidateId: string) => Promise<void>;
  removeCandidate: (orgSlug: string, candidateId: string) => Promise<void>;
  updateCandidateMeta: (
    orgSlug: string, 
    candidateId: string, 
    meta: { notes?: string; tags?: string[]; hiringStage?: string; recruiterId?: string | null }
  ) => Promise<void>;
  bulkAction: (
    orgSlug: string,
    candidateIds: string[],
    actionType: 'Delete' | 'UpdateStage' | 'AddTags',
    stageValue?: string,
    tagValues?: string[]
  ) => Promise<void>;
  setSelectedCandidate: (candidate: SavedCandidateDto | null) => void;
  resetStore: () => void;
}

const INITIAL_FILTERS = {
  query: '',
  location: '',
  minTrustScore: 0,
  stage: '',
  sortBy: 'highest_trust',
  page: 1,
  pageSize: 10,
};

export const useTalentPoolStore = create<TalentPoolState>((set, get) => ({
  // Initial state
  ...INITIAL_FILTERS,
  totalCount: 0,
  candidates: [],
  analytics: null,
  selectedCandidate: null,
  isLoading: false,
  error: null,

  setFilters: (filters) => {
    set((state) => ({
      ...state,
      ...filters,
      // Reset page to 1 when search filters change
      page: filters.page !== undefined ? filters.page : 1,
    }));
  },

  fetchTalentPool: async (orgSlug: string) => {
    set({ isLoading: true, error: null });
    try {
      const { query, location, minTrustScore, stage, sortBy, page, pageSize } = get();
      const result = await talentPoolApi.getTalentPool(orgSlug, {
        query: query || undefined,
        location: location || undefined,
        minTrustScore: minTrustScore > 0 ? minTrustScore : undefined,
        stage: stage || undefined,
        sortBy,
        page,
        pageSize,
      });

      set({
        candidates: result.items,
        totalCount: result.totalCount,
        isLoading: false,
      });

      // Synchronize selectedCandidate reference if it's currently open
      const currentSelected = get().selectedCandidate;
      if (currentSelected) {
        const updated = result.items.find(c => c.candidateId === currentSelected.candidateId);
        if (updated) {
          set({ selectedCandidate: updated });
        }
      }
    } catch (err: any) {
      set({ 
        error: err.response?.data?.message || err.message || 'Failed to fetch talent pool', 
        isLoading: false 
      });
    }
  },

  fetchAnalytics: async (orgSlug: string) => {
    try {
      const data = await talentPoolApi.getAnalytics(orgSlug);
      set({ analytics: data });
    } catch (err) {
      console.error('Failed to fetch talent pool analytics', err);
    }
  },

  saveCandidate: async (orgSlug, candidateId) => {
    set({ isLoading: true, error: null });
    try {
      await talentPoolApi.saveCandidate(orgSlug, candidateId);
      await get().fetchTalentPool(orgSlug);
      await get().fetchAnalytics(orgSlug);
    } catch (err: any) {
      set({ 
        error: err.response?.data?.message || err.message || 'Failed to save candidate', 
        isLoading: false 
      });
      throw err;
    }
  },

  removeCandidate: async (orgSlug, candidateId) => {
    set({ isLoading: true, error: null });
    try {
      await talentPoolApi.removeCandidate(orgSlug, candidateId);
      
      // Close preview if we are removing the selected candidate
      if (get().selectedCandidate?.candidateId === candidateId) {
        set({ selectedCandidate: null });
      }

      await get().fetchTalentPool(orgSlug);
      await get().fetchAnalytics(orgSlug);
    } catch (err: any) {
      set({ 
        error: err.response?.data?.message || err.message || 'Failed to remove candidate', 
        isLoading: false 
      });
      throw err;
    }
  },

  updateCandidateMeta: async (orgSlug, candidateId, meta) => {
    try {
      await talentPoolApi.updateCandidateMeta(orgSlug, candidateId, meta);
      await get().fetchTalentPool(orgSlug);
      await get().fetchAnalytics(orgSlug);
    } catch (err: any) {
      set({ error: err.response?.data?.message || err.message || 'Failed to update candidate meta' });
      throw err;
    }
  },

  bulkAction: async (orgSlug, candidateIds, actionType, stageValue, tagValues) => {
    set({ isLoading: true, error: null });
    try {
      await talentPoolApi.bulkAction(orgSlug, {
        candidateIds,
        actionType,
        stageValue,
        tagValues,
      });

      // Clear selectedCandidate if it is bulk deleted
      if (actionType === 'Delete' && get().selectedCandidate && candidateIds.includes(get().selectedCandidate!.candidateId)) {
        set({ selectedCandidate: null });
      }

      await get().fetchTalentPool(orgSlug);
      await get().fetchAnalytics(orgSlug);
    } catch (err: any) {
      set({ 
        error: err.response?.data?.message || err.message || 'Failed to complete bulk action', 
        isLoading: false 
      });
      throw err;
    }
  },

  setSelectedCandidate: (candidate) => set({ selectedCandidate: candidate }),

  resetStore: () => set({
    ...INITIAL_FILTERS,
    totalCount: 0,
    candidates: [],
    analytics: null,
    selectedCandidate: null,
    isLoading: false,
    error: null,
  }),
}));
