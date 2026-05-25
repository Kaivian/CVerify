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
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
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
