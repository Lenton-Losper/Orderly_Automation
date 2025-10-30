#!/bin/bash
# Quick Start Script - Get running in under 5 minutes
# Uses volume mounts and existing images to avoid long builds

set -e

echo "🚀 Quick Start - LLL Farming WhatsApp Bot"
echo "========================================"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if Firebase credentials exist
if [ ! -f "lllfarming-firebase-adminsdk-fbsvc-c9ce466038.json" ]; then
    echo "❌ Firebase credentials file not found!"
    echo "   Please ensure lllfarming-firebase-adminsdk-fbsvc-c9ce466038.json is in the project root."
    exit 1
fi

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p logs tenants rasa-models

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down..."
    docker-compose -f docker-compose.quick.yml down
    echo "✅ Stopped"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

echo "🔨 Starting services (this will take 2-3 minutes)..."
echo "   - Using existing Rasa image (no build needed)"
echo "   - Installing Node.js dependencies in containers"
echo "   - Volume mounts for hot-reload"

# Start services
docker-compose -f docker-compose.quick.yml up

echo ""
echo "✅ Quick start complete!"
echo ""
echo "📊 Service URLs:"
echo "   Backend API: http://localhost:3000"
echo "   Bot Training API: http://localhost:3001"
echo "   Rasa Server: http://localhost:5005"
echo "   Rasa Actions: http://localhost:5055"
echo ""
echo "📱 WhatsApp Bot:"
echo "   - Check logs for QR code to scan"
echo "   - WebSocket server on port 8080"
echo ""
echo "Press Ctrl+C to stop"
echo "========================================"








