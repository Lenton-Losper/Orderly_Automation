#!/bin/bash
# Development Docker startup script for LLL Farming WhatsApp Bot
# Includes hot-reloading, volume mounts, and development tools

set -e

echo "🚀 Starting LLL Farming WhatsApp Bot - Development Environment"
echo "=============================================================="

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
    echo "🛑 Shutting down development environment..."
    docker-compose -f docker-compose.dev.yml down
    echo "✅ Development environment stopped"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Build and start services
echo "🔨 Building and starting services..."
docker-compose -f docker-compose.dev.yml up --build

echo ""
echo "✅ Development environment started successfully!"
echo ""
echo "📊 Service URLs:"
echo "   Backend API: http://localhost:3000"
echo "   Bot Training API: http://localhost:3001"
echo "   Rasa Server: http://localhost:5005"
echo "   Rasa Actions: http://localhost:5055"
echo "   Redis: localhost:6379"
echo "   MongoDB: localhost:27017"
echo ""
echo "🛠️  Development Tools:"
echo "   Redis Commander: http://localhost:8081"
echo "   Mongo Express: http://localhost:8082 (admin/admin)"
echo ""
echo "📱 WhatsApp Bot:"
echo "   - Scan QR code in terminal to connect WhatsApp"
echo "   - WebSocket server running on port 8080"
echo ""
echo "🔄 Hot Reload:"
echo "   - Source code changes will automatically restart services"
echo "   - Check logs with: docker-compose -f docker-compose.dev.yml logs -f"
echo ""
echo "Press Ctrl+C to stop all services"
echo "=============================================================="

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check service health
echo "🏥 Checking service health..."
services=("backend" "bot-training" "rasa" "rasa-actions" "redis" "mongodb")

for service in "${services[@]}"; do
    if docker-compose -f docker-compose.dev.yml ps $service | grep -q "Up"; then
        echo "✅ $service is running"
    else
        echo "❌ $service is not running"
    fi
done

echo ""
echo "🎉 Development environment is ready!"
echo "   All services are running with hot-reload enabled"
echo "   Make changes to your code and see them reflected immediately"
echo ""
echo "📋 Useful Commands:"
echo "   View logs: docker-compose -f docker-compose.dev.yml logs -f [service]"
echo "   Restart service: docker-compose -f docker-compose.dev.yml restart [service]"
echo "   Stop all: docker-compose -f docker-compose.dev.yml down"
echo "   Rebuild: docker-compose -f docker-compose.dev.yml up --build"
echo ""

# Keep script running
wait


