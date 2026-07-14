import { 
  LayoutDashboard, 
  Users, 
  Shield, 
  ShieldCheck, 
  Inbox, 
  GitFork, 
  FileText, 
  ShieldAlert, 
  BarChart3, 
  Settings, 
  BookOpen,
  type LucideIcon 
} from 'lucide-react';
import { type ResourceActionPermission } from '../types/auth.types';

export interface AdminSubModuleMetadata {
  id: string;
  name: string;
  path: string;
  requiredPermission: ResourceActionPermission;
  featureFlag?: string;
  isEnabled?: boolean;
  order: number;
}

export interface AdminModuleMetadata {
  id: string;
  name: string;
  icon: LucideIcon;
  path: string;
  requiredPermission: ResourceActionPermission;
  featureFlag?: string;
  isEnabled?: boolean;
  parentGroupId?: 'overview' | 'identity' | 'verification' | 'intelligence' | 'security' | 'system';
  order: number;
  subModules?: AdminSubModuleMetadata[];
}

export const adminModuleRegistry: AdminModuleMetadata[] = [
  // 1. Overview
  {
    id: 'admin-dashboard',
    name: 'Dashboard',
    icon: LayoutDashboard,
    path: '/admin',
    requiredPermission: 'admin:dashboard:view',
    parentGroupId: 'overview',
    order: 1,
  },
  // 2. Identity & Access
  {
    id: 'admin-users',
    name: 'Users',
    icon: Users,
    path: '/admin/users',
    requiredPermission: 'users:view:list',
    parentGroupId: 'identity',
    order: 1,
  },
  {
    id: 'admin-roles',
    name: 'Roles & Permissions',
    icon: Shield,
    path: '/admin/roles',
    requiredPermission: 'roles:view:list',
    parentGroupId: 'identity',
    order: 2,
  },
  // 3. Verification
  {
    id: 'admin-verification-queue',
    name: 'Verification Queue',
    icon: Inbox,
    path: '/admin/verification',
    requiredPermission: 'admin:verification:view',
    featureFlag: 'feature:admin:verification-queue',
    parentGroupId: 'verification',
    order: 1,
  },
  // 4. Repository Intelligence
  {
    id: 'admin-repositories',
    name: 'Repository Index',
    icon: GitFork,
    path: '/admin/repositories',
    requiredPermission: 'admin:repositories:view',
    parentGroupId: 'intelligence',
    order: 1,
  },
  // 5. Security
  {
    id: 'admin-audit-logs',
    name: 'Audit Trail',
    icon: FileText,
    path: '/admin/audit-logs',
    requiredPermission: 'admin:ai:audit',
    parentGroupId: 'security',
    order: 1,
  },
  {
    id: 'admin-security-events',
    name: 'Security Events',
    icon: ShieldAlert,
    path: '/admin/security',
    requiredPermission: 'admin:security:view',
    featureFlag: 'feature:admin:security-alerts',
    parentGroupId: 'security',
    order: 2,
  },
  // 6. System & Configuration
  {
    id: 'admin-analytics',
    name: 'Analytics',
    icon: BarChart3,
    path: '/admin/analytics',
    requiredPermission: 'admin:analytics:view',
    parentGroupId: 'system',
    order: 1,
  },
  {
    id: 'admin-system-health',
    name: 'System Diagnostics',
    icon: Settings,
    path: '/admin/system',
    requiredPermission: 'admin:system:view',
    parentGroupId: 'system',
    order: 2,
  },
  {
    id: 'admin-settings',
    name: 'Portal Settings',
    icon: Settings,
    path: '/admin/settings',
    requiredPermission: 'admin:settings:view',
    parentGroupId: 'system',
    order: 3,
  },
  {
    id: 'admin-components',
    name: 'Component Explorer',
    icon: BookOpen,
    path: '/admin/components',
    requiredPermission: 'components:system:read',
    parentGroupId: 'system',
    order: 4,
  },
];
