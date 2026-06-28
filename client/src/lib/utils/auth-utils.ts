import { type UserRole } from '../../types/auth.types';

/**
 * Centrally normalizes database and JWT claim roles to the frontend UserRole type.
 * Maps 'SUPER_ADMIN' (from C# seed records) to 'ADMIN' for frontend compatibility.
 * Normalized values are mapped to uppercase. Supports multi-role scenarios by
 * matching the highest privileged role in the order of: ADMIN, BUSINESS, USER.
 *
 * @param roles - String array, single string, or undefined/null role from token or DTO
 * @returns UserRole - 'ADMIN' | 'BUSINESS' | 'USER'
 */
export function normalizeRole(roles: string[] | string | undefined | null): UserRole {
  if (!roles) {
    return 'USER';
  }

  let rolesList: string[] = [];

  if (Array.isArray(roles)) {
    rolesList = roles;
  } else if (typeof roles === 'string') {
    // Handle comma-separated list of roles if present
    rolesList = roles.split(',').map((r) => r.trim());
  }

  const normalized = rolesList
    .filter(Boolean)
    .map((role) => role.toUpperCase());

  // Rank 1: Administrator privileges (map SUPER_ADMIN to ADMIN)
  if (normalized.includes('SUPER_ADMIN') || normalized.includes('ADMIN')) {
    return 'ADMIN';
  }

  // Rank 2: Business partner privileges
  if (normalized.includes('BUSINESS')) {
    return 'BUSINESS';
  }

  // Default Rank 3: Basic traveler
  return 'USER';
}

/**
 * Validates that a path is strictly internal to prevent open redirect vulnerabilities.
 * A valid internal path must start with a single '/' and not be followed by another '/' or '\'.
 */
export function isValidInternalPath(path: string | null | undefined): boolean {
  if (!path) return false;
  if (!path.startsWith('/')) return false;
  
  // Prevent protocol-relative redirects (e.g. //evil.com or /\evil.com)
  if (path.startsWith('//') || path.startsWith('/\\') || path.startsWith('\\')) {
    return false;
  }
  
  return true;
}

/**
 * Determines whether a pathname requires an authenticated session.
 * Protects:
 * - /admin, /business, /user, /chat, /cv, /settings, and their sub-routes.
 * - Private sub-routes under /business (e.g. /business/{slug}/information) while allowing
 *   public sub-routes like /business/{slug}, /business/{slug}/about, etc.
 */
export function isProtectedRoute(pathname: string): boolean {
  const isDashboardRoute = ['/admin', '/business', '/user', '/chat', '/cv', '/settings'].some(p => pathname.startsWith(p));
  if (!isDashboardRoute) return false;

  const segments = pathname.split('/').filter(Boolean);
  if (segments[0] === 'business') {
    if (segments.length <= 2) {
      // /business or /business/{organizationSlug} are public
      return false;
    } else {
      const subPath = segments[2];
      const publicSubPaths = ['about', 'jobs', 'posts', 'people'];
      if (publicSubPaths.includes(subPath)) {
        return false;
      }
    }
  }

  return true;
}

