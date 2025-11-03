/**
 * Conversation State Management Service
 * Handles multi-turn conversations and order flow
 */

class ConversationSession {
    constructor(userId) {
        this.userId = userId;
        this.state = 'idle';
        this.cart = [];
        this.currentProduct = null;
        this.lastActivity = Date.now();
        this.orderId = null;
    }

    setState(newState) {
        console.log(`🔄 Session ${this.userId}: ${this.state} → ${newState}`);
        this.state = newState;
        this.lastActivity = Date.now();
    }

    addToCart(product, quantity) {
        this.cart.push({ product, quantity });
        console.log(`🛒 Session ${this.userId}: Added ${quantity}x ${product.name} to cart`);
    }

    clearCart() {
        this.cart = [];
        this.currentProduct = null;
        console.log(`🗑️ Session ${this.userId}: Cart cleared`);
    }

    isExpired() {
        // Session expires after 15 minutes of inactivity
        return Date.now() - this.lastActivity > 15 * 60 * 1000;
    }

    getCartTotal() {
        return this.cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    }
}

class ConversationStateService {
    constructor() {
        this.sessions = new Map();
        this.states = {
            IDLE: 'idle',
            AWAITING_ORDER: 'awaiting_order',
            AWAITING_QUANTITY: 'awaiting_quantity',
            AWAITING_MORE: 'awaiting_more',
            CONFIRMING: 'confirming',
            COMPLETED: 'completed'
        };
        
        // Clean expired sessions every hour
        setInterval(() => this.cleanExpiredSessions(), 60 * 60 * 1000);
    }

    getOrCreateSession(userId) {
        if (!this.sessions.has(userId) || this.sessions.get(userId).isExpired()) {
            console.log(`🆕 Creating new session for user: ${userId}`);
            this.sessions.set(userId, new ConversationSession(userId));
        }
        return this.sessions.get(userId);
    }

    cleanExpiredSessions() {
        console.log(`🧹 Cleaning expired sessions...`);
        let cleaned = 0;
        for (const [userId, session] of this.sessions.entries()) {
            if (session.isExpired()) {
                this.sessions.delete(userId);
                cleaned++;
            }
        }
        console.log(`🧹 Cleaned ${cleaned} expired sessions`);
    }

    // Helper functions for product matching
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

    isAffirmativeResponse(message) {
        const affirmatives = ['yes', 'yeah', 'yep', 'sure', 'ok', 'okay', 'yea', 'ya', 'y'];
        const lowerMessage = message.toLowerCase().trim();
        return affirmatives.some(word => lowerMessage === word || lowerMessage.startsWith(word));
    }

    isNegativeResponse(message) {
        const negatives = ['no', 'nope', 'nah', 'nothing', "that's all", "that's it", 'done', 'finish', 'n'];
        const lowerMessage = message.toLowerCase().trim();
        return negatives.some(word => lowerMessage === word || lowerMessage.includes(word));
    }

    formatProductList(products) {
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
        
        return response;
    }

    formatProductListWithNumbers(products) {
        let response = "🛒 *Our Products*\n\n";
        
        products.forEach((product, index) => {
            const stockStatus = product.isAvailable !== false ? "✅" : "❌";
            const stockText = product.isAvailable === false ? ' (Out of stock)' : '';
            response += `${index + 1}. ${product.name} - N$${product.price}${stockText}\n`;
        });
        
        return response;
    }

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

    generateOrderId() {
        return `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    showOrderSummary(session) {
        let total = 0;
        let summary = "📋 *Order Summary*\n\n";
        
        session.cart.forEach((item, index) => {
            const subtotal = item.product.price * item.quantity;
            total += subtotal;
            summary += `${index + 1}. ${item.quantity}x ${item.product.name} - N$${subtotal}\n`;
        });
        
        summary += `\n*Total: N$${total}*\n\n`;
        summary += "Please reply 'Yes' to confirm or 'Cancel' to cancel the order.";
        
        return summary;
    }
}

module.exports = ConversationStateService;










