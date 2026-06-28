import { axiosClient } from "../../services/axios-client";
import { StreamingSession, StreamingStage, StreamingLog } from "./types";

export interface SessionDetailsResponse {
  session: StreamingSession;
  stages: StreamingStage[];
  metrics: {
    id: string;
    sessionId: string;
    stageId?: string;
    metricName: string;
    metricValue: number;
    timestamp: string;
  }[];
}

export const streamingHistoryApi = {
  fetchSessions: async (pipelineId?: string, status?: string): Promise<StreamingSession[]> => {
    const params = new URLSearchParams();
    if (pipelineId) params.append("pipelineId", pipelineId);
    if (status) params.append("status", status);

    const response = await axiosClient.get<StreamingSession[]>(`/v1/streaming/sessions?${params.toString()}`);
    return response.data;
  },

  fetchSessionDetails: async (sessionId: string): Promise<SessionDetailsResponse> => {
    const response = await axiosClient.get<SessionDetailsResponse>(`/v1/streaming/sessions/${sessionId}`);
    return response.data;
  },

  fetchSessionLogs: async (sessionId: string): Promise<StreamingLog[]> => {
    const response = await axiosClient.get<StreamingLog[]>(`/v1/streaming/sessions/${sessionId}/logs`);
    return response.data;
  },
};
