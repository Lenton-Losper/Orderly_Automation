#!/bin/bash

# Fix Puppeteer/Chromium Dependencies for Ubuntu
# Run this script on your server: bash fix-puppeteer-dependencies.sh

set -e  # Exit on error

echo "🔧 Installing Puppeteer/Chromium system dependencies..."

# Update package list
apt-get update

# Detect Ubuntu version and install appropriate packages
# Ubuntu 25.04 uses t64 transitional packages
if [ -f /etc/os-release ]; then
    . /etc/os-release
    if [[ "$VERSION_ID" == "25.04"* ]]; then
        echo "📦 Detected Ubuntu 25.04 - using t64 packages..."
        # Ubuntu 25.04 package names
        apt-get install -y \
            ca-certificates \
            fonts-liberation \
            libappindicator3-1 \
            libasound2t64 \
            libatk-bridge2.0-0t64 \
            libatk1.0-0t64 \
            libc6 \
            libcairo2 \
            libcups2t64 \
            libdbus-1-3 \
            libexpat1 \
            libfontconfig1 \
            libgbm1 \
            libgcc-s1 \
            libglib2.0-0t64 \
            libgtk-3-0t64 \
            libnspr4 \
            libnss3 \
            libpango-1.0-0 \
            libpangocairo-1.0-0 \
            libstdc++6 \
            libx11-6 \
            libx11-xcb1 \
            libxcb1 \
            libxcomposite1 \
            libxcursor1 \
            libxdamage1 \
            libxext6 \
            libxfixes3 \
            libxi6 \
            libxrandr2 \
            libxrender1 \
            libxss1 \
            libxtst6 \
            lsb-release \
            wget \
            xdg-utils
    else
        echo "📦 Installing standard packages..."
        # Standard package names for older Ubuntu versions
        apt-get install -y \
            ca-certificates \
            fonts-liberation \
            libappindicator3-1 \
            libasound2 \
            libatk-bridge2.0-0 \
            libatk1.0-0 \
            libc6 \
            libcairo2 \
            libcups2 \
            libdbus-1-3 \
            libexpat1 \
            libfontconfig1 \
            libgbm1 \
            libgcc1 \
            libglib2.0-0 \
            libgtk-3-0 \
            libnspr4 \
            libnss3 \
            libpango-1.0-0 \
            libpangocairo-1.0-0 \
            libstdc++6 \
            libx11-6 \
            libx11-xcb1 \
            libxcb1 \
            libxcomposite1 \
            libxcursor1 \
            libxdamage1 \
            libxext6 \
            libxfixes3 \
            libxi6 \
            libxrandr2 \
            libxrender1 \
            libxss1 \
            libxtst6 \
            lsb-release \
            wget \
            xdg-utils
    fi
else
    echo "⚠️  Cannot detect OS version, trying standard packages..."
    apt-get install -y \
        ca-certificates \
        fonts-liberation \
        libappindicator3-1 \
        libasound2t64 \
        libatk-bridge2.0-0t64 \
        libatk1.0-0t64 \
        libcairo2 \
        libcups2t64 \
        libdbus-1-3 \
        libexpat1 \
        libfontconfig1 \
        libgbm1 \
        libglib2.0-0t64 \
        libgtk-3-0t64 \
        libnspr4 \
        libnss3 \
        libpango-1.0-0 \
        libpangocairo-1.0-0 \
        libx11-6 \
        libx11-xcb1 \
        libxcb1 \
        libxcomposite1 \
        libxcursor1 \
        libxdamage1 \
        libxext6 \
        libxfixes3 \
        libxi6 \
        libxrandr2 \
        libxrender1 \
        libxss1 \
        libxtst6 \
        lsb-release \
        wget \
        xdg-utils
fi

echo "✅ System dependencies installed successfully!"
echo ""
echo "🔄 Now restarting PM2 processes..."
pm2 restart all --update-env

echo "📊 Checking PM2 status..."
pm2 status

echo ""
echo "✅ Setup complete! Check logs with: pm2 logs"

