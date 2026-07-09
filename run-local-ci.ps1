# ==============================================================================
# CVerify Local CI Pipeline Runner
# ==============================================================================
# Runs the identical checks performed by the GitHub Actions pipeline.
# ==============================================================================

param (
    [switch]$Frontend = $false,
    [switch]$BackendUnit = $false,
    [switch]$BackendIntegration = $false,
    [switch]$Ai = $false,
    [switch]$All = $false
)

$ErrorActionPreference = "Continue"

# Setup default behavior: if no switches are specified, run all checks
if (-not ($Frontend -or $BackendUnit -or $BackendIntegration -or $Ai -or $All)) {
    $All = $true
}

if ($All) {
    $Frontend = $true
    $BackendUnit = $true
    $BackendIntegration = $true
    $Ai = $true
}

# Helpers for logging
function Write-Info ($Message) { Write-Host "[INFO] $Message" -ForegroundColor Cyan }
function Write-Success ($Message) { Write-Host "[SUCCESS] $Message" -ForegroundColor Green }
function Write-WarningMsg ($Message) { Write-Host "[WARNING] $Message" -ForegroundColor Yellow }
function Write-ErrorMsg ($Message) { Write-Host "[ERROR] $Message" -ForegroundColor Red }

$results = [ordered]@{
    "Frontend Build & Lint" = "Skipped"
    "Backend Build & Unit Tests" = "Skipped"
    "Backend Integration Tests" = "Skipped"
    "AI Service Tests" = "Skipped"
}

# ==============================================================================
# 1. Frontend Build & Lint
# ==============================================================================
if ($Frontend) {
    Write-Info "=== [1/4] Starting Frontend Quality Checks ==="
    Push-Location "client"
    try {
        Write-Info "Running ESLint Quality Gate..."
        npm run lint
        $lintStatus = $LASTEXITCODE

        Write-Info "Verifying Frontend Compilation..."
        npm run build
        $buildStatus = $LASTEXITCODE

        if ($lintStatus -eq 0 -and $buildStatus -eq 0) {
            $results["Frontend Build & Lint"] = "Passed"
            Write-Success "Frontend checks passed."
        } else {
            $results["Frontend Build & Lint"] = "Failed"
            Write-ErrorMsg "Frontend checks failed (Lint Code: $lintStatus, Build Code: $buildStatus)."
        }
    } catch {
        $results["Frontend Build & Lint"] = "Failed (Error)"
        Write-ErrorMsg "An error occurred during Frontend checks: $_"
    } finally {
        Pop-Location
    }
}

# ==============================================================================
# 2. Backend Build & Unit Tests
# ==============================================================================
if ($BackendUnit) {
    Write-Info "=== [2/4] Starting Backend Build & Unit Tests ==="
    try {
        Write-Info "Restoring NuGet packages..."
        dotnet restore CVerify.Core/CVerify.sln
        
        Write-Info "Verifying Code Formatting..."
        dotnet format CVerify.Core/CVerify.sln --verify-no-changes
        $formatStatus = $LASTEXITCODE

        Write-Info "Compiling Backend Solution..."
        dotnet build CVerify.Core/CVerify.sln --configuration Release --no-restore
        $compileStatus = $LASTEXITCODE

        Write-Info "Executing Unit Tests..."
        dotnet test CVerify.Core/tests/CVerify.API.UnitTests/CVerify.API.UnitTests.csproj --configuration Release --no-build
        $testStatus = $LASTEXITCODE

        if ($formatStatus -eq 0 -and $compileStatus -eq 0 -and $testStatus -eq 0) {
            $results["Backend Build & Unit Tests"] = "Passed"
            Write-Success "Backend unit checks passed."
        } else {
            $results["Backend Build & Unit Tests"] = "Failed"
            Write-ErrorMsg "Backend unit checks failed (Format: $formatStatus, Compile: $compileStatus, Tests: $testStatus)."
        }
    } catch {
        $results["Backend Build & Unit Tests"] = "Failed (Error)"
        Write-ErrorMsg "An error occurred during Backend unit checks: $_"
    }
}

