#!/bin/bash

# ==============================================================================
# CVerify.AI Development Environment Bootstrapper (Unix/Linux/macOS)
# ==============================================================================
# This script automates the installation of runtimes, SDKs, system tools,
# dependency restoration, and local infrastructure setup for CVerify.AI.
# ==============================================================================

# Exit immediately if a command exits with a non-zero status
set -e

# Configuration variables
CHECK_ONLY=false
SKIP_RUNTIMES=false
SKIP_CONTAINERS=false

# Parse flags
for arg in "$@"; do
  case $arg in
    --check-only)
      CHECK_ONLY=true
      shift
      ;;
    --skip-runtimes)
      SKIP_RUNTIMES=true
      shift
      ;;
    --skip-containers)
      SKIP_CONTAINERS=true
      shift
      ;;
  esac
done

# Text formatting helper functions
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

write_header() {
  echo -e "\n${CYAN}=========================================================${NC}"
  echo -e "${CYAN} $1${NC}"
  echo -e "${CYAN}=========================================================${NC}"
}

write_success() {
  echo -e "${GREEN}[SUCCESS] $1${NC}"
}

write_info() {
  echo -e "[INFO] $1"
}

write_warning() {
  echo -e "${YELLOW}[WARNING] $1${NC}"
}

write_error() {
  echo -e "${RED}[ERROR] $1${NC}"
}

# Resolve directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# ---------------------------------------------------------
# Step 1: Tool and Runtime Verification
# ---------------------------------------------------------
write_header "Step 1: Verifying System Runtimes & SDKs"

install_tool_mac() {
  local tool="$1"
  write_info "Attempting to install $tool via Homebrew..."
  if command -v brew &>/dev/null; then
    case $tool in
      git) brew install git ;;
      docker) write_warning "Please install Docker Desktop manually: https://www.docker.com/products/docker-desktop" ;;
      node) brew install node@20 ;;
      dotnet) brew install --cask dotnet-sdk ;;
      python3) brew install python@3.11 ;;
      tesseract) brew install tesseract ;;
    esac
  else
    write_warning "Homebrew not found. Cannot install $tool automatically."
  fi
}

install_tool_linux() {
  local tool="$1"
  write_info "Attempting to install $tool via apt-get..."
  if command -v apt-get &>/dev/null; then
    local pkg=""
    case $tool in
      git) pkg="git" ;;
      docker) pkg="docker.io" ;;
      node) pkg="nodejs npm" ;;
      dotnet) pkg="dotnet-sdk-10.0" ;;
      python3) pkg="python3 python3-pip python3-venv" ;;
      tesseract) pkg="tesseract-ocr poppler-utils libgl1 libglib2.0-0" ;;
    esac
    if [ -n "$pkg" ]; then
      write_info "Running: sudo apt-get update && sudo apt-get install -y $pkg"
      sudo apt-get update && sudo apt-get install -y $pkg
    fi
  else
    write_warning "apt-get not found. Cannot install $tool automatically."
  fi
}

declare -A tools
tools=(
  ["git"]="Git CLI"
  ["docker"]="Docker Desktop/Daemon"
  ["node"]="Node.js v20 (LTS)"
  ["dotnet"]=".NET 10.0 SDK"
  ["python3"]="Python 3.11+"
  ["tesseract"]="Tesseract OCR"
)

verify_runtimes() {
  missing_tools=()
  for cmd in "${!tools[@]}"; do
    tool_name="${tools[$cmd]}"
    if command -v "$cmd" &>/dev/null; then
      # Get exact version string
      version=""
      if [ "$cmd" = "dotnet" ]; then
        version=$(dotnet --version)
        # Check if version starts with 10
        if [[ ! "$version" =~ ^10\..* ]]; then
          write_warning ".NET SDK version is $version. CVerify.Core requires .NET 10.0."
        fi
      elif [ "$cmd" = "node" ]; then
        version=$(node -v)
      elif [ "$cmd" = "python3" ]; then
        version=$(python3 --version | cut -d' ' -f2)
      elif [ "$cmd" = "tesseract" ]; then
        version=$(tesseract --version | head -n1 | cut -d' ' -f2)
      else
        version=$( "$cmd" --version | head -n 1 )
      fi
      write_success "$tool_name is installed ($version)"
    else
      write_warning "$tool_name is NOT found in PATH."
      missing_tools+=("$cmd")
    fi
  done
}

verify_runtimes

# If there are missing runtimes and we are not in check-only mode
if [ "${#missing_tools[@]}" -gt 0 ] && [ "$CHECK_ONLY" = false ] && [ "$SKIP_RUNTIMES" = false ]; then
  write_header "Attempting Automatic Installation of Missing Runtimes"
  for cmd in "${missing_tools[@]}"; do
    tool_name="${tools[$cmd]}"
    write_info "Installing $tool_name ($cmd)..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
      install_tool_mac "$cmd"
    elif command -v apt-get &>/dev/null; then
      install_tool_linux "$cmd"
    else
      write_warning "Automatic installation not supported on this platform. Please install $tool_name manually."
    fi
  done
  
  # Re-verify after installation attempt
  write_info "Re-verifying runtimes..."
  verify_runtimes
  if [ "${#missing_tools[@]}" -gt 0 ]; then
    write_warning "Some runtimes are still missing. You might need to restart your terminal or install them manually."
  fi
fi

if [ "$CHECK_ONLY" = true ]; then
  write_info "Check-only mode active. Skipping env setup, package restores, and container launches."
  write_header "Verification Completed"
  exit 0
fi

