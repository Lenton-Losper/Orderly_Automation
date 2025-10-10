@echo off
REM Rasa Setup Script for LLL Farming WhatsApp Bot (Windows)

echo 🚀 Setting up Rasa for LLL Farming WhatsApp Bot...

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python is required but not installed. Please install Python first.
    pause
    exit /b 1
)

REM Check if pip is installed
pip --version >nul 2>&1
if errorlevel 1 (
    echo ❌ pip is required but not installed. Please install pip first.
    pause
    exit /b 1
)

REM Install Rasa
echo 📦 Installing Rasa...
pip install -r requirements.txt

REM Install spaCy language model
echo 🌍 Installing spaCy English model...
python -m spacy download en_core_web_sm

REM Create necessary directories
echo 📁 Creating directories...
if not exist models mkdir models
if not exist logs mkdir logs
if not exist data\test mkdir data\test

REM Train the initial model
echo 🧠 Training initial Rasa model...
rasa train

if errorlevel 0 (
    echo ✅ Rasa setup completed successfully!
    echo.
    echo Next steps:
    echo 1. Start the Rasa server: npm run rasa:run
    echo 2. Start the action server: python -m rasa_sdk --actions actions.actions
    echo 3. Test the bot: npm run rasa:shell
    echo.
    echo For production deployment:
    echo 1. Configure your environment variables in rasa.env
    echo 2. Set up Redis/MongoDB for conversation storage
    echo 3. Deploy using Docker or your preferred method
) else (
    echo ❌ Rasa training failed. Please check the error messages above.
)

pause
