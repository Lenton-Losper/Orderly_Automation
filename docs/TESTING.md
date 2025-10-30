# WhatsApp Bot Testing Guide

## Overview

This guide provides comprehensive instructions for testing the WhatsApp bot system from a clean state, ensuring all features work correctly for new users.

## Prerequisites

Before starting any tests, ensure you have:
1. ✅ Firebase data cleared (products, orders)
2. ✅ WhatsApp bot disconnected from phone
3. ✅ All services running (Backend API, Bot Training API, WhatsApp Bot)
4. ✅ Clean development environment

## Quick Reset & Test Procedure

### Step 1: Reset WhatsApp Session

```bash
npm run reset:whatsapp
```

This will:
- Delete all WhatsApp session/authentication files
- Clear cached data and temporary files
- Remove old invoice PDFs
- Clear QR code images
- Prepare system for fresh connection

### Step 2: Start WhatsApp Bot

```bash
npm run start
```

Expected output:
```
🤖 WhatsApp Bot Starting...
❌ No session found. Generating QR code...
📱 Scan the QR code below with your WhatsApp:

[QR CODE APPEARS]
```

### Step 3: Connect WhatsApp

1. **Wait for QR code** to appear in terminal
2. **Open WhatsApp** on your phone
3. **Go to**: Settings → Linked Devices
4. **Tap**: "Link a Device"
5. **Scan** the QR code
6. **Wait for**: "WhatsApp connected!" message

### Step 4: Verify Connection

Send a test message:
```
User: "hi"
Expected Bot Response: "Hello! 👋 Welcome to [Business Name]. How can I help you today?"
```

## Comprehensive Test Flow

### Phase 1: Basic Functionality

**Test 1: Greeting**
```
User: "hi"
Expected: Dynamic business name greeting
```

**Test 2: Product Inquiry**
```
User: "what do you sell?"
Expected: Product list with prices and categories
```

**Test 3: Goodbye**
```
User: "bye"
Expected: Dynamic business name goodbye
```

### Phase 2: Product Management

**Test 4: Add Products via Dashboard**
1. Open frontend dashboard
2. Add 3-5 test products with:
   - Names, prices, categories
   - Set availability to "Available"
3. Verify products appear in WhatsApp bot

**Test 5: Product Display**
```
User: "products"
Expected: Formatted product list with:
- Product names
- Prices (N$ format)
- Categories
- Availability status
```

### Phase 3: Order Flow

**Test 6: Start Order Process**
```
User: "what do you sell?"
Bot: Shows products + "Reply with *YES* to order, *NO* if you're just browsing"
User: "yes"
Expected: "Great! What would you like to order? Please type the exact product name."
```

**Test 7: Product Selection**
```
User: "[exact product name]"
Expected: "Perfect! How many [product name] would you like?"
```

**Test 8: Quantity Input**
```
User: "2"
Expected: "Added 2 [product name] to your cart. Total: N$[price]"
```

**Test 9: Multi-Item Cart**
```
Bot: "Would you like to add more items? Reply *YES* to continue shopping or *NO* to checkout."
User: "yes"
Expected: "What else would you like to order?"
```

**Test 10: Final Order Confirmation**
```
User: "no" (after adding items)
Expected: Order summary + "Is this correct? Reply *YES* to confirm or *NO* to cancel."
```

**Test 11: Order Processing**
```
User: "yes"
Expected: 
- Order confirmation message
- PDF invoice sent via WhatsApp
- Order saved to Firebase
```

### Phase 4: Advanced Features

**Test 12: Cart Management**
```
User: "cart"
Expected: Current cart summary with items and total
```

**Test 13: Clear Cart**
```
User: "clear cart"
Expected: "Your cart has been cleared! Type *PRODUCTS* to start fresh."
```

**Test 14: Error Handling**
```
User: "invalid product name"
Expected: "I couldn't find that product. Please check the spelling and try again."
```

**Test 15: Invalid Quantity**
```
User: "abc" (when asked for quantity)
Expected: "Please enter a valid number for the quantity."
```

## Troubleshooting

### Common Issues

**QR Code not appearing:**
- Ensure all session files were deleted
- Restart the bot completely
- Check console for error messages

**"Already connected" error:**
- Go to WhatsApp → Settings → Linked Devices
- Remove any existing bot connections
- Restart reset process

**Bot not responding:**
- Check bot is running (see terminal output)
- Verify WhatsApp connection (check linked devices)
- Check backend API is running (port 3000)
- Check bot training API is running (port 3001)

**Products not showing:**
- Verify products are added via dashboard
- Check Firebase connection
- Ensure products have `isAvailable: true`

**PDF invoice not sent:**
- Check `pdfkit` is installed
- Verify `whatsappService.sendDocument` method exists
- Check file permissions for invoice generation

### Debug Commands

**Check running processes:**
```bash
# Windows
netstat -ano | findstr :3000
netstat -ano | findstr :3001
netstat -ano | findstr :3003

# Check Node.js processes
Get-Process | Where-Object {$_.ProcessName -eq "node"}
```

**Check Firebase connection:**
```bash
node -e "const admin = require('firebase-admin'); console.log('Firebase admin loaded');"
```

**Test Python classification:**
```bash
python classify.py "hi" tenant_1757833139935_2h9n7r7ed
```

## Expected Results

### Successful Test Run Should Show:

1. **Clean Session Reset:**
```
🧹 Starting WhatsApp Session Reset...
📁 Checking for session folders...
   Found: ./auth/session-lll-farming-bot
   ✅ Deleted: ./auth/session-lll-farming-bot
✅ Session reset complete! Deleted 1 items.
```

2. **Fresh Bot Connection:**
```
🤖 WhatsApp Bot Starting...
❌ No session found. Generating QR code...
📱 Scan the QR code below with your WhatsApp:
[QR CODE]
✅ WhatsApp connected successfully!
```

3. **Dynamic Business Name:**
```
User: "hi"
Bot: "Hello! 👋 Welcome to Business 264813141453. How can I help you today?"
```

4. **Complete Order Flow:**
```
User: "products" → Bot shows products
User: "yes" → Bot asks for product selection
User: "[product]" → Bot asks for quantity
User: "2" → Bot adds to cart
User: "no" → Bot shows order summary
User: "yes" → Bot confirms order + sends PDF
```

5. **PDF Invoice Delivery:**
```
📄 Your invoice has been sent above!
🎉 Order Confirmed!
Order ID: ORD-[timestamp]-[random]
Total: N$[amount]
```

## Performance Expectations

- **Response Time**: < 2 seconds for simple messages
- **Product Loading**: < 3 seconds for product lists
- **PDF Generation**: < 5 seconds for invoice creation
- **Order Processing**: < 10 seconds end-to-end

## Security Notes

- Session reset only works in development environment
- Never run reset script in production
- Always backup important data before reset
- Test with non-production WhatsApp accounts

## Next Steps After Testing

1. **Document any issues** found during testing
2. **Update business data** in Firebase if needed
3. **Configure production settings** for deployment
4. **Set up monitoring** for production environment
5. **Train team** on bot management and troubleshooting







