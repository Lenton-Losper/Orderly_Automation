#!/bin/bash
# Rasa Setup Script for LLL Farming WhatsApp Bot

echo "🚀 Setting up Rasa for LLL Farming WhatsApp Bot..."

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed. Please install Python 3 first."
    exit 1
fi

# Check if pip is installed
if ! command -v pip3 &> /dev/null; then
    echo "❌ pip3 is required but not installed. Please install pip3 first."
    exit 1
fi

# Install Rasa
echo "📦 Installing Rasa..."
pip3 install -r requirements.txt

# Install spaCy language model
echo "🌍 Installing spaCy English model..."
python3 -m spacy download en_core_web_sm

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p models
mkdir -p logs
mkdir -p data/test

# Train the initial model
echo "🧠 Training initial Rasa model..."
rasa train

if [ $? -eq 0 ]; then
    echo "✅ Rasa setup completed successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Start the Rasa server: npm run rasa:run"
    echo "2. Start the action server: python3 -m rasa_sdk --actions actions.actions"
    echo "3. Test the bot: npm run rasa:shell"
    echo ""
    echo "For production deployment:"
    echo "1. Configure your environment variables in rasa.env"
    echo "2. Set up Redis/MongoDB for conversation storage"
    echo "3. Deploy using Docker or your preferred method"
else
    echo "❌ Rasa training failed. Please check the error messages above."
    exit 1
fi
