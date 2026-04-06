import { create } from 'zustand';

export type ErrorStatus = 'RECEIVED' | 'INTERPRETED' | 'RENDERED' | 'RETRIED' | 'RESOLVED';

export interface ErrorStateNode {
  id: string; // Correlation ID or auto-generated ID
  status: ErrorStatus;
  code: string;
  category: string;
  timestamp: number;
  retryAttempts: number;
}

interface ErrorLifecycleStore {
  states: Record<string, ErrorStateNode>;
  transition(correlationId: string, status: ErrorStatus, code?: string, category?: string): void;
  incrementRetry(correlationId: string): void;
  clear(correlationId: string): void;
  clearAll(): void;
}

/**
 * Zustand store tracking the 5-stage Platform Error Lifecycle State Machine.
 * Essential for auditing, automated diagnostics support, and workflows retry sequencing.
 */
export const useErrorLifecycle = create<ErrorLifecycleStore>((set) => ({
  states: {},

  transition: (correlationId, status, code, category) => set((state) => {
    if (!correlationId) return {};

    const existing = state.states[correlationId];
    
    // Validate state machine transitions flow logically
    if (existing) {
      const flowRules: Record<ErrorStatus, ErrorStatus[]> = {
        'RECEIVED': ['INTERPRETED', 'RESOLVED'],
        'INTERPRETED': ['RENDERED', 'RESOLVED'],
        'RENDERED': ['RETRIED', 'RESOLVED'],
        'RETRIED': ['RESOLVED', 'RENDERED'],
        'RESOLVED': []
      };

      const allowedNext = flowRules[existing.status];
      if (!allowedNext.includes(status) && status !== existing.status) {
        console.warn(`[Error Lifecycle] Invalid state transition: ${existing.status} -> ${status} for ID: ${correlationId}`);
      }
    }

    const node: ErrorStateNode = {
      id: correlationId,
      status,
      code: code || existing?.code || 'UNKNOWN_ERROR',
      category: category || existing?.category || 'UNKNOWN',
      timestamp: existing?.timestamp || Date.now(),
      retryAttempts: existing?.retryAttempts || 0,
    };

    console.log(`[Error Lifecycle] [${status}] CorrelationID: ${correlationId} (Code: ${node.code})`);

    return {
      states: {
        ...state.states,
        [correlationId]: node
      }
    };
  }),

  incrementRetry: (correlationId) => set((state) => {
    const existing = state.states[correlationId];
    if (!existing) return {};

    return {
      states: {
        ...state.states,
        [correlationId]: {
          ...existing,
          retryAttempts: existing.retryAttempts + 1
        }
      }
    };
  }),

  clear: (correlationId) => set((state) => {
    const newStates = { ...state.states };
    delete newStates[correlationId];
    return { states: newStates };
  }),

  clearAll: () => set({ states: {} })
}));
