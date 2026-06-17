import { useEffect, useCallback } from 'react';
import { useCandidateAssessmentStore } from '@/stores/use-candidate-assessment-store';
import { useAuth } from '@/features/auth/hooks/use-auth';

export function useCandidateAssessment() {
  const { user } = useAuth();
  const store = useCandidateAssessmentStore();

  useEffect(() => {
    if (user?.id) {
      store.fetchReadiness();
      store.fetchLatest();
      store.fetchHistory();
      store.fetchStages();
    }
  }, [user?.id]);

  const trigger = useCallback(async () => {
    if (!user?.id) return;
    return store.triggerAssessment();
  }, [user?.id, store.triggerAssessment]);

  const connect = useCallback(() => {
    if (user?.id) {
      store.connectProgressStream(user.id);
    }
  }, [user?.id, store.connectProgressStream]);

  return {
    readiness: store.readiness,
    latestAssessment: store.latestAssessment,
    assessmentDetails: store.assessmentDetails,
    history: store.history,
    stages: store.stages,
    isLoadingReadiness: !!store.loading.readiness,
    isLoadingLatest: !!store.loading.latest,
    isLoadingDetails: !!store.loading.details,
    isLoadingHistory: !!store.loading.history,
    isTriggering: !!store.loading.trigger,
    error: store.error,

    // Stream status
    streamStatus: store.streamStatus,
    streamProgress: store.streamProgress,
    streamStep: store.streamStep,
    streamMessage: store.streamMessage,

    // Real-time evaluation results
    realtimeScore: store.realtimeScore,
    realtimeLevel: store.realtimeLevel,
    realtimeLevelLabel: store.realtimeLevelLabel,
    realtimeDimensions: store.realtimeDimensions,
    realtimeRecommendations: store.realtimeRecommendations,
    realtimeSignals: store.realtimeSignals,

    // Actions
    fetchReadiness: store.fetchReadiness,
    fetchLatest: store.fetchLatest,
    fetchDetails: store.fetchDetails,
    fetchHistory: store.fetchHistory,
    fetchStages: store.fetchStages,
    triggerAssessment: trigger,
    connectProgressStream: connect,
    disconnectProgressStream: store.disconnectProgressStream,
    clearError: store.clearError,
  };
}
