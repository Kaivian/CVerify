"use client";

import React, { createContext, useContext, useEffect } from "react";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useCandidateAssessmentStore, type StreamStatus } from "@/stores/use-candidate-assessment-store";
import {
  type CandidateReadinessDto,
  type CandidateAssessmentResponse,
  type CandidateAssessmentDetailResponse,
  type AssessmentStageDto
} from "@/types/profile.types";

interface AssessmentContextProps {
  readiness: CandidateReadinessDto | null;
  latestAssessment: CandidateAssessmentResponse | null;
  assessmentDetails: CandidateAssessmentDetailResponse | null;
  parsedProfile: any | null;
  parsedImprovementPlan: any | null;
  history: CandidateAssessmentResponse[];
  stages: AssessmentStageDto[];
  isLoadingReadiness: boolean;
  isLoadingLatest: boolean;
  isLoadingDetails: boolean;
  isLoadingHistory: boolean;
  isTriggering: boolean;
  error: string | null;

  // Stream status
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

  // Global modal visibility states
  isProgressModalOpen: boolean;
  hasClosedProgressModal: boolean;

  // Actions
  fetchReadiness: () => Promise<void>;
  fetchLatest: () => Promise<void>;
  fetchDetails: (id: string) => Promise<void>;
  fetchHistory: () => Promise<void>;
  triggerAssessment: () => Promise<CandidateAssessmentResponse>;
  connectProgressStream: () => void;
  disconnectProgressStream: () => void;
  setIsProgressModalOpen: (isOpen: boolean) => void;
  setHasClosedProgressModal: (hasClosed: boolean) => void;
  clearError: () => void;
}

const AssessmentContext = createContext<AssessmentContextProps | undefined>(undefined);

export const AssessmentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const store = useCandidateAssessmentStore();

  const {
    fetchReadiness,
    fetchLatest,
    fetchHistory,
    fetchStages,
    fetchDetails,
    connectProgressStream: connectStream,
    latestAssessment,
    streamStatus
  } = store;

  // 1. Initial fetches on user load
  useEffect(() => {
    if (user?.id) {
      fetchReadiness();
      fetchLatest();
      fetchHistory();
      fetchStages();
    }
  }, [user?.id, fetchReadiness, fetchLatest, fetchHistory, fetchStages]);

  // 2. Automatically load details when latestAssessment is completed
  useEffect(() => {
    if (latestAssessment?.id && latestAssessment.status === "Completed") {
      fetchDetails(latestAssessment.id);
    }
  }, [latestAssessment?.id, latestAssessment?.status, fetchDetails]);

  // 3. Connect progress stream on mount if assessment is running or queued (auto-recovery)
  useEffect(() => {
    if (
      user?.id &&
      latestAssessment &&
      (latestAssessment.status === "Queued" || latestAssessment.status === "Running") &&
      streamStatus === "idle"
    ) {
      connectStream(user.id);
    }
  }, [user?.id, latestAssessment?.id, latestAssessment?.status, streamStatus, connectStream]);

  const connectProgressStream = () => {
    if (user?.id) {
      connectStream(user.id);
    }
  };

  const value: AssessmentContextProps = {
    readiness: store.readiness,
    latestAssessment: store.latestAssessment,
    assessmentDetails: store.assessmentDetails,
    parsedProfile: store.parsedProfile,
    parsedImprovementPlan: store.parsedImprovementPlan,
    history: store.history,
    stages: store.stages,
    isLoadingReadiness: !!store.loading.readiness,
    isLoadingLatest: !!store.loading.latest,
    isLoadingDetails: !!store.loading.details,
    isLoadingHistory: !!store.loading.history,
    isTriggering: !!store.loading.trigger,
    error: store.error,

    streamStatus: store.streamStatus,
    streamProgress: store.streamProgress,
    streamStep: store.streamStep,
    streamMessage: store.streamMessage,

    realtimeScore: store.realtimeScore,
    realtimeLevel: store.realtimeLevel,
    realtimeLevelLabel: store.realtimeLevelLabel,
    realtimeDimensions: store.realtimeDimensions,
    realtimeRecommendations: store.realtimeRecommendations,
    realtimeSignals: store.realtimeSignals,

    isProgressModalOpen: store.isProgressModalOpen,
    hasClosedProgressModal: store.hasClosedProgressModal,

    fetchReadiness: store.fetchReadiness,
    fetchLatest: store.fetchLatest,
    fetchDetails: store.fetchDetails,
    fetchHistory: store.fetchHistory,
    triggerAssessment: store.triggerAssessment,
    connectProgressStream,
    disconnectProgressStream: store.disconnectProgressStream,
    setIsProgressModalOpen: store.setIsProgressModalOpen,
    setHasClosedProgressModal: store.setHasClosedProgressModal,
    clearError: store.clearError,
  };

  return (
    <AssessmentContext.Provider value={value}>
      {children}
    </AssessmentContext.Provider>
  );
};

export const useAssessment = () => {
  const context = useContext(AssessmentContext);
  if (!context) {
    throw new Error("useAssessment must be used within an AssessmentProvider");
  }
  return context;
};
