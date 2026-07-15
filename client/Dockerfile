# ==============================================================================
# CVERIFY CLIENT NEXT.JS PRODUCTION DOCKERFILE
# ==============================================================================
# Multi-stage, standalone output, non-root execution, BuildKit cached.
# ==============================================================================

# 1. Dependencies stage
FROM node:20.18.3-alpine3.21 AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package*.json ./
# Cache npm downloads using BuildKit cache mount
RUN --mount=type=cache,target=/root/.npm \
    npm ci --legacy-peer-deps

# 2. Builder stage
FROM node:20.18.3-alpine3.21 AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_API_URL=__NEXT_PUBLIC_API_URL__
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=__NEXT_PUBLIC_GOOGLE_CLIENT_ID__

RUN npm run build

# 3. Runner stage
FROM node:20.18.3-alpine3.21 AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Install curl for healthcheck
RUN apk add --no-cache curl

# Create non-root system user and group
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Pre-create and set permissions on Next.js cache directory
RUN mkdir -p .next && chown nextjs:nodejs .next

# Copy standalone build and static files with correct ownership
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy entrypoint script and set permissions
COPY --chown=nextjs:nodejs entrypoint.sh ./
RUN chmod +x entrypoint.sh

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --retries=3 --start-period=10s \
  CMD curl -f http://localhost:3000/ || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["node", "server.js"]
