# Email Service Setup Guide

## 📧 Email Notifications for Invoice Orders

When a customer receives an invoice via WhatsApp, the business owner automatically receives an email copy.

## Configuration

Add these environment variables to your `.env` file:

```env
# SMTP Email Configuration
SMTP_HOST=smtp.gmail.com          # Your SMTP server (Gmail, Outlook, etc.)
SMTP_PORT=587                     # SMTP port (587 for TLS, 465 for SSL)
SMTP_USER=your-email@gmail.com    # Your email address
SMTP_PASS=your-app-password       # Your email password or app password
```

## Gmail Setup

1. **Enable 2-Step Verification** on your Google account
2. **Generate App Password**:
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" and "Other (Custom name)"
   - Enter "LLL Farm Bot"
   - Copy the 16-character password
3. **Use App Password** in `SMTP_PASS` (not your regular password)

## Outlook/Office 365 Setup

```env
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=your-email@outlook.com
SMTP_PASS=your-password
```

## Other Email Providers

**SendGrid:**
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
```

**Mailgun:**
```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=your-mailgun-username
SMTP_PASS=your-mailgun-password
```

## How It Works

1. Customer confirms order via WhatsApp bot
2. Bot generates PDF invoice
3. Bot sends invoice to customer via WhatsApp
4. **Automatically** sends email to business owner with:
   - Order summary
   - Customer information
   - Invoice PDF attachment

## Business Email Source

The bot looks for business email in this order:
1. `tenants/{tenantId}.email` (from signup)
2. `vendors/{businessId}` profile email
3. If no email found → Email notification skipped (logged as warning)

## Testing

Test email service:

```javascript
const emailService = require('./src/services/emailService');
await emailService.initialize();

const result = await emailService.sendTestEmail('your-email@example.com');
console.log(result);
```

## Troubleshooting

**Email not sending?**
- Check SMTP credentials are correct
- Verify SMTP port (587 for TLS, 465 for SSL)
- Check firewall isn't blocking SMTP port
- Review server logs: `pm2 logs | grep -i email`

**"Email service not initialized"?**
- Check `.env` file has all SMTP variables
- Restart bot: `pm2 restart all`
- Check logs for initialization errors

**Gmail "Less secure app" error?**
- Use App Password instead of regular password
- Enable 2-Step Verification first

## Optional Feature

If email service is not configured, the bot continues working normally - only email notifications are disabled. WhatsApp invoices still work.


