export interface PermissionDefinition {
  name: string;
  displayName: string;
  description: string;
  system?: boolean;
  dangerous?: boolean;
  dependsOn?: string[];
  deprecated?: boolean;
  hidden?: boolean;
}

export interface RoleDefinition {
  displayName: string;
  description: string;
  permissions: string[];
}

export interface PermissionsRegistry {
  roles: Record<string, RoleDefinition>;
  modules: Record<string, PermissionDefinition[]>;
}
export type SystemRole = "SUPER_ADMIN" | "ADMIN" | "BUSINESS" | "USER";
