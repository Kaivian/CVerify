<#
.SYNOPSIS
    CVerify.AI Development Environment Bootstrapper
.DESCRIPTION
    This script automates the installation of runtimes, SDKs, system tools,
    dependency restoration, and local infrastructure setup for CVerify.AI.
    Designed for Windows using PowerShell and winget.
.PARAMETER CheckOnly
    Only perform verification checks without installing packages or restoring dependencies.
.PARAMETER SkipRuntimes
    Skip system runtime installation and only perform codebase configuration and dependency restores.
.PARAMETER SkipContainers
    Skip starting local infrastructure containers via Docker Compose.
#>

param (
    [switch]$CheckOnly,
    [switch]$SkipRuntimes,
    [switch]$SkipContainers
)

$ErrorActionPreference = "Stop"

# ---------------------------------------------------------
# Formatting Helpers
# ---------------------------------------------------------
function Write-Header ($text) {
    Write-Host ""
    Write-Host "=========================================================" -ForegroundColor Cyan
    Write-Host " $text" -ForegroundColor Cyan -Bold
    Write-Host "=========================================================" -ForegroundColor Cyan
}

function Write-Success ($text) {
    Write-Host "[SUCCESS] $text" -ForegroundColor Green
}

function Write-Info ($text) {
    Write-Host "[INFO] $text" -ForegroundColor White
}

function Write-WarningMsg ($text) {
    Write-Host "[WARNING] $text" -ForegroundColor Yellow
}

function Write-ErrorMsg ($text) {
    Write-Host "[ERROR] $text" -ForegroundColor Red
}

# ---------------------------------------------------------
# Version Extraction Helpers
# ---------------------------------------------------------
function Get-CommandVersion ($cmd, $argsList) {
    try {
        $output = & $cmd $argsList 2>$null
        if ($output -is [array]) { $output = $output[0] }
        return $output.ToString().Trim()
    }
    catch {
        return $null
    }
}

# ---------------------------------------------------------
# Step 1: Tool and Runtime Verification
# ---------------------------------------------------------
Write-Header "Step 1: Verifying System Runtimes & SDKs"

$prereqs = @{
    "git"       = @{ Name = "Git CLI"; CheckCmd = "git"; CheckArgs = "--version"; WingetId = "Git.Git" }
    "docker"    = @{ Name = "Docker Desktop"; CheckCmd = "docker"; CheckArgs = "--version"; WingetId = "Docker.DockerDesktop" }
    "node"      = @{ Name = "Node.js v20 (LTS)"; CheckCmd = "node"; CheckArgs = "--version"; WingetId = "OpenJS.NodeJS.LTS" }
    "dotnet"    = @{ Name = ".NET 10.0 SDK"; CheckCmd = "dotnet"; CheckArgs = "--version"; WingetId = "Microsoft.DotNet.SDK.Preview" }
    "python"    = @{ Name = "Python 3.11"; CheckCmd = "python"; CheckArgs = "--version"; WingetId = "Python.Python.3.11" }
    "tesseract" = @{ Name = "Tesseract OCR"; CheckCmd = "tesseract"; CheckArgs = "--version"; WingetId = "UB-Mannheim.TesseractOCR" }
}

$missingTools = @()

foreach ($key in $prereqs.Keys) {
    $tool = $prereqs[$key]
    $version = Get-CommandVersion $tool.CheckCmd $tool.CheckArgs
    
    if ($version) {
        Write-Success "$($tool.Name) is installed ($version)"
        
        # Specific version validations
        if ($key -eq "dotnet" -and -not ($version -like "10.*")) {
            Write-WarningMsg ".NET SDK version is $version. CVerify.Core requires .NET 10.0."
            if (-not $CheckOnly -and -not $SkipRuntimes) {
                $missingTools += $tool
            }
        }
    }
    else {
        Write-WarningMsg "$($tool.Name) is NOT found in PATH."
        if (-not $CheckOnly -and -not $SkipRuntimes) {
            $missingTools += $tool
        }
    }
}

