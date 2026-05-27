import { type NotificationEvent, type NotificationRenderer } from './types';

class NotificationOrchestrator {
  private renderers: Set<NotificationRenderer> = new Set();
  private eventHistory: NotificationEvent[] = [];

  registerRenderer(renderer: NotificationRenderer) {
    this.renderers.add(renderer);
    return () => {
      this.renderers.delete(renderer);
    };
  }

  dispatch(event: Omit<NotificationEvent, 'id'>) {
    const fullEvent: NotificationEvent = {
      ...event,
      id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' 
        ? crypto.randomUUID() 
        : Math.random().toString(36).substring(2, 15),
    };
    
    this.eventHistory.push(fullEvent);
    // Keep a maximum history threshold of 50 events for debugging and auditing
    if (this.eventHistory.length > 50) {
      this.eventHistory.shift();
    }

    this.renderers.forEach((renderer) => {
      try {
        renderer.render(fullEvent);
      } catch (err) {
        console.error("Failed to render notification in channel:", err);
      }
    });
  }

  getHistory(): NotificationEvent[] {
    return this.eventHistory;
  }

  clearAll() {
    this.renderers.forEach((renderer) => {
      if (typeof renderer.clearAll === 'function') {
        renderer.clearAll();
      }
    });
  }
}

export const NotificationHub = new NotificationOrchestrator();
