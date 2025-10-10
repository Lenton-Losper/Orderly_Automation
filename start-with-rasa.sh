#!/bin/bash
# Start Rasa + Node.js WhatsApp Bot

echo "🚀 Starting LLL Farming WhatsApp Bot with Rasa..."

# Check if Rasa is installed
if ! command -v rasa &> /dev/null; then
    echo "❌ Rasa not found. Please install Rasa first:"
    echo "   pip install rasa"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js first."
    exit 1
fi

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 not found. Please install Python 3 first."
    exit 1
fi

echo "✅ All dependencies found"

# Function to cleanup background processes
cleanup() {
    echo "🛑 Shutting down services..."
    kill $RASA_PID $ACTION_PID $NODE_PID 2>/dev/null
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Start Rasa server
echo "🧠 Starting Rasa server..."
rasa run --enable-api --cors "*" --port 5005 &
RASA_PID=$!

# Wait for Rasa to start
sleep 5

# Start Rasa action server
echo "⚡ Starting Rasa action server..."
python3 -m rasa_sdk --actions actions.actions --port 5055 &
ACTION_PID=$!

# Wait for action server to start
sleep 3

# Start Node.js app
echo "📱 Starting Node.js WhatsApp bot..."
node src/index.js &
NODE_PID=$!

echo "✅ All services started!"
echo "📊 Service Status:"
echo "   Rasa Server: http://localhost:5005"
echo "   Action Server: http://localhost:5055"
echo "   Node.js App: Running"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for any process to exit
wait
