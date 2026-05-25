import { NavigationNode } from '../types/navigation.types';
import { ResourceActionPermission, UserRole } from '../types/auth.types';

/**
 * Checks if a navigation item's href matches the current route pathname.
 * Handles exact matching and active-descendant path prefixes.
 */
export const isActiveRoute = (pathname: string, href: string, exact: boolean = false): boolean => {
  if (href === '/') {
    return pathname === '/';
  }
  if (exact) {
    return pathname === href;
  }
  
  // Standard exact match or matching dynamic paths underneath
  return pathname === href || pathname.startsWith(href + '/');
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
