#!/bin/bash
# ==============================================================================
# CVerify Blue-Green VM Deployment Orchestration Script
# ==============================================================================
# Usage: ./deploy-gcp.sh [Production|Staging] [GitSHA]
# ==============================================================================
set -e

# Logging colors
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

write_info() { echo -e "${CYAN}[INFO]${NC} $1"; }
write_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
write_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
write_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 1. Parse Arguments
ENV_ARG="${1:-Production}"
GIT_SHA="${2}"

if [ -z "$GIT_SHA" ]; then
  write_error "Git SHA parameter is required."
  exit 1
fi

# Normalize case of environment
ENV=$(echo "$ENV_ARG" | tr '[:upper:]' '[:lower:]')
case "$ENV" in
  production) ENV_TITLE="Production" ;;
  staging|uat) ENV_TITLE="Staging" ;;
  *)
    write_error "Invalid Environment: '$ENV_ARG'. Must be Production or Staging."
    exit 1
    ;;
esac
ENV_LOWER=$(echo "$ENV_TITLE" | tr '[:upper:]' '[:lower:]')

write_info "Starting Blue-Green Deploy for CVerify [$ENV_TITLE] (Git SHA: $GIT_SHA)"
START_TIME=$(date +%s)

# Ensure audit log directory exists
mkdir -p /var/log/cverify

# 2. Extract Secrets from GCP Secret Manager
SECRETS_FILE=".env.secrets"
SECRET_NAME="cverify-${ENV_LOWER}-secrets"

write_info "Retrieving credentials from Google Secret Manager (${SECRET_NAME})..."
if command -v gcloud >/dev/null 2>&1; then
  if gcloud secrets versions access latest --secret="$SECRET_NAME" > "$SECRETS_FILE" 2>/dev/null; then
    write_success "Secrets successfully fetched from Secret Manager."
    chmod 600 "$SECRETS_FILE"
  else
    write_warning "Could not fetch secrets from Google Secret Manager. Falling back to existing .env.secrets if present."
    if [ ! -f "$SECRETS_FILE" ]; then
      write_error "No .env.secrets file found and Secret Manager retrieval failed. Aborting."
      exit 1
    fi
  fi
else
  write_warning "gcloud CLI not found. Falling back to local .env.secrets."
fi

# Write environment type to current configuration
cat <<EOF > .env.current
CVERIFY_ENVIRONMENT=${ENV_TITLE}
PRODUCTION_UNLOCK_CONFIRMATION=true
EOF

# 3. Execute setup resolver to layer environment files (.env)
write_info "Running environment resolver setup..."
export CVERIFY_SKIP_DOCKER=true
./setup.sh "$ENV_TITLE"

# Add dynamic values to merged .env
echo "IMAGE_TAG=sha-${GIT_SHA}" >> .env
GCP_PROJECT_ID=$(curl -s -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/project/project-id 2>/dev/null || gcloud config get-value project 2>/dev/null || echo "cverify-prod")
echo "GCP_PROJECT_ID=${GCP_PROJECT_ID}" >> .env
echo "GAR_REGISTRY_URL=asia-southeast1-docker.pkg.dev" >> .env

# 3.5 Download and Validate Deployment Manifest from GCS
write_info "Downloading build manifest from GCS..."
if gcloud storage cp "gs://cverify-build-metadata-${GCP_PROJECT_ID}/manifests/sha-${GIT_SHA}.json" manifest.json 2>/dev/null; then
  write_success "Manifest successfully downloaded."
else
  write_error "Failed to download manifest for SHA-${GIT_SHA} from GCS bucket!"
  exit 1
fi

validate_manifest() {
  local manifest_file="manifest.json"
  if [ ! -f "$manifest_file" ]; then
    write_error "Manifest file not found."
    return 1
  fi
  
  local m_sha=$(jq -r '.commit_sha' "$manifest_file" 2>/dev/null || echo "")
  if [ "$m_sha" != "$GIT_SHA" ]; then
    write_error "Manifest commit_sha ($m_sha) does not match deploy Git SHA ($GIT_SHA)!"
    return 1
  fi
  
  for svc in core ai client; do
    local digest=$(jq -r ".services.$svc" "$manifest_file" 2>/dev/null || echo "")
    if [ -z "$digest" ] || [ "$digest" = "null" ]; then
      write_error "Service $svc is missing from the manifest!"
      return 1
    fi
    if [[ ! "$digest" =~ ^asia-southeast1-docker\.pkg\.dev/.*@sha256:[a-f0-9]{64}$ ]]; then
      write_error "Invalid GAR image digest format for service $svc: '$digest'"
      return 1
    fi
    write_info "Validated manifest entry for $svc: $digest"
  done
  return 0
}

