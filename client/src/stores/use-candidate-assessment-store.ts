import { create } from 'zustand';
import { profileApi } from '@/services/profile.service';
import { useStreamingStore } from '@/modules/streaming';
import {
  type CandidateReadinessDto,
  type CandidateAssessmentResponse,
  type CandidateAssessmentDetailResponse,
  type AssessmentStageDto,
} from '@/types/profile.types';

export type StreamStatus = 'idle' | 'connecting' | 'streaming' | 'completed' | 'failed';

interface CandidateAssessmentState {
  readiness: CandidateReadinessDto | null;
  latestAssessment: CandidateAssessmentResponse | null;
  assessmentDetails: CandidateAssessmentDetailResponse | null;
  parsedProfile: any | null;
  parsedImprovementPlan: any | null;
  history: CandidateAssessmentResponse[];
  loading: Record<string, boolean>;
  error: string | null;
  stages: AssessmentStageDto[];

  // Global modal visibility states
  isProgressModalOpen: boolean;
  hasClosedProgressModal: boolean;

  // Real-time SSE progress state
  streamStatus: StreamStatus;
  streamProgress: number;
  streamStep: string;
  streamMessage: string;

  // Real-time evaluation results
  realtimeScore: number | null;
  realtimeLevel: string | null;
  realtimeLevelLabel: string | null;
  realtimeDimensions: Record<string, number>;
  realtimeRecommendations: Array<{ id: string; priority: string; action: string }>;
  realtimeSignals: string[];

  fetchReadiness: () => Promise<void>;
  fetchLatest: () => Promise<void>;
  fetchDetails: (id: string) => Promise<void>;
  fetchHistory: () => Promise<void>;
  fetchStages: () => Promise<void>;
  triggerAssessment: () => Promise<CandidateAssessmentResponse>;
  connectProgressStream: (userId: string) => void;
  disconnectProgressStream: () => void;
  setIsProgressModalOpen: (isOpen: boolean) => void;
  setHasClosedProgressModal: (hasClosed: boolean) => void;
  clearError: () => void;
}

const activeEventSource: EventSource | null = null;

const FALLBACK_STAGES: AssessmentStageDto[] = [
  { id: 'FetchLine1', name: 'Retrieve Repository Artifacts', description: 'Fetches verified static analysis, provenance, and git telemetry artifacts for the candidate\'s active repositories.' },
  { id: 'ConsolidateLine1', name: 'Consolidate Repository Signals', description: 'Merges multidimensional capability signals, code quality scores, and commit telemetry across all repositories.' },
  { id: 'L2-001', name: 'Skill Taxonomy Mapping', description: 'Normalizes raw project-level skills against the global CVerify technical skill taxonomy.' },
  { id: 'L2-002', name: 'Skill Proficiency Estimation', description: 'Estimates the depth, scope, and capability bands for each extracted skill using commit frequency and syntax patterns.' },
  { id: 'L2-003', name: 'Capabilities & Gaps Diagnostics', description: 'Pinpoints key architectural strengths and potential engineering development areas from the codebase history.' },
  { id: 'L2-004', name: 'Career Level Assessment', description: 'Maps codebase scope, ownership ratio, and engineering complexity to career-level thresholds.' },
  { id: 'L2-005', name: 'Career Level Calibration', description: 'Calibrates career level alignment across multiple repositories using weighted developer experience metrics.' },
  { id: 'L2-006', name: 'Career Level Evaluation Gate', description: 'Applies validation constraints and overrides to finalize candidate level classifications.' },
  { id: 'L2-007', name: 'Engineering Maturity Evaluation', description: 'Evaluates project hygiene, logging practices, test coverage, and structural organization.' },
  { id: 'L2-008', name: 'Problem Solving Complexity Analyzer', description: 'Analyzes diagnostic intent, recovery patterns, and bug-fix cycles in git commit messages.' },
  { id: 'L2-009', name: 'Technical Tendency Classification', description: 'Classifies developer affinity towards backend, frontend, devops, or fullstack development.' },
  { id: 'L2-010', name: 'Working Style Classification', description: 'Infers collaboration density, velocity consistency, and code review compliance from git metadata.' },
  { id: 'L2-011', name: 'Experience Confidence Calibration', description: 'Adjusts assessment confidence scores based on codebase age, volume, and contributor density.' },
  { id: 'L2-012', name: 'Role Recommendation Engine', description: 'Computes alignment percentages for classic industry roles (e.g. Backend, Tech Lead, DevOps, Architect).' },
  { id: 'L2-013', name: 'Executive Summary Generation', description: 'Generates a comprehensive recruiter-friendly assessment narrative and executive summary.' },
  { id: 'L2-016', name: 'Skill Tree Generation', description: 'Constructs a validated, hierarchical taxonomy of skills and capabilities based on code and profile evidence.' },
  { id: 'L2-014', name: 'AI Profile Composition', description: 'Assembles and serializes the final verified candidate profile and calibrated score index.' },
  { id: 'L2-015', name: 'Candidate Improvement Engine', description: 'Formulates targeted vector-improvement recommendations and prioritizes progression paths.' }
];

