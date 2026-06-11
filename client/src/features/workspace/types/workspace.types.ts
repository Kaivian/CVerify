export interface WorkspaceMember {
  userId: string;
  name: string;
  email: string;
  role: 'OWNER' | 'REPRESENTATIVE' | 'HR' | 'MEMBER';
  status: string;
}

export interface LinkedOrganization {
  name: string;
  slug: string;
}

export interface LinkedWorkspace {
  id: string;
  displayName: string;
  slug: string;
}

export interface WorkspaceDetails {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  userRole?: 'OWNER' | 'REPRESENTATIVE' | 'HR' | 'MEMBER' | null;
  linkedOrganizations: LinkedOrganization[];
  permissions?: string[];
  workspaces?: LinkedWorkspace[];
  description?: string;
  website?: string;
  location?: string;
  industry?: string;
  founded?: string;
  companySize?: string;
  mission?: string;
  vision?: string;
  coreValues?: string;
  bannerUrl?: string;
  logoUrl?: string;
  followersCount?: number;
  isFollowing?: boolean;
}

export interface PaginatedWorkspaceMembers {
  items: WorkspaceMember[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface MemberRole {
  roleId: string;
  roleName: string;
  roleDisplayName: string;
  scopeType: 'ORGANIZATION' | 'WORKSPACE';
  scopeId: string;
  scopeName: string;
}

export interface MemberDetails {
  userId: string;
  fullName: string;
  email: string;
  identityStatus: string;
  trustScore?: number;
  status: string;
  joinedAt: string;
  roles: MemberRole[];
}

export interface PaginatedMembers {
  items: MemberDetails[];
  totalItems: number;
  page: number;
  pageSize: number;
}

export interface PreAssignedRole {
  roleId: string;
  scopeType: string;
  scopeId: string;
}

export interface PreAssignedRoleDetails {
  roleId: string;
  roleName: string;
  roleDisplayName: string;
  scopeType: string;
  scopeId: string;
  scopeName: string;
}

export interface OrganizationInvitation {
  id: string;
  inviteeEmail: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string;
  invitedByUserId?: string;
  invitedByUserName?: string;
  preAssignedRoles: PreAssignedRoleDetails[];
}

export interface PaginatedInvitations {
  items: OrganizationInvitation[];
  totalItems: number;
  page: number;
  pageSize: number;
}


