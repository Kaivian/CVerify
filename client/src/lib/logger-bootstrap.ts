/**
 * Production environment-aware logging configuration.
 * Intercepts console methods in production to strip out noisy, low-value debugging info,
 * prevent repetitive logs, and only emit structured lifecycle and telemetry messages.
 */
if (typeof window !== "undefined" && process.env.NODE_ENV === "production") {
  const originalInfo = console.info;

  // Suppress verbose dev logs
  console.log = () => {};
  console.debug = () => {};

  // Map to track duplicate/repetitive logs to avoid spam
  const lastLoggedMap = new Map<string, number>();
  const DUP_LOG_COOLDOWN_MS = 5000; // Suppress duplicates within 5 seconds

  console.info = (message, ...args) => {
    if (typeof message !== "string") {
      // Allow structured object telemetry logs
      originalInfo(message, ...args);
      return;
    }

    // Only allow specific white-listed runtime traces (SignalR setup, auth state changes, telemetry, health)
    const isActionableTrace =
      message.startsWith("[SignalR]") ||
      message.startsWith("[Auth") ||
      message.startsWith("[Telemetry]") ||
      message.startsWith("[Lifecycle]") ||
      message.includes("successful") ||
      message.includes("failed") ||
      message.includes("error");

    if (!isActionableTrace) {
      return;
    }

    // De-duplication check: avoid logging identical messages repeatedly
    const key = message + JSON.stringify(args);
    const now = Date.now();
    const lastLogged = lastLoggedMap.get(key);

    if (lastLogged && now - lastLogged < DUP_LOG_COOLDOWN_MS) {
      return;
    }

    lastLoggedMap.set(key, now);

    // Keep the cache size bound
    if (lastLoggedMap.size > 200) {
      const keys = Array.from(lastLoggedMap.keys());
      lastLoggedMap.delete(keys[0]);
    }

    originalInfo(message, ...args);
  };
}
export {};
