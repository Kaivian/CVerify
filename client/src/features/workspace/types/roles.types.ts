export interface CreateBusinessRoleDto {
  name: string;
  displayName: string;
  description?: string;
  parentRoleId?: string | null;
  permissionNames: string[];
}

export interface AssignScopedRoleDto {
  userId: string;
  roleId: string;
  scopeType: 'ORGANIZATION' | 'WORKSPACE';
  scopeId: string;
}

export interface BusinessRoleDetailsDto {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  parentRoleId?: string | null;
  parentRoleName?: string | null;
  isSystem: boolean;
  isActive: boolean;
  memberCount: number;
  permissions: string[];
  createdAt: string;
}

export interface RoleAssignmentDto {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  roleId: string;
  roleDisplayName: string;
  scopeType: 'ORGANIZATION' | 'WORKSPACE';
  scopeId: string;
  scopeName: string;
  assignedAt: string;
}

export interface RoleAuditLogDto {
  id: string;
  actorUserId?: string | null;
  actorUserName: string;
  action: string;
  targetRoleName: string;
  targetUserId?: string | null;
  targetUserName?: string | null;
  scopeType?: string | null;
  scopeId?: string | null;
  detailsJson?: string | null;
  timestamp: string;
}

export interface PermissionDto {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  module: string;
}

export interface PaginatedAuditLogsResponseDto {
  items: RoleAuditLogDto[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export type CreateOrganizationRoleDto = CreateBusinessRoleDto;
export type OrganizationRoleDetailsDto = BusinessRoleDetailsDto;
