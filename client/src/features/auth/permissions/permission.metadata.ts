import registry from "./permissions-registry.json";
import { type PermissionsRegistry, type PermissionDefinition } from "./permission.types";

export const PERMISSIONS_REGISTRY = registry as PermissionsRegistry;

/**
 * Returns a flat array of all registered system permissions.
 */
export const getPermissionsList = (): PermissionDefinition[] => {
  return Object.values(PERMISSIONS_REGISTRY.modules).flat();
};

/**
 * Returns permissions grouped by their module keys.
 */
export const getPermissionsByModule = (): Record<string, PermissionDefinition[]> => {
  return PERMISSIONS_REGISTRY.modules;
};

/**
 * Gets default assignments mapped to roles.
 */
export const getRoleDefaults = () => {
  return PERMISSIONS_REGISTRY.roles;
};

/**
 * Maps nice visual icon categories and order positions for the layout dashboard sidebar dynamically.
 */
export const SIDEBAR_MODULE_META: Record<string, { label: string; icon: string; order: number }> = {
  users: { label: "User Management", icon: "Users", order: 1 },
  roles: { label: "Roles & Access Control", icon: "Shield", order: 2 },
  booking: { label: "Bookings", icon: "Calendar", order: 3 },
  ai: { label: "AI Safety Audit", icon: "BrainCircuit", order: 4 },
  trips: { label: "Trip Planners", icon: "MapPin", order: 5 }
};
