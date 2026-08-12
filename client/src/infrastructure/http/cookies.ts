/**
 * Browser cookie utilities for client-side reading and writing.
 * Extracted from the monolithic axios-client to isolate cookie manipulation
 * from HTTP client infrastructure.
 */

/**
 * Extracts a cookie value by name from the document cookies.
 * Returns `undefined` when running server-side or when the cookie is absent.
 */
export function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift();
  }
  return undefined;
}

/**
 * Sets a cookie with secure defaults (path=/, SameSite=Lax, Secure).
 * No-op when called server-side.
 *
 * @param name - Cookie name
 * @param value - Cookie value
 * @param maxAgeSeconds - Time-to-live in seconds (default: 1 year)
 */
export function setCookie(name: string, value: string, maxAgeSeconds: number = 31536000) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=${value}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax; Secure`;
}

/**
 * Deletes a cookie by name.
 * No-op when called server-side.
 */
export function deleteCookie(name: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax; Secure`;
}