# ==============================================================================
# 3. Backend Integration Tests
# ==============================================================================
if ($BackendIntegration) {
    Write-Info "=== [3/4] Starting Backend Integration Tests ==="
    try {
        # Note: compile is done in step 2 if run together, but compile anyway if skipped step 2
        if (-not $BackendUnit) {
            Write-Info "Restoring NuGet packages..."
            dotnet restore CVerify.Core/CVerify.sln
            Write-Info "Compiling Backend Solution..."
            dotnet build CVerify.Core/CVerify.sln --configuration Release --no-restore
        }

        Write-Info "Executing Integration Tests (Testcontainers)..."
        dotnet test CVerify.Core/tests/CVerify.API.IntegrationTests/CVerify.API.IntegrationTests.csproj --configuration Release --no-build
        $integrationStatus = $LASTEXITCODE

        if ($integrationStatus -eq 0) {
            $results["Backend Integration Tests"] = "Passed"
            Write-Success "Backend integration checks passed."
        } else {
            $results["Backend Integration Tests"] = "Failed"
            Write-ErrorMsg "Backend integration tests failed (Exit Code: $integrationStatus)."
        }
    } catch {
        $results["Backend Integration Tests"] = "Failed (Error)"
        Write-ErrorMsg "An error occurred during Integration checks: $_"
    }
}

# ==============================================================================
# 4. AI Service Tests
# ==============================================================================
if ($Ai) {
    Write-Info "=== [4/4] Starting AI Service Setup & Tests ==="
    Push-Location "CVerify.AI"
    try {
        # Check for virtual environment
        if (-not (Test-Path ".venv")) {
            Write-WarningMsg "Virtual environment (.venv) not found. Creating virtual environment..."
            python -m venv .venv
        }

        # Setup environment variables for pytest matching CI pipeline
        $env:PYTHONPATH = "CVerify.AI"
        $env:ANTHROPIC_API_KEY = "dummy-key-for-ci"
        $env:SHARED_SECRET = "dummy-secret-for-ci"
        $env:BACKEND_API_URL = "http://mock-backend:8080"

        Write-Info "Installing pip dependencies..."
        & .venv/Scripts/pip install --upgrade pip
        & .venv/Scripts/pip install -r requirements.txt
        & .venv/Scripts/pip install pytest pytest-cov pytest-asyncio

        Write-Info "Running Pytest Suite..."
        & .venv/Scripts/pytest tests --cov=app --cov-report=xml --cov-report=term
        $aiStatus = $LASTEXITCODE

        if ($aiStatus -eq 0) {
            $results["AI Service Tests"] = "Passed"
            Write-Success "AI Service checks passed."
        } else {
            $results["AI Service Tests"] = "Failed"
            Write-ErrorMsg "AI Service checks failed (Exit Code: $aiStatus)."
        }
    } catch {
        $results["AI Service Tests"] = "Failed (Error)"
        Write-ErrorMsg "An error occurred during AI Service checks: $_"
    } finally {
        Pop-Location
    }
}

# ==============================================================================
# Pipeline Run Summary
# ==============================================================================
Write-Host ""
Write-Host "==========================================================================" -ForegroundColor Gray
Write-Host "                           LOCAL CI PIPELINE SUMMARY" -ForegroundColor Gray
Write-Host "==========================================================================" -ForegroundColor Gray

$globalPassed = $true
foreach ($key in $results.Keys) {
    $status = $results[$key]
    $color = "Cyan"
    if ($status -eq "Passed") {
        $color = "Green"
    } elseif ($status -eq "Failed" -or $status -like "Failed*") {
        $color = "Red"
        $globalPassed = $false
    }
    Write-Host "$($key.PadRight(40)) : $status" -ForegroundColor $color
}
Write-Host "==========================================================================" -ForegroundColor Gray

if ($globalPassed) {
    Write-Success "All selected CI checks passed locally!"
    exit 0
} else {
    Write-ErrorMsg "Some CI checks failed locally. Review logs above."
    exit 1
}