# Install missing runtimes using Winget if permitted
if ($missingTools.Count -gt 0) {
    Write-Header "Installing Missing System Prerequisites"
    foreach ($tool in $missingTools) {
        Write-Info "Installing $($tool.Name) via Winget ($($tool.WingetId))..."
        try {
            # Run winget install silently and wait
            Start-Process "winget" -ArgumentList "install --id $($tool.WingetId) --silent --accept-source-agreements --accept-package-agreements" -NoNewWindow -Wait
            Write-Success "Installation command triggered for $($tool.Name)."
        }
        catch {
            Write-ErrorMsg "Failed to install $($tool.Name) automatically. Please install it manually from official source."
        }
    }
    Write-WarningMsg "Some tools require terminal shell restart to update PATH environmental variables."
}

if ($CheckOnly) {
    Write-Info "CheckOnly mode active. Skipping configuration, dependency restores, and container setups."
    Write-Header "Verification Completed"
    return
}

# ---------------------------------------------------------
# Step 2: Environment Templates Configuration
# ---------------------------------------------------------
Write-Header "Step 2: Configuring Environment Variable Templates"

$rootPath = Resolve-Path "$PSScriptRoot/.."
$aiEnv = "$PSScriptRoot/.env"
$aiEnvExample = "$PSScriptRoot/.env.example"
$coreEnv = "$rootPath/CVerify.Core/.env"
$coreEnvExample = "$rootPath/CVerify.Core/.env.example"
$clientEnv = "$rootPath/client/.env"
$clientEnvExample = "$rootPath/client/.env.example"

function Copy-EnvTemplate ($example, $target) {
    if (Test-Path $target) {
        Write-Info "$($target | Split-Path -Leaf) already exists. Skipping overwrite."
        return
    }
    if (Test-Path $example) {
        Copy-Item $example $target
        Write-Success "Created new environment config from template: $target"
    } else {
        Write-ErrorMsg "Template not found: $example"
    }
}

Copy-EnvTemplate $aiEnvExample $aiEnv
Copy-EnvTemplate $coreEnvExample $coreEnv
Copy-EnvTemplate $clientEnvExample $clientEnv

# Ensure local directories exist
$tempClonesDir = "$PSScriptRoot/temp_clones"
if (-not (Test-Path $tempClonesDir)) {
    New-Item -ItemType Directory -Path $tempClonesDir | Out-Null
    Write-Success "Created local workspace directory: $tempClonesDir"
}

# ---------------------------------------------------------
# Step 3: Dependency Restoration
# ---------------------------------------------------------
Write-Header "Step 3: Restoring Workspace Dependencies"

# 1. CVerify.Core NuGet packages
Write-Info "Restoring .NET Core NuGet dependencies..."
try {
    Push-Location "$rootPath/CVerify.Core"
    dotnet restore
    Write-Success ".NET Core NuGet packages restored successfully."
}
catch {
    Write-WarningMsg "dotnet restore failed. Attempting to clear NuGet cache and retry..."
    try {
        dotnet nuget locals all --clear
        dotnet restore
        Write-Success ".NET Core NuGet packages restored successfully after clearing cache."
    }
    catch {
        Write-ErrorMsg "Failed to restore NuGet packages after clearing cache."
    }
}
finally {
    Pop-Location
}

# 2. Client npm packages
Write-Info "Restoring Next.js frontend dependencies..."
try {
    Push-Location "$rootPath/client"
    npm install --legacy-peer-deps
    Write-Success "Client npm packages restored successfully."
}
catch {
    Write-WarningMsg "npm install failed. Attempting with npm install --force..."
    try {
        npm install --force
        Write-Success "Client npm packages restored successfully after using --force."
    }
    catch {
        Write-ErrorMsg "Failed to restore Next.js npm packages."
    }
}
finally {
    Pop-Location
}

