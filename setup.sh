#!/bin/bash

# ==============================================================================
# CVerify One-Click Setup Script (Unix/Linux/macOS)
# ==============================================================================
# Automates environment variables generation and system startup.
# ==============================================================================

set -e

# Formatting helper functions
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

write_info() {
  echo -e "${CYAN}[INFO]${NC} $1"
}

write_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

write_warning() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

write_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# 1. Environment File Verification & Copy
if [ ! -f .env ]; then
  write_info "Copying .env.example to .env..."
  cp .env.example .env
else
  write_warning ".env file already exists. Skipping file copy to prevent overwriting existing keys."
fi

# Function to generate secure random strings
generate_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 "$1" | tr -d '=+/' | cut -c1-"$2"
  else
    # Fallback if openssl is not available
    cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w "$2" | head -n 1
  fi
}

# Function to generate hex strings
generate_hex() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex "$1" | cut -c1-"$2"
  else
    # Fallback if openssl is not available
    cat /dev/urandom | tr -dc 'a-f0-9' | fold -w "$2" | head -n 1
  fi
}

# 2. Automatically Generate Secure Passwords & Keys
write_info "Generating secure cryptographic keys and database credentials..."

# Generate unique values
DB_PASS=$(generate_secret 24 20)
REDIS_PASS=$(generate_secret 24 20)
JWT_SEC=$(generate_secret 48 40)
TOKEN_ENC=$(generate_hex 32 32)
AI_HMAC=$(generate_secret 48 40)

# Replace placeholder keys in .env
# Using compatible sed pattern for macOS and Linux
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

# Apply updates to .env if placeholders are found
if grep -q "GENERATE_SECURE_PASSWORD" .env; then
  sed_replace "DB_PASSWORD=GENERATE_SECURE_PASSWORD" "DB_PASSWORD=$DB_PASS" .env
  sed_replace "REDIS_PASSWORD=GENERATE_SECURE_PASSWORD" "REDIS_PASSWORD=$REDIS_PASS" .env
  write_info "Secure database and cache passwords generated successfully."
fi

if grep -q "GENERATE_JWT_SECRET_KEY" .env; then
  sed_replace "JWT_KEY=GENERATE_JWT_SECRET_KEY" "JWT_KEY=$JWT_SEC" .env
  write_info "JWT signing secret generated successfully."
fi

if grep -q "GENERATE_TOKEN_ENCRYPTION_KEY" .env; then
  sed_replace "TOKEN_ENCRYPTION_KEY=GENERATE_TOKEN_ENCRYPTION_KEY" "TOKEN_ENCRYPTION_KEY=$TOKEN_ENC" .env
  write_info "Token encryption key (AES-256-GCM) generated successfully."
fi

if grep -q "GENERATE_AI_SHARED_SECRET" .env; then
  sed_replace "AI_SERVICE_SHARED_SECRET=GENERATE_AI_SHARED_SECRET" "AI_SERVICE_SHARED_SECRET=$AI_HMAC" .env
  write_info "AI Service HMAC shared secret generated successfully."
fi

# 3. Booting up Docker Compose
write_info "Launching Docker Infrastructure..."
if command -v docker-compose >/dev/null 2>&1; then
  docker-compose up --build -d
elif docker compose version >/dev/null 2>&1; then
  docker compose up --build -d
else
  write_error "Docker Compose was not found. Please install Docker/Docker Compose and run 'docker compose up --build -d'."
  exit 1
fi

write_success "CVerify Platform launched successfully!"
write_info "Frontend dashboard is accessible at: http://localhost:3000"
write_info "Backend gateway healthcheck: http://localhost:5000/health"
