import 'i18next';

import common from '../locales/vi/common.json';
import auth from '../locales/vi/auth.json';
import navbar from '../locales/vi/navbar.json';
import sidebar from '../locales/vi/sidebar.json';
import dashboardUser from '../locales/vi/dashboard-user.json';
import dashboardBusiness from '../locales/vi/dashboard-business.json';
import dashboardAdmin from '../locales/vi/dashboard-admin.json';
import chatVerification from '../locales/vi/chat-verification.json';
import bookings from '../locales/vi/bookings.json';
import settings from '../locales/vi/settings.json';
import notifications from '../locales/vi/notifications.json';
import errors from '../locales/vi/errors.json';

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
