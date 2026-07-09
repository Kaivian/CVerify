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
write_info "Layering configuration files..."
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

# 6. Pre-flight Validation Pipeline
write_info "Executing configuration validation pipeline..."
missing_required=()
warnings=()

# Required keys check
for req in DB_PASSWORD REDIS_PASSWORD JWT_KEY TOKEN_ENCRYPTION_KEY AI_SERVICE_SHARED_SECRET ASPNETCORE_ENVIRONMENT; do
  val=$(get_val "$req")
  if [ -z "$val" ] || [[ "$val" == *"your_"* ]] || [[ "$val" == *"GENERATE_"* ]]; then
    missing_required+=("$req")
  fi
done

# Ports checks
for portKey in CORE_PORT AI_PORT CLIENT_PORT DB_PORT REDIS_PORT; do
  val=$(get_val "$portKey")
  if [[ ! "$val" =~ ^[0-9]+$ ]] || [ "$val" -lt 1 ] || [ "$val" -gt 65535 ]; then
    missing_required+=("$portKey (Invalid Port: '$val')")
  fi
done

# URL checks
for urlKey in FRONTEND_URL INTERNAL_API_URL NEXT_PUBLIC_API_URL; do
  val=$(get_val "$urlKey")
  if [ -n "$val" ]; then
    if [[ ! "$val" =~ ^https?:// ]]; then
      missing_required+=("$urlKey (Invalid URL: '$val')")
    fi
  fi
done

# Warnings check
for opt in ANTHROPIC_API_KEY GOOGLE_CLIENT_SECRET GITHUB_CLIENT_SECRET; do
  val=$(get_val "$opt")
  if [ -z "$val" ] || [[ "$val" == *"your_"* ]]; then
    warnings+=("$opt is missing or placeholder.")
  fi
done

# 7. Generate Configuration Health Report
mkdir -p logs
status="PASS"
if [ ${#missing_required[@]} -gt 0 ]; then
  status="FAIL"
fi

to_json_array() {
  local arr=("$@")
  local out="["
  for i in "${!arr[@]}"; do
    local val="${arr[$i]}"
    val="${val//\"/\\\"}"
    if [ $i -eq 0 ]; then
      out+="\"$val\""
    else
      out+=", \"$val\""
    fi
  done
  out+="]"
  echo "$out"
}

missing_json=$(to_json_array "${missing_required[@]}")
warnings_json=$(to_json_array "${warnings[@]}")
loaded_sources=(".env.defaults" ".env.${target_env_lower}" "$secrets_file" "$current_file")
sources_json=$(to_json_array "${loaded_sources[@]}")

cat <<EOF > logs/config-health-report.json
{
  "activeEnvironment": "${target_env}",
  "status": "${status}",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "sourcesLoaded": ${sources_json},
  "missingRequired": ${missing_json},
  "warnings": ${warnings_json}
}
EOF

# Print Validation Report
echo "--------------------------------------------------------"
if [ "$status" = "PASS" ]; then
  echo -e " CONFIGURATION HEALTH REPORT - STATUS: ${GREEN}${status}${NC}"
else
  echo -e " CONFIGURATION HEALTH REPORT - STATUS: ${RED}${status}${NC}"
fi
echo "--------------------------------------------------------"
echo " Active Environment : ${target_env}"
echo " Loaded Sources     : .env.defaults, .env.${target_env_lower}, .env.secrets"
if [ ${#missing_required[@]} -gt 0 ]; then
  echo -e " ${RED}Missing/Erroneous  :${NC}"
  for m in "${missing_required[@]}"; do echo -e "   - ${RED}$m${NC}"; done
fi
if [ ${#warnings[@]} -gt 0 ]; then
  echo -e " ${YELLOW}Warnings           :${NC}"
  for w in "${warnings[@]}"; do echo -e "   - ${YELLOW}$w${NC}"; done
fi
echo "--------------------------------------------------------"

if [ "$status" = "FAIL" ]; then
  write_error "Configuration validation failed. Resolving critical issues is required before booting."
  exit 1
fi

# 8. Synchronize .env across subprojects
cp .env client/.env
cp .env CVerify.Core/.env
cp .env CVerify.AI/.env
cp .env docker/.env

write_success "Configuration generated and synchronized successfully."

# 9. Docker Service Orchestration
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
