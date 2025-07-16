const { PRODUCTS, PRODUCT_ORDER } = require('../config/products');

/**
 * Generate main menu with catalog option
 */
function generateMainMenu() {
    let msg = "🛍️ *WELCOME TO LLL FARM* 🛍️\n\n";
    msg += "Choose an option:\n\n";
    msg += "1️⃣ *Quick Order* - Order popular items directly\n";
    msg += "2️⃣ *Full Catalog* - Browse our complete product range\n";
    msg += "3️⃣ *View Cart* - Check your current cart\n";
    msg += "4️⃣ *Help* - Get assistance\n\n";
    msg += "Type the number of your choice (1-4) or type:\n";
    msg += "• *catalog* - View full product catalog\n";
    msg += "• *quick* - Quick order from popular items\n";
    msg += "• *cart* - View your cart\n";
    msg += "• *help* - Get help";
    return msg;
}

/**
 * Generate catalog message with external link
 */
function generateCatalogMessage() {
    let msg = "📖 *COMPLETE PRODUCT CATALOG* 📖\n\n";
    msg += "Browse our full range of premium meat products with detailed descriptions, images, and pricing:\n\n";
    msg += "🔗 *View Full Catalog:*\n";
    msg += "https://mailchi.mp/158fe0fbec51/lll-farm-special-10340967\n\n";
    msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    msg += "📱 *HOW TO ORDER:*\n";
    msg += "1. Browse the catalog above\n";
    msg += "2. Come back to WhatsApp\n";
    msg += "3. Type *quick* to order popular items\n";
    msg += "4. Or tell us what you want to order\n\n";
    msg += "💡 *Quick Commands:*\n";
    msg += "• *quick* - Order popular items\n";
    msg += "• *menu* - Back to main menu\n";
    msg += "• *cart* - View your cart\n";
    msg += "• *help* - Get assistance";
    return msg;
}

/**
 * Generate quick order product menu
 */
function generateProductMenu() {
    let msg = "🛒 *QUICK ORDER MENU* 🛒\n\n";
    msg += "Popular items - Order directly:\n\n";
    
    // Use PRODUCT_ORDER array for consistent numbering
    PRODUCT_ORDER.forEach((key, i) => {
        const p = PRODUCTS[key];
        msg += `${i + 1}. ${p.image} *${p.name}* - N${p.price.toFixed(2)}\n`;
    });
    
    msg += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `💡 *How to order:*\n`;
    msg += `• Type the number to add to cart\n`;
    msg += `• Type *catalog* for full product range\n`;
    msg += `• Type *cart* to view cart\n`;
    msg += `• Type *checkout* to finish\n`;
    return msg;
}

/**
 * Generate cart summary with items and totals
 */
