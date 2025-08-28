#!/bin/bash
while true; do
    # Check if bot is responding (not just running)
    if ! pm2 list | grep -q "online"; then
        echo "$(date): Bot offline, restarting..."
        pm2 restart lll-farm-bot
    fi
    # Check every 30 seconds (not 5)
    sleep 30
done
