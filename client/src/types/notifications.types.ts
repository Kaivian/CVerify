export interface ActorInfo {
  id: string;
  fullName: string;
}

export interface NotificationPayload {
  count: number;
  actors: ActorInfo[];
}

export interface NotificationItem {
  id: string;
  userId: string;
  activityEventId: string | null;
  notificationType: string;
  resourceType: string;
  resourceId: string | null;
  payload: NotificationPayload | null;
  isRead: boolean;
  isAggregated: boolean;
  aggregateKey: string | null;
  createdAt: string;
}

export interface NotificationPreference {
  id: string;
  notificationType: string;
  channel: string;
  isEnabled: boolean;
}

export interface UpdatePreferencePayload {
  notificationType: string;
  channel: string;
  isEnabled: boolean;
}
