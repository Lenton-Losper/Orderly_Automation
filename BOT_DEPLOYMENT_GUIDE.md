# WhatsApp Bot Deployment Guide

## 🎯 Overview
This guide shows you how to properly create and deploy WhatsApp bot instances using existing Firebase tenants, avoiding data fragmentation and ensuring proper QR code linking.

## 📋 Prerequisites
- Server access (SSH to your server)
- Firebase tenant already exists in Firestore
- Phone number associated with the tenant

## 🚀 Step-by-Step Deployment Process

### Step 1: Connect to Server
```bash
ssh root@134.122.93.21
cd Orderly_Automation
```

### Step 2: Stop Any Running Bots
```bash
# Check current status
pm2 status

# Stop all running bots
pm2 delete all

# Verify all stopped
pm2 status
```

### Step 3: Find Existing Tenant by Phone Number
```bash
# Option A: Check Firebase Console manually
# Go to: console.firebase.google.com/project/lllfarming/firestore
# Navigate to: tenants collection
# Look for tenant with matching phoneId

# Option B: Use our phone lookup script (if available)
node test-phone-lookup.js 264817375744
```

### Step 4: Create Local Configuration for Existing Tenant
```bash
# Format: node create-tenant.js <tenantId> <phoneNumber> <businessName> <email>
node create-tenant.js tenant_1757795389583_tr1yiscf8 264817375744 "My Business" "test@example.com"
```

**Expected Output:**
```
✅ Tenant configuration saved: /root/Orderly_Automation/tenants/tenant_1757795389583_tr1yiscf8/tenant-config.json

✅ Tenant created successfully:
=====================================
Tenant ID: tenant_1757795389583_tr1yiscf8
Business Phone: 264817375744
Business Name: My Business
API Port: 4636
WebSocket Port: 4637
Created: 2025-09-13T21:19:13.764Z
=====================================

📋 Next steps:
1. Start tenant: pm2 start start-tenant.js --name "tenant_1757795389583_tr1yiscf8" -- tenant_1757795389583_tr1yiscf8
2. View logs: pm2 logs tenant_1757795389583_tr1yiscf8
3. Stop tenant: pm2 stop tenant_1757795389583_tr1yiscf8
```

### Step 5: Start the Bot Instance
```bash
# Format: pm2 start start-tenant.js --name "bot-<phone>" -- <tenantId>
pm2 start start-tenant.js --name "bot-264817375744" -- tenant_1757795389583_tr1yiscf8
```

**Expected Output:**
```
[PM2] Starting /root/Orderly_Automation/start-tenant.js in fork_mode (1 instance)
[PM2] Done.
┌────┬────────────────────┬──────────┬──────┬───────────┬──────────┬──────────┐
│ id │ name               │ mode     │ ↺    │ status    │ cpu      │ memory   │
├────┼────────────────────┼──────────┬──────┬───────────┬──────────┬──────────┤
│ 0  │ bot-264817375744   │ fork     │ 0    │ online    │ 0%       │ 18.2mb   │
└────┴────────────────────┴──────────┴──────┴───────────┬──────────┬──────────┘
```

### Step 6: Check Bot Logs
```bash
# View recent logs
pm2 logs bot-264817375744

# View last 50 lines
pm2 logs bot-264817375744 --lines 50

# Follow logs in real-time
pm2 logs bot-264817375744 --follow
```

**Expected Output:**
```
0|bot-2648 | ✅ WhatsApp Bot successfully initialized
0|bot-2648 | 🎉 === WHATSAPP BOT STARTED SUCCESSFULLY ===
0|bot-2648 | 📱 Scan the QR code above to connect
0|bot-2648 | 👑 Owner number: null
0|bot-2648 | 🕐 Started at: 9/13/2025, 9:19:31 PM
0|bot-2648 | ============================================
0|bot-2648 | 
0|bot-2648 | QR CODE TO SCAN:
0|bot-2648 | ==================================================
0|bot-2648 | 2@p7fP4Z3VEqXswla8+SWHnSZ2ocEU7xpO7MomfsODE7vxANK8pTsDgTZ2xitr3rS+rYLQInQ/5NtE3A==,VLF80svQNs4/khrIRGxiZER+m6FgFFp8i16Dp6+2hmA=,X0hdS4rusmvMFSZyomGjV8NSY4ogJBiLbtVWqQ7P6Tw=,c4rMYvJev6turwrvsj4qn70TjHizQMjFfJRPvr/RviE=
0|bot-2648 | ==================================================
0|bot-2648 | OPTION 1: Copy the text above and paste into WhatsApp Web
0|bot-2648 | OPTION 2: Visit this URL to see QR code:
0|bot-2648 | https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=2%40p7fP4Z3VEqXswla8%2BSWHnSZ2ocEU7xpO7MomfsODE7vxANK8pTsDgTZ2xitr3rS%2BrYLQInQ%2F5NtE3A%3D%3D%2CVLF80svQNs4%2FkhrIRGxiZER%2Bm6FgFFp8i16Dp6%2B2hmA%3D%2CX0hdS4rusmvMFSZyomGjV8NSY4ogJBiLbtVWqQ7P6Tw%3D%2Cc4rMYvJev6turwrvsj4qn70TjHizQMjFfJRPvr%2FRviE%3D
0|bot-2648 | OPTION 3: Open WhatsApp > Settings > Linked Devices > Link a Device
0|bot-2648 | ==================================================
0|bot-2648 | Once connected, bot will auto-discover vendor mapping...
0|bot-2648 | ==================================================
0|bot-2648 | 
0|bot-2648 | TENANT INFO - Using environment tenant: tenant_1757795389583_tr1yiscf8
0|bot-2648 | 📱 QR code updated in Firestore for tenant: tenant_1757795389583_tr1yiscf8 (timestamp: 1757798367944)
0|bot-2648 | 📱 QR code published for vendor: tenant_1757795389583_tr1yiscf8, tenant: tenant_1757795389583_tr1yiscf8
```

