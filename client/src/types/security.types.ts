export interface SecurityEventListItem {
  id: string;
  eventType: string;
  category: string;
  severity: string;
  status: string;
  riskScore: number;
  confidenceScore: number;
  description: string;
  actorUserEmail: string | null;
  targetUserEmail: string | null;
  ipAddress: string | null;
  countryCode: string | null;
  occurrenceCount: number;
  createdAt: string;
}

export interface SecurityEventComment {
  id: string;
  securityEventId?: string;
  securityIncidentId?: string;
  authorUserId: string;
  authorUserEmail: string;
  commentText: string;
  createdAt: string;
}

export interface SecurityEventDetail {
  id: string;
  eventType: string;
  category: string;
  severity: string;
  status: string;
  riskScore: number;
  confidenceScore: number;
  description: string;
  actorUserId: string | null;
  actorUserEmail: string | null;
  targetUserId: string | null;
  targetUserEmail: string | null;
  organizationId: string | null;
  organizationName: string | null;
  ipAddress: string | null;
  countryCode: string | null;
  device: string | null;
  browser: string | null;
  sessionId: string | null;
  detailsJson: string | null;
  correlationId: string;
  incidentId: string | null;
  incidentTitle: string | null;
  assignedToUserId: string | null;
  assignedToUserEmail: string | null;
  occurrenceCount: number;
  comments: SecurityEventComment[];
  createdAt: string;
  updatedAt: string;
}

export interface SecurityRule {
  id: string;
  code: string;
  name: string;
  description: string;
  isEnabled: boolean;
  severity: string;
  configurationJson: string;
  createdAt: string;
  updatedAt: string;
}

export interface SecurityDashboardStats {
  activeThreats: number;
  unresolvedCritical: number;
  highRiskEvents: number;
  failedLoginsToday: number;
  blockedRequestsToday: number;
  openInvestigations: number;
  resolvedToday: number;
  avgMttrHours: number;
  avgMttdMinutes: number;
}

export interface SecurityTrendItem {
  timeLabel: string;
  eventCount: number;
  criticalCount: number;
  highCount: number;
}

export interface KeyValuePair<K, V> {
  key: K;
  value: V;
}

export interface SecurityDashboardData {
  stats: SecurityDashboardStats;
  recentEvents: SecurityEventListItem[];
  dailyTrends: SecurityTrendItem[];
  topAttackingIps: KeyValuePair<string, number>[];
  topCountries: KeyValuePair<string, number>[];
  categoryBreakdown: KeyValuePair<string, number>[];
}
