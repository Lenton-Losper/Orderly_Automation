# Vendor Signup & Tenant Creation Implementation

## Overview
This implementation provides a complete vendor signup flow with automatic tenant creation, WhatsApp bot QR code generation, and secure Firestore rules for tenant isolation.

## ✅ Features Implemented

### 1. Vendor Signup → Tenant Creation
- **POST /auth/signup** endpoint for vendor registration
- Firebase Auth user creation
- Automatic tenant ID generation
- Tenant document creation in Firestore
- User added to tenant with admin role

### 2. Generate Bot QR on Tenant Creation
- Automatic WhatsApp bot QR code generation using Baileys
- QR code saved to Firestore under `/tenants/{tenantId}/botSession`
- Base64 encoded QR code returned in signup response
- Bot session management per tenant

### 3. Secure Firestore with Tenant Rules
- Comprehensive security rules for tenant isolation
- Users can only access data within their tenant
- Role-based permissions (admin, manager, staff, viewer)
- Complete data isolation between vendors

## 🚀 Getting Started

### Prerequisites
```bash
npm install express cors helmet qrcode
```

### 1. Start the API Server
The API server is automatically started when you run the main bot:
```bash
npm start
```

Or start just the API server:
```bash
node src/server.js
```

### 2. Deploy Firestore Rules
```bash
node deploy-rules.js
```

### 3. Test the Signup Flow
```bash
# Install axios for testing
npm install axios

# Run the test
node test-signup.js
```

## 📋 API Endpoints

### POST /auth/signup
Creates a new vendor account and tenant.

**Request:**
```json
{
  "email": "vendor@example.com",
  "password": "securepassword123",
  "businessName": "My Business"
}
```

**Response:**
```json
{
  "success": true,
  "tenantId": "tenant_1234567890_abcdef",
  "uid": "firebase_user_id",
  "qrCodeUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "message": "Vendor account created successfully. Scan the QR code to connect WhatsApp bot."
}
```

### GET /tenant/:tenantId
Get tenant information.

**Response:**
```json
{
  "success": true,
  "tenantId": "tenant_1234567890_abcdef",
  "businessName": "My Business",
  "ownerId": "firebase_user_id",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "botStatus": "pending",
  "qrCodeUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "lastUpdated": "2024-01-01T00:00:00.000Z"
}
```

### GET /tenant/:tenantId/qr
Get WhatsApp bot QR code for tenant.

**Response:**
```json
{
  "success": true,
  "tenantId": "tenant_1234567890_abcdef",
  "qrCodeUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "status": "pending",
  "lastUpdated": "2024-01-01T00:00:00.000Z"
}
```

### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "initialized": true
}
```

## 🔒 Security Rules

The Firestore security rules ensure complete tenant isolation:

### Key Features:
- **Tenant-based access control**: Users can only access data within their tenant
- **Role-based permissions**: Different access levels (admin, manager, staff, viewer)
- **Authentication required**: All operations require Firebase Auth
- **Data isolation**: Vendor A cannot see Vendor B's data

### Collections Protected:
- `/tenants/{tenantId}` - Tenant documents
- `/vendors/{vendorId}` - Vendor documents
- `/orders/{orderId}` - Order documents
- `/customers/{customerId}` - Customer documents
- `/products/{productId}` - Product documents
- `/invoices/{invoiceId}` - Invoice documents

## 🏗️ Architecture

### Data Structure
```
/tenants/{tenantId}/
├── ownerId: string
├── businessName: string
├── createdAt: timestamp
├── status: string
├── settings: object
├── /members/{uid}/
│   ├── role: string
│   ├── permissions: array
│   └── addedAt: timestamp
└── /botSession/main/
    ├── qrCode: string
    ├── qrCodeUrl: string
    ├── status: string
    └── lastUpdated: timestamp
```

### Bot Session Management
- Each tenant gets its own WhatsApp bot session
- QR codes are generated using Baileys
- Sessions are stored in tenant-specific auth folders
- Bot status is tracked in Firestore

## 🧪 Testing

### Manual Testing
1. Start the API server: `node src/server.js`
2. Test signup: `curl -X POST http://localhost:3001/auth/signup -H "Content-Type: application/json" -d '{"email":"test@example.com","password":"test123","businessName":"Test Business"}'`
3. Check tenant info: `curl http://localhost:3001/tenant/{tenantId}`
4. Get QR code: `curl http://localhost:3001/tenant/{tenantId}/qr`

### Automated Testing
```bash
node test-signup.js
```

## 🔧 Configuration

### Environment Variables
```bash
API_PORT=3001                    # API server port
NODE_ENV=development            # Environment mode
TENANT_ID=default              # Default tenant ID
```

### Firebase Configuration
- Ensure Firebase Admin SDK is properly configured
- Service account key should be in `lllfarming-firebase-adminsdk-fbsvc-c9ce466038.json`
- Firestore rules deployed via `deploy-rules.js`

## 🚨 Error Handling

### Common Errors:
- **400 Bad Request**: Missing required fields or invalid input
- **409 Conflict**: Email already exists
- **500 Internal Server Error**: Server-side errors

### Error Response Format:
```json
{
  "success": false,
  "error": "Error message",
  "details": "Additional details (development only)"
}
```

## 📈 Monitoring

### Health Check
Monitor the API server health:
```bash
curl http://localhost:3001/health
```

### Logs
The API server logs all operations:
- Signup attempts
- QR code generation
- Bot session management
- Error conditions

## 🔄 Next Steps

1. **Frontend Integration**: Create a web interface for vendor signup
2. **Email Verification**: Add email verification for new accounts
3. **Bot Management**: Add endpoints to manage bot sessions
4. **Analytics**: Track signup metrics and bot usage
5. **Multi-language**: Support multiple languages for QR codes

## 🛠️ Troubleshooting

### Common Issues:

1. **QR Code not generating**:
   - Check if Baileys dependencies are installed
   - Verify auth folder permissions
   - Check Firebase connection

2. **Firestore rules not working**:
   - Deploy rules: `node deploy-rules.js`
   - Check Firebase project configuration
   - Verify user authentication

3. **API server not starting**:
   - Check port availability
   - Verify Firebase configuration
   - Check dependencies installation

### Debug Mode:
Set `NODE_ENV=development` for detailed error messages.

## 📚 Dependencies

- **express**: Web framework
- **cors**: Cross-origin resource sharing
- **helmet**: Security headers
- **qrcode**: QR code generation
- **@whiskeysockets/baileys**: WhatsApp Web API
- **firebase-admin**: Firebase Admin SDK
- **axios**: HTTP client (for testing)
