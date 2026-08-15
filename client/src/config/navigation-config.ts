import { 
  LayoutDashboard,
  Building2, 
  ShieldAlert, 
  Users, 
  Shield, 
  FileText,
  Briefcase,
  MessageSquare,
  UserCircle,
  Orbit,
  ShieldCheck,
  Sparkles,
  GitFork,
  Folder,
  Compass,
  Target,
  Bookmark,
  Inbox,
  User,
  GraduationCap,
  Award,
  Trophy,
  CreditCard,
  Settings,
  TrendingUp,
  HandCoins,
  Globe,
  BarChart3,
  Home,
  CheckCircle2
} from 'lucide-react';
import { type NavigationNode, type NavigationSectionItem } from '../types/navigation.types';

// 1. COMPANY-SCOPED NAVIGATION
export const companyNavigationConfig: NavigationNode[] = [
  {
    id: 'general-section',
    type: 'section',
    label: 'General',
    children: [
      {
        id: 'company-overview',
        type: 'item',
        label: 'Overview',
        href: '/business/[slug]/dashboard',
        icon: LayoutDashboard,
        exactMatch: true,
      },
      {
        id: 'company-workspaces',
        type: 'item',
        label: 'Workspaces',
        href: '/business/[slug]/workspaces',
        icon: Building2,
        exactMatch: true,
        requiredWorkspacePermissions: ['organization:workspaces:view'],
      },
      {
        id: 'company-public-page-group',
        type: 'group',
        label: 'Public Page',
        href: '/business/[slug]',
        icon: Globe,
        children: [
          {
            id: 'public-page-home',
            type: 'item',
            label: 'Home',
            href: '/business/[slug]',
            icon: Home,
            exactMatch: true,
          },
          {
            id: 'public-page-jobs',
            type: 'item',
            label: 'Jobs',
            href: '/business/[slug]/jobs',
            icon: Briefcase,
          },
          {
            id: 'public-page-posts',
            type: 'item',
            label: 'Posts',
            href: '/business/[slug]/posts',
            icon: FileText,
          },
          {
            id: 'public-page-members',
            type: 'item',
            label: 'Members',
            href: '/business/[slug]/people',
            icon: Users,
          },
        ],
      },
    ],
  },
  {
    id: 'talent-intelligence-section',
    type: 'section',
    label: 'Talent Intelligence',
    children: [
      {
        id: 'company-talent-pool',
        type: 'item',
        label: 'Talent Pool',
        href: '/business/[slug]/talent-pool',
        icon: Bookmark,
      },
      {
        id: 'company-candidate-discovery',
        type: 'item',
        label: 'Candidate Discovery',
        href: '/business/[slug]/intelligence',
        icon: Compass,
      },
      {
        id: 'company-rankings',
        type: 'item',
        label: 'Rankings',
        href: '/business/[slug]/rankings',
        icon: Trophy,
      },
      {
        id: 'company-insights',
        type: 'item',
        label: 'Insights',
        href: '/business/[slug]/insights',
        icon: BarChart3,
      },
    ],
  },
  {
    id: 'organization-section',
    type: 'section',
    label: 'Organization',
    children: [
      {
        id: 'company-members',
        type: 'item',
        label: 'Members',
        href: '/business/[slug]/members',
        icon: Users,
        requiredWorkspacePermissions: ['organization:members:view'],
      },
      {
        id: 'company-roles',
        type: 'item',
        label: 'Roles',
        href: '/business/[slug]/roles',
        icon: Shield,
        requiredWorkspacePermissions: ['organization:roles:view', 'organization:roles:manage'],
      },
    ],
  },
  {
    id: 'administration-section',
    type: 'section',
    label: 'Administration',
    children: [
      {
        id: 'company-billing',
        type: 'item',
        label: 'Billing',
        href: '/business/[slug]/billing',
        icon: CreditCard,
        requiredWorkspacePermissions: ['billing:invoice:view', 'billing:subscription:manage'],
      },
      {
        id: 'company-verification',
        type: 'item',
        label: 'Verification',
        href: '/business/[slug]/verification',
        icon: ShieldCheck,
      },
      {
        id: 'company-settings',
        type: 'item',
        label: 'Settings',
        href: '/business/[slug]/settings',
        icon: Settings,
        requiredWorkspacePermissions: ['organization:settings:edit', 'organization:profile:edit'],
      },
    ],
  },
];

