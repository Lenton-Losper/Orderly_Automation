# Frontend QR Code Integration Prompt

## Context
You are working on a React frontend dashboard for a WhatsApp order automation bot. The backend has been updated to store QR codes in Firestore and provide an API endpoint for retrieval. You need to implement QR code polling and display functionality.

## Backend API Details
- **Endpoint**: `GET /tenant/:tenantId/qr`
- **Base URL**: `http://localhost:3000` (or your backend URL)
- **Response Format**:
```json
{
  "success": true,
  "tenantId": "tenant_1757335152310_46uy6tztf",
  "qrCode": "2@ZcqznwUU8j8yREDLrVNLw45Ze6DCvLU7ONqMVBQI110AMG13JnIZdbJPO1C02J1EEYXqoRE8EuOPo3eNaWFteZw0qB7iksvkbcA=",
  "qrCodeUrl": "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=2%40ZcqznwUU8j8yREDLrVNLw45Ze6DCvLU7ONqMVBQI110AMG13JnIZdbJPO1C02J1EEYXqoRE8EuOPo3eNaWFteZw0qB7iksvkbcA%3D%2CesGyVLM%2FcHEBSBVSnp5VSt%2FQxk2i0t0SgfaLhPynj2s%3D%2C5zOYZBuLO0GWA0MCja1RoRE8EuOPo3eNaWFteZw0qB7iksvkbcA%3D%2CesGyVLM%2FcHEBSBVSnp5VSt%2FQxk2i0t0SgfaLhPynj2s%3D%2C5zOYZBuLO0GWA0MCja1mo6Uf5yZ0QkzZBg%2FQF1gdwk4%3D%2CcREWSp77DiQK7ZqLmd1HsQ6M3YUVc5gMTQkQQfh3MCw%3D",
  "status": "pending",
  "lastUpdated": "2025-09-08T16:49:20.529Z",
  "timestamp": 1757350160419
}
```

## Requirements

### 1. QR Code Polling Component
Create a React component that:
- Polls the API endpoint every 5 seconds when active
- Handles loading states
- Displays error messages if API fails
- Stops polling when component unmounts
- Shows connection status (pending, connected, disconnected)

### 2. QR Code Display
- Display the QR code image using the `qrCodeUrl` from the API response
- Show a loading spinner while fetching
- Display "No QR code available" when `qrCode` is null/undefined
- Show connection status with appropriate styling

### 3. Integration Points
- The component should accept `tenantId` as a prop
- Integrate with your existing authentication system to get the current tenant
- Add to your dashboard where QR code scanning is needed

### 4. Error Handling
- Handle network errors gracefully
- Show retry mechanism for failed requests
- Display user-friendly error messages

## Example Implementation Structure

```jsx
// QRCodeDisplay.jsx
import React, { useState, useEffect } from 'react';

const QRCodeDisplay = ({ tenantId, onStatusChange }) => {
  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!tenantId) return;

    const pollQRCode = async () => {
      try {
        const response = await fetch(`http://localhost:3000/tenant/${tenantId}/qr`);
        const data = await response.json();
        
        if (data.success) {
          setQrData(data);
          setError(null);
          onStatusChange?.(data.status);
        } else {
          setError('Failed to load QR code');
        }
      } catch (err) {
        setError('Network error');
      } finally {
        setLoading(false);
      }
    };

    // Initial fetch
    pollQRCode();

    // Poll every 5 seconds
    const interval = setInterval(pollQRCode, 5000);

    return () => clearInterval(interval);
  }, [tenantId, onStatusChange]);

  if (loading) return <div>Loading QR code...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!qrData?.qrCodeUrl) return <div>No QR code available</div>;

  return (
    <div className="qr-code-container">
      <img 
        src={qrData.qrCodeUrl} 
        alt="WhatsApp QR Code" 
        className="qr-code-image"
      />
      <div className={`status status-${qrData.status}`}>
        Status: {qrData.status}
      </div>
      <div className="last-updated">
        Last updated: {new Date(qrData.lastUpdated).toLocaleString()}
      </div>
    </div>
  );
};

export default QRCodeDisplay;
```

## CSS Styling Suggestions

```css
.qr-code-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: white;
}

.qr-code-image {
  max-width: 300px;
  height: auto;
  margin-bottom: 10px;
}

.status {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
}

.status-pending {
  background-color: #fff3cd;
  color: #856404;
}

.status-connected {
  background-color: #d4edda;
  color: #155724;
}

.status-disconnected {
  background-color: #f8d7da;
  color: #721c24;
}

.last-updated {
  font-size: 11px;
  color: #666;
  margin-top: 5px;
}
```

## Integration Steps

1. **Add the component to your dashboard** where QR code scanning is needed
2. **Pass the tenantId** from your authentication context or props
3. **Handle status changes** to update UI state (e.g., hide QR code when connected)
4. **Test the polling** by checking browser network tab for API calls every 5 seconds
5. **Verify QR code display** by scanning with WhatsApp

## Testing Checklist

- [ ] Component polls API every 5 seconds
- [ ] QR code image displays correctly
- [ ] Loading states work properly
- [ ] Error handling shows appropriate messages
- [ ] Status updates reflect connection state
- [ ] Polling stops when component unmounts
- [ ] Works with different tenant IDs

## Notes

- The QR code is generated by the backend and stored in Firestore
- The `qrCodeUrl` points to an external QR code generator service
- The `status` field indicates: "pending" (waiting for scan), "connected" (scanned successfully), "disconnected" (connection lost)
- The component should be responsive and work on mobile devices
- Consider adding a manual refresh button for better UX

