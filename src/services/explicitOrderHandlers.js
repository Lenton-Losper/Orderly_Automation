/**
 * Explicit Order Handlers
 * Clear, simple order flow with explicit instructions
 */

const ProductService = require('./productService');
const pdfInvoiceGenerator = require('./pdfInvoiceGenerator');

class ExplicitOrderHandlers {
    constructor() {
        this.productService = new ProductService();
    }

    /**
     * Handle product inquiry with explicit YES/NO prompt
     */
    async handleProductInquiry(tenantId) {
        console.log(`🛒 Handling product inquiry for tenant: ${tenantId}`);
        
        const products = await this.productService.getProductsForTenant(tenantId, true);
        
        if (!products || products.length === 0) {
            return "We're updating our product list. Please check back soon!";
        }
        
        let response = "🛒 *Our Products*\n\n";
        
        // Group by category
        const grouped = this.groupByCategory(products);
        
        for (const [category, items] of Object.entries(grouped)) {
            response += `*${category}*\n`;
            items.forEach(product => {
                const stockStatus = product.isAvailable !== false ? "✅" : "❌";
                const stockText = product.isAvailable === false ? ' (Out of stock)' : '';
                response += `${stockStatus} ${product.name} - N$${product.price}${stockText}\n`;
            });
            response += "\n";
        }
        
        // EXPLICIT INSTRUCTION
        response += "Would you like to place an order?\n\n";
        response += "👉 Reply with *YES* to order\n";
        response += "👉 Reply with *NO* if you're just browsing\n\n";
        response += "_(YES or NO - capital letters don't matter!)_";
        
        return response;
    }

    /**
     * Handle order confirmation with fuzzy matching
     */
    async handleOrderConfirmation(userMessage, tenantId, from, explicitService) {
        console.log(`🤔 Handling order confirmation: "${userMessage}"`);
        
        const validation = explicitService.validateResponse(userMessage, ['yes', 'no']);
        
        if (!validation.valid) {
            // Send clarification
            return explicitService.getClarificationMessage(
                "order placement",
                ['yes', 'no']
            );
        }
        
        if (validation.matched === 'yes') {
            // Start order process
            return await this.startOrderProcess(tenantId, from, explicitService);
        } else {
            // Customer declined
            explicitService.clearUserExpectation(from);
            return "No problem! Feel free to ask if you have any questions. 😊\n\n" +
                   "Type *PRODUCTS* anytime to see our catalog again!";
        }
    }

    /**
     * Start order process with clear product selection
     */
    async startOrderProcess(tenantId, from, explicitService) {
        console.log(`📝 Starting order process for user: ${from}`);
        
        const products = await this.productService.getProductsForTenant(tenantId, true);
        
        let response = "Great! Let's get your order started. 📝\n\n";
        response += "*Please type the EXACT product name* from the list below:\n\n";
        
        // Show products with clear selection instructions
        products.forEach((product, index) => {
            const stockStatus = product.isAvailable !== false ? "✅" : "❌";
            const stockText = product.isAvailable === false ? ' (Out of stock)' : '';
            response += `${index + 1}. *${product.name}* - N$${product.price}${stockText}\n`;
        });
        
        response += "\n💡 *Tip:* Copy and paste the product name to avoid typos!\n";
        response += "\n_(Or type CANCEL to go back)_";
        
        // Set expectation for product selection
        explicitService.setUserExpectation(from, 'product_selection', { products });
        
        return response;
    }

