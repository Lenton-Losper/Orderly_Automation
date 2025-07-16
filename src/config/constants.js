// Application constants
const OWNER_NUMBER = process.env.OWNER_NUMBER || '264812345678@s.whatsapp.net';

// Tax and shipping configuration
const TAX_RATE = 0.1; // 10% tax
const FREE_SHIPPING_THRESHOLD = 50;
const SHIPPING_COST = 8;

// Company information
const COMPANY_INFO = {
    name: 'LLL FARM',
    slogan: 'Premium Quality Meat Products',
    phone: '+264 81 234 5678',
    email: 'orders@lllfarm.com',
    catalogUrl: 'https://mailchi.mp/158fe0fbec51/lll-farm-special-10340967'
};

// Message templates
const MESSAGES = {
    WELCOME: '👋 Welcome to LLL Farm!',
    CART_EMPTY: '🛒 Cart is empty!',
    INVALID_COMMAND: '🤖 I didn\'t understand that.',
    ORDER_CONFIRMED: '✅ Order confirmed!',
    REGISTRATION_SUCCESS: '✅ Account created successfully!',
    REGISTRATION_FAILED: '❌ Registration failed:',
    INVALID_FORMAT: '❌ Invalid format.',
    DISCOUNT_APPLIED: '🎉 Discount applied:',
    INVALID_DISCOUNT: '❌ Invalid discount code.',
    PDF_GENERATED: '📄 PDF receipt sent above - you can print it for your records!',
    PDF_FAILED: '⚠️ PDF generation failed, but your order is confirmed!'
};

module.exports = {
    OWNER_NUMBER,
    TAX_RATE,
    FREE_SHIPPING_THRESHOLD,
    SHIPPING_COST,
    COMPANY_INFO,
    MESSAGES
};