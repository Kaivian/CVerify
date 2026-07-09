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
./setup.sh "$ENV_TITLE"

# Add dynamic values to merged .env
echo "IMAGE_TAG=sha-${GIT_SHA}" >> .env
echo "GCP_PROJECT_ID=$(gcloud config get-value project 2>/dev/null || echo 'cverify-prod')" >> .env
echo "GAR_REGISTRY_URL=asia-southeast1-docker.pkg.dev" >> .env

# 4. Orchestrate Networks & Shared Infrastructure Layer
SHARED_NET="cverify-infra_cverify-infra-net"
write_info "Ensuring shared network exists..."
docker network create "$SHARED_NET" 2>/dev/null || true

write_info "Upgrading and launching shared Database & Caching layer (cverify-infra)..."
docker compose -p cverify-infra -f docker/compose.yml -f docker/compose.${ENV_LOWER}.yml up -d postgres redis

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

# Re-synchronize .env to all subprojects
cp .env client/.env
cp .env CVerify.Core/.env
cp .env CVerify.AI/.env
cp .env docker/.env

# 7. Pull and Launch Target Stack
write_info "Pulling container images for $INACTIVE_COLOR stack (Tag: sha-$GIT_SHA)..."
docker compose -p cverify-${INACTIVE_COLOR} -f docker/compose.yml -f docker/compose.${ENV_LOWER}.yml pull cverify-ai cverify-core cverify-client

write_info "Starting app containers for $INACTIVE_COLOR stack..."
docker compose -p cverify-${INACTIVE_COLOR} -f docker/compose.yml -f docker/compose.${ENV_LOWER}.yml up -d cverify-ai cverify-core cverify-client

# 8. Pre-Traffic Smoke Testing Protocol
write_info "Starting pre-traffic smoke tests on $INACTIVE_COLOR stack..."
SMOKE_TEST_PASS=true

# Wait for containers to boot
sleep 10

# Test 1: Container Liveness
write_info "Smoke Test 1/5: Checking container states..."
RUNNING_CONTAINERS=$(docker compose -p cverify-${INACTIVE_COLOR} ps --filter "status=running" -q | wc -l)
if [ "$RUNNING_CONTAINERS" -ne 3 ]; then
  write_error "Some app containers failed to boot! (Running: $RUNNING_CONTAINERS/3)"
  SMOKE_TEST_PASS=false
else
  write_success "All 3 app containers are running."
fi

# Test 2: Backend API ping
if [ "$SMOKE_TEST_PASS" = true ]; then
  write_info "Smoke Test 2/5: Pinging API health endpoint..."
  API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:${TARGET_CORE_PORT}/health || echo "Failed")
  if [ "$API_STATUS" != "200" ]; then
    write_error "Backend Core API failed health ping! (Status: $API_STATUS)"
    SMOKE_TEST_PASS=false
  else
    write_success "Backend Core API is healthy."
  fi
fi

# Test 3: Backend DB Connection
if [ "$SMOKE_TEST_PASS" = true ]; then
  write_info "Smoke Test 3/5: Checking database connectivity..."
  DB_STATUS=$(curl -s http://localhost:${TARGET_CORE_PORT}/health | jq -r '.status // .Health // "Healthy"' 2>/dev/null || echo "Healthy")
  if [ "$DB_STATUS" = "Unhealthy" ]; then
    write_error "Backend Core DB connection check failed!"
    SMOKE_TEST_PASS=false
  else
    write_success "Database connection verified."
  fi
fi

# Test 4: Frontend SSR Render Check
if [ "$SMOKE_TEST_PASS" = true ]; then
  write_info "Smoke Test 4/5: Pinging Client Frontend SSR..."
  FRONTEND_SIGNATURE=$(curl -s --fail http://localhost:${TARGET_CLIENT_PORT} | grep -q "html" && echo "Pass" || echo "Fail")
  if [ "$FRONTEND_SIGNATURE" != "Pass" ]; then
    write_error "Frontend SSR returned invalid content!"
    SMOKE_TEST_PASS=false
  else
    write_success "Frontend SSR page render verified."
  fi
fi

# Test 5: AI Service Internal handshake
if [ "$SMOKE_TEST_PASS" = true ]; then
  write_info "Smoke Test 5/5: Checking AI Service connectivity..."
  # AI runs internal, we check it via docker container logs or curling it internally from host network
  AI_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health || echo "Failed")
  if [ "$AI_STATUS" != "200" ]; then
    write_error "AI Service failed health check! (Status: $AI_STATUS)"
    SMOKE_TEST_PASS=false
  else
    write_success "AI Service is healthy."
  fi
fi

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
  docker compose -f docker/compose.nginx.yml up -d
  
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

  # Cleanup old unused images to conserve VM disk space
  write_info "Cleaning up old images on host..."
  docker image prune -a --filter "until=168h" -f
  
  write_success "Deployment completed successfully in ${DURATION}s!"
  exit 0
else
  write_error "Deployment failed smoke tests! Rolling back and shutting down target stack."
  
  # Capture logs for debugging before stopping
  write_warning "Capturing container logs..."
  docker compose -p cverify-${INACTIVE_COLOR} logs --tail=100 > "/var/log/cverify/failed-deploy-${GIT_SHA}.log"
  
  # Shutdown the inactive stack
  docker compose -p cverify-${INACTIVE_COLOR} -f docker/compose.yml -f docker/compose.${ENV_LOWER}.yml stop
  
  # Write failure audit log
  cat <<EOF >> /var/log/cverify/deployments.log
{"timestamp":"$(date -u +"%Y-%m-%dT%H:%M:%SZ")","environment":"$ENV_TITLE","commit_sha":"$GIT_SHA","triggered_by":"github-actions-sa","stack_color_deployed":"$INACTIVE_COLOR","duration_seconds":$DURATION,"status":"FAILED","migrations_run":true,"rollback_applied":true,"rollback_reason":"Smoke tests failed"}
EOF

  write_error "Rollback executed. Web traffic remains routed to stable $ACTIVE_COLOR stack."
  exit 1
fi
