export interface NotificationEvent {
  id: string;
  category: 'success' | 'warning' | 'info' | 'error';
  title: string;
  description?: string;
  action?: {
    label: string;
    onPress: () => void;
  };
  metadata?: Record<string, unknown>;
}

export interface NotificationRenderer {
  render(event: NotificationEvent): void;
  clearAll?(): void;
}