write_info "Validating deployment manifest..."
if ! validate_manifest; then
  write_error "Manifest validation failed. Aborting."
  exit 1
fi
write_success "Deployment manifest validated successfully."

# 4. Orchestrate Networks & Shared Infrastructure Layer
SHARED_NET="cverify-infra_cverify-infra-net"
write_info "Ensuring shared network exists..."
docker network create "$SHARED_NET" 2>/dev/null || true

write_info "Upgrading and launching shared Database & Caching layer (cverify-infra)..."
docker compose -p cverify-infra -f docker/compose.yml -f docker/compose.${ENV_LOWER}.yml up -d postgres redis

# Wait for shared database and cache to be healthy
write_info "Waiting for shared database and cache to be healthy..."
for svc in postgres redis; do
  CONTAINER_ID=""
  for i in {1..10}; do
    CONTAINER_ID=$(docker compose -p cverify-infra ps -q "$svc" 2>/dev/null || echo "")
    if [ -n "$CONTAINER_ID" ]; then
      break
    fi
    sleep 1
  done
  
  if [ -z "$CONTAINER_ID" ]; then
    write_error "Service $svc is not running in cverify-infra!"
    exit 1
  fi
  
  SERVICE_HEALTHY=false
  for i in {1..30}; do
    HEALTH_STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$CONTAINER_ID" 2>/dev/null || echo "unknown")
    if [ "$HEALTH_STATUS" = "healthy" ]; then
      write_success "Infrastructure service $svc is healthy."
      SERVICE_HEALTHY=true
      break
    fi
    sleep 2
  done
  
  if [ "$SERVICE_HEALTHY" != "true" ]; then
    write_error "Infrastructure service $svc failed to become healthy!"
    exit 1
  fi
done

# 5. Determine Active vs Inactive Blue-Green Upstream Color
NGINX_CONF_DIR="/app/cverify/docker/nginx/conf.d"
mkdir -p "$NGINX_CONF_DIR"
UPSTREAM_FILE="${NGINX_CONF_DIR}/upstreams.conf"

ACTIVE_COLOR="blue"
INACTIVE_COLOR="green"

if [ -f "$UPSTREAM_FILE" ]; then
  if grep -q "3004" "$UPSTREAM_FILE"; then
    ACTIVE_COLOR="green"
    INACTIVE_COLOR="blue"
  fi
fi

write_info "Current Active Upstream: $ACTIVE_COLOR"
write_info "Target Deployment Upstream: $INACTIVE_COLOR"

# 6. Assign target deployment ports
if [ "$INACTIVE_COLOR" = "green" ]; then
  TARGET_CLIENT_PORT=3004
  TARGET_CORE_PORT=5251
else
  TARGET_CLIENT_PORT=3003
  TARGET_CORE_PORT=5250
fi

# Override target ports in the merged configuration
sed -i "s/CLIENT_PORT=.*/CLIENT_PORT=$TARGET_CLIENT_PORT/g" .env
sed -i "s/CORE_PORT=.*/CORE_PORT=$TARGET_CORE_PORT/g" .env

# Re-synchronize .env (only docker/ is needed for production compose)
[ -d docker ] && cp .env docker/.env

# 7. Pull and Launch Target Stack
write_info "Configuring Docker authentication helper for GCP Artifact Registry..."
gcloud auth configure-docker asia-southeast1-docker.pkg.dev --quiet

write_info "Pulling container images for $INACTIVE_COLOR stack (Tag: sha-$GIT_SHA)..."
PULL_SUCCESS=false
for attempt in {1..3}; do
  write_info "Pull attempt $attempt/3..."
  if docker compose -p cverify-${INACTIVE_COLOR} -f docker/compose.yml -f docker/compose.${ENV_LOWER}.yml pull cverify-ai cverify-core cverify-client; then
    PULL_SUCCESS=true
    write_success "Images pulled successfully."
    break
  fi
  write_warning "Pull attempt $attempt failed. Retrying in 10 seconds..."
  sleep 10
done

