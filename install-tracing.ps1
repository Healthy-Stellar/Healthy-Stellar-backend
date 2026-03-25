# Distributed Tracing Installation Script (PowerShell)
# This script installs OpenTelemetry dependencies and sets up the development environment

Write-Host "🚀 Installing OpenTelemetry Distributed Tracing..." -ForegroundColor Cyan
Write-Host ""

# Install npm dependencies
Write-Host "📦 Installing npm packages..." -ForegroundColor Yellow
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install npm packages" -ForegroundColor Red
    exit 1
}

Write-Host "✅ npm packages installed successfully" -ForegroundColor Green
Write-Host ""

# Check if .env exists
if (-not (Test-Path .env)) {
    Write-Host "📝 Creating .env file from .env.example..." -ForegroundColor Yellow
    Copy-Item .env.example .env
    Write-Host "✅ .env file created" -ForegroundColor Green
    Write-Host ""
    Write-Host "⚠️  Please configure the following variables in .env:" -ForegroundColor Yellow
    Write-Host "   - OTEL_SERVICE_NAME=healthy-stellar-backend"
    Write-Host "   - OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces"
    Write-Host "   - OTEL_SAMPLING_RATE=1.0"
    Write-Host ""
} else {
    Write-Host "✅ .env file already exists" -ForegroundColor Green
    Write-Host ""
}

# Check if Docker is running
try {
    docker info | Out-Null
    $dockerRunning = $true
} catch {
    $dockerRunning = $false
}

if (-not $dockerRunning) {
    Write-Host "⚠️  Docker is not running. Please start Docker to use Jaeger." -ForegroundColor Yellow
    Write-Host ""
} else {
    Write-Host "🐳 Starting Jaeger with Docker Compose..." -ForegroundColor Yellow
    docker-compose -f docker-compose.dev.yml up -d jaeger
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Jaeger started successfully" -ForegroundColor Green
        Write-Host ""
        Write-Host "📊 Jaeger UI available at: http://localhost:16686" -ForegroundColor Cyan
        Write-Host ""
    } else {
        Write-Host "❌ Failed to start Jaeger" -ForegroundColor Red
        Write-Host ""
    }
}

Write-Host "✅ Distributed Tracing Installation Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📚 Next Steps:" -ForegroundColor Cyan
Write-Host "   1. Configure .env with OTEL_* variables (if not already done)"
Write-Host "   2. Start the application: npm run start:dev"
Write-Host "   3. Make some API requests to generate traces"
Write-Host "   4. View traces in Jaeger UI: http://localhost:16686"
Write-Host ""
Write-Host "📖 Documentation:" -ForegroundColor Cyan
Write-Host "   - Quick Start: docs/TRACING_QUICK_START.md"
Write-Host "   - Full Guide: docs/DISTRIBUTED_TRACING.md"
Write-Host "   - Implementation Summary: TRACING_IMPLEMENTATION.md"
Write-Host ""
