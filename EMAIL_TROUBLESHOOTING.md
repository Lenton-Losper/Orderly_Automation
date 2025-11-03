# Email Troubleshooting Guide

## Quick Diagnostic

Run this on your server to test email configuration:

```bash
cd ~/Orderly_Automation
node test-email-service.js
```

This will check:
1. ✅ Environment variables are set
2. ✅ Email service initializes
3. ✅ SMTP connection works
4. ✅ Business email is found in Firebase
5. ✅ Test email can be sent

## Common Issues

### 1. Email Service Not Initialized

**Symptoms:**
- No email logs in PM2
- No "Email service initialized" message on startup

**Solution:**
```bash
# Check PM2 logs for email service initialization
pm2 logs --lines 100 | grep -i "email"

# Look for:
# - "📧 Email service: No SMTP configuration found"
# - "✅ Email service initialized successfully"
```

### 2. Missing Environment Variables

**Symptoms:**
- Log shows: "📧 Email service: No SMTP configuration found"

**Solution:**
Add these to your `.env` file on the server:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-business-email@gmail.com
SMTP_PASS=your-app-password
```

**For Gmail:**
1. Enable 2-Step Verification: https://myaccount.google.com/security
2. Generate App Password: https://myaccount.google.com/apppasswords
3. Use the 16-character app password (not your regular password)

**For Outlook/Office 365:**
```env
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=your-email@outlook.com
SMTP_PASS=your-password
```

### 3. SMTP Connection Failed

**Symptoms:**
- Log shows: "❌ Email service initialization failed: Invalid login"

**Solutions:**
- **Gmail:** Use App Password, not regular password
- **Outlook:** Check if account has "Less secure app access" enabled
- **Firewall:** Ensure port 587 (or 465) is not blocked
- **Wrong credentials:** Double-check SMTP_USER and SMTP_PASS

### 4. Business Email Not Found

**Symptoms:**
- Log shows: "⚠️ No business email found. Invoice email notification skipped."

**Solution:**
Check Firebase and ensure tenant has email:

```bash
# On server, check Firebase
# The email should be at: tenants/{tenantId}/email
```

Or update tenant document:
```javascript
// In Firebase Console or via script
db.collection('tenants').doc('tenant_1757833139935_2h9n7r7ed').update({
  email: 'your-business-email@gmail.com'
});
```

### 5. Email Sent But Not Received

**Check:**
1. ✅ Spam/Junk folder
2. ✅ Email filters/rules
3. ✅ Check PM2 logs for "✅ Invoice email sent successfully"
4. ✅ Verify recipient email in logs

### 6. Error After Invoice Sent

**Check logs:**
```bash
pm2 logs --lines 200 | grep -i "invoice email"
```

Look for:
- `❌ Error sending invoice email notification:`
- `✅ Invoice email sent successfully to...`

## Testing Email on Server

1. **Test email service:**
   ```bash
   cd ~/Orderly_Automation
   node test-email-service.js
   ```

2. **Check PM2 logs during order:**
   ```bash
   pm2 logs --lines 100 | grep -E "email|invoice|Email"
   ```

3. **Place a test order and watch logs:**
   ```bash
   pm2 logs --lines 0
   # Then place an order via WhatsApp
   # Watch for email-related logs
   ```

## Manual Email Test

If you want to test sending an email manually:

```javascript
// Create test-email-manual.js
require('dotenv').config();
const emailService = require('./src/services/emailService');

async function test() {
  await emailService.initialize();
  const result = await emailService.sendInvoiceEmail({
    businessEmail: 'your-email@gmail.com',
    orderId: 'TEST-123',
    customerName: 'Test Customer',
    total: 100,
    pdfPath: null,
    businessName: 'Test Business',
    items: [{ name: 'Test Product', quantity: 1, price: 100 }]
  });
  console.log(result);
}

test();
```

Run: `node test-email-manual.js`

## Still Not Working?

1. ✅ Verify `.env` file is loaded (check PM2 uses it)
2. ✅ Restart PM2 after adding env vars: `pm2 restart all`
3. ✅ Check server firewall allows SMTP (ports 587/465)
4. ✅ Verify email provider allows SMTP access
5. ✅ Check PM2 logs for any errors during invoice sending