if [ "$PULL_SUCCESS" != "true" ]; then
  write_error "Failed to pull images after 3 attempts. Aborting."
  exit 1
fi

write_info "Starting app containers for $INACTIVE_COLOR stack..."
docker compose -p cverify-${INACTIVE_COLOR} -f docker/compose.yml -f docker/compose.${ENV_LOWER}.yml up -d cverify-ai cverify-core cverify-client

# 8. Pre-Traffic Smoke Testing Protocol (Native Docker Health Check)
write_info "Starting pre-traffic smoke tests on $INACTIVE_COLOR stack..."
SMOKE_TEST_PASS=true

for svc in cverify-ai cverify-core cverify-client; do
  CONTAINER_ID=""
  # Wait briefly for Docker to register container creation
  for i in {1..5}; do
    CONTAINER_ID=$(docker compose -p cverify-${INACTIVE_COLOR} ps -q "$svc" 2>/dev/null || echo "")
    if [ -n "$CONTAINER_ID" ]; then
      break
    fi
    sleep 1
  done

  if [ -z "$CONTAINER_ID" ]; then
    write_error "Service $svc is not running!"
    SMOKE_TEST_PASS=false
    break
  fi

  write_info "Checking health for service $svc (Container: $CONTAINER_ID)..."
  SERVICE_HEALTHY=false
  for i in {1..30}; do
    HEALTH_STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$CONTAINER_ID" 2>/dev/null || echo "unknown")
    if [ "$HEALTH_STATUS" = "healthy" ]; then
      write_success "Service $svc is healthy."
      SERVICE_HEALTHY=true
      break
    elif [ "$HEALTH_STATUS" = "unhealthy" ]; then
      write_error "Service $svc has failed health check (unhealthy)."
      break
    fi
    echo "Waiting for service $svc to become healthy (current status: $HEALTH_STATUS)..."
    sleep 5
  done

  if [ "$SERVICE_HEALTHY" != "true" ]; then
    SMOKE_TEST_PASS=false
    break
  fi
done

# 9. Handle Swapping or Rollback
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

if [ "$SMOKE_TEST_PASS" = true ]; then
  write_info "All smoke tests passed! Commencing Nginx upstream swap..."
  
  # Update Nginx Dynamic Upstreams File
  cat <<EOF > "$UPSTREAM_FILE"
# Dynamic upstreams config for CVerify Blue-Green
upstream cverify_client {
    server 127.0.0.1:${TARGET_CLIENT_PORT};
}
upstream cverify_api {
    server 127.0.0.1:${TARGET_CORE_PORT};
}
EOF

  # Ensure Nginx dynamic routing proxy is running on host
  write_info "Ensuring Nginx routing proxy is active..."

  # Detect SSL certificate availability for graceful HTTP/HTTPS mode selection
  SSL_DOMAIN="cverify.io.vn"
  SSL_CERT_PATH="/etc/letsencrypt/live/${SSL_DOMAIN}/fullchain.pem"

  # Remove any existing nginx-proxy container to avoid name conflicts (e.g., when switching modes)
  docker rm -f nginx-proxy 2>/dev/null || true

  if sudo test -f "$SSL_CERT_PATH"; then
    write_info "SSL certificate detected for $SSL_DOMAIN — starting Nginx with HTTPS."
    docker compose -f docker/compose.nginx.yml up -d
  else
    write_warning "SSL certificate not found at $SSL_CERT_PATH — starting Nginx in HTTP-only mode."
    write_warning "Run 'sudo /app/cverify/scripts/setup-ssl.sh $SSL_DOMAIN' to enable HTTPS."

    # Generate a temporary HTTP-only nginx config (no SSL references)
    NGINX_HTTP_CONF="/app/cverify/docker/nginx/nginx-http-only.conf"
    cat <<'HTTPCONF' > "$NGINX_HTTP_CONF"
user  nginx;
worker_processes  auto;
error_log  /var/log/nginx/error.log notice;
pid        /var/run/nginx.pid;

