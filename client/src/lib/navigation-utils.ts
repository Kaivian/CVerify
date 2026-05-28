import { type NavigationNode } from '../types/navigation.types';
import { type ResourceActionPermission, type UserRole } from '../types/auth.types';

/**
 * Checks if a navigation item's href matches the current route pathname.
 * Handles exact matching and active-descendant path prefixes.
 */
export const RESERVED_USERNAMES = new Set([
  "admin", "api", "login", "register", "settings", "dashboard", "profile", "privacy", "terms", "support", "help",
  "chat", "business", "user", "organization", "organizations", "auth", "system", "unauthorized", "company-onboarding",
  "company-verification", "continue-with-email", "forgot-password", "gateway", "reset-password", "verify-email", "workspace-setup",
  "cv", "jobs", "forum", "intelligence", "applications", "repositories", "projects"
]);

/**
 * Checks if a navigation item's href matches the current route pathname.
 * Handles exact matching, short routes, nested routes, and active-descendant path hierarchies.
 */
export const isActiveRoute = (
  pathname: string,
  href: string,
  exact: boolean = false,
  itemId?: string,
  username?: string,
  searchParams?: Record<string, string>
): boolean => {
  if (href === '/') {
    return pathname === '/';
  }

  // Helper check for root and normalization
  const cleanPath = pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  const cleanHref = href.endsWith('/') && href.length > 1 ? href.slice(0, -1) : href;

  // 1. Dashboard matching
  if (itemId === 'candidate-dashboard' || cleanHref === '/user' || cleanHref === '/dashboard') {
    return (
      cleanPath === '/user' ||
      cleanPath.startsWith('/user/') ||
      cleanPath === '/dashboard' ||
      cleanPath.startsWith('/dashboard/')
    );
  }

  // 2. My CV matching
  if (itemId === 'candidate-cv-group') {
    return (
      cleanPath === '/cv' ||
      cleanPath.startsWith('/cv/') ||
      cleanPath === '/my-cv' ||
      cleanPath.startsWith('/my-cv/')
    );
  }

  // 2a. CV Sub-items matching
  if (itemId === 'cv-overview') {
    const isCvPage = cleanPath === '/cv' || cleanPath === '/my-cv';
    const tab = searchParams?.tab;
    return isCvPage && (!tab || tab === 'overview');
  }

  if (itemId === 'cv-basic-info') {
    const isCvPage = cleanPath === '/cv' || cleanPath === '/my-cv';
    return isCvPage && searchParams?.tab === 'basic-info';
  }

  if (itemId === 'cv-skills') {
    const isCvPage = cleanPath === '/cv' || cleanPath === '/my-cv';
    return isCvPage && searchParams?.tab === 'skills';
  }

  if (itemId === 'cv-projects') {
    const isCvPage = cleanPath === '/cv' || cleanPath === '/my-cv';
    return isCvPage && searchParams?.tab === 'projects';
  }

  if (itemId === 'cv-experience') {
    const isCvPage = cleanPath === '/cv' || cleanPath === '/my-cv';
    return isCvPage && searchParams?.tab === 'experience';
  }

  if (itemId === 'cv-education') {
    const isCvPage = cleanPath === '/cv' || cleanPath === '/my-cv';
    return isCvPage && searchParams?.tab === 'education';
  }

  if (itemId === 'cv-achievements') {
    const isCvPage = cleanPath === '/cv' || cleanPath === '/my-cv';
    return isCvPage && searchParams?.tab === 'achievements';
  }

  if (itemId === 'cv-preferences') {
    const isCvPage = cleanPath === '/cv' || cleanPath === '/my-cv';
    return isCvPage && searchParams?.tab === 'preferences';
  }

  // 3. Professional Profile matching (dynamic username check)
  if (itemId === 'candidate-profile' || cleanHref === '/user/profile' || (username && cleanHref.toLowerCase() === '/' + username.toLowerCase())) {
    // Check if path matches current user's username
    if (username && cleanPath.toLowerCase() === '/' + username.toLowerCase()) {
      return true;
    }
    // Check if path is a single non-reserved segment (e.g. /john-doe)
    const segments = cleanPath.split('/').filter(Boolean);
    if (segments.length === 1 && !RESERVED_USERNAMES.has(segments[0].toLowerCase())) {
      return true;
    }
    return cleanPath === '/user/profile' || cleanPath.startsWith('/user/profile/');
  }

  // 4. Capability Graph matching
  if (itemId === 'intelligence-capability-graph' || cleanHref === '/intelligence/capability-graph') {
    return cleanPath === '/intelligence/capability-graph' || cleanPath.startsWith('/intelligence/capability-graph/');
  }

  // 5. Trust Score matching
  if (itemId === 'intelligence-trust-score' || cleanHref === '/intelligence/trust-score') {
    return cleanPath === '/intelligence/trust-score' || cleanPath.startsWith('/intelligence/trust-score/');
  }

  // 6. AI Analysis matching
  if (itemId === 'intelligence-ai-analysis' || cleanHref === '/intelligence/ai-analysis' || cleanHref === '/ai-analysis') {
    return (
      cleanPath === '/intelligence/ai-analysis' ||
      cleanPath.startsWith('/intelligence/ai-analysis/') ||
      cleanPath === '/ai-analysis' ||
      cleanPath.startsWith('/ai-analysis/')
    );
  }

  // 7. Explore Jobs matching
  if (itemId === 'jobs-explore') {
    const isJobsPage = cleanPath === '/jobs' || cleanPath.startsWith('/jobs/');
    const tab = searchParams?.tab;
    return isJobsPage && (!tab || tab === 'explore');
  }

  // 8. Recommended Jobs matching
  if (itemId === 'jobs-recommended' || cleanHref.includes('tab=recommended')) {
    const isJobsPage = cleanPath === '/jobs' || cleanPath.startsWith('/jobs/');
    return isJobsPage && searchParams?.tab === 'recommended';
  }

  // 9. Saved Jobs matching
  if (itemId === 'jobs-saved' || cleanHref.includes('tab=saved')) {
    const isJobsPage = cleanPath === '/jobs' || cleanPath.startsWith('/jobs/');
    return isJobsPage && searchParams?.tab === 'saved';
  }

  // 10. Applied Jobs / Applications matching
  if (
    itemId === 'jobs-applied' || 
    itemId === 'jobs-applications' || 
    cleanHref === '/applications' || 
    cleanHref.includes('tab=applied') || 
    cleanHref.includes('tab=applications')
  ) {
    const isApplicationsPath = cleanPath === '/applications' || cleanPath.startsWith('/applications/');
    const isJobsPage = cleanPath === '/jobs' || cleanPath.startsWith('/jobs/');
    const isAppliedTab = searchParams?.tab === 'applied' || searchParams?.tab === 'applications';
    return isApplicationsPath || (isJobsPage && isAppliedTab);
  }

  // 11. Repositories matching
  if (itemId === 'intelligence-repositories' || cleanHref === '/settings/source-code-providers' || cleanHref === '/repositories') {
    return (
      cleanPath === '/settings/source-code-providers' ||
      cleanPath.startsWith('/settings/source-code-providers/') ||
      cleanPath === '/repositories' ||
      cleanPath.startsWith('/repositories/')
    );
  }

  // 12. Organizations matching
  if (itemId === 'organizations' || cleanHref === '/workspace/organizations') {
    return cleanPath === '/workspace/organizations' || cleanPath.startsWith('/workspace/');
  }

  if (exact) {
    return cleanPath === cleanHref;
  }

  // Standard fallback exact match or matching dynamic paths underneath
  const targetHrefWithoutQuery = cleanHref.split('?')[0];
  return cleanPath === targetHrefWithoutQuery || cleanPath.startsWith(targetHrefWithoutQuery + '/');
};

