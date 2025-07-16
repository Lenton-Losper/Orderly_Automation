const { PRODUCTS, DISCOUNT_CODES } = require('../config/products');
const { TAX_RATE, FREE_SHIPPING_THRESHOLD, SHIPPING_COST } = require('../config/constants');

class OrderSession {
    constructor(userId) {
        this.userId = userId;
        this.cart = [];
        this.customerInfo = {};
        this.step = 'menu';
        this.discountCode = null;
        this.discountAmount = 0;
        this.customerAccount = null;
        this.existingCustomer = null;
    }

    /**
     * Add product to cart
     * @param {string} productId - Product identifier
     * @param {number} quantity - Quantity to add
     * @returns {boolean} - Success status
     */
    addToCart(productId, quantity = 1) {
        const product = PRODUCTS[productId];
        if (!product) return false;

        const existingItem = this.cart.find(item => item.id === productId);
        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            this.cart.push({ id: productId, ...product, quantity });
        }
        return true;
    }

    /**
     * Remove product from cart
     * @param {string} productId - Product identifier
     * @returns {boolean} - Success status
     */
    removeFromCart(productId) {
        const index = this.cart.findIndex(item => item.id === productId);
        if (index > -1) {
            this.cart.splice(index, 1);
            return true;
        }
        return false;
    }

    /**
     * Update product quantity in cart
     * @param {string} productId - Product identifier
     * @param {number} quantity - New quantity
     * @returns {boolean} - Success status
     */
    updateQuantity(productId, quantity) {
        const item = this.cart.find(item => item.id === productId);
        if (item) {
            if (quantity <= 0) {
                return this.removeFromCart(productId);
            }
            item.quantity = quantity;
            return true;
        }
        return false;
    }

    /**
     * Clear cart
     */
    clearCart() {
        this.cart = [];
        this.discountCode = null;
        this.discountAmount = 0;
    }

    /**
     * Calculate subtotal
     * @returns {number} - Subtotal amount
     */
    getSubtotal() {
        return this.cart.reduce((total, item) => total + item.price * item.quantity, 0);
    }

    /**
     * Calculate tax
     * @returns {number} - Tax amount
     */
    getTax() {
        return this.getSubtotal() * TAX_RATE;
    }

    /**
     * Calculate shipping cost
     * @returns {number} - Shipping cost
     */
    getShipping() {
        return this.getSubtotal() > FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
    }

    /**
     * Apply discount code
     * @param {string} code - Discount code
     * @returns {boolean} - Success status
     */
    applyDiscount(code) {
        const discountRate = DISCOUNT_CODES[code.toUpperCase()];
        if (discountRate) {
            this.discountCode = code.toUpperCase();
            this.discountAmount = this.getSubtotal() * discountRate;
            return true;
        }
        return false;
    }

    /**
     * Remove discount
     */
    removeDiscount() {
        this.discountCode = null;
        this.discountAmount = 0;
    }

    /**
     * Calculate total
     * @returns {number} - Total amount
     */
    getTotal() {
        return this.getSubtotal() + this.getTax() + this.getShipping() - this.discountAmount;
    }

    /**
     * Get cart item count
     * @returns {number} - Number of items in cart
     */
    getItemCount() {
        return this.cart.reduce((count, item) => count + item.quantity, 0);
    }

    /**
     * Check if cart is empty
     * @returns {boolean} - True if cart is empty
     */
    isCartEmpty() {
        return this.cart.length === 0;
    }

    /**
     * Set customer information
     * @param {Object} customerInfo - Customer information object
     */
    setCustomerInfo(customerInfo) {
        this.customerInfo = { ...customerInfo };
    }

    /**
     * Check if customer info is complete
     * @returns {boolean} - True if all required info is present
     */
    isCustomerInfoComplete() {
        return !!(this.customerInfo.name && 
                 this.customerInfo.email && 
                 this.customerInfo.phone && 
                 this.customerInfo.address);
    }

    /**
     * Get order summary object
     * @returns {Object} - Order summary
     */
    getOrderSummary() {
        return {
            items: this.cart,
            subtotal: this.getSubtotal(),
            tax: this.getTax(),
            shipping: this.getShipping(),
            discount: this.discountAmount,
            discountCode: this.discountCode,
            total: this.getTotal(),
            itemCount: this.getItemCount()
        };
    }

    /**
     * Reset session
     */
    reset() {
        this.cart = [];
        this.customerInfo = {};
        this.step = 'menu';
        this.discountCode = null;
        this.discountAmount = 0;
        this.customerAccount = null;
        this.existingCustomer = null;
    }
}

module.exports = OrderSession;