events {
    worker_connections  1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    log_format  main  '$remote_addr - $remote_user [$time_local] "$request" '
                      '$status $body_bytes_sent "$http_referer" '
                      '"$http_user_agent" "$http_x_forwarded_for"';

    access_log  /var/log/nginx/access.log  main;

    sendfile        on;
    tcp_nopush     on;
    tcp_nodelay    on;
    keepalive_timeout  65;
    types_hash_max_size 2048;

    gzip on;
    gzip_disable "msie6";
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_buffers 16 8k;
    gzip_http_version 1.1;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    include /etc/nginx/conf.d/upstreams.conf;

    server {
        listen       80;
        listen       [::]:80;
        server_name  _;

        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }

        location / {
            proxy_pass         http://cverify_client;
            proxy_http_version 1.1;
            proxy_set_header   Upgrade $http_upgrade;
            proxy_set_header   Connection 'upgrade';
            proxy_set_header   Host $host;
            proxy_cache_bypass $http_upgrade;
            proxy_set_header   X-Real-IP $remote_addr;
            proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header   X-Forwarded-Proto $scheme;
        }

        location /api/ {
            proxy_pass         http://cverify_api;
            proxy_http_version 1.1;
            proxy_set_header   Upgrade $http_upgrade;
            proxy_set_header   Connection 'upgrade';
            proxy_set_header   Host $host;
            proxy_cache_bypass $http_upgrade;
            proxy_set_header   X-Real-IP $remote_addr;
            proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header   X-Forwarded-Proto $scheme;
        }

        location /nginx-health {
            access_log off;
            add_header Content-Type text/plain;
            return 200 'OK';
        }
    }
}
HTTPCONF

    # Remove any existing nginx-proxy container to avoid name conflicts
    docker rm -f nginx-proxy 2>/dev/null || true

    # Start Nginx with the HTTP-only config override
    docker run -d --name nginx-proxy --restart always --network host \
      -v "$NGINX_HTTP_CONF:/etc/nginx/nginx.conf:ro" \
      -v "/app/cverify/docker/nginx/conf.d:/etc/nginx/conf.d:rw" \
      -v "/var/log/nginx:/var/log/nginx" \
      -v "/var/www/certbot:/var/www/certbot:ro" \
      nginx:1.25.3-alpine
  fi

  # Wait for Nginx container to be fully running before reload
  sleep 3

  # Reload Nginx Router configuration
  write_info "Reloading Nginx Proxy..."
  docker exec nginx-proxy nginx -s reload
  
  write_success "Production traffic successfully routed to $INACTIVE_COLOR stack."
  
  # Stop (do not destroy) the old active stack to free memory/CPU
  write_info "Stopping old active stack ($ACTIVE_COLOR) to conserve resources..."
  docker compose -p cverify-${ACTIVE_COLOR} -f docker/compose.yml -f docker/compose.${ENV_LOWER}.yml stop
  
  # Write Audit Log
  cat <<EOF >> /var/log/cverify/deployments.log
{"timestamp":"$(date -u +"%Y-%m-%dT%H:%M:%SZ")","environment":"$ENV_TITLE","commit_sha":"$GIT_SHA","triggered_by":"github-actions-sa","stack_color_deployed":"$INACTIVE_COLOR","duration_seconds":$DURATION,"status":"SUCCESS","migrations_run":true,"rollback_applied":false,"rollback_reason":null}
EOF

  # Cleanup old unused images and networks to conserve VM disk space
  write_info "Cleaning up old images and networks on host..."
  docker image prune -a --filter "until=168h" -f
  docker network prune -f
  
  write_success "Deployment completed successfully in ${DURATION}s!"
  exit 0
else
  write_error "Deployment failed smoke tests! Rolling back and shutting down target stack."
  
  # Capture logs for debugging before stopping
  write_warning "Capturing container logs..."
  docker compose -p cverify-${INACTIVE_COLOR} logs --tail=100 > "/var/log/cverify/failed-deploy-${GIT_SHA}.log"
  
  # Shutdown and remove the inactive stack (prevent orphan containers/networks)
  docker compose -p cverify-${INACTIVE_COLOR} -f docker/compose.yml -f docker/compose.${ENV_LOWER}.yml down -v
  
  # Write failure audit log
  cat <<EOF >> /var/log/cverify/deployments.log
{"timestamp":"$(date -u +"%Y-%m-%dT%H:%M:%SZ")","environment":"$ENV_TITLE","commit_sha":"$GIT_SHA","triggered_by":"github-actions-sa","stack_color_deployed":"$INACTIVE_COLOR","duration_seconds":$DURATION,"status":"FAILED","migrations_run":true,"rollback_applied":true,"rollback_reason":"Smoke tests failed"}
EOF

  write_error "Rollback executed. Web traffic remains routed to stable $ACTIVE_COLOR stack."
  exit 1
fi
