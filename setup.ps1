# ==============================================================================
# CVerify One-Click Centralized Setup & Environment Resolver (PowerShell)
# ==============================================================================
# Resolves environment settings, validates safety gates, and launches Docker.
# ==============================================================================

param (
    [string]$Environment = $null
)

$ErrorActionPreference = "Stop"

# Helpers for logging
function Write-Info ($Message) { Write-Host "[INFO] $Message" -ForegroundColor Cyan }
function Write-Success ($Message) { Write-Host "[SUCCESS] $Message" -ForegroundColor Green }
function Write-WarningMsg ($Message) { Write-Host "[WARNING] $Message" -ForegroundColor Yellow }
function Write-ErrorMsg ($Message) { Write-Host "[ERROR] $Message" -ForegroundColor Red }

# Cryptographic random generation helpers
function Get-RandomSecret ($length) {
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $bytes = New-Object Byte[] $length
    $rng.GetBytes($bytes)
    $base64 = [Convert]::ToBase64String($bytes)
    $clean = $base64 -replace '[^a-zA-Z0-9]', ''
    if ($clean.Length -lt $length) {
        return ($clean + (Get-RandomSecret ($length - $clean.Length))).Substring(0, $length)
    }
    return $clean.Substring(0, $length)
}

function Get-RandomHex ($length) {
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $bytes = New-Object Byte[] ($length / 2)
    $rng.GetBytes($bytes)
    $hex = ($bytes | ForEach-Object { $_.ToString("x2") }) -join ""
    return $hex.Substring(0, $length)
}

# 1. Determine Environment Selection

$currentFile = Join-Path $PSScriptRoot ".env.current"
$targetEnv = "Development"
$prodUnlock = "false"

# Read existing selection if it exists
if (Test-Path $currentFile) {
    $currentContent = Get-Content $currentFile
    foreach ($line in $currentContent) {
        if ($line -match "CVERIFY_ENVIRONMENT=(.+)") {
            $targetEnv = $Matches[1].Trim()
        }
        if ($line -match "PRODUCTION_UNLOCK_CONFIRMATION=(.+)") {
            $prodUnlock = $Matches[1].Trim()
        }
    }
}

# Override environment if parameter provided
if ($null -ne $Environment -and $Environment -ne "") {
    $targetEnv = $Environment
}

# Normalize case of environment
$targetEnv = (Get-Culture).TextInfo.ToTitleCase($targetEnv.ToLower())
if ($targetEnv -notin @("Development", "Testing", "Staging", "Production")) {
    Write-ErrorMsg "Invalid Environment: '$targetEnv'. Must be one of Development, Testing, Staging, Production."
    exit 1
}

# Write environment selection to .env.current to persist
Set-Content -Path $currentFile -Value "CVERIFY_ENVIRONMENT=$targetEnv`nPRODUCTION_UNLOCK_CONFIRMATION=$prodUnlock"
Write-Info "Active Target Environment: $targetEnv"

# 2. Production Lock Safety Gate
if ($targetEnv -eq "Production" -and $prodUnlock -ne "true") {
    Write-ErrorMsg "=========================================================================="
    Write-ErrorMsg "PRODUCTION LOCK SAFETY TRIGGERED!"
    Write-ErrorMsg "--------------------------------------------------------------------------"
    Write-ErrorMsg "You are attempting to deploy or switch to the PRODUCTION environment,"
    Write-ErrorMsg "but the production unlock confirmation has not been set to true."
    Write-ErrorMsg ""
    Write-ErrorMsg "To switch to production, please edit '.env.current' and set:"
    Write-ErrorMsg "PRODUCTION_UNLOCK_CONFIRMATION=true"
    Write-ErrorMsg "=========================================================================="
    exit 1
}

# 3. Create or load Secrets file
$secretsFile = Join-Path $PSScriptRoot ".env.secrets"
$secretsExample = Join-Path $PSScriptRoot ".env.secrets.example"

if (-not (Test-Path $secretsFile)) {
    if ($targetEnv -in @("Development", "Testing")) {
        Write-Info "Creating local secrets file from template..."
        Copy-Item $secretsExample $secretsFile
    } else {
        Write-ErrorMsg "Fatal: Local secrets file '.env.secrets' is required for $targetEnv but was not found."
        Write-ErrorMsg "Please copy '.env.secrets.example' to '.env.secrets' and configure your production keys."
        exit 1
    }
}

# 4. Generate keys in secrets if placeholders exist
$secretsContent = Get-Content $secretsFile -Raw
$secretsUpdated = $false

