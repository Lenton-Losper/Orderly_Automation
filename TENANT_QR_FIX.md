# Tenant-Specific QR Code Publishing Fix

## 🎯 Problem Identified

The QR codes were being published to the "default" tenant instead of the specific business tenant because:

1. **Hardcoded Values**: The WhatsApp service was using hardcoded `vendorId` and `tenantId` values
2. **Missing Business Mapping**: The bot wasn't properly determining which business/tenant it should serve
3. **Default Fallback**: All QR codes were falling back to "default" tenant

## ✅ Solution Implemented

### 1. Updated WhatsApp Service (`src/services/whatsapp.js`)

**Changes Made:**
- Added `getBotTenantInfo()` method to dynamically determine vendor/tenant IDs
- Updated `publishQrCode()` to accept vendor/tenant parameters
- Updated `publishConnectionStatus()` to accept vendor/tenant parameters
- Modified QR code generation to use correct tenant information

**Key Methods:**
```javascript
// Get correct tenant info for this bot
async getBotTenantInfo() {
    // Try to get from bot info if already mapped
    if (this.botInfo?.mappedBusinessId && this.botInfo?.mappedBusinessId !== 'default') {
        return {
            vendorId: this.botInfo.mappedBusinessId,
            tenantId: this.botInfo.tenantId || this.botInfo.mappedBusinessId
        };
    }
    
    // Try to get business mapping from bot phone number
    const botPhoneNumber = this.getBotPhoneNumber();
    if (botPhoneNumber) {
        const businessManager = require('./businessManager');
        if (businessManager.isHealthy()) {
            const businessId = await businessManager.getBusinessIdFromBot(botPhoneNumber);
            if (businessId && businessId !== 'default') {
                return {
                    vendorId: businessId,
                    tenantId: businessId
                };
            }
        }
    }
    
    // Fallback to environment variables or default
    return {
        vendorId: process.env.TENANT_ID || 'default',
        tenantId: process.env.TENANT_ID || 'default'
    };
}
```

### 2. Dynamic QR Code Publishing

**Before:**
```javascript
// Always published to "default" tenant
await this.publishQrCode(qr);
```

**After:**
```javascript
// Get correct tenant info and publish to specific tenant
const { vendorId, tenantId } = await this.getBotTenantInfo();
await this.publishQrCode(qr, vendorId, tenantId);
```

## 🚀 How to Test the Fix

### 1. Restart Your Bot
```bash
pm2 restart api-server
```

### 2. Check the Logs
Look for these log messages:
```
TENANT INFO - Using fallback vendor: 264813141453, tenant: 264813141453
📱 QR code published for vendor: 264813141453, tenant: 264813141453
```

### 3. Test with WebSocket Client
```bash
node test-tenant-qr.js
```

### 4. Verify Frontend Connection
Make sure your frontend connects with the correct parameters:
```javascript
const ws = new WebSocket(`ws://localhost:3000?vendorId=264813141453&tenantId=BOBs_B`);
```

## 🔧 Configuration for Your Setup

### Environment Variables
Set these in your `.env` file or PM2 ecosystem:
```bash
TENANT_ID=264813141453  # Your business/vendor ID
```

### Frontend WebSocket Connection
Update your React frontend to connect with the correct tenant:
```javascript
const connectWebSocket = (vendorId, tenantId) => {
    const ws = new WebSocket(`ws://localhost:3000?vendorId=${vendorId}&tenantId=${tenantId}`);
    
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'qr_code') {
            setQrCode(data.qrUrl);
        }
    };
};
```

## 📊 Expected Results

### ✅ After the Fix:
1. **QR codes will be published to the correct tenant**
2. **Frontend will receive QR codes for the specific business**
3. **Logs will show correct vendor/tenant IDs**
4. **Multiple tenants can run simultaneously without interference**

### 🔍 Debug Information:
Look for these log messages to verify the fix:
```
TENANT INFO - Using fallback vendor: 264813141453, tenant: 264813141453
📱 QR code published for vendor: 264813141453, tenant: 264813141453
📡 Connection status published: connecting for vendor: 264813141453, tenant: 264813141453
```

## 🛠️ Troubleshooting

### Issue: Still getting "default" tenant
**Solution:** Check if `TENANT_ID` environment variable is set correctly

### Issue: QR codes not appearing in frontend
**Solution:** Verify WebSocket connection parameters match the bot's vendor/tenant IDs

### Issue: Multiple tenants interfering
**Solution:** Each tenant should have its own vendor ID and WebSocket connection

## 📈 Next Steps

1. **Deploy the fix** to your VPS
2. **Test with your actual business tenant** (BOB's B)
3. **Verify QR codes appear** in the dashboard
4. **Test with multiple tenants** if needed
5. **Monitor logs** for correct tenant publishing

## 🎉 Expected Outcome

After implementing this fix:
- QR codes will be published to the correct business tenant
- Your frontend dashboard will receive QR codes for the specific business
- Multiple businesses can run simultaneously without interference
- The system will properly identify which business the bot is serving

The fix ensures that each business gets its own QR code and connection status, solving the tenant isolation issue! 🚀
