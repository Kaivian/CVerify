export const ROLES = {
  USER: 'USER',
  BUSINESS: 'BUSINESS',
  ADMIN: 'ADMIN',
} as const;

export const ROUTES = {
  LOGIN: '/login',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  ORGANIZATION_RECOVERY: '/organization/recovery',
  ORGANIZATION_RECLAIM: '/organization/reclaim',
  VERIFY_EMAIL: '/verify-email',
  UNAUTHORIZED: '/unauthorized',
  DASHBOARD: {
    USER: '/user',
    BUSINESS: '/business',
    ADMIN: '/admin',
  },
} as const;

export const AUTH_KEYS = {
  BROADCAST_CHANNEL: 'cverify_auth_channel',
  CSRF_HEADER: 'X-CSRF-Token',
  CSRF_COOKIE: 'CSRF-TOKEN',
} as const;

export const AUTH_EVENTS = {
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  SESSION_EXTEND: 'SESSION_EXTEND',
} as const;

// Standard enterprise resources and actions
export const PERMISSIONS = {
  TRIPS: {
    CREATE: 'trips:create',
    READ: 'trips:read',
    UPDATE: 'trips:update',
    DELETE: 'trips:delete',
    PUBLISH: 'trips:publish',
  },
  BOOKINGS: {
    CREATE: 'bookings:create',
    READ: 'bookings:read',
    UPDATE: 'bookings:update',
    CANCEL: 'bookings:cancel',
  },
  PARTNERS: {
    REGISTER: 'partners:register',
    MANAGE: 'partners:manage',
  },
  ADMIN: {
    USERS_MANAGE: 'admin:users:manage',
    SYSTEM_VIEW: 'admin:system:view',
    REPORTS_VIEW: 'admin:reports:view',
  },
} as const;