/**
 * Recursively filters navigation items against the user's role and granular permissions.
 * If all children of a group or section are filtered out, the group/section itself is hidden.
 */
export const filterNavigationNodes = (
  nodes: NavigationNode[],
  userRole: UserRole,
  hasPermission: (permission: ResourceActionPermission) => boolean
): NavigationNode[] => {
  return nodes
    .map((node) => {
      // 1. Role-based check
      if (node.requiredRoles && !node.requiredRoles.includes(userRole)) {
        return null;
      }

      // 2. Permission-based check
      if (node.requiredPermissions) {
        const passes = node.requiredPermissions.some((p) => hasPermission(p));
        if (!passes) {
          return null;
        }
      }

      // 3. Recursive filtering for children
      if (node.type === 'group' || node.type === 'section') {
        const filteredChildren = filterNavigationNodes(node.children, userRole, hasPermission);
        
        // Hide structural containers if they contain no visible children
        if (filteredChildren.length === 0) {
          return null;
        }
        
        return {
          ...node,
          children: filteredChildren,
        } as NavigationNode;
      }

      return node;
    })
    .filter((node): node is NavigationNode => node !== null);
};

/**
 * Traverses the navigation tree to identify parent groups that should be
 * auto-expanded because one of their descendants is currently active.
 */
export const getExpandedGroupsForPath = (
  nodes: NavigationNode[],
  pathname: string
): Record<string, boolean> => {
  const expanded: Record<string, boolean> = {};

  const traverse = (node: NavigationNode, parentIds: string[]): boolean => {
    if (node.type === 'item') {
      if (isActiveRoute(pathname, node.href, node.exactMatch)) {
        parentIds.forEach((id) => {
          expanded[id] = true;
        });
        return true;
      }
    } else if (node.type === 'group' || node.type === 'section') {
      let childMatched = false;
      for (const child of node.children) {
        // Sections don't collapse/expand visually in the accordion (they are static headers),
        // so we only accumulate group IDs as collapsible parents.
        const nextParents = node.type === 'group' ? [...parentIds, node.id] : parentIds;
        const matched = traverse(child, nextParents);
        if (matched) {
          childMatched = true;
        }
      }
      return childMatched;
    }
    return false;
  };

  nodes.forEach((node) => traverse(node, []));
  return expanded;
};
