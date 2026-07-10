import i18n, { type Resource } from 'i18next';
import { initReactI18next } from 'react-i18next';
import resourcesToBackend from 'i18next-resources-to-backend';
import { getCookie } from '@/infrastructure/http/cookies';

// Statically import critical namespaces for preloading
import viCommon from '@/locales/vi/common.json';
import viAuth from '@/locales/vi/auth.json';
import enCommon from '@/locales/en/common.json';
import enAuth from '@/locales/en/auth.json';

const staticResources: Resource = {
  vi: {
    common: viCommon,
    auth: viAuth,
  },
  en: {
    common: enCommon,
    auth: enAuth,
  },
};

// Initialize i18n instance
i18n
  .use(
    resourcesToBackend(async (language: string, namespace: string) => {
      // Return preloaded static resource if available
      if (staticResources[language]?.[namespace]) {
        return staticResources[language][namespace];
      }
      
      // Lazily import other namespaces for performance
      try {
        return await import(`@/locales/${language}/${namespace}.json`);
      } catch (error) {
        console.warn(`Translation namespace "${namespace}" not found for language "${language}"`, error);
        // Fallback to Vietnamese if a dynamic namespace fails to load
        if (language !== 'vi') {
          try {
            return await import(`@/locales/vi/${namespace}.json`);
          } catch {
            // Safe fallback
          }
        }
        return {};
      }
    })
  )
  .use(initReactI18next)
  .init({
    lng: typeof window !== 'undefined' ? (getCookie('i18next') || 'vi') : 'vi',
    fallbackLng: 'vi',
    supportedLngs: ['vi', 'en'],
    defaultNS: 'common',
    ns: [
      'common',
      'auth',
      'navbar',
      'sidebar',
      'dashboard-user',
      'dashboard-organization',
      'dashboard-admin',
      'chat-verification',
      'bookings',
      'settings',
      'notifications',
      'errors',
    ],
    // Let i18next know we are preloading some of the assets
    partialBundledLanguages: true,
    resources: staticResources,
    interpolation: {
      escapeValue: false, // React handles escaping natively
    },
    react: {
      useSuspense: true,
    },
  });

export default i18n;
