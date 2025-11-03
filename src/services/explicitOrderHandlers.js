/**
 * Explicit Order Handlers
 * Clear, simple order flow with explicit instructions
 */

const ProductService = require('./productService');
const pdfInvoiceGenerator = require('./pdfInvoiceGenerator');
const firebaseService = require('./firebase');

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
        
        // Check if this is the last item (check cart after adding)
        const cart = explicitService.getUserCart(from);
        
        // If cart has items, ask for delivery method before final confirmation
        if (cart.length > 0) {
            // Ask if they want more items OR proceed to delivery selection
            return await this.askForMoreItems(from, tenantId, explicitService);
        }
        
        // This shouldn't happen, but fallback
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
            // Customer is done shopping - proceed to delivery method selection
            return await this.askForDeliveryMethod(userId, tenantId, explicitService);
        }
    }

    /**
     * Ask for delivery method
     */
    async askForDeliveryMethod(userId, tenantId, explicitService) {
        console.log(`🚚 Asking for delivery method for user: ${userId}`);
        
        const cart = explicitService.getUserCart(userId);
        
        if (cart.length === 0) {
            explicitService.clearUserExpectation(userId);
            return "Your cart is empty! Type *PRODUCTS* to browse our catalog. 😊";
        }
        
        let response = "🚚 *Delivery Method*\n\n";
        response += "How would you like to receive your order?\n\n";
        response += "1️⃣ *PICKUP* - Collect from our store\n";
        response += "2️⃣ *DELIVERY* - We'll deliver to you\n\n";
        response += "👉 Reply with *PICKUP* or *DELIVERY*\n";
        response += "_(Or type CANCEL to go back)_";
        
        // Set expectation for delivery method
        explicitService.setUserExpectation(userId, 'delivery_method', { 
            cart, 
            tenantId
        });
        
        return response;
    }

    /**
     * Handle delivery method selection
     */
    async handleDeliveryMethod(userMessage, userId, tenantId, explicitService) {
        console.log(`🚚 Handling delivery method: "${userMessage}"`);
        
        const message = userMessage.trim().toLowerCase();
        
        // Check for cancel
        if (message === 'cancel') {
            return await this.askForMoreItems(userId, tenantId, explicitService);
        }
        
        // Parse delivery method
        let deliveryMethod = null;
        let needsAddress = false;
        
        if (message.includes('pickup') || message === '1' || message === '1️⃣') {
            deliveryMethod = 'pickup';
            needsAddress = false;
        } else if (message.includes('delivery') || message === '2' || message === '2️⃣') {
            deliveryMethod = 'delivery';
            needsAddress = true;
        } else {
            return `Please choose a delivery method:\n\n` +
                   `👉 Reply *PICKUP* for store pickup\n` +
                   `👉 Reply *DELIVERY* for home delivery\n` +
                   `_(Or type CANCEL to go back)_`;
        }
        
        // Store delivery method
        const expectation = explicitService.getUserExpectation(userId);
        if (expectation && expectation.context) {
            expectation.context.deliveryMethod = deliveryMethod;
        }
        
        // If delivery, ask for address
        if (needsAddress) {
            let response = `✅ Delivery selected!\n\n`;
            response += `Please provide your delivery address:\n`;
            response += `_(Type your full address, or type CANCEL to change delivery method)_`;
            
            explicitService.setUserExpectation(userId, 'delivery_address', {
                ...expectation?.context,
                deliveryMethod
            });
            
            return response;
        } else {
            // Pickup - no address needed, proceed to summary
            return await this.showFinalOrderSummary(userId, tenantId, explicitService, deliveryMethod);
        }
    }

    /**
     * Handle delivery address input
     */
    async handleDeliveryAddress(userMessage, userId, tenantId, explicitService) {
        console.log(`📍 Handling delivery address: "${userMessage}"`);
        
        const message = userMessage.trim();
        
        // Check for cancel
        if (message.toLowerCase() === 'cancel') {
            return await this.askForDeliveryMethod(userId, tenantId, explicitService);
        }
        
        // Validate address (min length check)
        if (message.length < 10) {
            return `Please provide a complete address (at least 10 characters).\n\n` +
                   `Example: "123 Main Street, Windhoek, Namibia"\n\n` +
                   `_(Or type CANCEL to go back)_`;
        }
        
        // Store address
        const expectation = explicitService.getUserExpectation(userId);
        if (expectation && expectation.context) {
            expectation.context.deliveryAddress = message;
            expectation.context.deliveryMethod = 'delivery';
        }
        
        // Proceed to order summary
        return await this.showFinalOrderSummary(userId, tenantId, explicitService, 'delivery', message);
    }

    /**
     * Show final order summary before confirmation
     */
    async showFinalOrderSummary(userId, tenantId, explicitService, deliveryMethod = null, deliveryAddress = null) {
        console.log(`📋 Showing final order summary for user: ${userId}`);
        
        const cart = explicitService.getUserCart(userId);
        const expectation = explicitService.getUserExpectation(userId);
        
        // Get delivery info from expectation if not provided
        if (!deliveryMethod && expectation?.context?.deliveryMethod) {
            deliveryMethod = expectation.context.deliveryMethod;
        }
        if (!deliveryAddress && expectation?.context?.deliveryAddress) {
            deliveryAddress = expectation.context.deliveryAddress;
        }
        
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
        
        // Add delivery info
        if (deliveryMethod) {
            response += `🚚 *Delivery Method:* ${deliveryMethod.toUpperCase()}\n`;
            if (deliveryMethod === 'delivery' && deliveryAddress) {
                response += `📍 *Delivery Address:* ${deliveryAddress}\n\n`;
            }
        }
        
        response += "Please confirm your order:\n\n";
        response += "👉 Reply *YES* to confirm and receive your invoice\n";
        response += "👉 Reply *NO* to cancel this order\n\n";
        response += "_(YES or NO - capital letters don't matter!)_";
        
        // Set expectation with delivery info
        explicitService.setUserExpectation(userId, 'final_confirmation', { 
            cart, 
            total,
            tenantId,
            deliveryMethod: deliveryMethod || 'pickup',
            deliveryAddress: deliveryAddress || ''
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
                tenantId: tenantId,
                deliveryMethod: orderData.deliveryMethod || 'pickup',
                deliveryAddress: orderData.deliveryAddress || ''
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
                    
                    // NOTIFY BUSINESS OWNER VIA WHATSAPP
                    try {
                        if (whatsappService && typeof whatsappService.sendTextMessage === 'function') {
                            const tenantRef = firebaseService.db.collection('tenants').doc(tenantId);
                            const tenantSnap = await tenantRef.get();
                            const tenantData = tenantSnap.exists ? tenantSnap.data() : {};
                            const businessPhone = tenantData?.phoneId || businessId;
                            const ownerJid = `${businessPhone}@s.whatsapp.net`;
                            
                            // Build order summary for owner
                            let orderSummary = `📦 *New Order Received!*\n\n`;
                            orderSummary += `Order ID: *${orderId}*\n`;
                            orderSummary += `Customer: ${from}\n`;
                            orderSummary += `Total: N$${orderData.total}\n\n`;
                            orderSummary += `*Items:*\n`;
                            orderData.cart.forEach((item, idx) => {
                                orderSummary += `${idx + 1}. ${item.quantity}x ${item.product.name} - N$${item.subtotal}\n`;
                            });
                            orderSummary += `\nStatus: *Confirmed* ✅`;
                            
                            try {
                                await whatsappService.sendTextMessage(ownerJid, orderSummary);
                                console.log(`✅ Order notification sent to business owner: ${ownerJid}`);
                            } catch (notifError) {
                                console.error(`❌ Failed to notify owner via WhatsApp:`, notifError.message);
                                // Don't fail the order if notification fails
                            }
                        }
                    } catch (notifErr) {
                        console.error('❌ Error in owner notification:', notifErr.message);
                        // Don't fail the order if notification fails
                    }
                } else {
                    console.error(`❌ Failed to save order ${orderId} to Firebase`);
                }

                // DEDUCT STOCK AND ALERT OWNER IF LOW
                try {
                    const db = firebaseService.db;
                    if (db) {
                        console.log('📦 Updating inventory for ordered items...');
                        const tenantRef = db.collection('tenants').doc(tenantId);
                        const tenantSnap = await tenantRef.get();
                        const tenantData = tenantSnap.exists ? tenantSnap.data() : {};
                        const businessPhone = tenantData?.phoneId || businessId; // fallback to businessId

                        const lowStockWarnings = [];

                        for (const item of orderToSave.items) {
                            const prodRef = db
                                .collection('vendors')
                                .doc(businessPhone)
                                .collection('tenants')
                                .doc(tenantId)
                                .collection('products')
                                .doc(item.productId);

                            const prodSnap = await prodRef.get();
                            if (!prodSnap.exists) {
                                console.log(`⚠️ Product doc missing for ${item.productId}, skipping stock update`);
                                continue;
                            }

                            const prod = prodSnap.data();
                            const currentStock = parseInt(prod.stock || prod.stockQuantity || 0);
                            const newStock = Math.max(0, currentStock - item.quantity);

                            await prodRef.update({
                                stock: newStock,
                                lastStockUpdate: new Date().toISOString()
                            });

                            if (newStock <= 5) {
                                lowStockWarnings.push({ name: prod.name || item.productName, stock: newStock });
                            }
                        }

                        // Send low stock alert to business owner via WhatsApp
                        if (lowStockWarnings.length > 0 && whatsappService && typeof whatsappService.sendTextMessage === 'function') {
                            const ownerJid = `${businessPhone}@s.whatsapp.net`;
                            let alertMsg = '🔔 Low Stock Alert\n\n';
                            lowStockWarnings.forEach(w => {
                                alertMsg += `• ${w.name}: ${w.stock} left\n`;
                            });
                            alertMsg += `\nOrder ID: ${orderId}`;
                            try { await whatsappService.sendTextMessage(ownerJid, alertMsg); } catch (_) {}
                        }
                    } else {
                        console.log('⚠️ Firebase DB not initialized, skipping stock updates');
                    }
                } catch (invErr) {
                    console.error('❌ Inventory update error:', invErr.message);
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