### Step 7: Verify QR Code in Firebase
1. Go to Firebase Console: `console.firebase.google.com/project/lllfarming/firestore`
2. Navigate to: `tenants > tenant_1757795389583_tr1yiscf8 > botSession > current`
3. Verify fields:
   - `qrCode`: Contains the QR code data
   - `qrCodeUrl`: Contains the QR code image URL
   - `status`: Should be "pending"
   - `lastUpdated`: Recent timestamp

### Step 8: Test QR Code Scanning
1. Open WhatsApp on your phone
2. Go to Settings > Linked Devices > Link a Device
3. Scan the QR code from the logs or use the URL
4. Check logs for connection status change

## 🔧 Management Commands

### Check Bot Status
```bash
pm2 status
pm2 list
```

### View Specific Bot Logs
```bash
pm2 logs bot-264817375744
pm2 logs bot-264817375744 --lines 100
pm2 logs bot-264817375744 --follow
```

### Restart Bot
```bash
pm2 restart bot-264817375744
```

### Stop Bot
```bash
pm2 stop bot-264817375744
```

### Delete Bot
```bash
pm2 delete bot-264817375744
```

### Stop All Bots
```bash
pm2 delete all
```

## 🚨 Troubleshooting

### Bot Won't Start - Missing Tenant Config
```bash
# Error: Tenant configuration not found
# Solution: Create local config first
node create-tenant.js <tenantId> <phoneNumber> <businessName> <email>
```

### Bot Keeps Restarting
```bash
# Check error logs
pm2 logs bot-264817375744 --err

# Check restart count
pm2 status
```

### QR Code Not Updating
```bash
# Check if bot is running
pm2 status

# Check logs for QR generation
pm2 logs bot-264817375744 --lines 20
```

## 📝 Practice Scenarios

### Scenario 1: New User with Existing Phone
```bash
# 1. Find existing tenant
# 2. Create local config
node create-tenant.js tenant_1234567890_abcdef 264817375744 "New Business" "new@example.com"

# 3. Start bot
pm2 start start-tenant.js --name "bot-264817375744" -- tenant_1234567890_abcdef
```

### Scenario 2: Multiple Bots for Same Phone
```bash
# This should be avoided - use existing tenant instead
# If you must, use different tenant IDs
```

### Scenario 3: Clean Restart
```bash
# 1. Stop all
pm2 delete all

# 2. Create config
node create-tenant.js <tenantId> <phone> <name> <email>

# 3. Start bot
pm2 start start-tenant.js --name "bot-<phone>" -- <tenantId>
```

## ✅ Success Indicators

- ✅ Bot shows "online" status in PM2
- ✅ Logs show "WhatsApp Bot successfully initialized"
- ✅ QR code appears in logs
- ✅ QR code is stored in Firebase
- ✅ Frontend displays QR code
- ✅ No error messages in logs

## 🎯 Best Practices

1. **Always search for existing tenants first**
2. **Use descriptive bot names** (e.g., `bot-264817375744`)
3. **Check logs after starting** to ensure success
4. **Verify QR code in Firebase** before testing
5. **Use the correct tenant ID** from Firebase, not phone number
6. **Stop all bots before creating new ones** to avoid conflicts

## 📞 Quick Reference

```bash
# Complete deployment in 4 commands:
pm2 delete all
node create-tenant.js <tenantId> <phone> <name> <email>
pm2 start start-tenant.js --name "bot-<phone>" -- <tenantId>
pm2 logs bot-<phone>
```

---

**Remember**: The key is to use existing Firebase tenants, not create new ones with phone numbers as IDs!