# 3. Python Virtual Environment Setup & Dependencies
Write-Info "Setting up Python virtual environment (.venv) in CVerify.AI..."
try {
    Push-Location $PSScriptRoot
    if (-not (Test-Path ".venv")) {
        python -m venv .venv
        Write-Success "Python virtual environment created."
    }
    
    # Activate and install requirements
    $pipPath = "$PSScriptRoot/.venv/Scripts/pip.exe"
    if (-not (Test-Path $pipPath)) {
        $pipPath = "$PSScriptRoot/.venv/Scripts/pip"
    }
    
    Write-Info "Installing python dependencies from requirements.txt..."
    try {
        & $pipPath install --no-cache-dir -r requirements.txt
        Write-Success "Python packages installed successfully."
    }
    catch {
        Write-WarningMsg "pip install failed. Attempting to upgrade pip and retry..."
        & $pipPath install --upgrade pip
        & $pipPath install --no-cache-dir -r requirements.txt
        Write-Success "Python packages installed successfully after upgrading pip."
    }
}
catch {
    Write-ErrorMsg "Failed to configure Python virtual environment and dependencies."
}
finally {
    Pop-Location
}

# ---------------------------------------------------------
# Step 4: Infrastructure Containers Setup
# ---------------------------------------------------------
if (-not $SkipContainers) {
    Write-Header "Step 4: Bootstrapping Infrastructure Containers"
    
    $dockerRunning = Get-CommandVersion "docker" "info"
    if (-not $dockerRunning) {
        Write-WarningMsg "Docker daemon is NOT running. Please start Docker Desktop to enable local databases."
    }
    else {
        try {
            Push-Location $rootPath
            Write-Info "Starting PostgreSQL and Redis containers..."
            docker compose up -d postgres redis
            Write-Success "Database and caching containers are running."
        }
        catch {
            Write-ErrorMsg "Failed to start Docker containers."
        }
        finally {
            Pop-Location
        }
    }
}

# ---------------------------------------------------------
# Step 5: System Verification and Builds
# ---------------------------------------------------------
Write-Header "Step 5: Verifying Workspace Build & Integrity"

# 1. Verify C# Project Build
Write-Info "Compiling CVerify.Core backend Web API..."
try {
    Push-Location "$rootPath/CVerify.Core"
    $buildResult = dotnet build --no-restore -c Debug
    Write-Success "Backend build completed successfully."
}
catch {
    Write-WarningMsg "Backend build failed. Attempting to run dotnet restore and rebuild..."
    try {
        dotnet restore
        $buildResult = dotnet build --no-restore -c Debug
        Write-Success "Backend build completed successfully after restore."
    }
    catch {
        Write-ErrorMsg "Backend build failed twice. Please examine build output errors."
    }
}
finally {
    Pop-Location
}

# 2. Run C# Unit Tests
Write-Info "Running Backend Unit Tests..."
try {
    Push-Location "$rootPath/CVerify.Core"
    dotnet test tests/CVerify.API.UnitTests/CVerify.API.UnitTests.csproj --no-build
    Write-Success "Backend Unit Tests passed."
}
catch {
    Write-WarningMsg "Some backend unit tests failed or test runner returned errors."
}
finally {
    Pop-Location
}

# 3. Run Python Unit Tests
Write-Info "Running AI service Python unit tests..."
try {
    $pythonPath = "$PSScriptRoot/.venv/Scripts/python.exe"
    if (-not (Test-Path $pythonPath)) {
        $pythonPath = "$PSScriptRoot/.venv/Scripts/python"
    }
    Push-Location $PSScriptRoot
    & $pythonPath -m unittest discover tests
    Write-Success "AI service Python unit tests passed."
}
catch {
    Write-WarningMsg "Some Python unit tests failed or test runner returned errors."
}
finally {
    Pop-Location
}

Write-Header "CVerify.AI Environment Setup Complete!"
Write-Host "You are ready to develop! Start services locally or run tests." -ForegroundColor Green
Write-Host "  - Client app port: 3000 (npm run dev)" -ForegroundColor Gray
Write-Host "  - ASP.NET API gateway port: 5247 (dotnet run)" -ForegroundColor Gray
Write-Host "  - FastAPI AI microservice port: 8000 (uvicorn app.main:app --reload)" -ForegroundColor Gray
Write-Host ""