    /**
     * Handle product selection
     */
    async handleProductSelection(userMessage, tenantId, from, explicitService) {
        console.log(`🛍️ Handling product selection: "${userMessage}"`);
        
        const message = userMessage.trim();
        
        // Check for cancel
        if (message.toLowerCase() === 'cancel') {
            explicitService.clearUserExpectation(from);
            return "Order cancelled. Type *PRODUCTS* to browse again! 😊";
        }
        
        // Get products from context or fetch fresh
        const expectation = explicitService.getUserExpectation(from);
        const products = expectation?.context?.products || await this.productService.getProductsForTenant(tenantId, true);
        
        // Find product
        const selectedProduct = explicitService.findProductByName(products, message);
        
        if (!selectedProduct) {
            // Product not found - give helpful error
            return `❌ I couldn't find "${message}" in our products.\n\n` +
                   `Please check the spelling and try again, or:\n` +
                   `• Copy-paste the exact product name\n` +
                   `• Type CANCEL to go back\n` +
                   `• Type PRODUCTS to see the list again`;
        }
        
        // Check if product is available
        if (selectedProduct.isAvailable === false) {
            return `Sorry, *${selectedProduct.name}* is currently out of stock.\n\n` +
                   `Please choose another product from our list, or type CANCEL to go back.`;
        }
        
        // Product found - ask for quantity with clear format
        const response = `Perfect! You selected *${selectedProduct.name}*\n\n` +
                        `Price: N$${selectedProduct.price}\n\n` +
                        `How many would you like?\n` +
                        `👉 *Please enter a NUMBER* (example: 2)\n\n` +
                        `_(Or type CANCEL to choose a different product)_`;
        
        // Set expectation for quantity input
        explicitService.setUserExpectation(from, 'quantity_input', { selectedProduct });
        
        return response;
    }

    /**
     * Handle quantity input with validation
     */
    async handleQuantityInput(userMessage, tenantId, from, explicitService) {
        console.log(`🔢 Handling quantity input: "${userMessage}"`);
        
        const message = userMessage.trim();
        
        // Check for cancel
        if (message.toLowerCase() === 'cancel') {
            return await this.startOrderProcess(tenantId, from, explicitService);
        }
        
        // Get selected product from context
        const expectation = explicitService.getUserExpectation(from);
        const selectedProduct = expectation?.context?.selectedProduct;
        
        if (!selectedProduct) {
            explicitService.clearUserExpectation(from);
            return "Something went wrong. Let's start over!\n\nType *PRODUCTS* to see our catalog.";
        }
        
        // Parse quantity
        const quantity = parseInt(message);
        
        // Validate
        if (isNaN(quantity)) {
            return `Please enter a valid NUMBER.\n\n` +
                   `Example: Type *2* for 2 items\n\n` +
                   `How many *${selectedProduct.name}* would you like?`;
        }
        
        if (quantity <= 0) {
            return `Quantity must be at least 1.\n\n` +
                   `How many *${selectedProduct.name}* would you like?`;
        }
        
        if (quantity > 100) {
            return `That's a large order! For orders over 100 items, please call us directly.\n\n` +
                   `How many *${selectedProduct.name}* would you like? (Max: 100)`;
        }
        
        // Quantity valid - add to cart
        const subtotal = selectedProduct.price * quantity;
        
        // ADD TO CART
        explicitService.addItemToCart(from, {
            product: selectedProduct,
            quantity: quantity,
            subtotal: subtotal
        });
        
        // Ask if they want more items
        return await this.askForMoreItems(from, tenantId, explicitService);
    }

    /**
     * Ask if customer wants to add more items
     */
    async askForMoreItems(userId, tenantId, explicitService) {
        console.log(`➕ Asking for more items for user: ${userId}`);
        
        const cart = explicitService.getUserCart(userId);
        
        // Show what's in cart so far
        let response = "✅ *Added to your cart!*\n\n";
        response += "*Your cart:*\n";
        
        let total = 0;
        cart.forEach((item, index) => {
            total += item.subtotal;
            response += `${index + 1}. ${item.quantity}x ${item.product.name} - N$${item.subtotal}\n`;
        });
        
        response += `\n*Current Total: N$${total}*\n\n`;
        response += "Would you like to add more items?\n\n";
        response += "👉 Reply *YES* to add more items\n";
        response += "👉 Reply *NO* to proceed to checkout\n\n";
        response += "_(YES or NO - capital letters don't matter!)_";
        
        // Set expectation for next message
        explicitService.setUserExpectation(userId, 'continue_shopping', { tenantId });
        
        return response;
    }