// 2. WORKSPACE-SCOPED NAVIGATION
export const workspaceNavigationConfig: NavigationNode[] = [
  {
    id: 'workspace-dashboard',
    type: 'item',
    label: 'Dashboard',
    href: '/business/[slug]/recruitment/dashboard',
    icon: LayoutDashboard,
    exactMatch: true,
  },
  {
    id: 'recruitment-section',
    type: 'section',
    label: 'Recruitment',
    children: [
      {
        id: 'workspace-jobs',
        type: 'item',
        label: 'Jobs',
        href: '/business/[slug]/recruitment/jd',
        icon: Briefcase,
      },
      {
        id: 'workspace-candidates',
        type: 'item',
        label: 'Candidates',
        href: '/business/[slug]/recruitment/candidates',
        icon: Users,
      },
      {
        id: 'workspace-applications',
        type: 'item',
        label: 'Applications',
        href: '/business/[slug]/recruitment/applications',
        icon: FileText,
      },
      {
        id: 'workspace-interviews',
        type: 'item',
        label: 'Interviews',
        href: '/business/[slug]/recruitment/interviews',
        icon: Sparkles,
      },
      {
        id: 'workspace-pipeline',
        type: 'item',
        label: 'Pipeline',
        href: '/business/[slug]/recruitment/pipeline',
        icon: TrendingUp,
      },
    ],
  },
  {
    id: 'workspace-admin-section',
    type: 'section',
    label: 'Workspace Administration',
    children: [
      {
        id: 'workspace-members',
        type: 'item',
        label: 'Members',
        href: '/business/[slug]/workspace/members',
        icon: Users,
        requiredWorkspacePermissions: ['workspace:members:manage'],
      },
      {
        id: 'workspace-settings',
        type: 'item',
        label: 'Settings',
        href: '/business/[slug]/workspace/settings',
        icon: Settings,
        requiredWorkspacePermissions: ['workspace:settings:update'],
      },
    ],
  },
];

// 3. CANDIDATE-SCOPED NAVIGATION
export const candidateNavigationConfig: NavigationNode[] = [
  {
    id: 'candidate-general-section',
    type: 'section',
    label: 'General',
    requiredRoles: ['USER', 'ADMIN'],
    children: [
      {
        id: 'candidate-jobs-group',
        type: 'group',
        label: 'Job Board',
        href: '/jobs',
        icon: Briefcase,
        children: [
          {
            id: 'jobs-explore',
            type: 'item',
            label: 'Explore',
            href: '/jobs',
            icon: Briefcase,
            exactMatch: true,
          },
          {
            id: 'jobs-recommended',
            type: 'item',
            label: 'Recommended',
            href: '/jobs?tab=recommended',
            icon: Sparkles,
          },
          {
            id: 'jobs-saved',
            type: 'item',
            label: 'Saved',
            href: '/jobs?tab=saved',
            icon: Bookmark,
          },
          {
            id: 'jobs-applied',
            type: 'item',
            label: 'Applied',
            href: '/jobs?tab=applied',
            icon: CheckCircle2,
          },
        ],
      },
      {
        id: 'candidate-forum',
        type: 'item',
        label: 'Forum',
        href: '/forum',
        icon: MessageSquare,
      },
      {
        id: 'candidate-organizations',
        type: 'item',
        label: 'Organizations',
        href: '/workspace/organizations',
        icon: Building2,
      },
      {
        id: 'ranking-group',
        type: 'group',
        label: 'Leaderboard',
        href: '/ranking/insights',
        icon: Trophy,
        children: [
          {
            id: 'ranking-insights',
            type: 'item',
            label: 'Insights',
            href: '/ranking/insights',
            icon: Sparkles,
          },
          {
            id: 'ranking-candidates',
            type: 'item',
            label: 'Rankings',
            href: '/ranking',
            icon: Trophy,
            exactMatch: true,
          },
        ],
      },
    ],
  },
  {
    id: 'candidate-section',
    type: 'section',
    label: 'Candidate',
    requiredRoles: ['USER', 'ADMIN'],
    children: [
      {
        id: 'candidate-dashboard',
        type: 'item',
        label: 'Dashboard',
        href: '/user',
        icon: LayoutDashboard,
      },
      {
        id: 'candidate-profile',
        type: 'item',
        label: 'Professional Profile',
        href: '/[username]',
        icon: UserCircle,
      },
      {
        id: 'candidate-cv-group',
        type: 'group',
        label: 'My CV',
        href: '/cv',
        icon: FileText,
        children: [
          {
            id: 'cv-overview',
            type: 'item',
            label: 'Overview',
            href: '/cv',
            icon: FileText,
            exactMatch: true,
          },
          {
            id: 'cv-basic-info',
            type: 'item',
            label: 'Basic Information',
            href: '/cv?tab=basic-info',
            icon: User,
          },
          {
            id: 'cv-skills',
            type: 'item',
            label: 'Target Skills',
            href: '/cv?tab=skills',
            icon: Sparkles,
          },
          {
            id: 'cv-projects',
            type: 'item',
            label: 'Linked Projects',
            href: '/cv?tab=projects',
            icon: Folder,
          },
          {
            id: 'cv-experience',
            type: 'item',
            label: 'Work Experience',
            href: '/cv?tab=experience',
            icon: Briefcase,
          },
          {
            id: 'cv-education',
            type: 'item',
            label: 'Education',
            href: '/cv?tab=education',
            icon: GraduationCap,
          },
          {
            id: 'cv-achievements',
            type: 'item',
            label: 'Achievements & Certificates',
            href: '/cv?tab=achievements',
            icon: Award,
          },
          {
            id: 'cv-preferences',
            type: 'item',
            label: 'Career Preferences',
            href: '/cv?tab=preferences',
            icon: Target,
          },
        ],
      },
    ],
  },
  {
    id: 'candidate-intelligence-section',
    type: 'section',
    label: 'Intelligence',
    requiredRoles: ['USER', 'ADMIN'],
    children: [
      {
        id: 'intelligence-skill-tree',
        type: 'item',
        label: 'Skill Tree',
        href: '/intelligence/skill-tree',
        icon: GitFork,
      },
      {
        id: 'intelligence-trust-score',
        type: 'item',
        label: 'Trust Score',
        href: '/intelligence/trust-score',
        icon: ShieldCheck,
      },
      {
        id: 'intelligence-ai-analysis',
        type: 'item',
        label: 'AI Analysis',
        href: '/intelligence/ai-analysis',
        icon: Sparkles,
      },
      {
        id: 'intelligence-repositories',
        type: 'item',
        label: 'Repositories',
        href: '/settings/source-code-providers',
        icon: GitFork,
      },
    ],
  },
];

