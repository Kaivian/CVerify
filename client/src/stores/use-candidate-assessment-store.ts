import { create } from 'zustand';
import { profileApi } from '@/services/profile.service';
import {
  type CandidateReadinessDto,
  type CandidateAssessmentResponse,
  type CandidateAssessmentDetailResponse,
} from '@/types/profile.types';

export type StreamStatus = 'idle' | 'connecting' | 'streaming' | 'completed' | 'failed';

interface CandidateAssessmentState {
  readiness: CandidateReadinessDto | null;
  latestAssessment: CandidateAssessmentResponse | null;
  assessmentDetails: CandidateAssessmentDetailResponse | null;
  history: CandidateAssessmentResponse[];
  loading: Record<string, boolean>;
  error: string | null;

  // Real-time SSE progress state
  streamStatus: StreamStatus;
  streamProgress: number;
  streamStep: string;
  streamMessage: string;

  fetchReadiness: () => Promise<void>;
  fetchLatest: () => Promise<void>;
  fetchDetails: (id: string) => Promise<void>;
  fetchHistory: () => Promise<void>;
  triggerAssessment: () => Promise<CandidateAssessmentResponse>;
  connectProgressStream: (userId: string) => void;
  disconnectProgressStream: () => void;
  clearError: () => void;
}

let activeEventSource: EventSource | null = null;

export const useCandidateAssessmentStore = create<CandidateAssessmentState>((set, get) => ({
  readiness: null,
  latestAssessment: null,
  assessmentDetails: null,
  history: [],
  loading: {},
  error: null,

  streamStatus: 'idle',
  streamProgress: 0,
  streamStep: '',
  streamMessage: '',

  clearError: () => set({ error: null }),

  fetchReadiness: async () => {
    set((state) => ({ loading: { ...state.loading, readiness: true }, error: null }));
    try {
      const readiness = await profileApi.fetchCandidateReadiness();
      set({ readiness });
    } catch (err: any) {
      set({ error: err.response?.data?.message || 'Failed to load readiness status.' });
    } finally {
      set((state) => ({ loading: { ...state.loading, readiness: false } }));
    }
  },

  fetchLatest: async () => {
    set((state) => ({ loading: { ...state.loading, latest: true }, error: null }));
    try {
      const latestAssessment = await profileApi.fetchLatestCandidateAssessment();
      set({ latestAssessment });
      
      // If the latest assessment is in a running/queued status and we are not currently streaming,
      // we can automatically reconnect to the progress stream if we have the userId.
      if (latestAssessment && (latestAssessment.status === 'Queued' || latestAssessment.status === 'Running')) {
        const userId = latestAssessment.userId;
        if (userId && !activeEventSource) {
          get().connectProgressStream(userId);
        }
      }
    } catch (err: any) {
      set({ error: err.response?.data?.message || 'Failed to load latest assessment.' });
    } finally {
      set((state) => ({ loading: { ...state.loading, latest: false } }));
    }
  },

  fetchDetails: async (id: string) => {
    set((state) => ({ loading: { ...state.loading, details: true }, error: null }));
    try {
      const assessmentDetails = await profileApi.fetchCandidateAssessmentDetails(id);
      set({ assessmentDetails });
    } catch (err: any) {
      set({ error: err.response?.data?.message || 'Failed to load assessment details.' });
    } finally {
      set((state) => ({ loading: { ...state.loading, details: false } }));
    }
  },

  fetchHistory: async () => {
    set((state) => ({ loading: { ...state.loading, history: true }, error: null }));
    try {
      const history = await profileApi.fetchCandidateAssessmentHistory();
      set({ history });
    } catch (err: any) {
      set({ error: err.response?.data?.message || 'Failed to load assessment history.' });
    } finally {
      set((state) => ({ loading: { ...state.loading, history: false } }));
    }
  },

  triggerAssessment: async () => {
    set((state) => ({ loading: { ...state.loading, trigger: true }, error: null }));
    try {
      const response = await profileApi.triggerCandidateAssessment();
      set({ latestAssessment: response });
      
      // Automatically connect to progress stream
      get().connectProgressStream(response.userId);
      return response;
    } catch (err: any) {
      const errMsg = err.response?.data?.message || 'Failed to start candidate assessment.';
      set({ error: errMsg });
      throw new Error(errMsg);
    } finally {
      set((state) => ({ loading: { ...state.loading, trigger: false } }));
    }
  },

  connectProgressStream: (userId: string) => {
    if (activeEventSource) {
      activeEventSource.close();
      activeEventSource = null;
    }

    set({
      streamStatus: 'connecting',
      streamProgress: 0,
      streamStep: 'Initializing',
      streamMessage: 'Connecting to progress stream...',
    });

    const sseBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
    const sseUrl = `${sseBaseUrl}/v1/candidate-assessments/progress/${userId}`;

    const es = new EventSource(sseUrl, { withCredentials: true });
    activeEventSource = es;

    es.onopen = () => {
      set({ streamStatus: 'streaming' });
    };

    es.onmessage = async (event) => {
      if (activeEventSource !== es) {
        es.close();
        return;
      }

      const dataStr = event.data;
      if (dataStr === '[DONE]') {
        es.close();
        if (activeEventSource === es) {
          activeEventSource = null;
        }
        set({
          streamStatus: 'completed',
          streamProgress: 100,
          streamStep: 'Completed',
          streamMessage: 'Candidate assessment completed successfully.',
        });
        // Refresh details, latest, readiness, and history
        await get().fetchLatest();
        await get().fetchHistory();
        await get().fetchReadiness();
        return;
      }

      try {
        const payload = JSON.parse(dataStr);
        if (payload) {
          const status = payload.status || 'Running';
          const step = payload.step || '';
          const message = payload.message || '';
          const progress = payload.percentage !== undefined ? payload.percentage : 0;

          if (status === 'Failed') {
            es.close();
            if (activeEventSource === es) {
              activeEventSource = null;
            }
            set({
              streamStatus: 'failed',
              streamProgress: progress,
              streamStep: step,
              streamMessage: message || 'Assessment run failed.',
              error: message || 'Assessment run failed.',
            });
            await get().fetchLatest();
            await get().fetchHistory();
            return;
          }

          set({
            streamProgress: progress,
            streamStep: step,
            streamMessage: message,
          });
        }
      } catch (e) {
        console.error('Failed to parse SSE payload:', e);
      }
    };

    es.onerror = (err) => {
      console.error('Candidate assessment EventSource error:', err);
      es.close();
      if (activeEventSource === es) {
        activeEventSource = null;
      }
      set({
        streamStatus: 'failed',
        streamMessage: 'Connection to assessment progress lost.',
      });
    };
  },

  disconnectProgressStream: () => {
    if (activeEventSource) {
      activeEventSource.close();
      activeEventSource = null;
    }
    set({
      streamStatus: 'idle',
      streamProgress: 0,
      streamStep: '',
      streamMessage: '',
    });
  },
}));
