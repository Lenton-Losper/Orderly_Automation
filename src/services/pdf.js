const puppeteer = require('puppeteer');

class PDFService {
    constructor() {
        this.browser = null;
    }

    async initialize() {
        try {
            this.browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            console.log('✅ PDF service initialized');
        } catch (error) {
            console.error('❌ PDF service initialization error:', error);
            throw error;
        }
    }

    async generateOrderPDF(orderData, customerInfo) {
        try {
            if (!this.browser) {
                await this.initialize();
            }

            const page = await this.browser.newPage();
            const htmlContent = this.generateOrderHTML(orderData, customerInfo);
            
            await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
            
            const pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: {
                    top: '1cm',
                    right: '1cm',
                    bottom: '1cm',
                    left: '1cm'
                }
            });
            
            await page.close();
            return pdfBuffer;
        } catch (error) {
            console.error('❌ PDF Generation Error:', error);
            throw error;
        }
    }

    generateOrderHTML(order, customerInfo) {
        const currentDate = new Date().toLocaleDateString();
        const orderNumber = `LLL-${Date.now()}`;
        
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 0;
                    padding: 20px;
                    color: #333;
                }
                .header {
                    text-align: center;
                    border-bottom: 2px solid #4CAF50;
                    padding-bottom: 20px;
                    margin-bottom: 30px;
                }
                .logo {
                    font-size: 28px;
                    font-weight: bold;
                    color: #4CAF50;
                    margin-bottom: 10px;
                }
                .order-info {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 30px;
                }
                .customer-details, .order-details {
                    width: 45%;
                }
                .section-title {
                    font-size: 18px;
                    font-weight: bold;
                    color: #4CAF50;
                    margin-bottom: 10px;
                    border-bottom: 1px solid #ddd;
                    padding-bottom: 5px;
                }
                .items-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 20px 0;
                }
                .items-table th, .items-table td {
                    border: 1px solid #ddd;
                    padding: 12px;
                    text-align: left;
                }
                .items-table th {
                    background-color: #f2f2f2;
                    font-weight: bold;
                }
                .total-section {
                    width: 100%;
                    margin-top: 20px;
                }
                .total-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 5px 0;
                }
                .total-final {
                    font-size: 18px;
                    font-weight: bold;
                    border-top: 2px solid #4CAF50;
                    padding-top: 10px;
                    margin-top: 10px;
                }
                .footer {
                    margin-top: 40px;
                    text-align: center;
                    font-size: 12px;
                    color: #666;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="logo">🥩 LLL FARM</div>
                <p>Premium Quality Meat Products</p>
                <p>WhatsApp: +264 81 234 5678 | Email: orders@lllfarm.com</p>
            </div>
            
            <div class="order-info">
                <div class="customer-details">
                    <div class="section-title">Customer Information</div>
                    <p><strong>Name:</strong> ${customerInfo.name}</p>
                    <p><strong>Email:</strong> ${customerInfo.email}</p>
                    <p><strong>Phone:</strong> ${customerInfo.phone}</p>
                    <p><strong>Address:</strong> ${customerInfo.address}</p>
                </div>
                
                <div class="order-details">
                    <div class="section-title">Order Details</div>
                    <p><strong>Order Number:</strong> ${orderNumber}</p>
                    <p><strong>Date:</strong> ${currentDate}</p>
                    <p><strong>Status:</strong> Confirmed</p>
                    <p><strong>Payment:</strong> Cash on Delivery</p>
                </div>
            </div>
            
            <div class="section-title">Order Items</div>
            <table class="items-table">
                <thead>
                    <tr>
                        <th>Item</th>
                        <th>Quantity</th>
                        <th>Unit Price</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${order.items.map(item => `
                        <tr>
                            <td>${item.name}</td>
                            <td>${item.quantity}</td>
                            <td>N$${item.price.toFixed(2)}</td>
                            <td>N$${(item.price * item.quantity).toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            
            <div class="total-section">
                <div class="total-row">
                    <span>Subtotal:</span>
                    <span>N$${order.subtotal.toFixed(2)}</span>
                </div>
                <div class="total-row">
                    <span>Delivery:</span>
                    <span>N$${order.delivery.toFixed(2)}</span>
                </div>
                <div class="total-row">
                    <span>Tax (10%):</span>
                    <span>N$${order.tax.toFixed(2)}</span>
                </div>
                ${order.discount > 0 ? `
                <div class="total-row">
                    <span>Discount:</span>
                    <span>-N$${order.discount.toFixed(2)}</span>
                </div>
                ` : ''}
                <div class="total-row total-final">
                    <span>TOTAL:</span>
                    <span>N$${order.total.toFixed(2)}</span>
                </div>
            </div>
            
            <div class="footer">
                <p>Thank you for choosing LLL Farm!</p>
                <p>For any queries, contact us via WhatsApp or email.</p>
                <p>This is an automated receipt generated on ${currentDate}</p>
            </div>
        </body>
        </html>
        `;
    }

    async generateAndSendPDF(orderData, customerInfo, whatsappService, userId) {
        try {
            console.log('📄 Generating PDF receipt...');
            
            const pdfBuffer = await this.generateOrderPDF(orderData, customerInfo);
            const filename = `LLL_Farm_Receipt_${Date.now()}.pdf`;
            
            const success = await whatsappService.sendDocument(
                userId,
                pdfBuffer,
                filename,
                'application/pdf',
                '📄 Your order receipt is ready!\n\nYou can print this for your records or save it on your device.'
            );
            
            if (success) {
                console.log('✅ PDF receipt sent successfully');
                return true;
            } else {
                throw new Error('Failed to send PDF');
            }
        } catch (error) {
            console.error('❌ Error generating/sending PDF:', error);
            
            // Send fallback message
            await whatsappService.sendTextMessage(
                userId,
                '⚠️ PDF generation failed, but your order is confirmed!\n\nWe\'ll send you a receipt via email shortly.'
            );
            
            return false;
        }
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            console.log('✅ PDF service closed');
        }
    }
}

module.exports = PDFService;