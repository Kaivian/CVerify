'use client';

import React from 'react';
import { Sparkles } from 'lucide-react';
import { useObservabilityStream } from '@/features/observability/hooks/use-observability-stream';
import { ObservabilityConsole } from '@/features/observability/components/observability-console';

export default function AiBackendLogsPage() {
  useObservabilityStream('AI Backend');

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent" />
            Python AI Service Pipeline Logs
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Real-time FastAPI & Claude AI pipeline traces: LLM requests, token accounting, prompt execution, GitHub / CV analysis, and exceptions.
          </p>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <ObservabilityConsole
          title="Python FastAPI AI Pipeline Stream"
          serviceFilter="AI Backend"
          showServiceSelector={false}
        />
      </div>
    </div>
  );
}