// 4. SYSTEM ADMIN-SCOPED NAVIGATION (Dynamically generated from Admin Module Registry)
import { adminModuleRegistry } from './admin-module-registry';

const createAdminSection = (
  id: string,
  label: string,
  groupId: 'overview' | 'identity' | 'verification' | 'intelligence' | 'security' | 'system'
): NavigationSectionItem => {
  const children = adminModuleRegistry
    .filter((m) => m.parentGroupId === groupId)
    .sort((a, b) => a.order - b.order)
    .map((m) => {
      const node: NavigationNode = {
        id: m.id,
        type: 'item',
        label: m.name,
        href: m.path,
        icon: m.icon,
        requiredPermissions: [m.requiredPermission],
        requiredRoles: ['ADMIN'],
        exactMatch: m.path === '/admin',
        featureFlag: m.featureFlag,
      };

      if (m.subModules && m.subModules.length > 0) {
        return {
          id: m.id,
          type: 'group',
          label: m.name,
          icon: m.icon,
          requiredPermissions: [m.requiredPermission],
          requiredRoles: ['ADMIN'],
          featureFlag: m.featureFlag,
          children: m.subModules
            .sort((a, b) => a.order - b.order)
            .map((sm) => ({
              id: sm.id,
              type: 'item',
              label: sm.name,
              href: sm.path,
              requiredPermissions: [sm.requiredPermission],
              requiredRoles: ['ADMIN'],
              featureFlag: sm.featureFlag,
            })),
        } as NavigationNode;
      }

      return node;
    });

  return {
    id,
    type: 'section',
    label,
    requiredRoles: ['ADMIN'],
    children,
  };
};

export const adminNavigationConfig: NavigationNode[] = [
  createAdminSection('admin-overview-section', 'Overview', 'overview'),
  createAdminSection('admin-identity-section', 'Identity & Access', 'identity'),
  createAdminSection('admin-verification-section', 'Enterprise Operations', 'verification'),
  createAdminSection('admin-intelligence-section', 'AI Operations', 'intelligence'),
  createAdminSection('admin-security-section', 'Security', 'security'),
  createAdminSection('admin-system-section', 'Monitoring', 'system'),
].filter((section) => section.children.length > 0);

export const adminCompanyNavigationConfig: NavigationNode[] = [
  {
    id: 'admin-company-management-section',
    type: 'section',
    label: 'Company Management',
    requiredRoles: ['ADMIN'],
    children: [
      {
        id: 'admin-company-directory',
        type: 'item',
        label: 'Company Directory',
        href: '/business/companies',
        icon: Building2,
      },
      {
        id: 'admin-employer-directory',
        type: 'item',
        label: 'Employer Directory',
        href: '/business/employers',
        icon: Users,
      },
      {
        id: 'admin-job-moderation',
        type: 'item',
        label: 'Job Moderation',
        href: '/business/jobs',
        icon: Briefcase,
      },
      {
        id: 'admin-verification-workflows',
        type: 'item',
        label: 'Verification Workflows',
        href: '/business/verification',
        icon: ShieldCheck,
      },
      {
        id: 'admin-company-analytics',
        type: 'item',
        label: 'Company Analytics',
        href: '/business/analytics',
        icon: BarChart3,
      },
    ],
  },
];

export const adminCandidateNavigationConfig: NavigationNode[] = [
  {
    id: 'admin-candidate-management-section',
    type: 'section',
    label: 'Candidate Management',
    requiredRoles: ['ADMIN'],
    children: [
      {
        id: 'admin-candidate-directory',
        type: 'item',
        label: 'Candidate Directory',
        href: '/admin/users',
        icon: Users,
      },
      {
        id: 'admin-repository-index',
        type: 'item',
        label: 'Repository Index',
        href: '/admin/repositories',
        icon: GitFork,
      },
      {
        id: 'admin-verification-queue',
        type: 'item',
        label: 'Verification Queue',
        href: '/admin/verification',
        icon: ShieldCheck,
      },
    ],
  },
];

// Legacy export fallback
export const navigationConfig = companyNavigationConfig;
