/**
 * Conversation State Handlers
 * Handles each conversation state with appropriate responses
 */

const ProductService = require('./productService');

class ConversationStateHandlers {
    constructor() {
        this.productService = new ProductService();
    }

    /**
     * Handle IDLE state - normal intent classification
     */
    async handleIdleState(session, message, tenantId, conversationService) {
        console.log(`🎯 IDLE state: Processing "${message}" for user ${session.userId}`);
        
        const lowerMessage = message.toLowerCase();
        
        // Handle greetings
        if (lowerMessage.includes('hi') || lowerMessage.includes('hello') || 
            lowerMessage.includes('hey') || lowerMessage.includes('good morning') ||
            lowerMessage.includes('good afternoon') || lowerMessage.includes('good evening')) {
            return "Hello! 👋 Welcome to LLL Farming. How can I help you today?";
        }
        
        // Handle goodbyes
        if (lowerMessage.includes('bye') || lowerMessage.includes('goodbye') || 
            lowerMessage.includes('see you') || lowerMessage.includes('talk to you later') ||
            lowerMessage.includes('take care')) {
            return "Thank you for contacting us! Have a great day! 🙏";
        }
        
        // Handle product inquiries
        if (lowerMessage.includes('product') || lowerMessage.includes('sell') || 
            lowerMessage.includes('what do you') || lowerMessage.includes('menu') ||
            lowerMessage.includes('price') || lowerMessage.includes('meat') ||
            lowerMessage.includes('available') || lowerMessage.includes('whats available')) {
            
            const products = await this.productService.getProductsForTenant(tenantId, true);
            const productList = conversationService.formatProductList(products);
            
            // Change state to awaiting order
            session.setState(conversationService.states.AWAITING_ORDER);
            
            return `${productList}\n\nWhat would you like to order? 😊`;
        }
        
        // Default fallback
        return "I'm not sure I understood. Could you rephrase that?\n\nYou can ask about our products or place an order!";
    }

    /**
     * Handle AWAITING_ORDER state - customer selecting products
     */
    async handleAwaitingOrder(session, message, tenantId, conversationService) {
        console.log(`🛒 AWAITING_ORDER state: Processing "${message}" for user ${session.userId}`);
        
        const lowerMessage = message.toLowerCase().trim();
        
        // Handle cancel/back
        if (lowerMessage === 'cancel' || lowerMessage === 'back' || lowerMessage === 'nevermind') {
            session.setState(conversationService.states.IDLE);
            return "No problem! Let me know if you need anything else. 😊";
        }
        
        // Get products for this tenant
        const products = await this.productService.getProductsForTenant(tenantId, true);
        
        // Try to find matching product
        const matchedProduct = conversationService.findProductByName(products, message);
        
        if (matchedProduct) {
            // Check if product is available
            if (matchedProduct.isAvailable === false) {
                return `Sorry, *${matchedProduct.name}* is currently out of stock. Please choose another product from our list.`;
            }
            
            // Found product, ask for quantity
            session.currentProduct = matchedProduct;
            session.setState(conversationService.states.AWAITING_QUANTITY);
            
            return `Great choice! How many *${matchedProduct.name}* would you like?\n\n(Price: N$${matchedProduct.price} each)`;
        }
        
        // Check for affirmative response (yes, sure, okay, etc.)
        if (conversationService.isAffirmativeResponse(lowerMessage)) {
            // Show products again with numbers for easy selection
            const productList = conversationService.formatProductListWithNumbers(products);
            return `${productList}\n\nPlease type the product name or number you'd like to order.`;
        }
        
        // Product not found
        return `I couldn't find "${message}" in our products. 🤔\n\nPlease choose from the list above or type "cancel" to go back.`;
    }