if ($secretsContent -match "GENERATE_SECURE_PASSWORD") {
    $dbPass = Get-RandomSecret 20
    $redisPass = Get-RandomSecret 20
    $secretsContent = $secretsContent -replace "DB_PASSWORD=GENERATE_SECURE_PASSWORD", "DB_PASSWORD=$dbPass"
    $secretsContent = $secretsContent -replace "REDIS_PASSWORD=GENERATE_SECURE_PASSWORD", "REDIS_PASSWORD=$redisPass"
    $secretsUpdated = $true
}
if ($secretsContent -match "GENERATE_JWT_SECRET_KEY") {
    $jwtSec = Get-RandomSecret 40
    $secretsContent = $secretsContent -replace "JWT_KEY=GENERATE_JWT_SECRET_KEY", "JWT_KEY=$jwtSec"
    $secretsUpdated = $true
}
if ($secretsContent -match "GENERATE_TOKEN_ENCRYPTION_KEY") {
    $tokenEnc = Get-RandomHex 32
    $secretsContent = $secretsContent -replace "TOKEN_ENCRYPTION_KEY=GENERATE_TOKEN_ENCRYPTION_KEY", "TOKEN_ENCRYPTION_KEY=$tokenEnc"
    $secretsUpdated = $true
}
if ($secretsContent -match "GENERATE_AI_SHARED_SECRET") {
    $aiHmac = Get-RandomSecret 40
    $secretsContent = $secretsContent -replace "AI_SERVICE_SHARED_SECRET=GENERATE_AI_SHARED_SECRET", "AI_SERVICE_SHARED_SECRET=$aiHmac"
    $secretsUpdated = $true
}

if ($secretsUpdated) {
    Set-Content -Path $secretsFile -Value $secretsContent
    Write-Success "Generated secure cryptographic credentials inside .env.secrets"
}

# Helper function to parse an env file into a hashtable
function Import-EnvFile ($filePath) {
    $envHash = @{}
    if (Test-Path $filePath) {
        $lines = Get-Content $filePath
        foreach ($line in $lines) {
            $trimmed = $line.Trim()
            if ($trimmed -ne "" -and -not $trimmed.StartsWith("#")) {
                $parts = $trimmed.Split('=', 2)
                if ($parts.Count -eq 2) {
                    $key = $parts[0].Trim()
                    $val = $parts[1].Trim()
                    $envHash[$key] = $val
                }
            }
        }
    }
    return $envHash
}

# 5. Layer and Merge Configuration files
Write-Info "Layering configuration files..."
$defaultsHash = Import-EnvFile (Join-Path $PSScriptRoot ".env.defaults")
$envSpecificHash = Import-EnvFile (Join-Path $PSScriptRoot ".env.$($targetEnv.ToLower())")
$secretsHash = Import-EnvFile $secretsFile

# Merge (Current > Secrets > EnvSpecific > Defaults)
$mergedHash = @{}
foreach ($key in $defaultsHash.Keys) { $mergedHash[$key] = $defaultsHash[$key] }
foreach ($key in $envSpecificHash.Keys) { $mergedHash[$key] = $envSpecificHash[$key] }
foreach ($key in $secretsHash.Keys) { $mergedHash[$key] = $secretsHash[$key] }
$currentHash = Import-EnvFile $currentFile
foreach ($key in $currentHash.Keys) { $mergedHash[$key] = $currentHash[$key] }

# Ensure COMPOSE_FILE is configured for the target environment using Windows semicolon separator
$mergedHash["COMPOSE_FILE"] = "docker/compose.yml;docker/compose.$($targetEnv.ToLower()).yml"

# Map GOOGLE_CLIENT_ID to NEXT_PUBLIC_GOOGLE_CLIENT_ID for frontend SSO flow
if ($mergedHash.ContainsKey("GOOGLE_CLIENT_ID")) {
    $mergedHash["NEXT_PUBLIC_GOOGLE_CLIENT_ID"] = $mergedHash["GOOGLE_CLIENT_ID"]
}

# Write health check stats
$missingRequired = @()
$warnings = @()
$loadedSources = @(".env.defaults", ".env.$($targetEnv.ToLower())", ".env.secrets", ".env.current")

# 6. Pre-flight Validation Pipeline
Write-Info "Executing configuration validation pipeline..."

# Check required keys
$requiredKeys = @("DB_PASSWORD", "REDIS_PASSWORD", "JWT_KEY", "TOKEN_ENCRYPTION_KEY", "AI_SERVICE_SHARED_SECRET", "ASPNETCORE_ENVIRONMENT")
foreach ($req in $requiredKeys) {
    if (-not $mergedHash.ContainsKey($req) -or $mergedHash[$req] -eq "" -or $mergedHash[$req] -match "your_") {
        $missingRequired += $req
    }
}

# Check ports
$portKeys = @("CORE_PORT", "AI_PORT", "CLIENT_PORT", "DB_PORT", "REDIS_PORT")
foreach ($portKey in $portKeys) {
    if ($mergedHash.ContainsKey($portKey)) {
        $portVal = $mergedHash[$portKey]
        if (-not ($portVal -match "^\d+$") -or [int]$portVal -lt 1 -or [int]$portVal -gt 65535) {
            $missingRequired += "$portKey (Invalid Port: '$portVal')"
        }
    }
}

# Check URLs
$urlKeys = @("FRONTEND_URL", "INTERNAL_API_URL", "NEXT_PUBLIC_API_URL")
foreach ($urlKey in $urlKeys) {
    if ($mergedHash.ContainsKey($urlKey)) {
        $urlVal = $mergedHash[$urlKey]
        if ($urlVal -ne "" -and -not ($urlVal -match "^https?://")) {
            $missingRequired += "$urlKey (Invalid URL: '$urlVal')"
        }
    }
}