    /**
     * Handle continue shopping response
     */
    async handleContinueShopping(userMessage, userId, tenantId, explicitService) {
        console.log(`🛒 Handling continue shopping: "${userMessage}"`);
        
        const validation = explicitService.validateResponse(userMessage, ['yes', 'no']);
        
        if (!validation.valid) {
            return explicitService.getClarificationMessage("continue shopping", ['yes', 'no']);
        }
        
        if (validation.matched === 'yes') {
            // Customer wants to add more items
            return await this.startOrderProcess(tenantId, userId, explicitService);
        } else {
            // Customer is done shopping - proceed to checkout
            return await this.showFinalOrderSummary(userId, tenantId, explicitService);
        }
    }

    /**
     * Show final order summary before confirmation
     */
    async showFinalOrderSummary(userId, tenantId, explicitService) {
        console.log(`📋 Showing final order summary for user: ${userId}`);
        
        const cart = explicitService.getUserCart(userId);
        
        if (cart.length === 0) {
            explicitService.clearUserExpectation(userId);
            return "Your cart is empty! Type *PRODUCTS* to browse our catalog. 😊";
        }
        
        let response = "📋 *Order Summary*\n\n";
        
        let total = 0;
        cart.forEach((item, index) => {
            total += item.subtotal;
            response += `${index + 1}. ${item.quantity}x ${item.product.name} - N$${item.subtotal}\n`;
        });
        
        response += `\n*Total: N$${total}*\n\n`;
        response += "Please confirm your order:\n\n";
        response += "👉 Reply *YES* to confirm and receive your invoice\n";
        response += "👉 Reply *NO* to cancel this order\n\n";
        response += "_(YES or NO - capital letters don't matter!)_";
        
        // Set expectation
        explicitService.setUserExpectation(userId, 'final_confirmation', { 
            cart, 
            total,
            tenantId
        });
        
        return response;
    }

    /**
     * Show order confirmation
     */
    async confirmOrder(cartItems, customerPhone, explicitService) {
        console.log(`📋 Showing order confirmation for user: ${customerPhone}`);
        
        let total = 0;
        let response = "📋 *Order Summary*\n\n";
        
        cartItems.forEach((item, index) => {
            total += item.subtotal;
            response += `${index + 1}. ${item.quantity}x ${item.product.name} - N$${item.subtotal}\n`;
        });
        
        response += `\n*Total: N$${total}*\n\n`;
        response += "Please confirm your order:\n\n";
        response += "👉 Reply *YES* to confirm\n";
        response += "👉 Reply *NO* to cancel\n\n";
        response += "_(YES or NO - capital letters don't matter!)_";
        
        // Set expectation for final confirmation
        explicitService.setUserExpectation(customerPhone, 'final_confirmation', { 
            cartItems, 
            total 
        });
        
        return response;
    }