    /**
     * Handle AWAITING_QUANTITY state - getting quantity
     */
    async handleAwaitingQuantity(session, message, tenantId, conversationService) {
        console.log(`🔢 AWAITING_QUANTITY state: Processing "${message}" for user ${session.userId}`);
        
        const lowerMessage = message.toLowerCase().trim();
        
        // Handle cancel
        if (lowerMessage === 'cancel' || lowerMessage === 'back') {
            session.currentProduct = null;
            session.setState(conversationService.states.AWAITING_ORDER);
            return "Okay! What product would you like to order instead?";
        }
        
        // Parse quantity
        const quantity = parseInt(message);
        
        if (isNaN(quantity) || quantity <= 0) {
            return `Please enter a valid quantity (number). How many *${session.currentProduct.name}* would you like?`;
        }
        
        if (quantity > 100) {
            return `That's a large order! Please contact us directly for bulk orders, or enter a smaller quantity.`;
        }
        
        // Add to cart
        session.addToCart(session.currentProduct, quantity);
        
        const subtotal = session.currentProduct.price * quantity;
        
        session.currentProduct = null;
        session.setState(conversationService.states.AWAITING_MORE);
        
        return `✅ Added ${quantity}x ${session.currentProduct.name} - N$${subtotal}\n\nWould you like to add anything else? (Yes/No)`;
    }

    /**
     * Handle AWAITING_MORE state - asking if they want more items
     */
    async handleAwaitingMore(session, message, tenantId, conversationService) {
        console.log(`➕ AWAITING_MORE state: Processing "${message}" for user ${session.userId}`);
        
        const lowerMessage = message.toLowerCase().trim();
        
        // Check if they want more
        if (conversationService.isAffirmativeResponse(lowerMessage)) {
            session.setState(conversationService.states.AWAITING_ORDER);
            
            const products = await this.productService.getProductsForTenant(tenantId, true);
            const productList = conversationService.formatProductList(products);
            
            return `${productList}\n\nWhat else would you like to add?`;
        }
        
        // Check if they're done
        if (conversationService.isNegativeResponse(lowerMessage)) {
            session.setState(conversationService.states.CONFIRMING);
            return conversationService.showOrderSummary(session);
        }
        
        // Unclear response
        return "Would you like to add more items? Please reply with 'Yes' or 'No'.";
    }

    /**
     * Handle CONFIRMING state - final confirmation
     */
    async handleConfirming(session, message, tenantId, conversationService) {
        console.log(`✅ CONFIRMING state: Processing "${message}" for user ${session.userId}`);
        
        const lowerMessage = message.toLowerCase().trim();
        
        // Check for confirmation
        if (conversationService.isAffirmativeResponse(lowerMessage) || lowerMessage.includes('confirm')) {
            // Process order
            const orderResult = await this.processOrder(session, tenantId);
            
            // Generate and send PDF invoice (placeholder for now)
            // await this.generateAndSendInvoice(session, tenantId);
            
            // Clear session
            session.clearCart();
            session.setState(conversationService.states.COMPLETED);
            
            return `🎉 Thank you for your order!\n\nOrder #${orderResult.orderId} has been confirmed.\n\nWe'll prepare your order right away!\n\nTotal: N$${orderResult.total}`;
        }
        
        // Check for cancel
        if (conversationService.isNegativeResponse(lowerMessage) || lowerMessage === 'cancel') {
            session.clearCart();
            session.setState(conversationService.states.IDLE);
            return "Order cancelled. No worries! Feel free to order anytime. 😊";
        }
        
        // Unclear
        return "Please confirm your order by replying 'Yes' or cancel with 'No'.";
    }

    /**
     * Process the order and save to database
     */
    async processOrder(session, tenantId) {
        const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const total = session.getCartTotal();
        
        // TODO: Save order to Firebase
        console.log(`💾 Processing order ${orderId} for user ${session.userId}:`, {
            tenantId,
            customerPhone: session.userId,
            items: session.cart,
            total,
            status: 'confirmed',
            createdAt: new Date()
        });
        
        return {
            orderId,
            total,
            items: session.cart
        };
    }

    /**
     * Generate and send PDF invoice (placeholder)
     */
    async generateAndSendInvoice(session, tenantId) {
        // TODO: Integrate with existing PDF invoice generation code
        console.log(`📄 Generating invoice for order ${session.orderId}`);
        
        // Placeholder for now - will integrate with existing invoice system
        return true;
    }
}

module.exports = ConversationStateHandlers;
