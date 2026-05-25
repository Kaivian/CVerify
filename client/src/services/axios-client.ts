/**
 * @deprecated Import from '@/infrastructure/http' instead.
 * This file exists solely as a backward-compatible re-export bridge
 * during the architecture migration.
 */
export { axiosClient, API_URL } from '../infrastructure/http/axios-client';
export { normalizeError } from '../infrastructure/http/error-normalizer';
export { getCookie, setCookie } from '../infrastructure/http/cookies';

// Install the auth response interceptor on first import to preserve
// the previous behavior where interceptors were registered at module scope.
import { installAuthInterceptor } from '../infrastructure/http/interceptors';
installAuthInterceptor();
