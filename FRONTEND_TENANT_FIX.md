# Frontend Tenant ID Fix

## 🚨 Problem
The frontend is hardcoded to use `tenant_1757795389583_tr1yiscf8` instead of dynamically getting the correct tenant ID for the logged-in user (`tenant_1757833139935_2h9n7r7ed`).

## ✅ Solution
We've created a new API endpoint that returns the correct tenant ID for the current user.

## 🔧 Backend Changes Made

### 1. New API Endpoint: `/api/user/by-phone/:phoneNumber`
**Purpose**: Get tenant information by phone number (for debugging)

**Example Request**:
```bash
GET http://localhost:3000/api/user/by-phone/264813141453
```

**Example Response**:
```json
{
  "success": true,
  "phoneNumber": "264813141453",
  "tenants": [
    {
      "tenantId": "tenant_1757833139935_2h9n7r7ed",
      "name": "My Business",
      "phoneId": "264813141453",
      "isDefault": true,
      "ownerId": "UibTRurG1qTlmQHczOQhZ5KehSz2",
      "createdAt": 1757833139935
    }
  ],
  "recommended": {
    "tenantId": "tenant_1757833139935_2h9n7r7ed",
    "name": "My Business",
    "phoneId": "264813141453",
    "isDefault": true,
    "ownerId": "UibTRurG1qTlmQHczOQhZ5KehSz2",
    "createdAt": 1757833139935
  }
}
```

### 2. New API Endpoint: `/api/user/my-tenant`
**Purpose**: Get tenant information for the current authenticated user

**Example Request**:
```bash
GET http://localhost:3000/api/user/my-tenant
# Requires authentication headers
```

**Example Response**:
```json
{
  "success": true,
  "tenantId": "tenant_1757833139935_2h9n7r7ed",
  "tenantData": {
    "name": "My Business",
    "phoneId": "264813141453",
    "isDefault": true,
    "createdAt": 1757833139935
  }
}
```

## 🎯 Frontend Changes Needed

### 1. Update WhatsApp Sync Component

**Current Code (Hardcoded)**:
```javascript
// ❌ DON'T DO THIS - Hardcoded tenant ID
const tenantId = 'tenant_1757795389583_tr1yiscf8';
const apiUrl = `/api/tenants/${tenantId}/botSession/current`;
```

**New Code (Dynamic)**:
```javascript
// ✅ DO THIS - Dynamic tenant ID
const [tenantId, setTenantId] = useState(null);
const [loading, setLoading] = useState(true);

// Get the correct tenant ID for the current user
useEffect(() => {
    const getCurrentUserTenant = async () => {
        try {
            // Option 1: Use phone number (if you have it)
            const phoneNumber = getCurrentUserPhone(); // Your function to get user's phone
            const response = await fetch(`/api/user/by-phone/${phoneNumber}`);
            const data = await response.json();
            
            if (data.success) {
                setTenantId(data.recommended.tenantId);
            } else {
                console.error('Failed to get tenant:', data.error);
            }
        } catch (error) {
            console.error('Error getting tenant:', error);
        } finally {
            setLoading(false);
        }
    };

    getCurrentUserTenant();
}, []);

// Use the dynamic tenant ID
const apiUrl = tenantId ? `/api/tenants/${tenantId}/botSession/current` : null;
```

### 2. Complete React Component Example

```javascript
import React, { useState, useEffect } from 'react';

const WhatsAppSync = () => {
    const [tenantId, setTenantId] = useState(null);
    const [qrCode, setQrCode] = useState(null);
    const [status, setStatus] = useState('loading');
    const [loading, setLoading] = useState(true);

    // Get the correct tenant ID for the current user
    useEffect(() => {
        const getCurrentUserTenant = async () => {
            try {
                // Get user's phone number from your auth context
                const userPhone = getCurrentUserPhone(); // Implement this function
                
                if (!userPhone) {
                    console.error('No phone number found for current user');
                    setLoading(false);
                    return;
                }

                const response = await fetch(`/api/user/by-phone/${userPhone}`);
                const data = await response.json();
                
                if (data.success) {
                    setTenantId(data.recommended.tenantId);
                    console.log(`✅ Using tenant: ${data.recommended.tenantId}`);
                } else {
                    console.error('Failed to get tenant:', data.error);
                    setStatus('error');
                }
            } catch (error) {
                console.error('Error getting tenant:', error);
                setStatus('error');
            } finally {
                setLoading(false);
            }
        };

        getCurrentUserTenant();
    }, []);

    // Poll for QR code once we have the tenant ID
    useEffect(() => {
        if (!tenantId) return;

        const pollQRCode = async () => {
            try {
                const response = await fetch(`/api/tenants/${tenantId}/botSession/current`);
                const data = await response.json();
                
                if (data.success) {
                    setQrCode(data.qrCodeUrl);
                    setStatus(data.status || 'pending');
                } else {
                    console.error('Failed to get QR code:', data.error);
                }
            } catch (error) {
                console.error('Error polling QR code:', error);
            }
        };

        // Poll immediately
        pollQRCode();
        
        // Then poll every 5 seconds
        const interval = setInterval(pollQRCode, 5000);
        
        return () => clearInterval(interval);
    }, [tenantId]);

    if (loading) {
        return <div>Loading tenant information...</div>;
    }

    if (!tenantId) {
        return <div>No tenant found for this user.</div>;
    }

    return (
        <div>
            <h2>WhatsApp Bot Connection</h2>
            <p>Tenant ID: {tenantId}</p>
            <p>Status: {status}</p>
            
            {qrCode ? (
                <div>
                    <img src={qrCode} alt="WhatsApp QR Code" />
                    <p>Scan this QR code with WhatsApp</p>
                </div>
            ) : (
                <div>No QR code available</div>
            )}
        </div>
    );
};

export default WhatsAppSync;
```

## 🧪 Testing

### 1. Test the API Endpoints

```bash
# Test get tenant by phone
curl "http://localhost:3000/api/user/by-phone/264813141453"

# Test get tenant by phone (other user)
curl "http://localhost:3000/api/user/by-phone/264817375744"
```

### 2. Test with Node.js Script

```bash
node test-user-tenant-api.js
```

## 🎯 Expected Results

### ✅ After the Fix:
1. **Frontend will show the correct tenant ID** for each user
2. **QR codes will be user-specific** and not shared between users
3. **No more data mixing** between different users
4. **Each user sees their own WhatsApp bot** connection

### 🔍 Debug Information:
The frontend should now show:
- **Correct Tenant ID**: `tenant_1757833139935_2h9n7r7ed` (for user with phone 264813141453)
- **User-Specific QR Code**: Each user gets their own QR code
- **Proper Status**: Shows the correct connection status for each user

## 🚀 Deployment Steps

1. **Deploy the backend changes** to your server
2. **Update your frontend** to use the new API endpoints
3. **Test with different users** to ensure proper isolation
4. **Verify QR codes are user-specific**

## 🔧 Troubleshooting

### Issue: Still showing wrong tenant ID
**Solution**: Check if the frontend is using the new API endpoint

### Issue: API returns 404
**Solution**: Verify the phone number exists in Firebase tenants collection

### Issue: QR code not updating
**Solution**: Check if the tenant ID is correct and the bot is running for that tenant

---

**Remember**: Each user should now see their own tenant ID and QR code, preventing data mixing between users!

