#!/bin/bash

# ==============================================================================
# CVerify One-Click Centralized Setup & Environment Resolver (Unix/Linux/macOS)
# ==============================================================================
# Resolves environment settings, validates safety gates, and launches Docker.
# ==============================================================================

set -e

# Formatting helper functions
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

write_info() { echo -e "${CYAN}[INFO]${NC} $1"; }
write_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
write_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
write_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Cryptographic random generation helpers
generate_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 "$1" | tr -d '=+/' | cut -c1-"$2"
  else
    cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w "$2" | head -n 1
  fi
}

generate_hex() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex "$1" | cut -c1-"$2"
  else
    cat /dev/urandom | tr -dc 'a-f0-9' | fold -w "$2" | head -n 1
  fi
}

# 1. Determine Environment Selection
current_file=".env.current"
target_env="Development"
prod_unlock="false"

# Read existing selection if it exists
if [ -f "$current_file" ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    if [[ "$line" =~ ^CVERIFY_ENVIRONMENT=(.+) ]]; then
      target_env="${BASH_REMATCH[1]}"
    fi
    if [[ "$line" =~ ^PRODUCTION_UNLOCK_CONFIRMATION=(.+) ]]; then
      prod_unlock="${BASH_REMATCH[1]}"
    fi
  done < "$current_file"
fi

# Override environment if parameter provided
if [ -n "$1" ]; then
  target_env="$1"
fi

# Normalize case of environment (to TitleCase)
target_env=$(echo "$target_env" | tr '[:upper:]' '[:lower:]')
case "$target_env" in
  development) target_env="Development" ;;
  testing)     target_env="Testing" ;;
  staging)     target_env="Staging" ;;
  production)  target_env="Production" ;;
  *)
    write_error "Invalid Environment: '$target_env'. Must be one of Development, Testing, Staging, Production."
    exit 1
    ;;
esac

target_env_lower=$(echo "$target_env" | tr '[:upper:]' '[:lower:]')

# Write environment selection to .env.current to persist
cat <<EOF > "$current_file"
CVERIFY_ENVIRONMENT=${target_env}
PRODUCTION_UNLOCK_CONFIRMATION=${prod_unlock}
EOF

write_info "Active Target Environment: ${target_env}"

# 2. Production Lock Safety Gate
if [ "$target_env" = "Production" ] && [ "$prod_unlock" != "true" ]; then
  write_error "=========================================================================="
  write_error "PRODUCTION LOCK SAFETY TRIGGERED!"
  write_error "--------------------------------------------------------------------------"
  write_error "You are attempting to deploy or switch to the PRODUCTION environment,"
  write_error "but the production unlock confirmation has not been set to true."
  write_error ""
  write_error "To switch to production, please edit '.env.current' and set:"
  write_error "PRODUCTION_UNLOCK_CONFIRMATION=true"
  write_error "=========================================================================="
  exit 1
fi

# 3. Create or load Secrets file
secrets_file=".env.secrets"
secrets_example=".env.secrets.example"

if [ ! -f "$secrets_file" ]; then
  if [ "$target_env" = "Development" ] || [ "$target_env" = "Testing" ]; then
    write_info "Creating local secrets file from template..."
    cp "$secrets_example" "$secrets_file"
  else
    write_error "Fatal: Local secrets file '.env.secrets' is required for ${target_env} but was not found."
    write_error "Please copy '.env.secrets.example' to '.env.secrets' and configure your production keys."
    exit 1
  fi
fi

# 4. Generate keys in secrets if placeholders exist
# Compatible sed replacement
sed_replace() {
  local pattern="$1"
  local replacement="$2"
  local file="$3"
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i "" "s|$pattern|$replacement|g" "$file"
  else
    sed -i "s|$pattern|$replacement|g" "$file"
  fi
}

secrets_updated=false
if grep -q "GENERATE_SECURE_PASSWORD" "$secrets_file"; then
  db_pass=$(generate_secret 24 20)
  redis_pass=$(generate_secret 24 20)
  sed_replace "DB_PASSWORD=GENERATE_SECURE_PASSWORD" "DB_PASSWORD=$db_pass" "$secrets_file"
  sed_replace "REDIS_PASSWORD=GENERATE_SECURE_PASSWORD" "REDIS_PASSWORD=$redis_pass" "$secrets_file"
  secrets_updated=true
fi

if grep -q "GENERATE_JWT_SECRET_KEY" "$secrets_file"; then
  jwt_sec=$(generate_secret 48 40)
  sed_replace "JWT_KEY=GENERATE_JWT_SECRET_KEY" "JWT_KEY=$jwt_sec" "$secrets_file"
  secrets_updated=true
fi

if grep -q "GENERATE_TOKEN_ENCRYPTION_KEY" "$secrets_file"; then
  token_enc=$(generate_hex 32 32)
  sed_replace "TOKEN_ENCRYPTION_KEY=GENERATE_TOKEN_ENCRYPTION_KEY" "TOKEN_ENCRYPTION_KEY=$token_enc" "$secrets_file"
  secrets_updated=true
fi

if grep -q "GENERATE_AI_SHARED_SECRET" "$secrets_file"; then
  ai_hmac=$(generate_secret 48 40)
  sed_replace "AI_SERVICE_SHARED_SECRET=GENERATE_AI_SHARED_SECRET" "AI_SERVICE_SHARED_SECRET=$ai_hmac" "$secrets_file"
  secrets_updated=true
fi

if [ "$secrets_updated" = true ]; then
  write_success "Generated secure cryptographic credentials inside .env.secrets"
fi

# 5. Layer and Merge Configuration files
./scripts/resolve-env.sh "$target_env"

# 6. Pre-flight Validation Pipeline & Health Report
./scripts/validate-env.sh "$target_env"

# 8. Synchronize .env across subprojects (only if directories exist)
[ -d client ] && cp .env client/.env
[ -d CVerify.Core ] && cp .env CVerify.Core/.env
[ -d CVerify.AI ] && cp .env CVerify.AI/.env
[ -d docker ] && cp .env docker/.env

write_success "Configuration generated and synchronized successfully."

# 9. Docker Service Orchestration
if [ "$CVERIFY_SKIP_DOCKER" = "true" ]; then
  write_info "Skipping Docker service orchestration (CVERIFY_SKIP_DOCKER is set to true)."
  write_success "Setup process completed successfully!"
  exit 0
fi

write_info "Launching Docker containers..."
if command -v docker-compose >/dev/null 2>&1; then
  docker-compose -f docker/compose.yml -f docker/compose.${target_env_lower}.yml up --build -d
elif docker compose version >/dev/null 2>&1; then
  docker compose -f docker/compose.yml -f docker/compose.${target_env_lower}.yml up --build -d
else
  write_warning "Docker Compose was not found. Infrastructure containers could not be launched automatically."
  write_warning "Please launch manually using: docker compose -f docker/compose.yml -f docker/compose.${target_env_lower}.yml up --build -d"
fi

write_success "Setup process completed successfully!"
EOF
