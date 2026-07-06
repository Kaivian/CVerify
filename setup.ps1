# ==============================================================================
# CVerify One-Click Setup Script (PowerShell / Windows)
# ==============================================================================
# Automates environment variables generation and system startup.
# ==============================================================================

$ErrorActionPreference = "Stop"

function Write-Info ($Message) {
    Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

function Write-Success ($Message) {
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-WarningMsg ($Message) {
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-ErrorMsg ($Message) {
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Helper to generate secure base64 string
function Get-RandomSecret ($length) {
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $bytes = New-Object Byte[] $length
    $rng.GetBytes($bytes)
    $base64 = [Convert]::ToBase64String($bytes)
    # Remove non-alphanumeric chars for password safety
    $clean = $base64 -replace '[^a-zA-Z0-9]', ''
    if ($clean.Length -lt $length) {
        return ($clean + (Get-RandomSecret ($length - $clean.Length))).Substring(0, $length)
    }
    return $clean.Substring(0, $length)
}

# Helper to generate random hex string
function Get-RandomHex ($length) {
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $bytes = New-Object Byte[] ($length / 2)
    $rng.GetBytes($bytes)
    $hex = ($bytes | ForEach-Object { $_.ToString("x2") }) -join ""
    return $hex.Substring(0, $length)
}

# 1. Environment File Verification & Copy
$envFile = Join-Path $PSScriptRoot ".env"
$envExampleFile = Join-Path $PSScriptRoot ".env.example"

if (-not (Test-Path $envFile)) {
    Write-Info "Copying .env.example to .env..."
    Copy-Item $envExampleFile $envFile
} else {
    Write-WarningMsg ".env file already exists. Skipping file copy to prevent overwriting existing keys."
}

# 2. Automatically Generate Secure Passwords & Keys
Write-Info "Generating secure cryptographic keys and database credentials..."

$envContent = Get-Content $envFile -Raw

if ($envContent -match "GENERATE_SECURE_PASSWORD") {
    $dbPass = Get-RandomSecret 20
    $redisPass = Get-RandomSecret 20
    $envContent = $envContent -replace "DB_PASSWORD=GENERATE_SECURE_PASSWORD", "DB_PASSWORD=$dbPass"
    $envContent = $envContent -replace "REDIS_PASSWORD=GENERATE_SECURE_PASSWORD", "REDIS_PASSWORD=$redisPass"
    Write-Info "Secure database and cache passwords generated successfully."
}

if ($envContent -match "GENERATE_JWT_SECRET_KEY") {
    $jwtSec = Get-RandomSecret 40
    $envContent = $envContent -replace "JWT_KEY=GENERATE_JWT_SECRET_KEY", "JWT_KEY=$jwtSec"
    Write-Info "JWT signing secret generated successfully."
}

if ($envContent -match "GENERATE_TOKEN_ENCRYPTION_KEY") {
    $tokenEnc = Get-RandomHex 32
    $envContent = $envContent -replace "TOKEN_ENCRYPTION_KEY=GENERATE_TOKEN_ENCRYPTION_KEY", "TOKEN_ENCRYPTION_KEY=$tokenEnc"
    Write-Info "Token encryption key (AES-256-GCM) generated successfully."
}

if ($envContent -match "GENERATE_AI_SHARED_SECRET") {
    $aiHmac = Get-RandomSecret 40
    $envContent = $envContent -replace "AI_SERVICE_SHARED_SECRET=GENERATE_AI_SHARED_SECRET", "AI_SERVICE_SHARED_SECRET=$aiHmac"
    Write-Info "AI Service HMAC shared secret generated successfully."
}

Set-Content $envFile $envContent

# 3. Booting up Docker Compose
Write-Info "Launching Docker Infrastructure..."
$composeCmd = $null
if (Get-Command "docker compose" -ErrorAction SilentlyContinue) {
    $composeCmd = "docker compose"
} elseif (Get-Command "docker-compose" -ErrorAction SilentlyContinue) {
    $composeCmd = "docker-compose"
}

if ($null -ne $composeCmd) {
    Invoke-Expression "$composeCmd up --build -d"
} else {
    Write-ErrorMsg "Docker Compose was not found. Please install Docker Desktop and execute 'docker compose up --build -d'."
    exit 1
}

Write-Success "CVerify Platform launched successfully!"
Write-Info "Frontend dashboard is accessible at: http://localhost:3000"
Write-Info "Backend gateway healthcheck: http://localhost:5000/health"
