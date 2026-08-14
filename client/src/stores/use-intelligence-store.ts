import { create } from 'zustand';
import { 
  intelligenceApi, 
  type SearchProfileSummary, 
  type CandidateIntelligenceProfile, 
  type MatchEvaluationDto 
} from '../services/intelligence.service';

interface IntelligenceState {
  searchQuery: string;
  searchLocation: string;
  minTrustScore: number;
  searchResults: SearchProfileSummary[];
  selectedCandidate: CandidateIntelligenceProfile | null;
  activeMatch: MatchEvaluationDto | null;
  isLoading: boolean;
  error: string | null;

  setSearchQuery: (query: string) => void;
  setSearchLocation: (loc: string) => void;
  setMinTrustScore: (score: number) => void;
  searchCandidates: () => Promise<void>;
  fetchCandidateProfile: (id: string) => Promise<void>;
  evaluateMatch: (jobVacancyId: string, candidateId: string) => Promise<void>;
  resetActiveMatch: () => void;
}

export const useIntelligenceStore = create<IntelligenceState>((set, get) => ({
  searchQuery: '',
  searchLocation: '',
  minTrustScore: 0,
  searchResults: [],
  selectedCandidate: null,
  activeMatch: null,
  isLoading: false,
  error: null,

  setSearchQuery: (query: string) => set({ searchQuery: query }),
  setSearchLocation: (loc: string) => set({ searchLocation: loc }),
  setMinTrustScore: (score: number) => set({ minTrustScore: score }),

  searchCandidates: async () => {
    set({ isLoading: true, error: null });
    try {
      const { searchQuery, searchLocation, minTrustScore } = get();
      const results = await intelligenceApi.searchCandidates(searchQuery, searchLocation, minTrustScore);
      set({ searchResults: results.items, isLoading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to search candidates', isLoading: false });
    }
  },

  fetchCandidateProfile: async (id: string) => {
    set({ isLoading: true, error: null, selectedCandidate: null });
    try {
      const profile = await intelligenceApi.fetchCandidateProfile(id);
      set({ selectedCandidate: profile, isLoading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch candidate profile', isLoading: false });
    }
  },

  evaluateMatch: async (jobVacancyId: string, candidateId: string) => {
    set({ isLoading: true, error: null, activeMatch: null });
    try {
      const match = await intelligenceApi.evaluateMatch(jobVacancyId, candidateId);
      set({ activeMatch: match, isLoading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to evaluate match', isLoading: false });
    }
  },

  resetActiveMatch: () => set({ activeMatch: null }),
}));
