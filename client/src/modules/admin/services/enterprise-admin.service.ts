import { axiosClient } from '@/services/axios-client';
import { type PaginatedResult } from '@/types/admin.types';

export interface OrganizationAdminListItem {
  id: string;
  name: string;
  taxCode: string;
  email: string;
  status: 'active' | 'suspended' | 'disputed' | 'fraudulent';
  isVerified: boolean;
  verificationLevel: number;
  workspaceCount: number;
  memberCount: number;
  riskScore: number;
  createdAt: string;
}

export interface WorkspaceMini {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  createdAt: string;
}

export interface OrganizationAdminDetail {
  id: string;
  name: string;
  taxCode: string;
  email: string;
  username: string;
  registrationNumber: string | null;
  status: 'active' | 'suspended' | 'disputed' | 'fraudulent';
  isVerified: boolean;
  verificationLevel: number;
  representativeName: string | null;
  representativeEmail: string | null;
  representativePhone: string | null;
  website: string | null;
  description: string | null;
  organizationType: string | null;
  organizationSize: string | null;
  createdAt: string;
  industryTags: string[];
  workspaces: WorkspaceMini[];
  riskScore: number;
}

export interface EnterpriseWorkflowRequestListItem {
  id: string;
  organizationId: string;
  organizationName: string;
  requestType: 'Registration' | 'Verification' | 'Recovery' | 'Report' | 'Appeal' | 'OwnershipTransfer';
  status: 'Pending' | 'UnderReview' | 'Approved' | 'Rejected' | 'Escalated' | 'Resolved' | 'Dismissed';
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  assignedReviewerId: string | null;
  assignedReviewerName: string | null;
  dueAt: string | null;
  slaBreached: boolean;
  createdAt: string;
}

export interface WorkflowAttachment {
  id: string;
  fileName: string;
  contentType: string;
  createdAt: string;
}

export interface WorkflowComment {
  id: string;
  authorName: string;
  authorEmail: string;
  content: string;
  createdAt: string;
}

export interface EnterpriseWorkflowRequestDetail {
  id: string;
  organizationId: string;
  organizationName: string;
  requestType: 'Registration' | 'Verification' | 'Recovery' | 'Report' | 'Appeal' | 'OwnershipTransfer';
  status: 'Pending' | 'UnderReview' | 'Approved' | 'Rejected' | 'Escalated' | 'Resolved' | 'Dismissed';
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  metadataJson: string;
  assignedReviewerId: string | null;
  assignedReviewerName: string | null;
  assignedAt: string | null;
  claimedAt: string | null;
  dueAt: string | null;
  slaBreached: boolean;
  escalatedToUserId: string | null;
  escalatedToUserName: string | null;
  reviewState: string | null;
  attachments: WorkflowAttachment[];
  comments: WorkflowComment[];
  createdAt: string;
}

export interface WorkflowDashboardStats {
  pendingCount: number;
  claimedCount: number;
  slaBreachedCount: number;
  highRiskCount: number;
  approvalRate: number;
  rejectionRate: number;
}

export const enterpriseAdminService = {
  // Query all organizations
  async getOrganizations(params?: {
    search?: string;
    status?: string;
    isVerified?: boolean;
    verificationLevel?: number;
    page?: number;
    pageSize?: number;
  }): Promise<PaginatedResult<OrganizationAdminListItem>> {
    const response = await axiosClient.get<PaginatedResult<OrganizationAdminListItem>>('/admin/enterprise/organizations', {
      params
    });
    return response.data;
  },

  // Get single organization details
  async getOrganization(id: string): Promise<OrganizationAdminDetail> {
    const response = await axiosClient.get<OrganizationAdminDetail>(`/admin/enterprise/organizations/${id}`);
    return response.data;
  },

  // Update status (suspend, reactivate, disputed)
  async updateOrganizationStatus(id: string, payload: { status: string; reason: string }): Promise<void> {
    await axiosClient.patch(`/admin/enterprise/organizations/${id}/status`, payload);
  },

  // Query workflow requests queue
  async getRequests(params?: {
    requestType?: string;
    status?: string;
    priority?: string;
    slaBreached?: boolean;
    assignedReviewerId?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PaginatedResult<EnterpriseWorkflowRequestListItem>> {
    const response = await axiosClient.get<PaginatedResult<EnterpriseWorkflowRequestListItem>>('/admin/enterprise/requests', {
      params
    });
    return response.data;
  },

  // Get request details
  async getRequest(id: string): Promise<EnterpriseWorkflowRequestDetail> {
    const response = await axiosClient.get<EnterpriseWorkflowRequestDetail>(`/admin/enterprise/requests/${id}`);
    return response.data;
  },

  // Claim request
  async claimRequest(id: string): Promise<void> {
    await axiosClient.post(`/admin/enterprise/requests/${id}/claim`);
  },

  // Unclaim/release request
  async unclaimRequest(id: string): Promise<void> {
    await axiosClient.post(`/admin/enterprise/requests/${id}/unclaim`);
  },

  // Escalate request to senior review
  async escalateRequest(id: string): Promise<void> {
    await axiosClient.post(`/admin/enterprise/requests/${id}/escalate`);
  },

  // Resolve request (Approve, Reject, Dismiss)
  async resolveRequest(id: string, payload: { status: string; notes: string }): Promise<void> {
    await axiosClient.post(`/admin/enterprise/requests/${id}/resolve`, payload);
  },

  // Add internal comment
  async addComment(id: string, content: string): Promise<WorkflowComment> {
    const response = await axiosClient.post<WorkflowComment>(`/admin/enterprise/requests/${id}/comments`, { content });
    return response.data;
  },

  // Get dashboard metrics
  async getStats(): Promise<WorkflowDashboardStats> {
    const response = await axiosClient.get<WorkflowDashboardStats>('/admin/enterprise/stats');
    return response.data;
  },

  // Seed demo requests
  async seedDemoRequests(): Promise<void> {
    await axiosClient.post('/admin/enterprise/seed-demo-requests');
  }
};
