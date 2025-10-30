/**
 * Explicit Response Service
 * Simple, clear instruction-based order flow
 */

class ExplicitResponseService {
    constructor() {
        this.userStates = new Map(); // Minimal state tracking
        this.userCarts = new Map(); // Cart storage
    }

    /**
     * Validates if a response matches expected format
     * Case-insensitive, handles common variations
     */
    validateResponse(userMessage, expectedOptions) {
        const normalized = userMessage.toLowerCase().trim();
        
        // Direct match
        if (expectedOptions.includes(normalized)) {
            return { valid: true, matched: normalized };
        }
        
        // Fuzzy match for common variations
        const variations = {
            'yes': ['yes', 'y', 'ye', 'yeah', 'yep', 'yea', 'sure', 'ok', 'okay', 'yup', 'ya', 'ofc', 'of course'],
            'no': ['no', 'n', 'nope', 'nah', 'not', 'cancel']
        };
        
        for (const [expected, variants] of Object.entries(variations)) {
            if (expectedOptions.includes(expected) && variants.includes(normalized)) {
                return { valid: true, matched: expected };
            }
        }
        
        return { valid: false, matched: null };
    }

    /**
     * Generate clarification message when response is unclear
     */
    getClarificationMessage(lastPrompt, expectedOptions) {
        const optionsText = expectedOptions.map(opt => opt.toUpperCase()).join(' or ');
        
        return `Just to be clear, please respond with *${optionsText}*\n\n` +
               `(It doesn't matter if you use capital letters or not - YES, yes, or Yes all work! 😊)`;
    }

    /**
     * Set user expectation for next response
     */
    setUserExpectation(userId, expectation, context = {}) {
        this.userStates.set(userId, {
            expecting: expectation,
            context: context,
            timestamp: Date.now()
        });
    }

    /**
     * Get user expectation
     */
    getUserExpectation(userId) {
        const state = this.userStates.get(userId);
        if (!state) return null;
        
        // Expire after 15 minutes
        if (Date.now() - state.timestamp > 15 * 60 * 1000) {
            this.userStates.delete(userId);
            return null;
        }
        
        return state;
    }

    /**
     * Clear user expectation
     */
    clearUserExpectation(userId) {
        this.userStates.delete(userId);
    }

    /**
     * Generate order ID
     */
    generateOrderId() {
        return `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Find product by name with fuzzy matching
     */
    findProductByName(products, searchTerm) {
        const term = searchTerm.toLowerCase().trim();
        
        // Exact match first
        let product = products.find(p => p.name.toLowerCase() === term);
        if (product) return product;
        
        // Contains match
        product = products.find(p => 
            p.name.toLowerCase().includes(term) ||
            term.includes(p.name.toLowerCase())
        );
        if (product) return product;
        
        // Partial word match
        const words = term.split(' ');
        for (const word of words) {
            if (word.length > 2) {
                product = products.find(p => 
                    p.name.toLowerCase().includes(word)
                );
                if (product) return product;
            }
        }
        
        return null;
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

    // ===== CART MANAGEMENT =====

    /**
     * Get user's cart
     */
    getUserCart(userId) {
        if (!this.userCarts.has(userId)) {
            this.userCarts.set(userId, []);
        }
        return this.userCarts.get(userId);
    }

    /**
     * Add item to user's cart
     */
    addItemToCart(userId, item) {
        const cart = this.getUserCart(userId);
        
        // Check if product already in cart
        const existingIndex = cart.findIndex(i => i.product.id === item.product.id);
        
        if (existingIndex !== -1) {
            // Update quantity if product already in cart
            cart[existingIndex].quantity += item.quantity;
            cart[existingIndex].subtotal = cart[existingIndex].quantity * cart[existingIndex].product.price;
            console.log(`🛒 Updated existing item in cart: ${item.product.name} (${cart[existingIndex].quantity} total)`);
        } else {
            // Add new item
            cart.push(item);
            console.log(`🛒 Added new item to cart: ${item.product.name} (${item.quantity}x)`);
        }
        
        return cart;
    }

    /**
     * Clear user's cart
     */
    clearUserCart(userId) {
        this.userCarts.delete(userId);
        console.log(`🗑️ Cleared cart for user: ${userId}`);
    }

    /**
     * Calculate cart total
     */
    calculateCartTotal(userId) {
        const cart = this.getUserCart(userId);
        return cart.reduce((sum, item) => sum + item.subtotal, 0);
    }

    /**
     * Get cart summary text
     */
    getCartSummary(userId) {
        const cart = this.getUserCart(userId);
        
        if (cart.length === 0) {
            return "Your cart is empty! 🛒";
        }
        
        let response = "🛒 *Your Cart*\n\n";
        let total = 0;
        
        cart.forEach((item, index) => {
            total += item.subtotal;
            response += `${index + 1}. ${item.quantity}x ${item.product.name} - N$${item.subtotal}\n`;
        });
        
        response += `\n*Total: N$${total}*`;
        return response;
    }
}

module.exports = ExplicitResponseService;
