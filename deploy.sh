#!/bin/bash
# Medical System Deployment Script

set -e

echo "🏥 Starting Medical System Deployment..."

# Generate secrets if they don't exist
if [ ! -d "./secrets" ]; then
    echo "📝 Generating secrets..."
    chmod +x generate-secrets.sh
    ./generate-secrets.sh
fi

# Make backup script executable
chmod +x docker/backup/backup.sh

# Build and start services
echo "🔨 Building and starting services..."
docker compose down --remove-orphans
docker compose build --no-cache
docker compose up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
sleep 30

# Check service health
echo "🔍 Checking service health..."
docker compose ps

# Setup backup cron job
echo "💾 Setting up automated backups..."
docker compose exec -T backup /backup.sh setup

# Run initial backup
docker compose exec -T backup /backup.sh backup

echo "✅ Medical System deployed successfully!"
echo "📊 Grafana Dashboard: http://localhost:3001"
echo "📈 Prometheus: http://localhost:9090"
echo "🏥 Medical API: http://localhost:3000"
echo ""
echo "🔐 Login credentials:"
echo "Grafana admin password: $(cat secrets/grafana_password.txt)"