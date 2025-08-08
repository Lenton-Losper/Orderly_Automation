// File: src/services/pdfInvoiceGenerator.js
// Professional PDF Invoice Generator - Enhanced Design
// Generates professional invoices similar to LL Losper Farming template

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class ProfessionalPDFInvoiceGenerator {
    constructor() {
        this.invoicesDir = path.join(__dirname, '../invoices');
        this.ensureInvoicesDirectory();
        
        // Professional color scheme
        this.colors = {
            primary: '#4A90E2',        // Professional blue
            secondary: '#F8F9FA',      // Light gray background
            accent: '#28A745',         // Green for totals
            text: '#333333',           // Dark gray text
            lightText: '#666666',      // Medium gray text
            border: '#E0E0E0',         // Light border
            white: '#FFFFFF',
            red: '#DC3545'             // Red for urgent items
        };
        
        // Layout constants
        this.margins = {
            top: 50,
            bottom: 50,
            left: 50,
            right: 50
        };
    }

    // Ensure invoices directory exists
    ensureInvoicesDirectory() {
        if (!fs.existsSync(this.invoicesDir)) {
            fs.mkdirSync(this.invoicesDir, { recursive: true });
            console.log('📁 Created invoices directory:', this.invoicesDir);
        }
    }

    // Generate professional PDF invoice
    async generateInvoicePDF(orderData, businessData) {
        try {
            console.log('🔍 PROFESSIONAL_PDF DEBUG - Generating PDF for order:', orderData);
            
            // Create unique filename with business name
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const businessName = businessData?.businessName || 'LLL_Farm';
            const invoiceNumber = `INV-${Date.now()}`;
            const filename = `${businessName}_${invoiceNumber}.pdf`;
            const filepath = path.join(this.invoicesDir, filename);

            // Create PDF document with professional settings
            const doc = new PDFDocument({
                size: 'A4',
                margin: 0, // We'll handle margins manually for better control
                bufferPages: true
            });

            // Pipe to file
            doc.pipe(fs.createWriteStream(filepath));

            // Generate professional invoice content
            this.addProfessionalHeader(doc, businessData, invoiceNumber);
            this.addCustomerSection(doc, orderData.customerInfo);
            this.addInvoiceInfo(doc, orderData, invoiceNumber);
            this.addProfessionalItemsTable(doc, orderData.items);
            this.addProfessionalTotals(doc, orderData);
            this.addPaymentTerms(doc, businessData);
            this.addProfessionalFooter(doc, businessData);

            // Finalize PDF
            doc.end();

            console.log('✅ Professional PDF Invoice generated:', filepath);
            
            return {
                success: true,
                filepath,
                filename,
                invoiceNumber,
                fileSize: this.getFileSize(filepath)
            };

        } catch (error) {
            console.error('❌ Error generating professional PDF invoice:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Add professional header with company branding
    addProfessionalHeader(doc, businessData, invoiceNumber) {
        const businessName = businessData?.businessName || 'LLL Farm';
        const businessPhone = businessData?.businessPhone || businessData?.phone || '264813141453';
        const businessEmail = businessData?.businessEmail || businessData?.email || 'info@lllfarm.com';
        const businessAddress = businessData?.businessAddress || businessData?.address || 'Windhoek, Namibia';

        // Header background with solid color (compatible with all PDFKit versions)
        doc.rect(0, 0, doc.page.width, 140)
           .fill(this.colors.primary);

        // Company name - large and prominent
        doc.fillColor(this.colors.white)
           .fontSize(28)
           .font('Helvetica-Bold')
           .text(businessName, this.margins.left, 35);

        // Tagline or description
        doc.fontSize(12)
           .font('Helvetica')
           .text('Premium Agricultural Products & Fresh Meat', this.margins.left, 70);

        // Contact information in professional layout
        const contactStartX = this.margins.left;
        const contactY = 95;
        
        doc.fontSize(10)
           .text(`📱 ${businessPhone}`, contactStartX, contactY);
        
        if (businessEmail) {
            doc.text(`✉️  ${businessEmail}`, contactStartX + 150, contactY);
        }
        
        if (businessAddress) {
            doc.text(`📍 ${businessAddress}`, contactStartX + 300, contactY);
        }

        // Invoice title and number - right side
        const rightSideX = doc.page.width - 200;
        
        doc.fontSize(24)
           .font('Helvetica-Bold')
           .fillColor(this.colors.white)
           .text('INVOICE', rightSideX, 35);

        doc.fontSize(14)
           .font('Helvetica')
           .text(`#${invoiceNumber}`, rightSideX, 65);

        // Date
        const currentDate = new Date().toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        doc.fontSize(12)
           .text(`Date: ${currentDate}`, rightSideX, 85);

        // Reset position
        doc.y = 160;
    }

    // Add customer information section
    addCustomerSection(doc, customerInfo) {
        const startY = doc.y;
        
        // Section header
        doc.fillColor(this.colors.primary)
           .fontSize(14)
           .font('Helvetica-Bold')
           .text('BILL TO:', this.margins.left, startY);

        // Customer info box with border (simplified for compatibility)
        const boxY = startY + 25;
        const boxHeight = 80;
        
        doc.rect(this.margins.left, boxY, 300, boxHeight)
           .fill(this.colors.secondary);
        
        // Add border
        doc.rect(this.margins.left, boxY, 300, boxHeight)
           .stroke(this.colors.border);

        // Customer details
        doc.fillColor(this.colors.text)
           .fontSize(12)
           .font('Helvetica-Bold')
           .text(customerInfo.name || 'N/A', this.margins.left + 15, boxY + 15);

        doc.font('Helvetica')
           .fontSize(10)
           .fillColor(this.colors.lightText);

        if (customerInfo.email) {
            doc.text(`📧 ${customerInfo.email}`, this.margins.left + 15, boxY + 35);
        }
        
        if (customerInfo.phone) {
            doc.text(`📱 ${customerInfo.phone}`, this.margins.left + 15, boxY + 50);
        }
        
        if (customerInfo.address) {
            doc.text(`📍 ${customerInfo.address}`, this.margins.left + 15, boxY + 65);
        }

        doc.y = boxY + boxHeight + 30;
    }

    // Add invoice information
    addInvoiceInfo(doc, orderData, invoiceNumber) {
        const startY = doc.y - 135; // Position alongside customer info
        const rightX = doc.page.width - 250;

        // Info box (simplified)
        doc.rect(rightX, startY + 25, 200, 80)
           .fill(this.colors.white);
        
        // Add border
        doc.rect(rightX, startY + 25, 200, 80)
           .stroke(this.colors.border);

        // Invoice details
        doc.fillColor(this.colors.text)
           .fontSize(10)
           .font('Helvetica-Bold');

        const orderDate = new Date(orderData.timestamp || Date.now()).toLocaleDateString('en-GB');
        const dueDate = new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)).toLocaleDateString('en-GB');

        doc.text('Invoice Date:', rightX + 15, startY + 40);
        doc.font('Helvetica').text(orderDate, rightX + 100, startY + 40);

        doc.font('Helvetica-Bold').text('Due Date:', rightX + 15, startY + 55);
        doc.font('Helvetica').text(dueDate, rightX + 100, startY + 55);

        doc.font('Helvetica-Bold').text('Payment Terms:', rightX + 15, startY + 70);
        doc.font('Helvetica').text('Net 7 Days', rightX + 100, startY + 70);

        doc.font('Helvetica-Bold').text('Status:', rightX + 15, startY + 85);
        doc.fillColor(this.colors.red).text('UNPAID', rightX + 100, startY + 85);
    }

    // Add professional items table
    addProfessionalItemsTable(doc, items) {
        const tableTop = doc.y;
        const tableWidth = doc.page.width - (this.margins.left + this.margins.right);
        
        // Column positions and widths
        const columns = {
            item: { x: this.margins.left, width: 120 },
            description: { x: this.margins.left + 125, width: 200 },
            qty: { x: this.margins.left + 330, width: 50 },
            price: { x: this.margins.left + 385, width: 70 },
            amount: { x: this.margins.left + 460, width: 80 }
        };

        // Table header with professional styling (simplified)
        const headerHeight = 35;
        
        doc.rect(this.margins.left, tableTop, tableWidth, headerHeight)
           .fill(this.colors.primary);

        // Add border
        doc.rect(this.margins.left, tableTop, tableWidth, headerHeight)
           .stroke(this.colors.primary);

        doc.fillColor(this.colors.white)
           .fontSize(12)
           .font('Helvetica-Bold');

        doc.text('ITEM', columns.item.x + 10, tableTop + 12);
        doc.text('DESCRIPTION', columns.description.x + 10, tableTop + 12);
        doc.text('QTY', columns.qty.x + 10, tableTop + 12);
        doc.text('PRICE', columns.price.x + 10, tableTop + 12);
        doc.text('AMOUNT', columns.amount.x + 10, tableTop + 12);

        // Table rows
        let currentY = tableTop + headerHeight;
        const rowHeight = 40;

        items.forEach((item, index) => {
            // Alternate row colors (simplified)
            const isEven = index % 2 === 0;
            const rowColor = isEven ? this.colors.white : this.colors.secondary;
            
            doc.rect(this.margins.left, currentY, tableWidth, rowHeight)
               .fill(rowColor);
            
            // Add border
            doc.rect(this.margins.left, currentY, tableWidth, rowHeight)
               .stroke(this.colors.border);

            // Item details
            const itemName = item.name || 'Unknown Item';
            const description = item.description || 'Premium quality product';
            const quantity = item.quantity || 1;
            const price = parseFloat(item.price) || 0;
            const amount = price * quantity;

            doc.fillColor(this.colors.text)
               .fontSize(11)
               .font('Helvetica-Bold');

            // Item name
            doc.text(itemName, columns.item.x + 10, currentY + 8, { 
                width: columns.item.width - 20,
                height: rowHeight - 16
            });

            // Description
            doc.fontSize(9)
               .font('Helvetica')
               .fillColor(this.colors.lightText)
               .text(description, columns.description.x + 10, currentY + 8, {
                width: columns.description.width - 20,
                height: rowHeight - 16
            });

            // Quantity
            doc.fontSize(11)
               .font('Helvetica')
               .fillColor(this.colors.text)
               .text(quantity.toString(), columns.qty.x + 10, currentY + 15);

            // Price
            doc.text(`N$${price.toFixed(2)}`, columns.price.x + 10, currentY + 15);

            // Amount
            doc.font('Helvetica-Bold')
               .text(`N$${amount.toFixed(2)}`, columns.amount.x + 10, currentY + 15);

            currentY += rowHeight;
        });

        doc.y = currentY + 20;
    }

    // Add professional totals section
    addProfessionalTotals(doc, orderData) {
        const startX = doc.page.width - 280;
        const startY = doc.y;
        const boxWidth = 230;
        
        // Calculate totals
        const subtotal = orderData.items.reduce((sum, item) => {
            return sum + ((parseFloat(item.price) || 0) * (item.quantity || 1));
        }, 0);

        const vatRate = 0.15; // 15% VAT for Namibia
        const vat = subtotal * vatRate;
        const shipping = subtotal >= 100 ? 0 : 10; // Free shipping over N$100
        const discount = orderData.discountAmount || 0;
        const discountValue = subtotal * discount;
        const total = subtotal + vat + shipping - discountValue;

        // Totals container
        let currentY = startY;
        const lineHeight = 25;

        // Subtotal
        this.addTotalLine(doc, 'Subtotal:', `N$${subtotal.toFixed(2)}`, startX, currentY, boxWidth, false);
        currentY += lineHeight;

        // VAT
        this.addTotalLine(doc, 'VAT (15%):', `N$${vat.toFixed(2)}`, startX, currentY, boxWidth, false);
        currentY += lineHeight;

        // Shipping
        const shippingText = shipping > 0 ? `N$${shipping.toFixed(2)}` : 'FREE';
        this.addTotalLine(doc, 'Delivery:', shippingText, startX, currentY, boxWidth, false);
        currentY += lineHeight;

        // Discount (if applicable)
        if (discountValue > 0) {
            this.addTotalLine(doc, `Discount (${orderData.discountCode || 'PROMO'}):`, `-N$${discountValue.toFixed(2)}`, startX, currentY, boxWidth, false);
            currentY += lineHeight;
        }

        // Separator line
        doc.moveTo(startX, currentY + 5)
           .lineTo(startX + boxWidth, currentY + 5)
           .stroke(this.colors.border);
        currentY += 15;

        // Total (highlighted)
        this.addTotalLine(doc, 'TOTAL:', `N$${total.toFixed(2)}`, startX, currentY, boxWidth, true);

        doc.y = currentY + 60;
    }

    // Helper method for total lines
    addTotalLine(doc, label, value, x, y, width, isTotal = false) {
        if (isTotal) {
            // Highlighted total box (simplified)
            doc.rect(x, y - 5, width, 30)
               .fill(this.colors.accent);
            
            // Add border
            doc.rect(x, y - 5, width, 30)
               .stroke(this.colors.accent);
            
            doc.fillColor(this.colors.white)
               .fontSize(14)
               .font('Helvetica-Bold');
        } else {
            doc.fillColor(this.colors.text)
               .fontSize(11)
               .font('Helvetica');
        }

        doc.text(label, x + 15, y + (isTotal ? 5 : 0));
        doc.text(value, x + width - 80, y + (isTotal ? 5 : 0));
    }

    // Add payment terms and banking details
    addPaymentTerms(doc, businessData) {
        const startY = doc.y;
        
        // Payment terms box (simplified)
        doc.rect(this.margins.left, startY, doc.page.width - (this.margins.left + this.margins.right), 100)
           .fill(this.colors.secondary);
        
        // Add border
        doc.rect(this.margins.left, startY, doc.page.width - (this.margins.left + this.margins.right), 100)
           .stroke(this.colors.border);

        doc.fillColor(this.colors.primary)
           .fontSize(12)
           .font('Helvetica-Bold')
           .text('PAYMENT TERMS & BANKING DETAILS', this.margins.left + 15, startY + 15);

        doc.fillColor(this.colors.text)
           .fontSize(10)
           .font('Helvetica');

        // Payment terms
        const termsText = [
            '• Payment is due within 7 days of invoice date',
            '• Late payments may incur additional charges',
            '• Please reference invoice number on all payments'
        ];

        let textY = startY + 35;
        termsText.forEach(term => {
            doc.text(term, this.margins.left + 15, textY);
            textY += 15;
        });

        // Banking details (right side)
        const bankingX = this.margins.left + 300;
        doc.font('Helvetica-Bold')
           .text('Banking Details:', bankingX, startY + 35);
        
        doc.font('Helvetica')
           .text('Bank: First National Bank of Namibia', bankingX, startY + 50)
           .text('Account: LL Losper Farming cc', bankingX, startY + 65)
           .text('Branch: Maerua Mall (28273)', bankingX, startY + 80);

        doc.y = startY + 120;
    }

    // Add professional footer
    addProfessionalFooter(doc, businessData) {
        const footerY = doc.page.height - 80;
        const businessName = businessData?.businessName || 'LLL Farm';
        
        // Footer separator line
        doc.moveTo(this.margins.left, footerY - 20)
           .lineTo(doc.page.width - this.margins.right, footerY - 20)
           .stroke(this.colors.border);

        // Thank you message
        doc.fillColor(this.colors.primary)
           .fontSize(14)
           .font('Helvetica-Bold')
           .text('Thank you for choosing LLL Farm!', this.margins.left, footerY);

        // Footer text
        doc.fillColor(this.colors.lightText)
           .fontSize(9)
           .font('Helvetica')
           .text('This invoice was generated automatically by our WhatsApp ordering system.', this.margins.left, footerY + 20);

        // Copyright and page info
        doc.text(`© ${new Date().getFullYear()} ${businessName}. All rights reserved.`, this.margins.left, footerY + 35);
        doc.text('Page 1 of 1', doc.page.width - 100, footerY + 35);

        // Contact footer
        doc.text('For inquiries: WhatsApp us or email info@lllfarm.com', this.margins.left, footerY + 50);
    }

    // Utility methods
    getFileSize(filepath) {
        try {
            const stats = fs.statSync(filepath);
            return Math.round(stats.size / 1024) + ' KB';
        } catch (error) {
            return 'Unknown';
        }
    }

    // Clean up old invoices
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
                    console.log(`🗑️ Cleaned up old invoice: ${file}`);
                }
            });

            console.log(`✅ Cleanup complete: ${cleanedCount} files removed`);
            return cleanedCount;
        } catch (error) {
            console.error('❌ Error cleaning up invoices:', error);
            return 0;
        }
    }

    // Get invoice file for sending
    getInvoiceFile(filename) {
        const filepath = path.join(this.invoicesDir, filename);
        if (fs.existsSync(filepath)) {
            return {
                filepath,
                exists: true,
                size: this.getFileSize(filepath)
            };
        }
        return {
            filepath: null,
            exists: false,
            size: 0
        };
    }

    // Generate invoice preview (smaller version)
    async generateInvoicePreview(orderData, businessData) {
        try {
            const result = await this.generateInvoicePDF(orderData, businessData);
            if (result.success) {
                console.log(`📄 Invoice preview generated: ${result.filename} (${result.fileSize})`);
            }
            return result;
        } catch (error) {
            console.error('❌ Error generating invoice preview:', error);
            return { success: false, error: error.message };
        }
    }

    // Validate order data before PDF generation
    validateOrderData(orderData) {
        const errors = [];
        
        if (!orderData.items || !Array.isArray(orderData.items) || orderData.items.length === 0) {
            errors.push('Order must contain at least one item');
        }
        
        if (!orderData.customerInfo || !orderData.customerInfo.name) {
            errors.push('Customer information is required');
        }
        
        orderData.items.forEach((item, index) => {
            if (!item.name) errors.push(`Item ${index + 1} is missing name`);
            if (!item.price || parseFloat(item.price) <= 0) errors.push(`Item ${index + 1} has invalid price`);
            if (!item.quantity || parseInt(item.quantity) <= 0) errors.push(`Item ${index + 1} has invalid quantity`);
        });
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    // Get invoice statistics
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
            console.error('❌ Error getting invoice stats:', error);
            return {
                totalInvoices: 0,
                totalSize: '0 KB',
                averageSize: '0 KB',
                directory: this.invoicesDir
            };
        }
    }
}

module.exports = new ProfessionalPDFInvoiceGenerator();