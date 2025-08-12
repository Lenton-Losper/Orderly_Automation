// File: src/services/pdfInvoiceGenerator.js
// Professional PDF Invoice Generator with Firebase Integration

const fs = require('fs');
const path = require('path');

// Try to load PDFKit, but provide fallback if not installed
let PDFDocument;
try {
    PDFDocument = require('pdfkit');
    console.log('✅ PDFKit loaded successfully');
} catch (error) {
    console.warn('⚠️ PDFKit not installed. Please run: npm install pdfkit');
    PDFDocument = null;
}

class ProfessionalPDFInvoiceGenerator {
    constructor() {
        this.invoicesDir = path.join(__dirname, '../../invoices');
        this.ensureInvoicesDirectory();
        
        // Clean, minimalist color scheme
        this.colors = {
            primary: '#2E7D32',        // Dark green for headers
            lightGray: '#F5F5F5',      // Very light gray background
            darkText: '#212121',       // Almost black text
            mediumText: '#424242',     // Medium gray text
            lightText: '#757575',      // Light gray text
            border: '#E0E0E0',         // Light border
            white: '#FFFFFF',
            tableBorder: '#BDBDBD'     // Table border color
        };
        
        // Layout constants
        this.margins = {
            top: 60,
            bottom: 60,
            left: 60,
            right: 60
        };
        
        this.pageWidth = 595.28; // A4 width in points
        this.pageHeight = 841.89; // A4 height in points
    }

    // Check if PDFKit is available
    isPDFKitAvailable() {
        return PDFDocument !== null;
    }

    // Ensure invoices directory exists
    ensureInvoicesDirectory() {
        if (!fs.existsSync(this.invoicesDir)) {
            fs.mkdirSync(this.invoicesDir, { recursive: true });
            console.log('📁 Created invoices directory:', this.invoicesDir);
        }
    }

