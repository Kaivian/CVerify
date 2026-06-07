export interface WorkspaceMember {
  name: string;
  email: string;
  role: 'OWNER' | 'REPRESENTATIVE' | 'HR' | 'MEMBER';
  status: string;
}

export interface LinkedOrganization {
  name: string;
  slug: string;
}

export interface WorkspaceDetails {
  organizationName: string;
  organizationSlug: string;
  userRole: 'OWNER' | 'REPRESENTATIVE' | 'HR' | 'MEMBER';
  linkedOrganizations: LinkedOrganization[];
}

export interface PaginatedWorkspaceMembers {
  items: WorkspaceMember[];
  totalCount: number;
  page: number;
  pageSize: number;
}
