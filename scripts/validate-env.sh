#!/bin/bash
# ==============================================================================
# CVerify Environment Config Validator (validate-env.sh)
# ==============================================================================
# Performs pre-flight checks on the final .env file.
# ==============================================================================
set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

write_info() { echo -e "${CYAN}[INFO]${NC} $1"; }
write_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
write_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
write_error() { echo -e "${RED}[ERROR]${NC} $1"; }

target_env="${1:-Development}"
target_env_lower=$(echo "$target_env" | tr '[:upper:]' '[:lower:]')

if [ ! -f .env ]; then
  write_error "Fatal: .env file not found. Run resolve-env.sh first."
  exit 1
fi

get_val() {
  grep "^$1=" .env | cut -d'=' -f2- | tr -d '\r' | tr -d '"' | tr -d "'" | tr -d ' '
}

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

# Generate Configuration Health Report
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
loaded_sources=(".env.defaults" ".env.${target_env_lower}" ".env.secrets" ".env.current")
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

write_success "Configuration validation passed successfully."
