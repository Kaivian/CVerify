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
}export const TAG_TRANSLATIONS: Record<string, string> = {
  "Web Development": "PhÃ¡t triá»ƒn Web",
  "Mobile Development": "PhÃ¡t triá»ƒn Di Ä‘á»™ng",
  "Embedded Systems": "Há»‡ thá»‘ng nhÃºng",
  "Cloud Computing": "Äiá»‡n toÃ¡n Ä‘Ã¡m mÃ¢y",
  "Artificial Intelligence": "TrÃ­ tuá»‡ nhÃ¢n táº¡o (AI)",
  "Machine Learning": "Há»c mÃ¡y",
  "Data Science": "Khoa há»c dá»¯ liá»‡u",
  "Computer Vision": "Thá»‹ giÃ¡c mÃ¡y tÃ­nh",
  "Semiconductor": "BÃ¡n dáº«n",
  "IC Design": "Thiáº¿t káº¿ vi máº¡ch",
  "IoT (Internet of Things)": "Internet váº¡n váº­t (IoT)",
  "Microelectronics": "Vi Ä‘iá»‡n tá»­",
  "Healthcare": "ChÄƒm sÃ³c sá»©c khá»e",
  "Remote Work": "LÃ m viá»‡c tá»« xa",
  "Flexible Hours": "Giá» lÃ m viá»‡c linh hoáº¡t",
  "Training": "ÄÃ o táº¡o & PhÃ¡t triá»ƒn",
  "Free Lunch": "Ä‚n trÆ°a miá»…n phÃ­",
  "Gym Membership": "Há»— trá»£ phÃ²ng gym",
  "Stock Options": "Cá»• phiáº¿u thÆ°á»Ÿng",
  "Performance Bonus": "ThÆ°á»Ÿng hiá»‡u suáº¥t",
  "Laptop Provided": "Cung cáº¥p laptop",
  "Team Building": "Du lá»‹ch & Team Building",
  "Paid Time Off": "Nghá»‰ phÃ©p cÃ³ lÆ°Æ¡ng",
};

export const getTagLabel = (tag: string): string => {
  return TAG_TRANSLATIONS[tag] || tag;
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
  createdAt?: string;
  updatedAt?: string;
}
