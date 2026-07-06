export interface UserListItem {
  id: string;
  email: string;
  fullName: string;
  status: string;
  lastLoginAt: string | null;
  roles: string[];
  sessionVersion: number;
  createdAt: string;
}

export interface UpdateUserPayload {
  status: string;
  roles: string[];
}

export interface RoleListItem {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  permissions: string[];
  version: number;
}

export interface CreateOrUpdateRolePayload {
  name: string;
  displayName: string;
  description: string | null;
  permissions: string[];
  version?: number;
}

export interface AuditLogListItem {
  id: string;
  userEmail: string | null;
  eventType: string;
  description: string;
  resourceType: string | null;
  resourceDisplayName: string | null;
  resourceId: string | null;
  workspaceName: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  device: string | null;
  browser: string | null;
  createdAt: string;
}

export interface AuditLogDetail {
  id: string;
  userEmail: string | null;
  eventType: string;
  category: string;
  description: string;
  resourceType: string | null;
  resourceDisplayName: string | null;
  resourceId: string | null;
  workspaceName: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  device: string | null;
  browser: string | null;
  requestId: string | null;
  correlationId: string | null;
  httpPath: string | null;
  httpMethod: string | null;
  clientApp: string | null;
  detailsJson: string | null;
  oldStateJson: string | null;
  newStateJson: string | null;
  createdAt: string;
}

export interface AuditDashboardMetricItem {
  name: string;
  count: number;
}

export interface AuditLogsStats {
  configChangesCount: number;
  roleChangesCount: number;
  pendingVerificationActionsCount: number;
  exportsCount: number;
  trends: AuditDashboardMetricItem[];
  topAdmins: AuditDashboardMetricItem[];
  topResources: AuditDashboardMetricItem[];
}

export interface PaginatedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface SystemPermission {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  module: string;
  isSystem: boolean;
}