    // Method to generate invoice for completed orders (MAIN METHOD)
    async generateInvoiceForOrder(session, businessId) {
        try {
            if (!this.isPDFKitAvailable()) {
                return {
                    success: false,
                    error: 'PDFKit not installed. Please run: npm install pdfkit'
                };
            }

            console.log('🔍 Generating invoice for completed order...');
            console.log('🔍 Session cart items:', session.cart?.length || 0);
            console.log('🔍 Customer info:', session.customerInfo);
            
            // Create order data from session
            const orderData = {
                id: session.messageId || `ORDER_${Date.now()}`,
                items: session.cart || [],
                customerInfo: session.customerInfo || {
                    name: 'Valued Customer',
                    email: '',
                    phone: '',
                    address: ''
                },
                total: session.getTotal ? session.getTotal() : 0,
                subtotal: 0,
                tax: 0,
                shipping: 0,
                discountAmount: session.discountAmount || 0,
                discountCode: session.discountCode || '',
                createdAt: new Date().toISOString(),
                status: 'completed'
            };
            
            // Calculate proper totals from cart
            if (session.cart && session.cart.length > 0) {
                orderData.subtotal = session.cart.reduce((sum, item) => {
                    const price = this.parsePrice(item.price);
                    const quantity = parseInt(item.quantity) || 1;
                    return sum + (price * quantity);
                }, 0);
                
                orderData.tax = orderData.subtotal * 0.10;
                orderData.shipping = orderData.subtotal >= 50 ? 0 : 5;
                orderData.total = orderData.subtotal + orderData.tax + orderData.shipping - orderData.discountAmount;
            }
            
            console.log('🔍 Order data prepared:', {
                id: orderData.id,
                itemCount: orderData.items.length,
                total: orderData.total,
                subtotal: orderData.subtotal
            });
            
            // Get business data
            const businessData = this.getDefaultBusinessData();
            
            // Generate PDF
            return await this.generateInvoicePDF(orderData, businessData);
            
        } catch (error) {
            console.error('❌ Error generating invoice for order:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Method to test PDF generation
    async generateTestInvoice(businessId = 'test_business') {
        try {
            if (!this.isPDFKitAvailable()) {
                return {
                    success: false,
                    error: 'PDFKit not installed. Please run: npm install pdfkit'
                };
            }

            console.log('🔍 Generating test invoice...');
            
            const testOrderData = {
                id: `TEST_${Date.now()}`,
                items: [
                    { name: 'Premium Tomatoes', price: 25.99, quantity: 2 },
                    { name: 'Fresh Lettuce', price: 15.50, quantity: 1 },
                    { name: 'Farm Fresh Carrots', price: 12.00, quantity: 3 }
                ],
                customerInfo: {
                    name: 'John Doe',
                    email: 'john.doe@example.com',
                    phone: '+264 81 234 5678',
                    address: '123 Main Street, Windhoek, Namibia'
                },
                subtotal: 103.48,
                tax: 10.35,
                shipping: 0,
                total: 113.83,
                discountAmount: 0,
                createdAt: new Date().toISOString()
            };
            
            const businessData = this.getDefaultBusinessData();
            return await this.generateInvoicePDF(testOrderData, businessData);
            
        } catch (error) {
            console.error('❌ Error generating test invoice:', error);
            return { success: false, error: error.message };
        }
    }

    // Main PDF generation method
    async generateInvoicePDF(orderData, businessData) {
        try {
            if (!this.isPDFKitAvailable()) {
                return { success: false, error: 'PDFKit not installed' };
            }

            const validation = this.validateOrderData(orderData);
            if (!validation.isValid) {
                throw new Error(`Invalid order data: ${validation.errors.join(', ')}`);
            }
            
            const businessName = businessData.businessName.replace(/[^a-zA-Z0-9]/g, '_');
            const invoiceNumber = orderData.id || `${Math.floor(100000000 + Math.random() * 900000000)}`;
            const filename = `${businessName}_INV_${invoiceNumber}.pdf`;
            const filepath = path.join(this.invoicesDir, filename);

            const doc = new PDFDocument({ size: 'A4', margin: 50 });
            doc.pipe(fs.createWriteStream(filepath));

            this.generateInvoiceContent(doc, orderData, businessData, invoiceNumber);
            doc.end();

            console.log('✅ PDF Invoice generated:', filepath);

            return {
                success: true,
                filepath,
                filename,
                invoiceNumber,
                fileSize: this.getFileSize(filepath)
            };

        } catch (error) {
            console.error('❌ Error generating PDF:', error);
            return { success: false, error: error.message };
        }
    }

    // Generate invoice content
    generateInvoiceContent(doc, orderData, businessData, invoiceNumber) {
        let currentY = 50;

        // Header
        doc.fillColor('#2E7D32').fontSize(28).font('Helvetica-Bold')
           .text('INVOICE', 50, currentY);
        currentY += 60;

        // Invoice details (3 columns: N. INVOICE, DATE, AMOUNT DUE)
        const orderDate = new Date(orderData.createdAt || Date.now());
        const dateStr = orderDate.toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric'
        });

        doc.fillColor('#000000').fontSize(10).font('Helvetica-Bold')
           .text('N. INVOICE', 50, currentY)
           .text('DATE', 200, currentY)
           .text('AMOUNT DUE', 350, currentY);

        doc.fontSize(11).font('Helvetica')
           .text(invoiceNumber, 50, currentY + 18)
           .text(dateStr.toUpperCase(), 200, currentY + 18)
           .text(`N$${orderData.total.toFixed(2)}`, 350, currentY + 18);

        currentY += 80;

        // Business info (BILL FROM)
        doc.fontSize(12).font('Helvetica-Bold')
           .text('BILL FROM:', 50, currentY);
        currentY += 20;
        
        doc.fontSize(11).font('Helvetica-Bold')
           .text(businessData.businessName.toUpperCase(), 50, currentY);
        currentY += 20;
        
        doc.fontSize(10).font('Helvetica').fillColor('#424242')
           .text(businessData.businessAddress, 50, currentY)
           .text(businessData.businessPhone, 50, currentY + 15)
           .text(businessData.businessEmail, 50, currentY + 30);

        // Customer info (BILL TO)
        let customerY = currentY - 55;
        doc.fillColor('#000000').fontSize(12).font('Helvetica-Bold')
           .text('BILL TO:', 300, customerY);
        customerY += 20;

        const customerName = orderData.customerInfo?.name || 'VALUED CUSTOMER';
        doc.fontSize(11).font('Helvetica-Bold')
           .text(customerName.toUpperCase(), 300, customerY);
        customerY += 20;
        
        doc.fontSize(10).font('Helvetica').fillColor('#424242');
        if (orderData.customerInfo?.address) {
            doc.text(orderData.customerInfo.address, 300, customerY);
            customerY += 15;
        }
        if (orderData.customerInfo?.phone) {
            doc.text(orderData.customerInfo.phone, 300, customerY);
            customerY += 15;
        }
        if (orderData.customerInfo?.email) {
            doc.text(orderData.customerInfo.email, 300, customerY);
        }

        currentY = Math.max(currentY + 60, customerY + 40);

        // Items table
        doc.fillColor('#000000').fontSize(11).font('Helvetica-Bold')
           .text('Items', 50, currentY)
           .text('Qty', 250, currentY)
           .text('Price', 300, currentY)
           .text('Total', 400, currentY);

        currentY += 20;
        doc.moveTo(50, currentY).lineTo(500, currentY).stroke('#BDBDBD');
        currentY += 15;

        // Items list
        orderData.items.forEach((item) => {
            const price = this.parsePrice(item.price);
            const quantity = parseInt(item.quantity) || 1;
            const total = price * quantity;

            doc.fontSize(10).font('Helvetica')
               .text(item.name, 50, currentY, { width: 180, ellipsis: true })
               .text(quantity.toString(), 250, currentY)
               .text(`N$${price.toFixed(2)}`, 300, currentY)
               .text(`N$${total.toFixed(2)}`, 400, currentY);
            currentY += 20;
        });

        currentY += 20;

        // Totals section
        const subtotal = orderData.subtotal || 0;
        const tax = orderData.tax || 0;
        const shipping = orderData.shipping || 0;
        const discount = orderData.discountAmount || 0;
        const finalTotal = subtotal + tax + shipping - discount;

        doc.fontSize(10).font('Helvetica')
           .text('SUBTOTAL', 250, currentY)
           .text(`N$${subtotal.toFixed(2)}`, 400, currentY);
        currentY += 15;

        if (shipping > 0) {
            doc.text('SHIPPING', 250, currentY)
               .text(`N$${shipping.toFixed(2)}`, 400, currentY);
            currentY += 15;
        }

        doc.text('TAX (10%)', 250, currentY)
           .text(`N$${tax.toFixed(2)}`, 400, currentY);
        currentY += 15;

        if (discount > 0) {
            doc.text(`DISCOUNT${orderData.discountCode ? ` (${orderData.discountCode})` : ''}`, 250, currentY)
               .text(`-N$${discount.toFixed(2)}`, 400, currentY);
            currentY += 15;
        }

        // Total
        doc.moveTo(250, currentY).lineTo(450, currentY).stroke('#BDBDBD');
        currentY += 10;
        doc.fontSize(12).font('Helvetica-Bold')
           .text('TOTAL', 250, currentY)
           .text(`N$${finalTotal.toFixed(2)}`, 400, currentY);

        // Thank you
        currentY += 60;
        doc.fillColor('#2E7D32').fontSize(20).font('Helvetica-Bold')
           .text('THANK YOU!', 50, currentY);

        doc.fillColor('#424242').fontSize(9).font('Helvetica')
           .text(businessData.businessDescription || 'Thank you for your business!', 
                 50, currentY + 35, { width: 500 });
    }

    // Helper methods
    parsePrice(price) {
        if (typeof price === 'number') return isNaN(price) ? 0 : price;
        if (typeof price === 'string') {
            const cleaned = price.replace(/[N\$\s,]/g, '').replace(/[^\d.-]/g, '');
            const parsed = parseFloat(cleaned);
            return isNaN(parsed) ? 0 : parsed;
        }
        return 0;
    }

    validateOrderData(orderData) {
        const errors = [];
        if (!orderData || typeof orderData !== 'object') {
            errors.push('Order data is required');
            return { isValid: false, errors };
        }
        if (!orderData.items || !Array.isArray(orderData.items) || orderData.items.length === 0) {
            errors.push('Order must contain items');
        }
        return { isValid: errors.length === 0, errors };
    }

    getFileSize(filepath) {
        try {
            const stats = fs.statSync(filepath);
            return Math.round(stats.size / 1024) + ' KB';
        } catch (error) {
            return 'Unknown';
        }
    }

    getDefaultBusinessData() {
        return {
            businessName: 'LLL Farm',
            businessAddress: 'Windhoek, Namibia',
            businessPhone: '+264 81 314 1453',
            businessEmail: 'info@lllfarm.com',
            businessDescription: 'Premium agricultural products and farming solutions'
        };
    }

    getInvoiceStats() {
        try {
            const files = fs.readdirSync(this.invoicesDir);
            const invoiceFiles = files.filter(file => file.endsWith('.pdf'));
            let totalSize = 0;
            invoiceFiles.forEach(file => {
                const filepath = path.join(this.invoicesDir, file);
                const stats = fs.statSync(filepath);
                totalSize += stats.size;
            });
            return {
                totalInvoices: invoiceFiles.length,
                totalSize: Math.round(totalSize / 1024) + ' KB',
                averageSize: invoiceFiles.length > 0 ? Math.round((totalSize / invoiceFiles.length) / 1024) + ' KB' : '0 KB',
                directory: this.invoicesDir
            };
        } catch (error) {
            return {
                totalInvoices: 0,
                totalSize: '0 KB',
                averageSize: '0 KB',
                directory: this.invoicesDir
            };
        }
    }

    cleanupOldInvoices(daysOld = 30) {
        try {
            const files = fs.readdirSync(this.invoicesDir);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);
            let cleanedCount = 0;
            files.forEach(file => {
                const filepath = path.join(this.invoicesDir, file);
                const stats = fs.statSync(filepath);
                if (stats.mtime < cutoffDate) {
                    fs.unlinkSync(filepath);
                    cleanedCount++;
                }
            });
            return cleanedCount;
        } catch (error) {
            return 0;
        }
    }
}

module.exports = new ProfessionalPDFInvoiceGenerator();