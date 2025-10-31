#!/bin/bash

# Server Deployment Script
# Run this script on your server after SSH: bash deploy-server.sh

set -e  # Exit on error

echo "🛑 Stopping PM2 processes..."
pm2 stop all || true

echo "📦 Cleaning up old dependencies..."
cd ~/Orderly_Automation

# Backup node_modules if it exists (optional)
if [ -d "node_modules" ]; then
    echo "   Removing old node_modules..."
    rm -rf node_modules
fi

# Remove package-lock.json to force fresh install
if [ -f "package-lock.json" ]; then
    echo "   Removing package-lock.json..."
    rm -f package-lock.json
fi

echo "🧹 Cleaning npm cache..."
npm cache clean --force

echo "📥 Installing dependencies..."
# Install with legacy peer deps to handle puppeteer issues
npm install --legacy-peer-deps

# If the above fails, try without legacy-peer-deps
if [ $? -ne 0 ]; then
    echo "⚠️  First install attempt failed, trying alternative method..."
    npm install
fi

echo "✅ Dependencies installed successfully!"

echo "🔄 Restarting PM2 processes..."
pm2 restart all --update-env

echo "📊 Checking PM2 status..."
pm2 status

echo ""
echo "✅ Deployment complete!"
echo ""
echo "To view logs, run: pm2 logs"
echo "To check status, run: pm2 status"

