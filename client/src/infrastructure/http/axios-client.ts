import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { getCookie } from './cookies';
import { AUTH_KEYS } from '@/infrastructure/config/constants';

/**
 * Configured base URL for API, using standard environment settings.
 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

/**
 * Central Axios HTTP client instance.
 * Configured with JSON defaults, CSRF protection, and credential forwarding.
 */
export const axiosClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
  withCredentials: true,
});

// CSRF Request Interceptor — injects anti-forgery token for state-mutating methods
axiosClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const method = config.method?.toUpperCase();
    if (method && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      const csrfToken = getCookie(AUTH_KEYS.CSRF_COOKIE);
      if (csrfToken) {
        config.headers.set(AUTH_KEYS.CSRF_HEADER, csrfToken);
      }
    }
    return config;
  },
  (error: unknown) => Promise.reject(error)
);
