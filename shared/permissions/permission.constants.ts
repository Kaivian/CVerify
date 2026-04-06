export const PERMISSIONS = {
  SYSTEM: {
    OVERRIDE: "*:*:*"
  },
  USERS: {
    VIEW: "users:view:list",
    CREATE: "users:create:user",
    UPDATE: "users:update:user",
    DELETE: "users:delete:user"
  },
  ROLES: {
    VIEW: "roles:view:list",
    CREATE: "roles:create:role",
    UPDATE: "roles:update:role",
    DELETE: "roles:delete:role"
  },
  BOOKING: {
    VIEW: "booking:view:list",
    UPDATE_STATUS: "booking:update:status"
  },
  AI: {
    CHAT_USE: "ai:chat:use",
    AUDIT_VIEW: "ai:audit:view"
  },
  TRIPS: {
    VIEW: "trips:planner:view",
    CREATE: "trips:planner:create",
    EDIT: "trips:planner:edit",
    JOIN: "trips:collaborator:join",
    COMMENT: "trips:collaborator:comment"
  }
} as const;

export type PermissionKey =
  | typeof PERMISSIONS.SYSTEM.OVERRIDE
  | typeof PERMISSIONS.USERS.VIEW
  | typeof PERMISSIONS.USERS.CREATE
  | typeof PERMISSIONS.USERS.UPDATE
  | typeof PERMISSIONS.USERS.DELETE
  | typeof PERMISSIONS.ROLES.VIEW
  | typeof PERMISSIONS.ROLES.CREATE
  | typeof PERMISSIONS.ROLES.UPDATE
  | typeof PERMISSIONS.ROLES.DELETE
  | typeof PERMISSIONS.BOOKING.VIEW
  | typeof PERMISSIONS.BOOKING.UPDATE_STATUS
  | typeof PERMISSIONS.AI.CHAT_USE
  | typeof PERMISSIONS.AI.AUDIT_VIEW
  | typeof PERMISSIONS.TRIPS.VIEW
  | typeof PERMISSIONS.TRIPS.CREATE
  | typeof PERMISSIONS.TRIPS.EDIT
  | typeof PERMISSIONS.TRIPS.JOIN
  | typeof PERMISSIONS.TRIPS.COMMENT;
