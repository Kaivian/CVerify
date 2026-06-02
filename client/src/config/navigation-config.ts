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
  BarChart3
} from 'lucide-react';
import { type NavigationNode } from '../types/navigation.types';

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
        href: '/workspace/[slug]/dashboard',
        icon: LayoutDashboard,
        exactMatch: true,
      },
      {
        id: 'company-workspaces',
        type: 'item',
        label: 'Workspaces',
        href: '/workspace/[slug]/workspaces',
        icon: Building2,
        exactMatch: true,
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
        href: '/workspace/[slug]/talent-pool',
        icon: Bookmark,
      },
      {
        id: 'company-candidate-discovery',
        type: 'item',
        label: 'Candidate Discovery',
        href: '/workspace/[slug]/intelligence',
        icon: Compass,
      },
      {
        id: 'company-rankings',
        type: 'item',
        label: 'Rankings',
        href: '/workspace/[slug]/rankings',
        icon: Trophy,
      },
      {
        id: 'company-insights',
        type: 'item',
        label: 'Insights',
        href: '/workspace/[slug]/insights',
        icon: BarChart3,
      },
    ],
  },
  {
    id: 'organization-section',
    type: 'section',
    label: 'Organization',
    requiredRoles: ['BUSINESS', 'ADMIN'],
    children: [
      {
        id: 'company-members',
        type: 'item',
        label: 'Members',
        href: '/workspace/[slug]/members',
        icon: Users,
      },
      {
        id: 'company-roles',
        type: 'item',
        label: 'Roles',
        href: '/workspace/[slug]/roles',
        icon: Shield,
        requiredWorkspacePermissions: ['organization:roles:view', 'organization:roles:manage'],
      },
    ],
  },
  {
    id: 'administration-section',
    type: 'section',
    label: 'Administration',
    requiredRoles: ['BUSINESS', 'ADMIN'],
    children: [
      {
        id: 'company-billing',
        type: 'item',
        label: 'Billing',
        href: '/workspace/[slug]/billing',
        icon: CreditCard,
        requiredWorkspacePermissions: ['billing:invoice:view', 'billing:subscription:manage'],
      },
      {
        id: 'company-verification',
        type: 'item',
        label: 'Verification',
        href: '/workspace/[slug]/verification',
        icon: ShieldCheck,
      },
      {
        id: 'company-settings',
        type: 'item',
        label: 'Settings',
        href: '/workspace/[slug]/settings',
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
    href: '/workspace/[slug]/recruitment/dashboard',
    icon: LayoutDashboard,
    exactMatch: true,
  },
  {
    id: 'recruitment-section',
    type: 'section',
    label: 'Recruitment',
    requiredRoles: ['BUSINESS', 'ADMIN'],
    children: [
      {
        id: 'workspace-jobs',
        type: 'item',
        label: 'Jobs',
        href: '/workspace/[slug]/recruitment/jd',
        icon: Briefcase,
      },
      {
        id: 'workspace-candidates',
        type: 'item',
        label: 'Candidates',
        href: '/workspace/[slug]/recruitment/candidates',
        icon: Users,
      },
      {
        id: 'workspace-applications',
        type: 'item',
        label: 'Applications',
        href: '/workspace/[slug]/recruitment/applications',
        icon: FileText,
      },
      {
        id: 'workspace-interviews',
        type: 'item',
        label: 'Interviews',
        href: '/workspace/[slug]/recruitment/interviews',
        icon: Sparkles,
      },
      {
        id: 'workspace-pipeline',
        type: 'item',
        label: 'Pipeline',
        href: '/workspace/[slug]/recruitment/pipeline',
        icon: TrendingUp,
      },
    ],
  },
  {
    id: 'workspace-admin-section',
    type: 'section',
    label: 'Workspace Administration',
    requiredRoles: ['BUSINESS', 'ADMIN'],
    children: [
      {
        id: 'workspace-members',
        type: 'item',
        label: 'Members',
        href: '/workspace/[slug]/workspace/members',
        icon: Users,
      },
      {
        id: 'workspace-settings',
        type: 'item',
        label: 'Settings',
        href: '/workspace/[slug]/workspace/settings',
        icon: Settings,
      },
    ],
  },
];

// 3. CANDIDATE-SCOPED NAVIGATION
export const candidateNavigationConfig: NavigationNode[] = [
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
        href: '/user/profile',
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
];

// 4. SYSTEM ADMIN-SCOPED NAVIGATION
export const adminNavigationConfig: NavigationNode[] = [
  {
    id: 'admin-section',
    type: 'section',
    label: 'Administration',
    requiredRoles: ['ADMIN'],
    children: [
      {
        id: 'admin-group',
        type: 'group',
        label: 'System Admin',
        icon: ShieldAlert,
        children: [
          {
            id: 'admin-overview',
            type: 'item',
            label: 'Admin',
            href: '/admin',
            exactMatch: true,
            icon: LayoutDashboard,
          },
          {
            id: 'admin-users',
            type: 'item',
            label: 'Users',
            href: '/admin/users',
            icon: Users,
            requiredPermissions: ['users:view:list'],
          },
          {
            id: 'admin-roles',
            type: 'item',
            label: 'Roles Matrix',
            href: '/admin/roles',
            icon: Shield,
            requiredPermissions: ['roles:view:list'],
          },
          {
            id: 'admin-audit-logs',
            type: 'item',
            label: 'Audit Trail',
            href: '/admin/audit-logs',
            icon: FileText,
            requiredPermissions: ['ai:audit:view'],
          },
        ],
      },
    ],
  },
];

// Legacy export fallback
export const navigationConfig = companyNavigationConfig;
