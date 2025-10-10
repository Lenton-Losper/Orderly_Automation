// Rasa API Integration Routes
// Add this to your existing Express app or create a new file

const express = require('express');
const router = express.Router();

// Mock business manager for Rasa integration
const businessManager = require('../services/businessManager');

// Get products for a business (for Rasa actions)
router.get('/api/business/:businessId/products', async (req, res) => {
    try {
        const { businessId } = req.params;
        const { tenantId } = req.query;
        
        console.log(`RASA API: Getting products for business ${businessId}, tenant ${tenantId}`);
        
        // Get business data using your existing business manager
        let businessData;
        try {
            if (businessManager.getBusinessData) {
                businessData = await businessManager.getBusinessData(businessId);
            } else if (businessManager.getBusiness) {
                businessData = await businessManager.getBusiness(businessId);
            } else {
                throw new Error('Business manager method not available');
            }
        } catch (error) {
            console.error('Error getting business data:', error);
            return res.status(500).json({ error: 'Failed to get business data' });
        }
        
        // Extract products from business data
        let products = {};
        if (businessData && businessData.products) {
            products = businessData.products;
        } else if (businessData && businessData.inventory) {
            products = businessData.inventory;
        }
        
        console.log(`RASA API: Found ${Object.keys(products).length} products`);
        
        res.json({
            success: true,
            products: products,
            businessId: businessId,
            tenantId: tenantId || 'default'
        });
        
    } catch (error) {
        console.error('RASA API Error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Place order (for Rasa actions)
router.post('/api/orders', async (req, res) => {
    try {
        const { product_name, quantity, customer_phone, business_id, tenant_id } = req.body;
        
        console.log(`RASA API: Placing order - ${product_name} x${quantity} for ${customer_phone}`);
        
        // Create order data
        const orderData = {
            items: [{
                name: product_name,
                quantity: quantity,
                price: 0 // Will be filled by business logic
            }],
            customerInfo: {
                phone: customer_phone,
                name: 'Rasa Customer'
            },
            total: 0, // Will be calculated
            timestamp: Date.now(),
            source: 'rasa'
        };
        
        // Save order using your existing business manager
        let orderResult;
        try {
            if (businessManager.saveOrder) {
                orderResult = await businessManager.saveOrder(
                    business_id, 
                    customer_phone, 
                    orderData, 
                    `rasa_${Date.now()}`,
                    tenant_id || 'default'
                );
            } else {
                throw new Error('Save order method not available');
            }
        } catch (error) {
            console.error('Error saving order:', error);
            return res.status(500).json({ 
                success: false, 
                error: 'Failed to save order' 
            });
        }
        
        if (orderResult) {
            const orderId = `ORD-${Date.now()}`;
            console.log(`RASA API: Order placed successfully - ${orderId}`);
            
            res.json({
                success: true,
                order_id: orderId,
                message: 'Order placed successfully'
            });
        } else {
            res.status(400).json({
                success: false,
                error: 'Order could not be processed'
            });
        }
        
    } catch (error) {
        console.error('RASA API Order Error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Get customer info (for Rasa actions)
router.get('/api/customer/:phone', async (req, res) => {
    try {
        const { phone } = req.params;
        const { businessId, tenantId } = req.query;
        
        console.log(`RASA API: Getting customer info for ${phone}`);
        
        // Get customer using your existing business manager
        let customer;
        try {
            if (businessManager.getExistingCustomer) {
                customer = await businessManager.getExistingCustomer(businessId, phone, tenantId);
            } else {
                throw new Error('Get customer method not available');
            }
        } catch (error) {
            console.error('Error getting customer:', error);
            return res.status(500).json({ error: 'Failed to get customer data' });
        }
        
        if (customer) {
            res.json({
                success: true,
                customer: {
                    name: customer.name,
                    phone: customer.phone,
                    email: customer.email,
                    address: customer.address,
                    accountId: customer.id
                }
            });
        } else {
            res.json({
                success: false,
                message: 'Customer not found'
            });
        }
        
    } catch (error) {
        console.error('RASA API Customer Error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Health check for Rasa
router.get('/api/rasa/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: Date.now(),
        service: 'LLL Farming WhatsApp Bot API'
    });
});

module.exports = router;