# ---------------------------------------------------------
# Step 2: Environment Templates Configuration
# ---------------------------------------------------------
write_header "Step 2: Configuring Environment Variable Templates"

copy_env_template() {
  local example="$1"
  local target="$2"
  if [ -f "$target" ]; then
    write_info "$(basename "$target") already exists. Skipping overwrite."
  elif [ -f "$example" ]; then
    cp "$example" "$target"
    write_success "Created new environment config from template: $target"
  else
    write_error "Template not found: $example"
  fi
}

copy_env_template "$SCRIPT_DIR/.env.example" "$SCRIPT_DIR/.env"
copy_env_template "$ROOT_DIR/CVerify.Core/.env.example" "$ROOT_DIR/CVerify.Core/.env"
copy_env_template "$ROOT_DIR/client/.env.example" "$ROOT_DIR/client/.env"

# Ensure local directories exist
mkdir -p "$SCRIPT_DIR/temp_clones"
write_success "Created local workspace directory: $SCRIPT_DIR/temp_clones"

# ---------------------------------------------------------
# Step 3: Dependency Restoration
# ---------------------------------------------------------
write_header "Step 3: Restoring Workspace Dependencies"

# 1. CVerify.Core NuGet packages
write_info "Restoring .NET Core NuGet dependencies..."
(
  cd "$ROOT_DIR/CVerify.Core"
  if ! dotnet restore; then
    write_warning "dotnet restore failed. Attempting to clear NuGet cache and retry..."
    dotnet nuget locals all --clear
    if ! dotnet restore; then
      write_error "Failed to restore .NET NuGet dependencies after clearing cache."
      exit 1
    fi
  fi
  write_success ".NET Core NuGet packages restored successfully."
)

# 2. Client npm packages
write_info "Restoring Next.js frontend dependencies..."
(
  cd "$ROOT_DIR/client"
  if ! npm install --legacy-peer-deps; then
    write_warning "npm install failed. Attempting with npm install --force..."
    if ! npm install --force; then
      write_error "Failed to restore Next.js npm packages."
      exit 1
    fi
  fi
  write_success "Client npm packages restored successfully."
)

# 3. Python Virtual Environment Setup & Dependencies
write_info "Setting up Python virtual environment (.venv) in CVerify.AI..."
(
  cd "$SCRIPT_DIR"
  if [ ! -d ".venv" ]; then
    if ! python3 -m venv .venv; then
      write_warning "python3 -m venv failed. Trying python -m venv..."
      python -m venv .venv
    fi
    write_success "Python virtual environment created."
  fi
  
  # Activate and install requirements
  source .venv/bin/activate
  write_info "Installing python dependencies from requirements.txt..."
  if ! pip install --no-cache-dir -r requirements.txt; then
    write_warning "pip install failed. Attempting to upgrade pip and retry..."
    pip install --upgrade pip
    if ! pip install --no-cache-dir -r requirements.txt; then
      write_error "Failed to restore Python dependencies."
      deactivate
      exit 1
    fi
  fi
  write_success "Python packages installed successfully."
  deactivate
)

# ---------------------------------------------------------
# Step 4: Infrastructure Containers Setup
# ---------------------------------------------------------
if [ "$SKIP_CONTAINERS" = false ]; then
  write_header "Step 4: Bootstrapping Infrastructure Containers"
  if ! command -v docker &>/dev/null; then
    write_warning "Docker command not found. Skipping docker compose service launches."
  elif ! docker info &>/dev/null; then
    write_warning "Docker daemon is not running. Please start Docker to run PostgreSQL & Redis containers."
  else
    (
      cd "$ROOT_DIR"
      write_info "Starting PostgreSQL and Redis containers..."
      docker compose up -d postgres redis
      write_success "Database and caching containers are running."
    )
  fi
fi

# ---------------------------------------------------------
# Step 5: System Verification and Builds
# ---------------------------------------------------------
write_header "Step 5: Verifying Workspace Build & Integrity"

# 1. Verify C# Project Build
write_info "Compiling CVerify.Core backend Web API..."
(
  cd "$ROOT_DIR/CVerify.Core"
  if ! dotnet build --no-restore -c Debug; then
    write_warning "Backend build failed. Attempting to restore and rebuild..."
    dotnet restore
    if ! dotnet build --no-restore -c Debug; then
      write_error "Backend build failed twice. Please examine compilation logs."
      exit 1
    fi
  fi
  write_success "Backend build completed successfully."
)

# 2. Run C# Unit Tests
write_info "Running Backend Unit Tests..."
(
  cd "$ROOT_DIR/CVerify.Core"
  if dotnet test tests/CVerify.API.UnitTests/CVerify.API.UnitTests.csproj --no-build; then
    write_success "Backend Unit Tests passed."
  else
    write_warning "Some backend unit tests failed or test runner returned errors."
  fi
)

# 3. Run Python Unit Tests
write_info "Running AI service Python unit tests..."
(
  cd "$SCRIPT_DIR"
  source .venv/bin/activate
  if python -m unittest discover tests; then
    write_success "AI service Python unit tests passed."
  else
    write_warning "Some Python unit tests failed or test runner returned errors."
  fi
  deactivate
)

write_header "CVerify.AI Environment Setup Complete!"
echo -e "${GREEN}You are ready to develop! Start services locally or run tests.${NC}"
write_info "  - Client app port: 3000 (npm run dev)"
write_info "  - ASP.NET API gateway port: 5247 (dotnet run)"
write_info "  - FastAPI AI microservice port: 8000 (uvicorn app.main:app --reload)"
echo ""
