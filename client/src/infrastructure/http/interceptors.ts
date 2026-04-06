import { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { axiosClient } from './axios-client';
import { normalizeError } from './error-normalizer';
import { useAuthStore } from '@/features/auth/store/use-auth-store';
import { ApiError } from '@/types/api.types';

// Single-flight refresh queue to prevent thundering herd on token expiry
let isRefreshing = false;
let failedQueue: Array<{ resolve: (value?: unknown) => void; reject: (err: unknown) => void }> = [];

const processQueue = (error: ApiError | null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve();
    }
  });
  failedQueue = [];
};

/**
 * Installs the response interceptor that handles:
 * 1. 401 → token refresh rotation with request queue
 * 2. 403 → security warning logging
 * 3. Generic error normalization
 *
 * Called once at app initialization.
 */
export function installAuthInterceptor(): void {
  axiosClient.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
      const apiError = normalizeError(error);

      // 1. Session Expiry & Token Rotation Handler (401 Unauthorized)
      if (error.response?.status === 401 && !originalRequest._retry) {
        const isRefreshRequest = originalRequest.url?.includes('/auth/refresh-token');
        const isLogoutRequest = originalRequest.url?.includes('/auth/logout');
        const isAuthFlowRequest = originalRequest.url?.includes('/auth/') && !originalRequest.url?.includes('/auth/me');

        if (isAuthFlowRequest) {
          console.log(`[Auth Interceptor] Auth flow request 401: ${originalRequest.url}. Skipping refresh rotation.`);
          if (isRefreshRequest || isLogoutRequest) {
            useAuthStore.getState().logout(true);

            if (isRefreshRequest && typeof window !== 'undefined') {
              const currentPath = window.location.pathname;
              const isProtectedPage = ['/admin', '/business', '/user', '/chat', '/jobs', '/cv'].some(p => currentPath.startsWith(p));

              if (isProtectedPage) {
                console.log(`[Auth Interceptor] Refresh token expired. Redirecting from: ${currentPath}`);
                window.location.href = `/login?session_expired=true&callbackUrl=${encodeURIComponent(
                  window.location.pathname + window.location.search
                )}`;
              }
            }
          }
          return Promise.reject(apiError);
        }

        if (isRefreshing) {
          console.log(`[Auth Interceptor] Queueing concurrent request: ${originalRequest.url}`);
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then(() => {
              originalRequest._retry = true;
              return axiosClient(originalRequest);
            })
            .catch((err) => Promise.reject(err));
        }

        originalRequest._retry = true;
        isRefreshing = true;
        console.log(`[Auth Interceptor] Starting token refresh for: ${originalRequest.url}`);

        return new Promise((resolve, reject) => {
          axiosClient.post('/auth/refresh-token')
            .then(() => {
              console.log('[Auth Interceptor] Token refresh succeeded. Retrying queued requests.');
              processQueue(null);
              resolve(axiosClient(originalRequest));
            })
            .catch((refreshErr) => {
              const parsedRefreshErr = normalizeError(refreshErr);
              if (parsedRefreshErr.status !== 401) {
                console.error(`[Auth Interceptor] Token refresh failed (status: ${parsedRefreshErr.status})`);
              } else {
                console.log('[Auth Interceptor] Token refresh skipped (401). Guest session.');
              }

              processQueue(parsedRefreshErr);

              const isAuthFailure = parsedRefreshErr.status === 401 || parsedRefreshErr.status === 403;
              if (isAuthFailure) {
                console.log('[Auth Interceptor] Session invalidation complete.');
                useAuthStore.getState().logout(true);

                if (typeof window !== 'undefined') {
                  const currentPath = window.location.pathname;
                  const isProtectedPage = ['/admin', '/business', '/user', '/chat', '/jobs', '/cv'].some(p => currentPath.startsWith(p));

                  if (isProtectedPage) {
                    console.log(`[Auth Interceptor] Redirecting from protected page: ${currentPath}`);
                    window.location.href = `/login?session_expired=true&callbackUrl=${encodeURIComponent(
                      window.location.pathname + window.location.search
                    )}`;
                  }
                }
              }
              reject(parsedRefreshErr);
            })
            .finally(() => {
              isRefreshing = false;
            });
        });
      }

      // 2. Access Gated (403 Forbidden)
      if (error.response?.status === 403) {
        console.warn('[Security Alert] 403 Forbidden - Insufficient Permissions');
      }

      return Promise.reject(apiError);
    }
  );
}
