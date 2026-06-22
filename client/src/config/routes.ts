import { 
  LayoutDashboard, 
  Sparkles, 
  Building2, 
  ShieldAlert, 
  Users, 
  Shield, 
  FileText,
  Settings,
  Trophy,
  type LucideIcon
} from 'lucide-react';

export interface RouteMetadata {
  path: string;
  translationKey: string;
  fallbackLabel: string;
  icon?: LucideIcon;
  isHidden?: boolean;
  parentPath?: string;
}

export const routesConfig: Record<string, RouteMetadata> = {
  '/settings': {
    path: '/settings',
    translationKey: 'common:dashboard.settings',
    fallbackLabel: 'Settings',
    icon: Settings,
  },
  '/settings/source-code-providers': {
    path: '/settings/source-code-providers',
    translationKey: 'common:dashboard.sourceCodeProviders',
    fallbackLabel: 'Connected Repositories',
    parentPath: '/settings',
  },
  '/cv': {
    path: '/cv',
    translationKey: 'common:dashboard.cv',
    fallbackLabel: 'My CV',
    icon: FileText,
  },
  '/user': {
    path: '/user',
    translationKey: 'common:dashboard.travelerHub',
    fallbackLabel: 'Traveler Hub',
    icon: LayoutDashboard,
  },
  '/chat': {
    path: '/chat',
    translationKey: 'common:dashboard.aiPlanner',
    fallbackLabel: 'AI Chat',
    icon: Sparkles,
  },
  '/jobs': {
    path: '/jobs',
    translationKey: 'common:dashboard.jobBoard',
    fallbackLabel: 'Job Board',
  },
  '/workspace/organizations': {
    path: '/workspace/organizations',
    translationKey: 'common:dashboard.organizations',
    fallbackLabel: 'Organizations',
    icon: Building2,
  },
  '/forum': {
    path: '/forum',
    translationKey: 'common:dashboard.forum',
    fallbackLabel: 'Forum',
  },
  '/ranking': {
    path: '/ranking',
    translationKey: 'common:dashboard.ranking',
    fallbackLabel: 'Leaderboard',
    icon: Trophy,
  },
  '/ranking/insights': {
    path: '/ranking/insights',
    translationKey: 'common:dashboard.rankingInsights',
    fallbackLabel: 'Talent Insights',
    icon: Sparkles,
    parentPath: '/ranking',
  },
  '/intelligence/capability-graph': {
    path: '/intelligence/capability-graph',
    translationKey: 'common:dashboard.capabilityGraph',
    fallbackLabel: 'Capability Graph',
  },
  '/intelligence/trust-score': {
    path: '/intelligence/trust-score',
    translationKey: 'common:dashboard.trustScore',
    fallbackLabel: 'Trust Score',
  },
  '/intelligence/ai-analysis': {
    path: '/intelligence/ai-analysis',
    translationKey: 'common:dashboard.aiAnalysis',
    fallbackLabel: 'AI Analysis',
  },
  '/business': {
    path: '/business',
    translationKey: 'common:dashboard.partnerConsole',
    fallbackLabel: 'Partner Console',
    icon: Building2,
  },
  '/admin': {
    path: '/admin',
    translationKey: 'common:dashboard.systemAdmin',
    fallbackLabel: 'Admin',
    icon: ShieldAlert,
  },
  '/admin/users': {
    path: '/admin/users',
    translationKey: 'common:admin.users',
    fallbackLabel: 'Users',
    icon: Users,
    parentPath: '/admin',
  },
  '/admin/roles': {
    path: '/admin/roles',
    translationKey: 'common:admin.rolesMatrix',
    fallbackLabel: 'Roles Matrix',
    icon: Shield,
    parentPath: '/admin',
  },
  '/admin/audit-logs': {
    path: '/admin/audit-logs',
    translationKey: 'common:admin.auditTrail',
    fallbackLabel: 'Audit Trail',
    icon: FileText,
    parentPath: '/admin',
  },
};

/**
 * Checks if a string is a standard UUID.
 */
const isUUID = (str: string): boolean => {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(str);
};

/**
 * Checks if a string is a simple numeric ID.
 */
const isNumeric = (str: string): boolean => {
  return /^\d+$/.test(str);
};

/**
 * Resolves a dynamic route segment into a readable string fallback.
 */
export const getDynamicSegmentLabel = (segment: string): string => {
  const lower = segment.toLowerCase();
  if (lower === "jd") {
    return "Job Descriptions";
  }
  if (lower === "intelligence") {
    return "Talent Discovery";
  }
  if (lower === "information") {
    return "Company Profile";
  }
  if (lower === "members") {
    return "Team Members";
  }
  if (lower === "roles") {
    return "Access Control";
  }
  if (lower === "settings") {
    return "Workspace Settings";
  }
  if (lower === "billing") {
    return "Billing & Subscription";
  }
  if (lower === "posts") {
    return "Company Posts";
  }
  if (lower === "people") {
    return "Members";
  }
  if (lower === "jobs") {
    return "Job Board";
  }
  if (lower === "dashboard") {
    return "Dashboard";
  }

  if (isUUID(segment)) {
    return `Ref: ${segment.slice(0, 8)}`;
  }
  if (isNumeric(segment)) {
    return `#${segment}`;
  }
  
  // Return cleaned title casing for normal slugs
  const clean = segment.replace(/-/g, ' ');
  return clean.charAt(0).toUpperCase() + clean.slice(1);
};

/**
 * Finds matching route metadata for a path, handling both static and dynamic routes.
 */
export const getRouteMetadata = (pathname: string): RouteMetadata | null => {
  if (routesConfig[pathname]) {
    return routesConfig[pathname];
  }

  // Iterate registry patterns
  const keys = Object.keys(routesConfig);
  for (const key of keys) {
    // Transform parameterized patterns to Regex
    // E.g. '/admin/users/[id]' or '/admin/users/:id' -> '/admin/users/[^/]+'
    const pattern = key
      .replace(/\[[^\]]+\]/g, '[^/]+')
      .replace(/:[a-zA-Z0-9_]+/g, '[^/]+');
      
    const regex = new RegExp(`^${pattern}$`);
    if (regex.test(pathname)) {
      return routesConfig[key];
    }
  }

  return null;
};
