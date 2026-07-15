#!/bin/bash
# ==============================================================================
# CVerify Environment Config Resolver (resolve-env.sh)
# ==============================================================================
# Layers and merges defaults, overrides, and secrets into the final .env.
# ==============================================================================
set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

write_info() { echo -e "${CYAN}[INFO]${NC} $1"; }
write_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
write_error() { echo -e "${RED}[ERROR]${NC} $1"; }

target_env="${1:-Development}"
target_env_lower=$(echo "$target_env" | tr '[:upper:]' '[:lower:]')

secrets_file=".env.secrets"
current_file=".env.current"

write_info "Layering configuration files for Environment: ${target_env}..."

temp_env=$(mktemp)

cat .env.defaults >> "$temp_env" 2>/dev/null || true
cat ".env.${target_env_lower}" >> "$temp_env" 2>/dev/null || true
cat "$secrets_file" >> "$temp_env" 2>/dev/null || true
cat "$current_file" >> "$temp_env" 2>/dev/null || true

# Unique merge keeping last definition
awk -F '=' '/^[A-Za-z_][A-Za-z0-9_]*=/ { val[$1]=$0 } END { for (k in val) print val[k] }' "$temp_env" > .env
rm -f "$temp_env"

# Add Unix-compatible COMPOSE_FILE to active .env
echo "COMPOSE_FILE=docker/compose.yml:docker/compose.${target_env_lower}.yml" >> .env

# Helper to retrieve value from generated .env
get_val() {
  grep "^$1=" .env | cut -d'=' -f2- | tr -d '\r' | tr -d '"' | tr -d "'" | tr -d ' '
}

# Map GOOGLE_CLIENT_ID to NEXT_PUBLIC_GOOGLE_CLIENT_ID for frontend SSO flow
google_client_id=$(get_val "GOOGLE_CLIENT_ID")
if [ -n "$google_client_id" ]; then
  echo "NEXT_PUBLIC_GOOGLE_CLIENT_ID=$google_client_id" >> .env
fi

write_success "Environment configuration resolved into .env"
