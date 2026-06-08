import React, { useEffect, useState } from "react";
import { 
  History, 
  Eye, 
  CheckCircle2, 
  XCircle, 
  Calendar, 
  Activity, 
  Coins 
} from "lucide-react";
import { Button, Spinner, Card } from "@heroui/react";
import { useStreamingStore } from "../use-streaming-store";
import { streamingHistoryApi } from "../history-service";
import { StreamingSession } from "../types";

interface HistoryViewerProps {
  pipelineId: string;
}

export function HistoryViewer({ pipelineId }: HistoryViewerProps) {
  const [sessions, setSessions] = useState<StreamingSession[]>([]);
  const [loading, setLoading] = useState(false);
  const loadHistorySession = useStreamingStore(state => state.loadHistorySession);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const data = await streamingHistoryApi.fetchSessions(pipelineId);
      setSessions(data);
    } catch (e) {
      console.error("Failed to load execution history list:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [pipelineId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 gap-2">
        <Spinner size="md" />
        <span className="text-xs text-muted">Retrieving execution audit log history...</span>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 border border-dashed border-border/10 rounded-2xl text-center">
        <History className="size-8 text-muted/30 mb-2" />
        <span className="text-sm font-extrabold text-foreground">No Execution History</span>
        <p className="text-xs text-muted max-w-xs mt-1 leading-relaxed">
          There are no recorded streaming sessions found in the database. Run the pipeline to start recording logs.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted font-bold uppercase tracking-wider flex items-center gap-1 select-none">
          <History className="size-3.5" /> Past Pipeline Executions
        </span>
        <Button size="sm" variant="ghost" className="h-7 text-xs font-semibold px-2" onPress={fetchHistory}>
          Refresh List
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {sessions.map((session) => {
          const isCompleted = session.status === "Completed";
          const formattedDate = new Date(session.createdAtUtc).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });

          return (
            <Card key={session.id} className="p-4 border border-border/10 bg-content2/30 flex flex-col gap-3 shadow-xs hover:border-border/30 transition-all duration-300">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-muted font-mono font-semibold truncate max-w-[140px] select-all">
                    Run ID: {session.id}
                  </span>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted mt-1 select-none">
                    <Calendar className="size-3" />
                    <span>{formattedDate}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 select-none">
                  {isCompleted ? (
                    <span className="text-[8px] font-black uppercase text-success bg-success/15 px-2 py-0.5 rounded-md tracking-wider flex items-center gap-1">
                      <CheckCircle2 className="size-2.5" /> Succeeded
                    </span>
                  ) : (
                    <span className="text-[8px] font-black uppercase text-danger bg-danger/15 px-2 py-0.5 rounded-md tracking-wider flex items-center gap-1">
                      <XCircle className="size-2.5" /> Failed
                    </span>
                  )}
                </div>
              </div>

              {/* Telemetry Metrics */}
              <div className="flex items-center gap-4 text-[10px] border-t border-border/5 pt-2 select-none text-muted">
                {session.totalCostUsd !== undefined && (
                  <div className="flex items-center gap-1">
                    <Coins className="size-3" />
                    <span>Cost: ${session.totalCostUsd?.toFixed(4)}</span>
                  </div>
                )}
                {session.totalInputTokens !== undefined && (
                  <div className="flex items-center gap-1">
                    <Activity className="size-3" />
                    <span>
                      Tokens: {(session.totalInputTokens + (session.totalOutputTokens ?? 0)).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 mt-1">
                <Button 
                  size="sm" 
                  variant="primary" 
                  className="h-7 text-xs font-black px-3 rounded-lg"
                  onPress={() => loadHistorySession(session.id)}
                >
                  <Eye className="size-3.5 mr-1" /> View Logs & Metrics
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
