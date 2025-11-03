const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');

class EmailService {
    constructor() {
        this.transporter = null;
        this.isInitialized = false;
    }

    async initialize() {
        try {
            // Check if email configuration exists
            const hasEmailConfig = 
                process.env.SMTP_HOST &&
                process.env.SMTP_PORT &&
                process.env.SMTP_USER &&
                process.env.SMTP_PASS;

            if (!hasEmailConfig) {
                console.log('📧 Email service: No SMTP configuration found. Email notifications disabled.');
                console.log('📧 To enable emails, set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in .env');
                return false;
            }

            // Create transporter
            this.transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: parseInt(process.env.SMTP_PORT) || 587,
                secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
                },
                // Gmail/Outlook specific options
                ...(process.env.SMTP_HOST.includes('gmail.com') && {
                    service: 'gmail'
                })
            });

            // Verify connection
            await this.transporter.verify();
            this.isInitialized = true;
            console.log('✅ Email service initialized successfully');
            return true;
        } catch (error) {
            console.error('❌ Email service initialization failed:', error.message);
            console.log('📧 Email notifications will be disabled');
            this.isInitialized = false;
            return false;
        }
    }

    /**
     * Send invoice email to business owner when invoice is sent to customer
     * @param {Object} options
     * @param {string} options.businessEmail - Business owner email
     * @param {string} options.orderId - Order/invoice ID
     * @param {string} options.customerName - Customer name/phone
     * @param {number} options.total - Order total
     * @param {string} options.pdfPath - Path to PDF invoice file
     * @param {string} options.businessName - Business name
     * @param {Array} options.items - Order items array
     */
    async sendInvoiceEmail({
        businessEmail,
        orderId,
        customerName,
        total,
        pdfPath,
        businessName = 'Your Business',
        items = []
    }) {
        try {
            if (!this.isInitialized || !this.transporter) {
                console.log('📧 Email service not initialized. Skipping email notification.');
                return { success: false, error: 'Email service not initialized' };
            }

            if (!businessEmail) {
                console.log('⚠️ No business email provided. Skipping invoice email.');
                return { success: false, error: 'No business email provided' };
            }

            console.log(`📧 Sending invoice email to business owner: ${businessEmail}`);

            // Prepare email content
            const emailSubject = `📄 New Order Invoice - ${orderId}`;
            
            const emailHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
        .order-info { background: white; padding: 15px; margin: 15px 0; border-radius: 5px; }
        .order-item { padding: 10px; border-bottom: 1px solid #eee; }
        .order-item:last-child { border-bottom: none; }
        .total { font-size: 18px; font-weight: bold; color: #4CAF50; margin-top: 15px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📦 New Order Received</h1>
        </div>
        <div class="content">
            <p>Hello ${businessName},</p>
            <p>A new order has been placed and an invoice has been sent to the customer.</p>
            
            <div class="order-info">
                <h3>Order Details</h3>
                <p><strong>Order ID:</strong> ${orderId}</p>
                <p><strong>Customer:</strong> ${customerName}</p>
                <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
            </div>

            ${items.length > 0 ? `
            <div class="order-info">
                <h3>Order Items</h3>
                ${items.map(item => `
                    <div class="order-item">
                        <strong>${item.name}</strong> × ${item.quantity}<br>
                        N$${(item.price * item.quantity).toFixed(2)}
                    </div>
                `).join('')}
                <div class="total">Total: N$${total.toFixed(2)}</div>
            </div>
            ` : `
            <div class="order-info">
                <p class="total">Order Total: N$${total.toFixed(2)}</p>
            </div>
            `}

            <p>The invoice PDF is attached to this email for your records.</p>
            
            <p>You can view and manage orders in your dashboard.</p>
        </div>
        <div class="footer">
            <p>This is an automated notification from ${businessName}</p>
            <p>LLL Farming Automation System</p>
        </div>
    </div>
</body>
</html>
            `;

            // Check if PDF file exists
            let attachments = [];
            if (pdfPath) {
                try {
                    await fs.access(pdfPath);
                    attachments.push({
                        filename: path.basename(pdfPath),
                        path: pdfPath,
                        contentType: 'application/pdf'
                    });
                } catch (err) {
                    console.log(`⚠️ PDF file not found: ${pdfPath}. Sending email without attachment.`);
                }
            }

            // Send email
            const mailOptions = {
                from: `"${businessName}" <${process.env.SMTP_USER}>`,
                to: businessEmail,
                subject: emailSubject,
                html: emailHtml,
                attachments
            };

            const info = await this.transporter.sendMail(mailOptions);
            console.log(`✅ Invoice email sent successfully to ${businessEmail}`);
            console.log(`📧 Message ID: ${info.messageId}`);
            console.log(`📧 Email Details:`, {
                orderId,
                recipient: businessEmail,
                subject: emailSubject,
                hasAttachment: attachments.length > 0,
                timestamp: new Date().toISOString()
            });

            return {
                success: true,
                messageId: info.messageId,
                recipient: businessEmail,
                orderId,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ Error sending invoice email:', error.message);
            console.error('❌ Email Error Details:', {
                orderId,
                recipient: businessEmail,
                error: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
            return {
                success: false,
                error: error.message,
                orderId,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Get business email from Firebase (tenant or vendor profile)
     */
    async getBusinessEmail(businessId, tenantId = null) {
        try {
            const admin = require('firebase-admin');
            const db = admin.firestore();

            // Try tenant email first
            if (tenantId) {
                try {
                    const tenantDoc = await db.collection('tenants').doc(tenantId).get();
                    if (tenantDoc.exists) {
                        const tenantData = tenantDoc.data();
                        if (tenantData.email) {
                            console.log(`📧 Found business email from tenant: ${tenantData.email}`);
                            return tenantData.email;
                        }
                    }
                } catch (error) {
                    console.log(`⚠️ Could not get email from tenant ${tenantId}:`, error.message);
                }
            }

            // Fallback to vendor profile
            if (businessId && businessId !== 'default') {
                try {
                    const vendorDoc = await db.collection('vendors').doc(businessId).get();
                    if (vendorDoc.exists) {
                        const vendorData = vendorDoc.data();
                        const email = vendorData.email || vendorData.businessEmail;
                        if (email) {
                            console.log(`📧 Found business email from vendor profile: ${email}`);
                            return email;
                        }
                    }
                } catch (error) {
                    console.log(`⚠️ Could not get email from vendor ${businessId}:`, error.message);
                }
            }

            console.log('⚠️ No business email found in Firebase');
            return null;
        } catch (error) {
            console.error('❌ Error getting business email:', error.message);
            return null;
        }
    }

    /**
     * Test email service
     */
    async sendTestEmail(toEmail) {
        try {
            if (!this.isInitialized) {
                return { success: false, error: 'Email service not initialized' };
            }

            const mailOptions = {
                from: `"LLL Farm Bot" <${process.env.SMTP_USER}>`,
                to: toEmail,
                subject: '📧 Email Service Test',
                html: `
                    <h2>Email Service Test</h2>
                    <p>If you're reading this, the email service is working correctly!</p>
                    <p>Timestamp: ${new Date().toISOString()}</p>
                `
            };

            const info = await this.transporter.sendMail(mailOptions);
            console.log(`✅ Test email sent to ${toEmail}`);
            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error('❌ Error sending test email:', error.message);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new EmailService();


