#!/bin/bash

# Setup Script for 24/7 Bot Operation
# Run this once on your server to configure PM2 for auto-start on reboot

set -e

echo "🚀 Setting up 24/7 bot operation..."

# Save current PM2 process list
echo "💾 Saving current PM2 processes..."
pm2 save

# Setup PM2 to start on system boot
echo "🔧 Setting up PM2 startup script..."
pm2 startup

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Your bots will now:"
echo "   ✓ Run 24/7"
echo "   ✓ Auto-restart if they crash"
echo "   ✓ Start automatically after server reboot"
echo ""
echo "🔄 To manually restart all bots:"
echo "   pm2 restart all"
echo ""
echo "📊 To check status:"
echo "   pm2 status"
echo ""
echo "📝 To view logs:"
echo "   pm2 logs"

