export interface WorkspaceMember {
  userId: string;
  name: string;
  email: string;
  role: 'OWNER' | 'REPRESENTATIVE' | 'HR' | 'MEMBER';
  status: string;
  headline?: string;
  username?: string;
  avatarUrl?: string;
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
  followersCount?: number;  // in-store display field (mapped from DEFAULT_DETAILS or followerCount)
  followerCount?: number;   // raw backend field name from WorkspaceDetailsDto
  isFollowing?: boolean;

  companyType?: string;
  branchCount?: number;
  industryTags?: string[];
  benefitTags?: string[];
  galleryUrls?: string[];
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  city?: string;
  detailAddress?: string;
  googleMapsEmbedUrl?: string;
  linkedinUrl?: string;
  facebookUrl?: string;
  twitterUrl?: string;
  taxCode?: string;
  isVerified?: boolean;
  verificationLevel?: number;
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
}export const getTagLabel = (tag: string): string => {
  return tag;
};

export interface Post {
  id: string;
  category: string;
  content: string;
  images: string[];
  likes: number;
  sharesCount: number;
  createdAt: string;
  authorName?: string;
  authorAvatar?: string;
  authorRole?: string;
}

export interface JobRequirementMetadata {
  hiringGoal: {
    reason: string;
    problem: string;
    outcomes: string[];
  };
  prioritizedRequirements: {
    responsibilities: Array<{
      text: string;
      priority: "Must Have" | "Should Have" | "Nice To Have";
      ownershipLevel: "Awareness" | "Contributor" | "Owner" | "Leader";
      isLeadership: boolean;
    }>;
    capabilities: Array<{
      id: string;
      name: string;
      priority: "Must Have" | "Should Have" | "Nice To Have";
      ownershipLevel: "Awareness" | "Contributor" | "Owner" | "Leader";
    }>;
    skills: Array<{
      name: string;
      priority: "Must Have" | "Should Have" | "Nice To Have";
      sfiaLevel: number;
    }>;
  };
  teamCollaboration: {
    teamSize: number;
    reportingTo: string;
    collaborationPartners: string[];
    stakeholderInteractions: string[];
  };
  successMilestones: {
    thirtyDays: string;
    ninetyDays: string;
  };
}

export interface Job {
  id: string;
  organizationId?: string;
  title: string;
  department: string;
  location?: string;
  workplaceType: "Hybrid" | "Remote" | "On-site";
  city: string;
  type: string;
  posted?: string;
  deadline?: string;
  salary: string;
  salaryMinMax: string;
  headcount: number;
  gender: string;
  experience: string;
  degree: string;
  category: string;
  description: string[];
  requirements: string[];
  benefits: string[];
  tags: string[];
  skills: string[];
  coverUrl: string;
  images?: string[];
  isActive?: boolean;
  metadata?: JobRequirementMetadata | string;
  createdAt?: string;
  updatedAt?: string;
}

export interface OrganizationListItem {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  logoUrl?: string;
  bannerUrl?: string;
  description?: string;
  companyType?: string;
  companySize?: string;
  city?: string;
  website?: string;
  industryTags: string[];
  isVerified: boolean;
  verificationLevel: number;
  memberCount: number;
  openPositionsCount: number;
  repositoryCount: number;
  verifiedRepositoryCount: number;
  averageTrustScore: number;
  followerCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationStats {
  totalOrganizations: number;
  verifiedOrganizations: number;
  openOpportunities: number;
  verifiedRepositories: number;
  totalMembers: number;
}

export interface PaginatedOrganizations {
  items: OrganizationListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
}