function generateCartSummary(session) {
    if (session.cart.length === 0) {
        return "🛒 Cart is empty!\n\nType *catalog* to browse all products or *quick* for popular items.";
    }
    
    let msg = "🛒 *YOUR CART*\n\n";
    session.cart.forEach((item, i) => {
        msg += `${i + 1}. ${item.image} *${item.name}*\n`;
        msg += `   Qty: ${item.quantity} × N${item.price.toFixed(2)} = N${(item.price * item.quantity).toFixed(2)}\n\n`;
    });
    
    const subtotal = session.getSubtotal();
    const total = session.getTotal();
    
    msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `Subtotal: N${subtotal.toFixed(2)}\n`;
    msg += `Total: N${total.toFixed(2)}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    msg += `Type *checkout* to continue or *catalog* to browse more items.`;
    
    return msg;
}

/**
 * Generate help message
 */
function generateHelpMessage() {
    let msg = "❓ *HELP & SUPPORT* ❓\n\n";
    msg += "🛍️ *HOW TO ORDER:*\n";
    msg += "1. Browse our catalog or quick menu\n";
    msg += "2. Add items to cart by typing numbers\n";
    msg += "3. Type *checkout* when ready\n";
    msg += "4. Provide your details\n";
    msg += "5. Confirm your order\n\n";
    msg += "📱 *MAIN COMMANDS:*\n";
    msg += "• *catalog* - View full product catalog\n";
    msg += "• *quick* - Quick order popular items\n";
    msg += "• *cart* - View your shopping cart\n";
    msg += "• *checkout* - Complete your order\n";
    msg += "• *menu* - Back to main menu\n";
    msg += "• *register* - Create account\n\n";
    msg += "🎯 *ORDERING TIPS:*\n";
    msg += "• Register for faster checkout\n";
    msg += "• Use discount codes for savings\n";
    msg += "• Free delivery on orders over N50\n";
    msg += "• Get PDF receipt after order\n\n";
    msg += "📞 *NEED MORE HELP?*\n";
    msg += "Just type what you're looking for and we'll help you find it!";
    return msg;
}

/**
 * Generate detailed order summary for checkout
 */
function generateOrderSummary(session) {
    if (session.cart.length === 0) {
        return "🛒 Cart is empty! Type 'catalog' to browse items.";
    }
    
    const subtotal = session.getSubtotal();
    const tax = session.getTax();
    const delivery = session.getShipping();
    const discount = session.discountAmount;
    const total = session.getTotal();
    
    let msg = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    msg += "📋 *ORDER SUMMARY*\n";
    msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";
    
    // Items section
    msg += "🛍️ *ITEMS*\n";
    session.cart.forEach((item, i) => {
        msg += `${i + 1}. ${item.name}\n`;
        msg += `   Qty: ${item.quantity} × N${item.price.toFixed(2)} = N${(item.price * item.quantity).toFixed(2)}\n\n`;
    });
    
    msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    
    // Pricing breakdown
    msg += `📊 *PRICING BREAKDOWN*\n\n`;
    msg += `Subtotal • ${session.cart.length} items${' '.repeat(20 - session.cart.length.toString().length)}N${subtotal.toFixed(2)}\n`;
    
    if (delivery > 0) {
        msg += `Delivery${' '.repeat(31)}N${delivery.toFixed(2)}\n`;
    } else {
        msg += `Delivery${' '.repeat(20)}~~N${(subtotal * 0.1).toFixed(2)}~~ FREE\n`;
    }
    
    msg += `Tax (10%)${' '.repeat(29)}N${tax.toFixed(2)}\n`;
    
    if (discount > 0) {
        msg += `Discount (${session.discountCode})${' '.repeat(20)}-N${discount.toFixed(2)}\n`;
    }
    
    msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    msg += `💰 *TOTAL*${' '.repeat(28)}N${total.toFixed(2)}\n`;
    
    if (discount > 0) {
        msg += `💎 *TOTAL SAVINGS*${' '.repeat(19)}N${discount.toFixed(2)}\n`;
    }
    
    msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    
    return msg;
}

/**
 * Generate registration form instructions
 */
function generateRegistrationForm() {
    let msg = "📝 *REGISTRATION FORM*\n\n";
    msg += "Please provide your details in this format:\n\n";
    msg += "*name|email|phone|address|accountName*\n\n";
    msg += "📋 *Example:*\n";
    msg += "John Doe|john@email.com|+264812345678|123 Main St, Windhoek|johndoe\n\n";
    msg += "⚠️ *Important:*\n";
    msg += "• Use your real name for delivery\n";
    msg += "• Valid email for order updates\n";
    msg += "• Full address for accurate delivery\n";
    msg += "• Choose unique account name\n\n";
    msg += "Type your details separated by | (pipe) symbols.";
    return msg;
}

/**
 * Generate welcome message for new users
 */
function generateWelcomeMessage() {
    let msg = "🎉 *WELCOME TO LLL FARM* 🎉\n\n";
    msg += "Your premium meat supplier in Namibia!\n\n";
    msg += "🥩 Fresh, quality meat products\n";
    msg += "🚚 Fast delivery service\n";
    msg += "💰 Competitive prices\n";
    msg += "📱 Easy WhatsApp ordering\n\n";
    msg += "Type *start* to begin your order or *help* for assistance.";
    return msg;
}

/**
 * Generate error message for invalid input
 */
function generateErrorMessage(context = 'general') {
    const errorMessages = {
        general: "🤖 I didn't understand that.\n\nType:\n• *catalog* - View full product catalog\n• *quick* - Quick order popular items\n• *cart* - View cart\n• *help* - Get help\n• *register* - Create account\n• *start* - Main menu",
        format: "❌ Invalid format. Please check your input and try again.",
        empty_cart: "❌ Cart is empty.\n\nType *catalog* to browse all products or *quick* for popular items.",
        invalid_product: "❌ Invalid product selection. Please choose a valid product number.",
        registration: "❌ Invalid registration format. Please use:\n*name|email|phone|address|accountName*"
    };
    
    return errorMessages[context] || errorMessages.general;
}

module.exports = {
    generateMainMenu,
    generateCatalogMessage,
    generateProductMenu,
    generateCartSummary,
    generateHelpMessage,
    generateOrderSummary,
    generateRegistrationForm,
    generateWelcomeMessage,
    generateErrorMessage
};