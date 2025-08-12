// File: src/utils/pdfInvoiceGenerator.js
// Simple wrapper for the PDF invoice generator service

try {
    const pdfInvoiceGenerator = require('../services/pdfInvoiceGenerator');
    
    // Log successful loading
    console.log('✅ PDF Invoice Generator loaded successfully');
    
    module.exports = pdfInvoiceGenerator;
} catch (error) {
    console.error('❌ Error loading PDF invoice generator:', error.message);
    
    // Provide a fallback object with error methods
    module.exports = {
        generateTestInvoice: async (businessId) => {
            console.log('⚠️ PDF service not available - generateTestInvoice called');
            return {
                success: false,
                error: 'PDF service not available: ' + error.message
            };
        },
        
        generateInvoiceForOrder: async (session, businessId) => {
            console.log('⚠️ PDF service not available - generateInvoiceForOrder called');
            return {
                success: false,
                error: 'PDF service not available: ' + error.message
            };
        },
        
        generateInvoiceFromFirebase: async (orderId, businessId) => {
            console.log('⚠️ PDF service not available - generateInvoiceFromFirebase called');
            return {
                success: false,
                error: 'PDF service not available: ' + error.message
            };
        },
        
        getInvoiceStats: () => {
            console.log('⚠️ PDF service not available - getInvoiceStats called');
            return {
                totalInvoices: 0,
                totalSize: '0 KB',
                averageSize: '0 KB',
                directory: 'N/A',
                error: 'PDF service not available'
            };
        },
        
        validateSystem: async () => {
            console.log('⚠️ PDF service not available - validateSystem called');
            return {
                success: false,
                error: 'PDF service not available: ' + error.message
            };
        },
        
        cleanupOldInvoices: (daysOld) => {
            console.log('⚠️ PDF service not available - cleanupOldInvoices called');
            return 0;
        },
        
        getInvoiceFile: (filename) => {
            console.log('⚠️ PDF service not available - getInvoiceFile called');
            return {
                filepath: null,
                exists: false,
                size: 0
            };
        }
    };
}