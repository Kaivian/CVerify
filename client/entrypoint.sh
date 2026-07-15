#!/bin/sh
# ==============================================================================
# Next.js Runtime Environment Variable Injector Entrypoint
# ==============================================================================
set -e

echo "[ENTRYPOINT] Substituting runtime environments in static JS files..."

if [ -z "$NEXT_PUBLIC_API_URL" ]; then
  echo "[WARNING] NEXT_PUBLIC_API_URL is not set. Defaulting to /api."
  NEXT_PUBLIC_API_URL="/api"
fi

# Find all compiled bundle files and replace the placeholder string with runtime variables
find .next -type f \( -name "*.js" -o -name "*.html" -o -name "*.json" \) -exec sed -i "s|__NEXT_PUBLIC_API_URL__|${NEXT_PUBLIC_API_URL}|g" {} +

if [ -n "$NEXT_PUBLIC_GOOGLE_CLIENT_ID" ]; then
  find .next -type f \( -name "*.js" -o -name "*.html" -o -name "*.json" \) -exec sed -i "s|__NEXT_PUBLIC_GOOGLE_CLIENT_ID__|${NEXT_PUBLIC_GOOGLE_CLIENT_ID}|g" {} +
fi

echo "[ENTRYPOINT] Environment substitution complete. Booting server..."
exec "$@"
