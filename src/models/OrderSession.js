const { SESSION_CONFIG, PRICING_CONFIG, DISCOUNT_CODES } = require('../config/constants');

class OrderSession {
    constructor(userId, businessId) {
        this.userId = userId;
        this.businessId = businessId;
        this.cart = [];
        this.customerInfo = {};
        this.step = 'menu';
        this.discountCode = null;
        this.discountAmount = 0;
        this.customerAccount = null;
        this.existingCustomer = null;
        this.businessData = null;
        this.createdAt = Date.now();
        this.lastActivity = Date.now();
    }

    // Load business data for this session
    async loadBusinessData(businessManager) {
        try {
            this.businessData = await businessManager.loadBusinessProducts(this.businessId);
            return this.businessData;
        } catch (error) {
            console.error(`❌ Failed to load business data for session ${this.userId}:`, error.message);
            throw error;
        }
    }

    // Cart management methods
    addToCart(productId, quantity = 1) {
        if (!this.businessData || !this.businessData.products) {
            console.error('❌ Business data not loaded');
            return false;
        }

        const product = this.businessData.products[productId];
        if (!product) {
            console.error(`❌ Product ${productId} not found`);
            return false;
        }

        const existingItem = this.cart.find(item => item.id === productId);
        if (existingItem) {
            existingItem.quantity += quantity;
            console.log(`✅ Updated quantity for ${product.name}: ${existingItem.quantity}`);
        } else {
            this.cart.push({ 
                id: productId, 
                ...product, 
                quantity 
            });
            console.log(`✅ Added to cart: ${product.name} (qty: ${quantity})`);
        }

        this.updateLastActivity();
        return true;
    }

    removeFromCart(productId) {
        const initialLength = this.cart.length;
        this.cart = this.cart.filter(item => item.id !== productId);
        
        if (this.cart.length < initialLength) {
            console.log(`✅ Removed product ${productId} from cart`);
            this.updateLastActivity();
            return true;
        }
        
        console.log(`⚠️ Product ${productId} not found in cart`);
        return false;
    }

    updateCartItemQuantity(productId, newQuantity) {
        if (newQuantity <= 0) {
            return this.removeFromCart(productId);
        }

        const item = this.cart.find(item => item.id === productId);
        if (item) {
            item.quantity = newQuantity;
            console.log(`✅ Updated quantity for ${item.name}: ${newQuantity}`);
            this.updateLastActivity();
            return true;
        }

        console.log(`⚠️ Product ${productId} not found in cart`);
        return false;
    }

    clearCart() {
        this.cart = [];
        this.discountCode = null;
        this.discountAmount = 0;
        console.log('🗑️ Cart cleared');
        this.updateLastActivity();
    }

    getCartItemCount() {
        return this.cart.reduce((total, item) => total + item.quantity, 0);
    }

    // Pricing calculations
    getSubtotal() {
        return this.cart.reduce((total, item) => {
            const itemTotal = (item.price || 0) * (item.quantity || 0);
            return total + itemTotal;
        }, 0);
    }

    getTax() {
        return this.getSubtotal() * PRICING_CONFIG.TAX_RATE;
    }

    getShipping() {
        const subtotal = this.getSubtotal();
        return subtotal > PRICING_CONFIG.FREE_SHIPPING_THRESHOLD ? 0 : PRICING_CONFIG.STANDARD_SHIPPING;
    }

    getDiscountAmount() {
        return this.discountAmount;
    }

    getTotal() {
        const subtotal = this.getSubtotal();
        const tax = this.getTax();
        const shipping = this.getShipping();
        const discount = this.getDiscountAmount();
        
        return Math.max(0, subtotal + tax + shipping - discount);
    }

    // Discount management
    applyDiscount(code) {
        const upperCode = code.toUpperCase();
        
        if (DISCOUNT_CODES[upperCode]) {
            this.discountCode = upperCode;
            this.discountAmount = this.getSubtotal() * DISCOUNT_CODES[upperCode];
            console.log(`✅ Applied discount ${upperCode}: -N$${this.discountAmount.toFixed(2)}`);
            this.updateLastActivity();
            return true;
        }
        
        console.log(`❌ Invalid discount code: ${code}`);
        return false;
    }

