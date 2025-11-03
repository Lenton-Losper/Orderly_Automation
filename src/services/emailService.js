const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');

// Singleton instance
let emailServiceInstance = null;

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
     * Send invoice notification email to business owner when order is placed
     * This is called after invoice PDF is sent to customer via WhatsApp
     * 
     * @param {Object} options
     * @param {string} options.tenantId - Tenant ID (for getting business email if not provided)
     * @param {string} options.businessPhone - Business phone number
     * @param {string} options.businessEmail - Business owner email (optional, will fetch if not provided)
     * @param {string} options.orderId - Order ID
     * @param {string} options.customerPhone - Customer phone number
     * @param {number} options.total - Order total
     * @param {string} options.pdfPath - Path to PDF invoice file
     * @param {string} options.businessName - Business name
     * @param {Array} options.items - Order items array with name, quantity, price, subtotal
     * @param {string} options.deliveryMethod - 'delivery' or 'pickup'
     * @param {string} options.deliveryAddress - Delivery address (if delivery method)
     * @param {string} options.paymentMethod - Payment method (default: 'Cash on delivery')
     * @returns {Promise<Object>} { success: boolean, messageId?: string, recipient?: string, error?: string }
     */
    async sendInvoiceNotification({
        tenantId = null,
        businessPhone = null,
        businessEmail = null,
        orderId,
        customerPhone,
        total,
        pdfPath,
        businessName = 'Your Business',
        items = [],
        deliveryMethod = 'pickup',
        deliveryAddress = '',
        paymentMethod = 'Cash on delivery'
    }) {
        // If businessEmail not provided, fetch it
        if (!businessEmail && (tenantId || businessPhone)) {
            businessEmail = await this.getBusinessEmail(businessPhone || '264813141453', tenantId);
        }
        
        return await this.sendInvoiceEmail({
            businessEmail,
            orderId,
            customerName: customerPhone,
            total,
            pdfPath,
            businessName,
            items,
            deliveryMethod,
            deliveryAddress,
            paymentMethod
        });
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
     * @param {string} options.deliveryMethod - Delivery method
     * @param {string} options.deliveryAddress - Delivery address
     * @param {string} options.paymentMethod - Payment method
     */
    async sendInvoiceEmail({
        businessEmail,
        orderId,
        customerName,
        total,
        pdfPath,
        businessName = 'Your Business',
        items = [],
        deliveryMethod = 'pickup',
        deliveryAddress = '',
        paymentMethod = 'Cash on delivery'
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
            const emailSubject = `🔔 New Order #${orderId} - N$${total.toFixed(2)}`;
            const fromName = process.env.SMTP_FROM_NAME || 'LLL Farming Automation';
            const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;
            
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
                <p><strong>Order #:</strong> ${orderId}</p>
                <p><strong>Customer:</strong> ${customerName}</p>
                <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
                <p><strong>Payment Method:</strong> ${paymentMethod}</p>
            </div>

            ${items.length > 0 ? `
            <div class="order-info">
                <h3>Order Items</h3>
                ${items.map(item => {
                    const itemTotal = (item.subtotal || (item.price || 0) * (item.quantity || 1));
                    const unit = item.unit || '';
                    return `
                    <div class="order-item">
                        <strong>${item.name}</strong> × ${item.quantity}${unit ? ` ${unit}` : ''}<br>
                        <span style="color: #666;">N$${(item.price || 0).toFixed(2)} each</span> → N$${itemTotal.toFixed(2)}
                    </div>
                `;
                }).join('')}
                <div class="total" style="margin-top: 15px; padding-top: 15px; border-top: 2px solid #4CAF50;">
                    <strong>Total: N$${total.toFixed(2)}</strong>
                </div>
            </div>
            ` : `
            <div class="order-info">
                <p class="total">Order Total: N$${total.toFixed(2)}</p>
            </div>
            `}

            <div class="order-info">
                <h3>Delivery Information</h3>
                <p><strong>Method:</strong> ${deliveryMethod.toUpperCase()}</p>
                ${deliveryMethod === 'delivery' && deliveryAddress ? `
                <p><strong>Delivery Address:</strong><br>${deliveryAddress}</p>
                ` : `
                <p>Customer will collect from store.</p>
                `}
            </div>

            <p style="margin-top: 20px;">📄 The invoice PDF is attached to this email for your records.</p>
            
            <p>You can view and manage this order in your dashboard.</p>
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
                from: `"${fromName}" <${fromEmail}>`,
                to: businessEmail,
                replyTo: fromEmail,
                subject: emailSubject,
                html: emailHtml,
                text: this.generatePlainTextEmail(orderId, customerName, total, items, deliveryMethod, deliveryAddress, paymentMethod),
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
     * Generate plain text version of email
     */
    generatePlainTextEmail(orderId, customerName, total, items, deliveryMethod, deliveryAddress, paymentMethod) {
        let text = `New Order Received!\n\n`;
        text += `Order #: ${orderId}\n`;
        text += `Customer: ${customerName}\n`;
        text += `Total: N$${total.toFixed(2)}\n\n`;
        
        if (items.length > 0) {
            text += `Items:\n`;
            items.forEach(item => {
                const itemTotal = (item.subtotal || (item.price || 0) * (item.quantity || 1));
                const unit = item.unit || '';
                text += `- ${item.quantity}${unit ? ` ${unit}` : ''} ${item.name} - N$${itemTotal.toFixed(2)}\n`;
            });
            text += `\nTotal: N$${total.toFixed(2)}\n\n`;
        }
        
        text += `Delivery Method: ${deliveryMethod.toUpperCase()}\n`;
        if (deliveryMethod === 'delivery' && deliveryAddress) {
            text += `Address: ${deliveryAddress}\n`;
        }
        text += `Payment: ${paymentMethod}\n\n`;
        text += `View full details in your dashboard.\n`;
        
        return text;
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

// Export singleton instance
if (!emailServiceInstance) {
    emailServiceInstance = new EmailService();
}

module.exports = emailServiceInstance;


