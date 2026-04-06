import { LucideIcon } from 'lucide-react';
import { ResourceActionPermission, UserRole } from './auth.types';

export type NavigationNodeType = 'item' | 'group' | 'section';

export interface BaseNavigationNode {
  id: string;
  type: NavigationNodeType;
  label: string;
  translationKey?: string;
  requiredPermissions?: ResourceActionPermission[];
  requiredRoles?: UserRole[];
}

export interface NavigationLinkItem extends BaseNavigationNode {
  type: 'item';
  href: string;
  exactMatch?: boolean;
  icon?: LucideIcon;
  badge?: string | number;
  badgeColor?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
}

export interface NavigationGroupItem extends BaseNavigationNode {
  type: 'group';
  icon?: LucideIcon;
  href?: string;
  children: NavigationNode[];
}

export interface NavigationSectionItem extends BaseNavigationNode {
  type: 'section';
  children: NavigationNode[];
}

export type NavigationNode = NavigationLinkItem | NavigationGroupItem | NavigationSectionItem;