    removeDiscount() {
        this.discountCode = null;
        this.discountAmount = 0;
        console.log('🗑️ Discount removed');
        this.updateLastActivity();
    }

    // Customer information management
    setCustomerInfo(customerInfo) {
        this.customerInfo = {
            name: customerInfo.name || '',
            email: customerInfo.email || '',
            phone: customerInfo.phone || '',
            address: customerInfo.address || ''
        };
        this.updateLastActivity();
        console.log(`✅ Customer info set for: ${this.customerInfo.name}`);
    }

    setExistingCustomer(customerData) {
        this.existingCustomer = customerData;
        this.customerAccount = customerData.id;
        this.setCustomerInfo({
            name: customerData.name,
            email: customerData.email,
            phone: customerData.phone,
            address: customerData.address
        });
        console.log(`✅ Existing customer loaded: ${customerData.name} (${customerData.id})`);
    }

    // Session state management
    setStep(step) {
        this.step = step;
        this.updateLastActivity();
        console.log(`📍 Session step changed to: ${step}`);
    }

    updateLastActivity() {
        this.lastActivity = Date.now();
    }

    // Session validation
    isExpired() {
        return Date.now() - this.createdAt > SESSION_CONFIG.EXPIRY_TIME;
    }

    isIdle() {
        return Date.now() - this.lastActivity > SESSION_CONFIG.EXPIRY_TIME;
    }

    getSessionAge() {
        return Date.now() - this.createdAt;
    }

    getIdleTime() {
        return Date.now() - this.lastActivity;
    }

    // Order generation
    generateOrder() {
        if (this.cart.length === 0) {
            throw new Error('Cannot generate order: cart is empty');
        }

        if (!this.customerInfo.name) {
            throw new Error('Cannot generate order: customer info incomplete');
        }

        const order = {
            customerInfo: this.customerInfo,
            items: this.cart.map(item => ({
                id: item.id,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                subtotal: item.price * item.quantity
            })),
            pricing: {
                subtotal: this.getSubtotal(),
                tax: this.getTax(),
                shipping: this.getShipping(),
                discount: this.getDiscountAmount(),
                total: this.getTotal()
            },
            discountCode: this.discountCode,
            status: 'pending',
            accountName: this.customerAccount,
            businessId: this.businessId,
            sessionId: this.userId,
            createdAt: new Date().toISOString()
        };

        console.log(`📋 Order generated for ${this.customerInfo.name}: N$${order.pricing.total.toFixed(2)}`);
        return order;
    }

    // Session summary for debugging
    getSummary() {
        return {
            userId: this.userId,
            businessId: this.businessId,
            step: this.step,
            cartItems: this.cart.length,
            cartValue: this.getSubtotal(),
            customerName: this.customerInfo.name || 'Not set',
            customerAccount: this.customerAccount || 'None',
            discountCode: this.discountCode || 'None',
            sessionAge: Math.round(this.getSessionAge() / 1000),
            idleTime: Math.round(this.getIdleTime() / 1000),
            isExpired: this.isExpired(),
            isIdle: this.isIdle()
        };
    }

    // Validation methods
    isValid() {
        return !this.isExpired() && this.businessData !== null;
    }

    canCheckout() {
        return this.cart.length > 0 && this.customerInfo.name && this.customerInfo.phone && this.customerInfo.address;
    }

    hasBusinessData() {
        return this.businessData !== null && this.businessData.products;
    }

    // Reset session (keep user and business ID)
    reset() {
        this.cart = [];
        this.customerInfo = {};
        this.step = 'menu';
        this.discountCode = null;
        this.discountAmount = 0;
        this.customerAccount = null;
        this.existingCustomer = null;
        this.createdAt = Date.now();
        this.lastActivity = Date.now();
        console.log(`🔄 Session reset for user: ${this.userId}`);
    }
}

module.exports = OrderSession;