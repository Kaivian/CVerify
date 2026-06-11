import { axiosClient } from '@/services/axios-client';
import type {
  BusinessRoleDetailsDto,
  CreateBusinessRoleDto,
  AssignScopedRoleDto,
  RoleAssignmentDto,
  PermissionDto,
  PaginatedAuditLogsResponseDto
} from '../types/roles.types';

export const rolesService = {
  async getRoles(orgSlug: string): Promise<BusinessRoleDetailsDto[]> {
    const response = await axiosClient.get<BusinessRoleDetailsDto[]>(`/organizations/${orgSlug}/roles`);
    return response.data;
  },

  async createRole(orgSlug: string, dto: CreateBusinessRoleDto): Promise<string> {
    const response = await axiosClient.post<string>(`/organizations/${orgSlug}/roles`, dto);
    return response.data;
  },

  async updateRole(orgSlug: string, roleId: string, dto: CreateBusinessRoleDto): Promise<void> {
    await axiosClient.put(`/organizations/${orgSlug}/roles/${roleId}`, dto);
  },

  async deleteRole(orgSlug: string, roleId: string): Promise<void> {
    await axiosClient.delete(`/organizations/${orgSlug}/roles/${roleId}`);
  },

  async getRoleAssignments(orgSlug: string): Promise<RoleAssignmentDto[]> {
    const response = await axiosClient.get<RoleAssignmentDto[]>(`/organizations/${orgSlug}/roles/assignments`);
    return response.data;
  },

  async assignRole(orgSlug: string, dto: AssignScopedRoleDto): Promise<void> {
    await axiosClient.post(`/organizations/${orgSlug}/roles/assign`, dto);
  },

  async revokeRole(orgSlug: string, dto: AssignScopedRoleDto): Promise<void> {
    await axiosClient.post(`/organizations/${orgSlug}/roles/revoke`, dto);
  },

  async getAvailablePermissions(orgSlug: string): Promise<PermissionDto[]> {
    const response = await axiosClient.get<PermissionDto[]>(`/organizations/${orgSlug}/roles/permissions`);
    return response.data;
  },

  async getAuditLogs(
    orgSlug: string,
    page = 1,
    pageSize = 10
  ): Promise<PaginatedAuditLogsResponseDto> {
    const response = await axiosClient.get<PaginatedAuditLogsResponseDto>(
      `/organizations/${orgSlug}/roles/audit-logs`,
      {
        params: { page, pageSize }
      }
    );
    return response.data;
  }
};