    /**
     * Process final order confirmation
     */
    async processFinalConfirmation(userMessage, tenantId, from, explicitService, whatsappService = null) {
        console.log(`✅ Processing final confirmation: "${userMessage}"`);
        
        const validation = explicitService.validateResponse(userMessage, ['yes', 'no']);
        
        if (!validation.valid) {
            return explicitService.getClarificationMessage("order confirmation", ['yes', 'no']);
        }
        
        if (validation.matched === 'yes') {
            // Get order data from context
            const expectation = explicitService.getUserExpectation(from);
            const orderData = expectation?.context;
            
            if (!orderData) {
                explicitService.clearUserExpectation(from);
                return "Something went wrong. Let's start over!\n\nType *PRODUCTS* to see our catalog.";
            }
            
            // Generate order ID
            const orderId = explicitService.generateOrderId();
            
            // Prepare order data for saving
            const orderToSave = {
                orderId: orderId,
                customerPhone: from,
                items: orderData.cart.map(item => ({
                    productId: item.product.id,
                    productName: item.product.name,
                    quantity: item.quantity,
                    price: item.product.price,
                    subtotal: item.subtotal
                })),
                total: orderData.total,
                status: 'confirmed',
                createdAt: new Date(),
                tenantId: tenantId
            };
            
            console.log(`💾 Processing order ${orderId} for user ${from}:`, orderToSave);
            
            try {
                // SAVE ORDER TO FIREBASE
                const businessManager = require('./businessManager');
                const businessId = '264813141453'; // Bot's business ID
                const messageId = `${orderId}-${Date.now()}`;
                
                console.log(`💾 Saving order to Firebase...`);
                const saved = await businessManager.saveOrder(
                    businessId,
                    from,
                    orderToSave,
                    messageId,
                    tenantId
                );
                
                if (saved) {
                    console.log(`✅ Order ${orderId} saved successfully to Firebase!`);
                } else {
                    console.error(`❌ Failed to save order ${orderId} to Firebase`);
                }
                
                // Generate PDF invoice
                const pdfResult = await this.generateAndSendInvoice(orderId, orderData, from, tenantId, whatsappService);
                
                // Clear cart and expectations
                explicitService.clearUserCart(from);
                explicitService.clearUserExpectation(from);
                
                // Success message
                let successMessage = `🎉 *Order Confirmed!*\n\n` +
                                   `Order ID: *${orderId}*\n` +
                                   `Total: *N$${orderData.total}*\n\n`;
                
                if (pdfResult.success) {
                    successMessage += `📄 Your invoice has been sent above!\n\n`;
                    // Add PDF info to the response for the message handler to process
                    successMessage += `__PDF_INVOICE__:${pdfResult.filepath}:${orderId}`;
                } else {
                    successMessage += `⚠️ Invoice could not be generated, but your order is confirmed.\n\n`;
                }
                
                successMessage += `We'll prepare your order right away.\n` +
                                `Thank you for your business! 🙏`;
                
                return successMessage;
                
            } catch (error) {
                console.error('❌ Error processing order:', error);
                
                // Clear cart anyway
                explicitService.clearUserCart(from);
                explicitService.clearUserExpectation(from);
                
                return `❌ Sorry, there was an error processing your order.\n\n` +
                       `Please try again or contact us directly.\n\n` +
                       `Error: ${error.message}`;
            }
        } else {
            // Order cancelled
            explicitService.clearUserCart(from);
            explicitService.clearUserExpectation(from);
            return "Order cancelled. No worries!\n\n" +
                   "Type *PRODUCTS* anytime to browse our catalog. 😊";
        }
    }

    /**
     * Generate PDF invoice (simplified version)
     */
    async generateAndSendInvoice(orderId, orderData, customerPhone, tenantId, whatsappService) {
        try {
            console.log(`📄 Generating PDF invoice for order ${orderId}`);
            
            // Prepare order data for PDF generation
            const pdfOrderData = {
                id: orderId,
                customerInfo: {
                    name: customerPhone,
                    phone: customerPhone
                },
                items: orderData.cart.map(item => ({
                    name: item.product.name,
                    quantity: item.quantity,
                    price: item.product.price,
                    subtotal: item.subtotal
                })),
                total: orderData.total,
                date: new Date()
            };
            
            // Get business data dynamically from businessManager
            const businessManager = require('./businessManager');
            const businessData = await businessManager.getBusinessData('264813141453'); // Bot's business ID
            const pdfBusinessData = {
                businessName: businessData?.businessName || businessData?.name || 'LLL Farming',
                address: businessData?.businessAddress || businessData?.address || 'Your Business Address',
                phone: businessData?.businessPhone || businessData?.phone || 'Your Business Phone',
                email: businessData?.businessEmail || businessData?.email || 'your@email.com'
            };
            
            // Generate PDF
            const pdfResult = await pdfInvoiceGenerator.generateInvoicePDF(pdfOrderData, pdfBusinessData);
            
            if (!pdfResult.success) {
                console.error('❌ PDF generation failed:', pdfResult.error);
                return { success: false, error: pdfResult.error };
            }
            
            console.log(`✅ PDF generated successfully: ${pdfResult.filepath}`);
            
            // Return success - the PDF is generated and saved
            // The WhatsApp service will be handled at the message handler level
            return { success: true, filepath: pdfResult.filepath, orderId };
            
        } catch (error) {
            console.error('❌ Error in generateAndSendInvoice:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Group products by category
     */
    groupByCategory(products) {
        const grouped = {};
        products.forEach(product => {
            const category = product.category || 'General';
            if (!grouped[category]) {
                grouped[category] = [];
            }
            grouped[category].push(product);
        });
        return grouped;
    }
}

module.exports = ExplicitOrderHandlers;
