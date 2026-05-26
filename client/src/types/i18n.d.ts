import 'i18next';

import type common from '../locales/vi/common.json';
import type auth from '../locales/vi/auth.json';
import type navbar from '../locales/vi/navbar.json';
import type sidebar from '../locales/vi/sidebar.json';
import type dashboardUser from '../locales/vi/dashboard-user.json';
import type dashboardBusiness from '../locales/vi/dashboard-business.json';
import type dashboardAdmin from '../locales/vi/dashboard-admin.json';
import type chatVerification from '../locales/vi/chat-verification.json';
import type bookings from '../locales/vi/bookings.json';
import type settings from '../locales/vi/settings.json';
import type notifications from '../locales/vi/notifications.json';
import type errors from '../locales/vi/errors.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof common;
      auth: typeof auth;
      navbar: typeof navbar;
      sidebar: typeof sidebar;
      'dashboard-user': typeof dashboardUser;
      'dashboard-business': typeof dashboardBusiness;
      'dashboard-admin': typeof dashboardAdmin;
      'chat-verification': typeof chatVerification;
      bookings: typeof bookings;
      settings: typeof settings;
      notifications: typeof notifications;
      errors: typeof errors;
    };
  }
}
