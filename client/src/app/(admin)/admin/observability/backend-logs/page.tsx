'use client';

import React from 'react';
import { Server } from 'lucide-react';
import { useObservabilityStream } from '@/features/observability/hooks/use-observability-stream';
import { ObservabilityConsole } from '@/features/observability/components/observability-console';

export default function BackendLogsPage() {
  useObservabilityStream('Backend');

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Server className="w-5 h-5 text-accent" />
            ASP.NET Core Backend Live Logs
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Real-time ASP.NET Core system logs: Info, Debug, Warning, Error, Database queries, Auth, Hubs, and Background Workers.
          </p>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <ObservabilityConsole
          title="ASP.NET Core Server System Stream"
          serviceFilter="Backend"
          showServiceSelector={false}
        />
      </div>
    </div>
  );
}
