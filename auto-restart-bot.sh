#!/bin/bash
LOG_FILE="/root/Orderly_Automation/bot-monitor.log"

while true; do
    # Get the last 10 lines of bot logs
    RECENT_LOGS=$(pm2 logs lll-farm-bot --lines 10 --nostream 2>/dev/null)
    
    # Count ping failures in recent logs
    PING_FAILURES=$(echo "$RECENT_LOGS" | grep -c "Connection ping failed: Timed Out")
    
    # If we see 3 or more ping failures, restart
    if [ "$PING_FAILURES" -ge 3 ]; then
        echo "$(date): Detected $PING_FAILURES ping failures, restarting bot..." >> $LOG_FILE
        pm2 restart lll-farm-bot
        echo "$(date): Bot restarted" >> $LOG_FILE
        # Wait 60 seconds after restart before checking again
        sleep 60
    fi
    
    # Check every 30 seconds
    sleep 30
done