export const useCandidateAssessmentStore = create<CandidateAssessmentState>((set, get) => ({
  readiness: null,
  latestAssessment: null,
  assessmentDetails: null,
  parsedProfile: null,
  parsedImprovementPlan: null,
  history: [],
  loading: {},
  error: null,
  stages: FALLBACK_STAGES,

  isProgressModalOpen: false,
  hasClosedProgressModal: false,

  streamStatus: 'idle',
  streamProgress: 0,
  streamStep: '',
  streamMessage: '',

  realtimeScore: null,
  realtimeLevel: null,
  realtimeLevelLabel: null,
  realtimeDimensions: {},
  realtimeRecommendations: [],
  realtimeSignals: [],

  setIsProgressModalOpen: (isOpen: boolean) => set({ isProgressModalOpen: isOpen }),
  setHasClosedProgressModal: (hasClosed: boolean) => set({ hasClosedProgressModal: hasClosed }),
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
          // Auto-open modal if the user hasn't closed it in this session
          if (!get().hasClosedProgressModal) {
            set({ isProgressModalOpen: true });
          }
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
      
      let parsedProfile = null;
      let parsedImprovementPlan = null;
      
      if (assessmentDetails && assessmentDetails.artifacts) {
        const profileArt = assessmentDetails.artifacts.find(a => a.artifactType === 'CandidateProfile');
        if (profileArt) {
          try {
            parsedProfile = JSON.parse(profileArt.jsonData);
          } catch (e) {
            console.error('Failed to parse CandidateProfile artifact:', e);
          }
        }
        
        const planArt = assessmentDetails.artifacts.find(a => a.artifactType === 'ImprovementPlan');
        if (planArt) {
          try {
            parsedImprovementPlan = JSON.parse(planArt.jsonData);
          } catch (e) {
            console.error('Failed to parse ImprovementPlan artifact:', e);
          }
        }
      }
      
      set({ assessmentDetails, parsedProfile, parsedImprovementPlan });
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

  fetchStages: async () => {
    try {
      const stages = await profileApi.fetchAssessmentStages();
      if (stages && stages.length > 0) {
        set({ stages });
      }
    } catch (err) {
      console.warn('Failed to fetch assessment stages from backend, using fallbacks:', err);
    }
  },

  triggerAssessment: async () => {
    set((state) => ({ loading: { ...state.loading, trigger: true }, error: null }));
    try {
      const response = await profileApi.triggerCandidateAssessment();
      set({ latestAssessment: response, isProgressModalOpen: true, hasClosedProgressModal: false });
      
      // Automatically connect to progress stream via unified framework
      useStreamingStore.getState().connectSession(
        "candidate-assessment",
        response.id,
        undefined,
        response.id
      );
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
    set({
      streamStatus: 'connecting',
      streamProgress: 0,
      streamStep: 'Initializing',
      streamMessage: 'Connecting to progress stream...',
    });

    profileApi.fetchLatestCandidateAssessment()
      .then(latest => {
        if (latest) {
          useStreamingStore.getState().connectSession(
            "candidate-assessment",
            latest.id,
            undefined,
            latest.id
          );
        }
      })
      .catch(err => {
        console.error("Failed to delegate progress stream:", err);
        set({
          streamStatus: 'failed',
          streamMessage: 'Failed to retrieve latest assessment session.',
        });
      });
  },

  disconnectProgressStream: () => {
    useStreamingStore.getState().disconnect();
    set({
      streamStatus: 'idle',
      streamProgress: 0,
      streamStep: '',
      streamMessage: '',
    });
  },
}));
