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

