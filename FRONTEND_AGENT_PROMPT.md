# Frontend Agent Prompt - WhatsApp Tenant ID Fix

## 🎯 **CRITICAL ISSUE TO FIX**

The WhatsApp sync page is showing the **WRONG tenant ID** for users, causing QR codes to be shared between different users. This is a **security and data integrity issue**.

## 🚨 **Current Problem**

- **User with phone `264813141453`** should see tenant `tenant_1757833139935_2h9n7r7ed`
- **User with phone `264817375744`** should see tenant `tenant_1757795389583_tr1yiscf8`
- **But currently, everyone sees the same hardcoded tenant ID!**

## ✅ **Solution Required**

Replace the hardcoded tenant ID with dynamic lookup using a new API endpoint.

## 🔧 **Backend API Available**

### **New Endpoint**: `/api/user/by-phone/:phoneNumber`

**Purpose**: Get the correct tenant ID for a user based on their phone number

**Example Request**:
```javascript
const response = await fetch(`/api/user/by-phone/264813141453`);
const data = await response.json();
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

## 🎯 **Frontend Changes Needed**

### **1. Replace Hardcoded Tenant ID**

**❌ CURRENT CODE (WRONG)**:
```javascript
// This is hardcoded and causes the issue
const tenantId = 'tenant_1757795389583_tr1yiscf8';
const apiUrl = `/api/tenants/${tenantId}/botSession/current`;
```

**✅ NEW CODE (CORRECT)**:
```javascript
// Dynamic tenant lookup based on user's phone number
const [tenantId, setTenantId] = useState(null);
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

// Use the dynamic tenant ID
const apiUrl = tenantId ? `/api/tenants/${tenantId}/botSession/current` : null;
```

### **2. Complete React Component Example**

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

## 🔍 **Key Requirements**

### **1. Implement `getCurrentUserPhone()` Function**
You need to create a function that returns the current user's phone number. This could be:
- From your auth context
- From user profile data
- From localStorage/sessionStorage
- From a user API endpoint

### **2. Handle Loading States**
- Show loading spinner while fetching tenant ID
- Show error message if tenant lookup fails
- Only start QR code polling after tenant ID is obtained

### **3. Error Handling**
- Handle API failures gracefully
- Show user-friendly error messages
- Log errors for debugging

## 🧪 **Testing**

### **Test Cases**:
1. **User with phone `264813141453`** should get tenant `tenant_1757833139935_2h9n7r7ed`
2. **User with phone `264817375744`** should get tenant `tenant_1757795389583_tr1yiscf8`
3. **User with unknown phone** should show error message

### **Test Commands**:
```bash
# Test API endpoints
curl "http://localhost:3000/api/user/by-phone/264813141453"
curl "http://localhost:3000/api/user/by-phone/264817375744"
```

## 🎯 **Expected Results**

After implementing this fix:
- ✅ **Each user sees their own tenant ID**
- ✅ **Each user gets their own QR code**
- ✅ **No more data mixing between users**
- ✅ **Proper user isolation**

## 🚨 **Critical Notes**

1. **This is a security issue** - users are currently sharing QR codes
2. **Data integrity** - messages could be going to wrong users
3. **Must be fixed immediately** - affects all users
4. **Test thoroughly** - ensure each user gets their own tenant

## 📋 **Implementation Checklist**

- [ ] Replace hardcoded tenant ID with dynamic lookup
- [ ] Implement `getCurrentUserPhone()` function
- [ ] Add loading states for tenant lookup
- [ ] Add error handling for API failures
- [ ] Test with different user phone numbers
- [ ] Verify each user gets their own QR code
- [ ] Test error cases (unknown phone numbers)

## 🔧 **Files to Update**

- WhatsApp sync component/page
- Any components that use hardcoded tenant IDs
- Auth context (if needed for phone number access)

---

**PRIORITY: HIGH** - This is a critical security and data integrity issue that must be fixed immediately.

