// First, install required packages:
// npm install pdfkit fs path

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class PDFInvoiceGenerator {
    constructor() {
        this.invoicesDir = path.join(__dirname, '../invoices');
        this.ensureInvoicesDirectory();
    }

    // Ensure invoices directory exists
    ensureInvoicesDirectory() {
        if (!fs.existsSync(this.invoicesDir)) {
            fs.mkdirSync(this.invoicesDir, { recursive: true });
            console.log('📁 Created invoices directory:', this.invoicesDir);
        }
    }

    // Generate PDF invoice
    async generateInvoicePDF(orderData, businessData) {
        try {
            console.log('🔍 PDF_INVOICE DEBUG - Generating PDF for order:', orderData);
            
            // Create unique filename
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const invoiceNumber = `INV-${timestamp}`;
            const filename = `${invoiceNumber}.pdf`;
            const filepath = path.join(this.invoicesDir, filename);

            // Create PDF document
            const doc = new PDFDocument({
                size: 'A4',
                margin: 50
            });

            // Pipe to file
            doc.pipe(fs.createWriteStream(filepath));

            // Generate invoice content
            this.addHeader(doc, businessData, invoiceNumber);
            this.addCustomerInfo(doc, orderData.customerInfo);
            this.addInvoiceDetails(doc, orderData);
            this.addItemsTable(doc, orderData.items);
            this.addTotals(doc, orderData);
            this.addFooter(doc, businessData);

            // Finalize PDF
            doc.end();

            console.log('✅ PDF Invoice generated:', filepath);
            
            return {
                success: true,
                filepath,
                filename,
                invoiceNumber
            };

        } catch (error) {
            console.error('❌ Error generating PDF invoice:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Add header with business info and logo
    addHeader(doc, businessData, invoiceNumber) {
        const businessName = businessData?.profile?.businessName || 'LLL Farm Bot';
        const businessPhone = businessData?.profile?.phone || 'Contact us';
        const businessEmail = businessData?.profile?.email || '';
        const businessAddress = businessData?.profile?.address || '';

        // Header background
        doc.rect(0, 0, doc.page.width, 120)
           .fill('#2E86AB')
           .fillColor('#FFFFFF');

        // Business name
        doc.fontSize(24)
           .font('Helvetica-Bold')
           .text(businessName, 50, 30);

        // Invoice title
        doc.fontSize(16)
           .text('INVOICE', doc.page.width - 150, 30);

        // Invoice number
        doc.fontSize(12)
           .font('Helvetica')
           .text(`Invoice #: ${invoiceNumber}`, doc.page.width - 150, 50);

        // Date
        const date = new Date().toLocaleDateString();
        doc.text(`Date: ${date}`, doc.page.width - 150, 65);

        // Business contact info
        doc.fontSize(10)
           .text(businessPhone, 50, 60);
        if (businessEmail) {
            doc.text(businessEmail, 50, 75);
        }
        if (businessAddress) {
            doc.text(businessAddress, 50, 90);
        }

        // Reset color and move down
        doc.fillColor('#000000');
        doc.y = 140;
    }

    // Add customer information
    addCustomerInfo(doc, customerInfo) {
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .fillColor('#2E86AB')
           .text('BILL TO:', 50, doc.y);

        doc.fillColor('#000000')
           .font('Helvetica')
           .fontSize(12);

        const startY = doc.y + 15;
        doc.text(`${customerInfo.name || 'N/A'}`, 50, startY);
        doc.text(`${customerInfo.email || 'N/A'}`, 50, startY + 15);
        doc.text(`${customerInfo.phone || 'N/A'}`, 50, startY + 30);
        doc.text(`${customerInfo.address || 'N/A'}`, 50, startY + 45);

        doc.y = startY + 80;
    }

    // Add invoice details
    addInvoiceDetails(doc, orderData) {
        const orderDate = new Date(orderData.timestamp).toLocaleDateString();
        const dueDate = new Date(orderData.timestamp + (7 * 24 * 60 * 60 * 1000)).toLocaleDateString(); // 7 days from order

        doc.fontSize(12)
           .font('Helvetica-Bold')
           .text('Order Date:', 350, doc.y)
           .font('Helvetica')
           .text(orderDate, 420, doc.y);

        doc.font('Helvetica-Bold')
           .text('Due Date:', 350, doc.y + 15)
           .font('Helvetica')
           .text(dueDate, 420, doc.y + 15);

        doc.y += 40;
    }

    // Add items table
    addItemsTable(doc, items) {
        const tableTop = doc.y;
        const itemCodeX = 50;
        const descriptionX = 150;
        const quantityX = 350;
        const priceX = 400;
        const amountX = 480;

        // Table header
        doc.rect(50, tableTop, doc.page.width - 100, 25)
           .fill('#F0F0F0')
           .stroke('#CCCCCC');

        doc.fillColor('#000000')
           .fontSize(12)
           .font('Helvetica-Bold');

        doc.text('Item', itemCodeX + 5, tableTop + 8);
        doc.text('Description', descriptionX + 5, tableTop + 8);
        doc.text('Qty', quantityX + 5, tableTop + 8);
        doc.text('Price', priceX + 5, tableTop + 8);
        doc.text('Amount', amountX + 5, tableTop + 8);

        // Table rows
        let currentY = tableTop + 25;
        doc.font('Helvetica').fontSize(10);

        items.forEach((item, i) => {
            const rowHeight = 25;
            
            // Alternate row colors
            if (i % 2 === 1) {
                doc.rect(50, currentY, doc.page.width - 100, rowHeight)
                   .fill('#F9F9F9')
                   .stroke('#CCCCCC');
            } else {
                doc.rect(50, currentY, doc.page.width - 100, rowHeight)
                   .fillAndStroke('#FFFFFF', '#CCCCCC');
            }

            doc.fillColor('#000000');

            // Item details
            const itemName = item.name || 'Unknown Item';
            const description = item.description || 'No description';
            const quantity = item.quantity || 1;
            const price = parseFloat(item.price) || 0;
            const amount = price * quantity;

            doc.text(itemName, itemCodeX + 5, currentY + 8, { width: 90 });
            doc.text(description, descriptionX + 5, currentY + 8, { width: 180 });
            doc.text(quantity.toString(), quantityX + 5, currentY + 8);
            doc.text(`N$${price.toFixed(2)}`, priceX + 5, currentY + 8);
            doc.text(`N$${amount.toFixed(2)}`, amountX + 5, currentY + 8);

            currentY += rowHeight;
        });

        doc.y = currentY + 20;
    }

    // Add totals section
    addTotals(doc, orderData) {
        const subtotal = orderData.items.reduce((sum, item) => {
            return sum + ((parseFloat(item.price) || 0) * (item.quantity || 1));
        }, 0);

        const tax = subtotal * 0.1; // 10% tax
        const shipping = subtotal >= 50 ? 0 : 5; // Free shipping over N$50
        const discount = orderData.discountAmount || 0;
        const discountValue = subtotal * discount;
        const total = subtotal + tax + shipping - discountValue;

        const totalsX = 400;
        let currentY = doc.y;

        // Totals box
        doc.rect(totalsX - 10, currentY - 10, 150, 120)
           .stroke('#CCCCCC');

        doc.fontSize(12).font('Helvetica');

        // Subtotal
        doc.text('Subtotal:', totalsX, currentY);
        doc.text(`N$${subtotal.toFixed(2)}`, totalsX + 70, currentY);
        currentY += 20;

        // Tax
        doc.text('Tax (10%):', totalsX, currentY);
        doc.text(`N$${tax.toFixed(2)}`, totalsX + 70, currentY);
        currentY += 20;

        // Shipping
        if (shipping > 0) {
            doc.text('Shipping:', totalsX, currentY);
            doc.text(`N$${shipping.toFixed(2)}`, totalsX + 70, currentY);
        } else {
            doc.text('Shipping:', totalsX, currentY);
            doc.text('FREE', totalsX + 70, currentY);
        }
        currentY += 20;

        // Discount
        if (discountValue > 0) {
            doc.text(`Discount (${orderData.discountCode}):`, totalsX, currentY);
            doc.text(`-N$${discountValue.toFixed(2)}`, totalsX + 70, currentY);
            currentY += 20;
        }

        // Total
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .fillColor('#2E86AB');
        
        doc.text('TOTAL:', totalsX, currentY);
        doc.text(`N$${total.toFixed(2)}`, totalsX + 70, currentY);

        doc.y = currentY + 40;
    }

    // Add footer
    addFooter(doc, businessData) {
        const footerY = doc.page.height - 100;
        
        doc.fontSize(10)
           .fillColor('#666666')
           .font('Helvetica');

        // Thank you message
        doc.text('Thank you for your business!', 50, footerY);
        
        // Payment terms
        doc.text('Payment Terms: Due upon receipt', 50, footerY + 15);
        
        // Business footer info
        const businessName = businessData?.profile?.businessName || 'LLL Farm Bot';
        doc.text(`© ${new Date().getFullYear()} ${businessName}. All rights reserved.`, 50, footerY + 30);
        
        // Page number
        doc.text(`Page 1 of 1`, doc.page.width - 100, footerY + 30);
    }

    // Clean up old invoices (optional)
    cleanupOldInvoices(daysOld = 30) {
        try {
            const files = fs.readdirSync(this.invoicesDir);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);

            files.forEach(file => {
                const filepath = path.join(this.invoicesDir, file);
                const stats = fs.statSync(filepath);
                
                if (stats.mtime < cutoffDate) {
                    fs.unlinkSync(filepath);
                    console.log(`🗑️ Cleaned up old invoice: ${file}`);
                }
            });
        } catch (error) {
            console.error('❌ Error cleaning up invoices:', error);
        }
    }

    // Get invoice file for sending
    getInvoiceFile(filename) {
        const filepath = path.join(this.invoicesDir, filename);
        if (fs.existsSync(filepath)) {
            return filepath;
        }
        return null;
    }
}

module.exports = new PDFInvoiceGenerator();