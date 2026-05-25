import { axiosClient } from './axios-client';
import {
  UserListItem,
  UpdateUserPayload,
  RoleListItem,
  CreateOrUpdateRolePayload,
  AuditLogListItem,
  PaginatedResult,
  SystemPermission
} from '../types/admin.types';

export const adminService = {
  // Users Management
  async getUsers(params?: {
    search?: string;
    status?: string;
    roleName?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PaginatedResult<UserListItem>> {
    const response = await axiosClient.get<PaginatedResult<UserListItem>>('/admin/users', {
      params
    });
    return response.data;
  },

  async getUser(id: string): Promise<UserListItem> {
    const response = await axiosClient.get<UserListItem>(`/admin/users/${id}`);
    return response.data;
  },

  async updateUser(id: string, payload: UpdateUserPayload): Promise<UserListItem> {
    const response = await axiosClient.put<UserListItem>(`/admin/users/${id}`, payload);
    return response.data;
  },

  // Roles Management
  async getRoles(): Promise<RoleListItem[]> {
    const response = await axiosClient.get<RoleListItem[]>('/admin/roles');
    return response.data;
  },

  async getRole(id: string): Promise<RoleListItem> {
    const response = await axiosClient.get<RoleListItem>(`/admin/roles/${id}`);
    return response.data;
  },

  async createRole(payload: CreateOrUpdateRolePayload): Promise<RoleListItem> {
    const response = await axiosClient.post<RoleListItem>('/admin/roles', payload);
    return response.data;
  },

  async updateRole(id: string, payload: CreateOrUpdateRolePayload): Promise<RoleListItem> {
    const response = await axiosClient.put<RoleListItem>(`/admin/roles/${id}`, payload);
    return response.data;
  },

  async deleteRole(id: string): Promise<{ message: string }> {
    const response = await axiosClient.delete<{ message: string }>(`/admin/roles/${id}`);
    return response.data;
  },

  // Permissions Management
  async getPermissions(): Promise<SystemPermission[]> {
    const response = await axiosClient.get<SystemPermission[]>('/admin/permissions');
    return response.data;
  },

  // Audit Logs Management
  async getAuditLogs(params?: {
    search?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PaginatedResult<AuditLogListItem>> {
    const response = await axiosClient.get<PaginatedResult<AuditLogListItem>>('/admin/audit-logs', {
      params
    });
    return response.data;
  }
};
