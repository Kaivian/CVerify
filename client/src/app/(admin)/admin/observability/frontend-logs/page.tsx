'use client';

import React from 'react';
import { Monitor } from 'lucide-react';
import { useObservabilityStream } from '@/features/observability/hooks/use-observability-stream';
import { ObservabilityConsole } from '@/features/observability/components/observability-console';

export default function FrontendLogsPage() {
  useObservabilityStream('Frontend');

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Monitor className="w-5 h-5 text-accent" />
            Frontend Real-Time Browser Logs
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Real-time client log streaming for React exceptions, API requests, navigation, auth, and SSE/SignalR client events.
          </p>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <ObservabilityConsole
          title="Browser & Client Application Stream"
          serviceFilter="Frontend"
          showServiceSelector={false}
        />
      </div>
    </div>
  );
}
