#!/bin/bash

# Distributed Tracing Installation Script
# This script installs OpenTelemetry dependencies and sets up the development environment

echo "🚀 Installing OpenTelemetry Distributed Tracing..."
echo ""

# Install npm dependencies
echo "📦 Installing npm packages..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install npm packages"
    exit 1
fi

echo "✅ npm packages installed successfully"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from .env.example..."
    cp .env.example .env
    echo "✅ .env file created"
    echo ""
    echo "⚠️  Please configure the following variables in .env:"
    echo "   - OTEL_SERVICE_NAME=healthy-stellar-backend"
    echo "   - OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces"
    echo "   - OTEL_SAMPLING_RATE=1.0"
    echo ""
else
    echo "✅ .env file already exists"
    echo ""
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "⚠️  Docker is not running. Please start Docker to use Jaeger."
    echo ""
else
    echo "🐳 Starting Jaeger with Docker Compose..."
    docker-compose -f docker-compose.dev.yml up -d jaeger
    
    if [ $? -eq 0 ]; then
        echo "✅ Jaeger started successfully"
        echo ""
        echo "📊 Jaeger UI available at: http://localhost:16686"
        echo ""
    else
        echo "❌ Failed to start Jaeger"
        echo ""
    fi
fi

echo "✅ Distributed Tracing Installation Complete!"
echo ""
echo "📚 Next Steps:"
echo "   1. Configure .env with OTEL_* variables (if not already done)"
echo "   2. Start the application: npm run start:dev"
echo "   3. Make some API requests to generate traces"
echo "   4. View traces in Jaeger UI: http://localhost:16686"
echo ""
echo "📖 Documentation:"
echo "   - Quick Start: docs/TRACING_QUICK_START.md"
echo "   - Full Guide: docs/DISTRIBUTED_TRACING.md"
echo "   - Implementation Summary: TRACING_IMPLEMENTATION.md"
echo ""