# Check Warnings
$optionalSecrets = @("ANTHROPIC_API_KEY", "GOOGLE_CLIENT_SECRET", "GITHUB_CLIENT_SECRET")
foreach ($opt in $optionalSecrets) {
    if (-not $mergedHash.ContainsKey($opt) -or $mergedHash[$opt] -eq "" -or $mergedHash[$opt] -match "your_") {
        $warnings += "$opt is missing or set to placeholder. Relevant features will be disabled."
    }
}

# 7. Generate Configuration Health Report
$reportDir = Join-Path $PSScriptRoot "logs"
if (-not (Test-Path $reportDir)) {
    New-Item -ItemType Directory -Path $reportDir | Out-Null
}

$status = "PASS"
if ($missingRequired.Count -gt 0) {
    $status = "FAIL"
}

$report = [ordered]@{
    "activeEnvironment" = $targetEnv
    "status"            = $status
    "timestamp"         = (Get-Date -Format "o")
    "sourcesLoaded"     = $loadedSources
    "missingRequired"   = $missingRequired
    "warnings"          = $warnings
}

$reportJson = $report | ConvertTo-Json
Set-Content -Path (Join-Path $reportDir "config-health-report.json") -Value $reportJson

# Print Validation Report
Write-Host "--------------------------------------------------------" -ForegroundColor Gray
$statusColor = if ($status -eq "PASS") { "Green" } else { "Red" }
Write-Host " CONFIGURATION HEALTH REPORT - STATUS: $status" -ForegroundColor $statusColor
Write-Host "--------------------------------------------------------" -ForegroundColor Gray
Write-Host " Active Environment : $targetEnv"
Write-Host " Loaded Sources     : $($loadedSources -join ', ')"
if ($missingRequired.Count -gt 0) {
    Write-Host " Missing/Erroneous  :" -ForegroundColor Red
    foreach ($m in $missingRequired) { Write-Host "   - $m" -ForegroundColor Red }
}
if ($warnings.Count -gt 0) {
    Write-Host " Warnings           :" -ForegroundColor Yellow
    foreach ($w in $warnings) { Write-Host "   - $w" -ForegroundColor Yellow }
}
Write-Host "--------------------------------------------------------" -ForegroundColor Gray

if ($status -eq "FAIL") {
    Write-ErrorMsg "Configuration validation failed. Resolving critical issues is required before booting."
    exit 1
}

# 8. Write combined .env file to root and subprojects
$envFileLines = @(
    "# ==============================================================================",
    "# GENERATED CVERIFY UNIFIED ENVIRONMENT CONFIGURATION - DO NOT EDIT",
    "# ==============================================================================",
    "# Generated for Environment: $targetEnv on $(Get-Date -Format 'F')",
    "# =============================================================================="
)

foreach ($key in $mergedHash.Keys) {
    $envFileLines += "$key=$($mergedHash[$key])"
}

$finalEnvContent = $envFileLines -join "`n"

# Root .env
$rootEnv = Join-Path $PSScriptRoot ".env"
Set-Content -Path $rootEnv -Value $finalEnvContent

# client/.env
$clientEnv = Join-Path (Join-Path $PSScriptRoot "client") ".env"
Set-Content -Path $clientEnv -Value $finalEnvContent

# CVerify.Core/.env
$coreEnv = Join-Path (Join-Path $PSScriptRoot "CVerify.Core") ".env"
Set-Content -Path $coreEnv -Value $finalEnvContent

# CVerify.AI/.env
$aiEnv = Join-Path (Join-Path $PSScriptRoot "CVerify.AI") ".env"
Set-Content -Path $aiEnv -Value $finalEnvContent

# docker/.env
$dockerEnv = Join-Path (Join-Path $PSScriptRoot "docker") ".env"
Set-Content -Path $dockerEnv -Value $finalEnvContent

Write-Success "Configuration generated and synchronized successfully."

# 9. Docker Service Orchestration
Write-Info "Launching Docker containers..."
$composeCmd = $null
if (Get-Command "docker compose" -ErrorAction SilentlyContinue) {
    $composeCmd = "docker compose"
} elseif (Get-Command "docker-compose" -ErrorAction SilentlyContinue) {
    $composeCmd = "docker-compose"
}

if ($null -ne $composeCmd) {
    $composeFiles = "-f docker/compose.yml -f docker/compose.$($targetEnv.ToLower()).yml"
    Write-Info "Running: $composeCmd $composeFiles up --build -d"
    Invoke-Expression "$composeCmd $composeFiles up --build -d"
} else {
    Write-WarningMsg "Docker Compose was not found. Infrastructure containers could not be launched automatically."
    Write-WarningMsg "Please launch manually using: docker compose -f docker/compose.yml -f docker/compose.$($targetEnv.ToLower()).yml up --build -d"
}

Write-Success "Setup process completed successfully!"
