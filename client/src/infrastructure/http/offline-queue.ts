import { type AxiosRequestConfig } from 'axios';
import { NotificationHub } from '../notifications/orchestrator';

interface QueuedItem {
  config: AxiosRequestConfig;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}

class OfflineQueueManager {
  private queue: QueuedItem[] = [];

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.processQueue());
      window.addEventListener('offline', () => {
        NotificationHub.dispatch({
          category: 'warning',
          title: 'You are offline',
          description: 'Network connection lost. Operations will be queued automatically.',
        });
      });
    }
  }

  enqueue(config: AxiosRequestConfig): Promise<unknown> {
    return new Promise((resolve, reject) => {
      this.queue.push({ config, resolve: resolve as (value: unknown) => void, reject });

      NotificationHub.dispatch({
        category: 'warning',
        title: 'Action Queued (Offline)',
        description: 'No active connection. Action preserved and will run when reconnected.',
      });
    });
  }

  /**
   * Drains the queued operations sequentially upon online reconnect events.
   */
  private async processQueue() {
    if (this.queue.length === 0) return;

    NotificationHub.dispatch({
      category: 'info',
      title: 'Reconnected',
      description: `Re-dispatching ${this.queue.length} buffered actions automatically...`,
    });

    const activeQueue = [...this.queue];
    this.queue = [];

    for (const item of activeQueue) {
      try {
        const { axiosClient } = await import('./axios-client');
        const res = await axiosClient(item.config);
        item.resolve(res);
      } catch (err) {
        // If still offline, re-enqueue
        if (typeof window !== 'undefined' && !navigator.onLine) {
          this.queue.push(item);
        } else {
          item.reject(err);
        }
      }
    }
  }

  getQueueLength(): number {
    return this.queue.length;
  }
}

export const OfflineQueue = new OfflineQueueManager();
