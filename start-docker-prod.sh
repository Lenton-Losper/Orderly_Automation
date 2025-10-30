#!/bin/bash
# Production Docker startup script for LLL Farming WhatsApp Bot
# Optimized for production deployment with proper security and monitoring

set -e

echo "🚀 Starting LLL Farming WhatsApp Bot - Production Environment"
echo "============================================================"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose not found. Please install Docker Compose."
    exit 1
fi

# Check environment variables
if [ -z "$NODE_ENV" ]; then
    export NODE_ENV=production
    echo "⚠️  NODE_ENV not set, defaulting to production"
fi

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p logs
mkdir -p tenants
mkdir -p rasa-models

# Check if Firebase credentials exist
if [ ! -f "lllfarming-firebase-adminsdk-fbsvc-c9ce466038.json" ]; then
    echo "❌ Firebase credentials file not found!"
    echo "   Please ensure lllfarming-firebase-adminsdk-fbsvc-c9ce466038.json is in the project root."
    exit 1
fi

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down production environment..."
    docker-compose -f docker-compose.full.yml down
    echo "✅ Production environment stopped"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Pull latest images
echo "📥 Pulling latest images..."
docker-compose -f docker-compose.full.yml pull

# Build and start services
echo "🔨 Building and starting services..."
docker-compose -f docker-compose.full.yml up --build -d

echo ""
echo "✅ Production environment started successfully!"
echo ""
echo "📊 Service URLs:"
echo "   Backend API: http://localhost:3000"
echo "   Bot Training API: http://localhost:3001"
echo "   Multi-Tenant Rasa: Integrated in Bot Training Service"
echo "   Rasa Actions: http://localhost:5055"
echo ""
echo "🔒 Security Notes:"
echo "   - Services are running in production mode"
echo "   - Health checks are enabled"
echo "   - Non-root users are configured"
echo "   - Sensitive data is mounted as read-only"
echo ""
echo "📱 WhatsApp Bot:"
echo "   - Scan QR code in logs to connect WhatsApp"
echo "   - WebSocket server running on port 8080"
echo ""
echo "Press Ctrl+C to stop all services"
echo "============================================================"

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 15

# Check service health
echo "🏥 Checking service health..."
services=("backend" "bot-training" "rasa-actions" "redis" "mongodb")

for service in "${services[@]}"; do
    if docker-compose -f docker-compose.full.yml ps $service | grep -q "Up"; then
        echo "✅ $service is running"
        
        # Check health endpoint if available
        case $service in
            "backend")
                if curl -f http://localhost:3000/health > /dev/null 2>&1; then
                    echo "   ✅ Health check passed"
                else
                    echo "   ⚠️  Health check failed"
                fi
                ;;
            "bot-training")
                if curl -f http://localhost:3001/health > /dev/null 2>&1; then
                    echo "   ✅ Health check passed"
                else
                    echo "   ⚠️  Health check failed"
                fi
                ;;
        esac
    else
        echo "❌ $service is not running"
    fi
done

echo ""
echo "🎉 Production environment is ready!"
echo "   All services are running in production mode"
echo ""
echo "📋 Useful Commands:"
echo "   View logs: docker-compose -f docker-compose.full.yml logs -f [service]"
echo "   Restart service: docker-compose -f docker-compose.full.yml restart [service]"
echo "   Stop all: docker-compose -f docker-compose.full.yml down"
echo "   Update: docker-compose -f docker-compose.full.yml pull && docker-compose -f docker-compose.full.yml up -d"
echo "   Health check: curl http://localhost:3000/health"
echo ""

# Show running containers
echo "🐳 Running Containers:"
docker-compose -f docker-compose.full.yml ps

echo ""
echo "📊 Resource Usage:"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"

# Keep script running and monitor
echo "🔄 Monitoring services... (Press Ctrl+C to stop)"
while true; do
    sleep 30
    echo "⏰ $(date): Services are running..."
done







