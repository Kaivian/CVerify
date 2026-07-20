import { create } from 'zustand';
import {
  ObservabilityLogEntry,
  SystemMetricsResponse,
  ObservabilityFilterOptions,
} from '@/types/observability.types';

interface ObservabilityState {
  metrics: SystemMetricsResponse | null;
  logs: ObservabilityLogEntry[];
  isPaused: boolean;
  autoScroll: boolean;
  filter: ObservabilityFilterOptions;

  setMetrics: (metrics: SystemMetricsResponse) => void;
  addLog: (log: ObservabilityLogEntry) => void;
  addLogs: (logs: ObservabilityLogEntry[]) => void;
  togglePause: () => void;
  toggleAutoScroll: () => void;
  togglePinLog: (id: string) => void;
  clearLogs: (service?: string) => void;
  setFilter: (filter: Partial<ObservabilityFilterOptions>) => void;
  resetFilter: () => void;
}

const MAX_LOGS_LIMIT = 2000;

const defaultFilter: ObservabilityFilterOptions = {
  severity: 'ALL',
  service: 'ALL',
  source: 'ALL',
  searchQuery: '',
  pipelineId: '',
  timeRange: 'ALL',
  showOnlyPinned: false,
};

export const useObservabilityStore = create<ObservabilityState>((set, get) => ({
  metrics: null,
  logs: [],
  isPaused: false,
  autoScroll: true,
  filter: defaultFilter,

  setMetrics: (metrics) => set({ metrics }),

  addLog: (log) => {
    if (get().isPaused) return;

    set((state) => {
      // Check duplicate by ID
      if (state.logs.some((l) => l.id === log.id)) return state;

      const newLogs = [...state.logs, log];
      if (newLogs.length > MAX_LOGS_LIMIT) {
        // Keep pinned logs if possible, drop oldest non-pinned
        const pinned = newLogs.filter((l) => l.isPinned);
        const unpinned = newLogs.filter((l) => !l.isPinned);
        const trimmedUnpinned = unpinned.slice(unpinned.length - (MAX_LOGS_LIMIT - pinned.length));
        return { logs: [...pinned, ...trimmedUnpinned].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()) };
      }
      return { logs: newLogs };
    });
  },

  addLogs: (incomingLogs) => {
    set((state) => {
      const existingIds = new Set(state.logs.map((l) => l.id));
      const filteredIncoming = incomingLogs.filter((l) => !existingIds.has(l.id));
      if (filteredIncoming.length === 0) return state;

      const merged = [...state.logs, ...filteredIncoming].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      if (merged.length > MAX_LOGS_LIMIT) {
        return { logs: merged.slice(merged.length - MAX_LOGS_LIMIT) };
      }
      return { logs: merged };
    });
  },

  togglePause: () => set((state) => ({ isPaused: !state.isPaused })),

  toggleAutoScroll: () => set((state) => ({ autoScroll: !state.autoScroll })),

  togglePinLog: (id) =>
    set((state) => ({
      logs: state.logs.map((l) => (l.id === id ? { ...l, isPinned: !l.isPinned } : l)),
    })),

  clearLogs: (service) =>
    set((state) => {
      if (!service || service === 'ALL') return { logs: state.logs.filter((l) => l.isPinned) };
      return { logs: state.logs.filter((l) => l.isPinned || l.service !== service) };
    }),

  setFilter: (newFilter) =>
    set((state) => ({
      filter: { ...state.filter, ...newFilter },
    })),

  resetFilter: () => set({ filter: defaultFilter }),
}));
