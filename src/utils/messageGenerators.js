class MessageGenerators {
    // Helper method to safely convert price to number
    safePrice(price) {
        const numPrice = parseFloat(price);
        return isNaN(numPrice) ? 0 : numPrice;
    }

    // Calculate cart totals directly from cart data
    calculateCartTotals(cart) {
        const subtotal = cart.reduce((sum, item) => {
            const price = this.safePrice(item.price);
            const quantity = parseInt(item.quantity) || 1;
            return sum + (price * quantity);
        }, 0);

        const tax = subtotal * 0.1; // 10% tax
        const shipping = subtotal >= 50 ? 0 : 5; // Free shipping over N$50
        const total = subtotal + tax + shipping;

        return {
            subtotal,
            tax,
            shipping,
            total,
            itemCount: cart.length
        };
    }

    // Main menu message
    generateMainMenu(businessProfile) {
        const businessName = businessProfile.businessName || 'Our Business';
        let msg = `🛍️ *WELCOME TO ${businessName.toUpperCase()}* 🛍️\n\n`;
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

    // Catalog message
    generateCatalogMessage(businessProfile) {
        const businessName = businessProfile.businessName || 'Our Business';
        let msg = `📖 *${businessName.toUpperCase()} PRODUCT CATALOG* 📖\n\n`;
        msg += "Browse our full range of premium products with detailed descriptions, images, and pricing:\n\n";
        
        if (businessProfile.catalogUrl) {
            msg += "🔗 *View Full Catalog:*\n";
            msg += `${businessProfile.catalogUrl}\n\n`;
        }
        
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

    // Product menu for quick ordering
    generateProductMenu(businessData) {
        const businessName = businessData.profile.businessName || 'Our Business';
        let msg = `🛒 *${businessName.toUpperCase()} QUICK ORDER* 🛒\n\n`;
        
        if (businessData.productOrder.length === 0) {
            msg += "⏳ Loading products...\n\nPlease try again in a moment or contact support if this persists.";
            return msg;
        }
        
        msg += "Popular items - Order directly:\n\n";
        businessData.productOrder.forEach((key, i) => {
            const p = businessData.products[key];
            if (p) {
                const price = this.safePrice(p.price);
                msg += `${i + 1}. ${p.image} *${p.name}* - N$${price.toFixed(2)}\n`;
                if (p.description) {
                    msg += `   ${p.description.substring(0, 60)}${p.description.length > 60 ? '...' : ''}\n`;
                }
            }
        });
        msg += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        msg += `💡 *How to order:*\n`;
        msg += `• Type the number to add to cart\n`;
        msg += `• Type *catalog* for full product range\n`;
        msg += `• Type *cart* to view cart\n`;
        msg += `• Type *checkout* to finish\n`;
        return msg;
    }

    // Cart summary
    generateCartSummary(session) {
        if (!session.cart || session.cart.length === 0) {
            return "🛒 *YOUR CART IS EMPTY*\n\n" +
                   "Ready to start shopping?\n\n" +
                   "• Type *catalog* to browse all products\n" +
                   "• Type *quick* for popular items\n" +
                   "• Type *menu* to return to main menu";
        }
        
        let msg = "🛒 *YOUR CART*\n\n";
        session.cart.forEach((item, i) => {
            const price = this.safePrice(item.price);
            const quantity = parseInt(item.quantity) || 1;
            const itemTotal = price * quantity;
            
            msg += `${i + 1}. ${item.image || '🛍️'} *${item.name}*\n`;
            msg += `   Qty: ${quantity} × N${price.toFixed(2)} = N${itemTotal.toFixed(2)}\n\n`;
        });
        
        // Calculate totals directly from cart data
        const totals = this.calculateCartTotals(session.cart);
        const discount = session.discountAmount || 0;
        const finalTotal = totals.total - discount;
        
        msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        msg += `📊 *SUMMARY*\n`;
        msg += `Subtotal: N${totals.subtotal.toFixed(2)}\n`;
        
        if (totals.shipping > 0) {
            msg += `Delivery: N${totals.shipping.toFixed(2)}\n`;
        } else {
            msg += `Delivery: FREE (orders over N$50)\n`;
        }
        
        msg += `Tax (10%): N${totals.tax.toFixed(2)}\n`;
        
        if (discount > 0) {
            msg += `Discount (${session.discountCode || 'Applied'}): -N${discount.toFixed(2)}\n`;
        }
        
        msg += `*Total: N${finalTotal.toFixed(2)}*\n`;
        msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        
        msg += `💡 *Next steps:*\n`;
        msg += `• Type *checkout* to complete order\n`;
        msg += `• Type *catalog* to browse more items\n`;
        msg += `• Type *quick* to add popular items\n`;
        
        if (!discount) {
            msg += `• Try: *discount WELCOME10* for 10% off`;
        }
        
        return msg;
    }

    // Help message
    generateHelpMessage() {
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
        msg += "• Free delivery on orders over N$50\n";
        msg += "• Try codes: WELCOME10, SAVE20, FIRSTORDER\n\n";
        msg += "📞 *NEED MORE HELP?*\n";
        msg += "Just type what you're looking for and we'll help you find it!";
        return msg;
    }

    // Registration message
    generateRegistrationMessage() {
        let msg = "📝 *CREATE YOUR ACCOUNT* 📝\n\n";
        msg += "Get faster checkout, order history, and exclusive offers!\n\n";
        msg += "Please enter your details in this format:\n";
        msg += "*name|email|phone|address|accountName*\n\n";
        msg += "📋 *Example:*\n";
        msg += "*John Doe|john@gmail.com|+264812345678|123 Main St, Windhoek|JohnD*\n\n";
        msg += "⚠️ *Important:*\n";
        msg += "• Use your real information\n";
        msg += "• Account name must be unique\n";
        msg += "• One account per WhatsApp number\n";
        msg += "• Type *menu* to go back";
        return msg;
    }

    // Checkout message
    generateCheckoutMessage(session) {
        // If cart is empty, redirect to shopping
        if (!session.cart || session.cart.length === 0) {
            return "🛒 *YOUR CART IS EMPTY*\n\n" +
                   "Please add items to your cart before checkout:\n\n" +
                   "• Type *catalog* to browse all products\n" +
                   "• Type *quick* for popular items\n" +
                   "• Type *menu* to return to main menu";
        }

        let msg = "📝 *CHECKOUT - CUSTOMER DETAILS* 📝\n\n";
        
        // Show cart summary first
        const totals = this.calculateCartTotals(session.cart);
        msg += `🛒 *Your Order: ${session.cart.length} items - N${totals.total.toFixed(2)}*\n\n`;
        
        msg += "Please provide your information for delivery:\n\n";
        msg += "Format: *name|email|phone|address*\n\n";
        msg += "📋 *Example:*\n";
        msg += "*John Doe|john@gmail.com|+264812345678|123 Main St, Windhoek*\n\n";
        msg += "💡 *Tip:* Register an account for faster future checkouts!";
        return msg;
    }

    // Checkout confirmation
    generateCheckoutConfirmation(session) {
        let msg = "📋 *CHECKOUT CONFIRMATION* 📋\n\n";
        msg += this.generateOrderSummary(session);
        msg += "\n👤 *CUSTOMER DETAILS*\n";
        msg += `Name: ${session.customerInfo?.name || 'Not provided'}\n`;
        msg += `Email: ${session.customerInfo?.email || 'Not provided'}\n`;
        msg += `Phone: ${session.customerInfo?.phone || 'Not provided'}\n`;
        msg += `Address: ${session.customerInfo?.address || 'Not provided'}\n\n`;
        
        if (session.customerAccount) {
            msg += `Account: ${session.customerAccount}\n\n`;
        }
        
        msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
        msg += "✅ Type *confirm* to place your order\n";
        msg += "📝 Type *cart* to modify items\n";
        msg += "🔙 Type *menu* to start over";
        return msg;
    }

    // Order confirmation
    generateOrderConfirmation(session) {
        const totals = this.calculateCartTotals(session.cart || []);
        const customerName = session.customerInfo?.name || 'Customer';
        
        let msg = "🎉 *ORDER CONFIRMED!* 🎉\n\n";
        msg += `Thank you, *${customerName}*!\n\n`;
        msg += `📋 Order Total: *N${totals.total.toFixed(2)}*\n`;
        msg += `📦 Items: ${totals.itemCount} products\n\n`;
        
        if (session.customerAccount) {
            msg += `👤 Account: ${session.customerAccount}\n`;
            msg += `🏆 You earned 1 loyalty point!\n\n`;
        }
        
        msg += "📱 *WHAT'S NEXT?*\n";
        msg += "• We'll contact you soon to confirm delivery\n";
        msg += "• Expect delivery within 24-48 hours\n";
        msg += "• You'll receive updates via WhatsApp\n\n";
        msg += "🛍️ *WANT TO ORDER AGAIN?*\n";
        msg += "Type *start* to place another order\n\n";
        msg += "Thank you for choosing us! 🙏";
        return msg;
    }

    // Detailed order summary for checkout
    generateOrderSummary(session) {
        if (!session.cart || session.cart.length === 0) {
            return "🛒 Cart is empty! Type 'catalog' to browse items.";
        }
        
        const totals = this.calculateCartTotals(session.cart);
        const discount = session.discountAmount || 0;
        const finalTotal = totals.total - discount;
        
        let msg = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
        msg += "📋 *ORDER SUMMARY*\n";
        msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";
        
        // Items section
        msg += "🛍️ *ITEMS*\n";
        session.cart.forEach((item, i) => {
            const price = this.safePrice(item.price);
            const quantity = parseInt(item.quantity) || 1;
            const itemTotal = price * quantity;
            
            msg += `${i + 1}. ${item.name || 'Product'}\n`;
            msg += `   Qty: ${quantity} × N${price.toFixed(2)} = N${itemTotal.toFixed(2)}\n\n`;
        });
        
        msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
        
        // Pricing breakdown
        msg += `📊 *PRICING BREAKDOWN*\n\n`;
        msg += `Subtotal • ${session.cart.length} items${' '.repeat(20 - session.cart.length.toString().length)}N${totals.subtotal.toFixed(2)}\n`;
        
        if (totals.shipping > 0) {
            msg += `Delivery${' '.repeat(31)}N${totals.shipping.toFixed(2)}\n`;
        } else {
            msg += `Delivery${' '.repeat(20)}~~N${(totals.subtotal * 0.1).toFixed(2)}~~ FREE\n`;
        }
        
        msg += `Tax (10%)${' '.repeat(29)}N${totals.tax.toFixed(2)}\n`;
        
        if (discount > 0) {
            msg += `Discount (${session.discountCode || 'Applied'})${' '.repeat(20)}-N${discount.toFixed(2)}\n`;
        }
        
        msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
        msg += `💰 *TOTAL*${' '.repeat(28)}N${finalTotal.toFixed(2)}\n`;
        
        if (discount > 0) {
            msg += `💎 *TOTAL SAVINGS*${' '.repeat(19)}N${discount.toFixed(2)}\n`;
        }
        
        msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
        
        return msg;
    }

    // Error messages
    generateErrorMessage(type = 'general') {
        const errorMessages = {
            general: "⚠️ Something went wrong. Please try again or type *help* for assistance.",
            network: "📶 Connection issue detected. Please check your internet and try again.",
            validation: "❌ Invalid input format. Please check the example and try again.",
            cart_empty: "🛒 Your cart is empty! Type *catalog* to browse products or *quick* for popular items.",
            session_expired: "⏰ Your session has expired. Type *start* to begin a new shopping session.",
            product_unavailable: "❌ Sorry, this product is currently unavailable. Please choose another item.",
            duplicate_order: "⚠️ This order was already processed. Type *start* to place a new order.",
            registration_failed: "❌ Registration failed. Please check your information and try again.",
            business_error: "🏢 Business data is temporarily unavailable. Please try again in a moment."
        };
        
        return errorMessages[type] || errorMessages.general;
    }

    // Welcome back message for returning customers
    generateWelcomeBackMessage(customer, businessProfile) {
        const businessName = businessProfile.businessName || 'Our Business';
        let msg = `🎉 *WELCOME BACK TO ${businessName.toUpperCase()}!* 🎉\n\n`;
        
        // Customer level badge
        if (customer.score >= 50) {
            msg += `💎 VIP Customer • ${customer.name}\n`;
        } else if (customer.score >= 20) {
            msg += `🥇 Gold Customer • ${customer.name}\n`;
        } else if (customer.score >= 10) {
            msg += `🥈 Silver Customer • ${customer.name}\n`;
        } else {
            msg += `🥉 Bronze Customer • ${customer.name}\n`;
        }
        
        msg += `📊 Account: ${customer.id}\n`;
        msg += `⭐ Loyalty Points: ${customer.score}\n\n`;
        
        // Special offers for VIP customers
        if (customer.score >= 50) {
            msg += `🎁 *VIP BONUS:* Use code *VIP20* for 20% off!\n\n`;
        } else if (customer.score >= 20) {
            msg += `🎁 *GOLD BONUS:* Use code *GOLD15* for 15% off!\n\n`;
        }
        
        return msg;
    }

    // Loading message
    generateLoadingMessage() {
        return "⏳ Loading your personalized shopping experience...\n\nPlease wait a moment.";
    }

    // Maintenance message
    generateMaintenanceMessage() {
        return "🔧 *TEMPORARY MAINTENANCE* 🔧\n\n" +
               "We're currently updating our system to serve you better.\n\n" +
               "Please try again in a few minutes.\n\n" +
               "Thank you for your patience! 🙏";
    }

    // Order status messages
    generateOrderStatusMessage(status, orderInfo = {}) {
        const statusMessages = {
            pending: `⏳ *ORDER PENDING*\n\nYour order is being processed.\nWe'll update you soon!`,
            confirmed: `✅ *ORDER CONFIRMED*\n\nOrder #${orderInfo.id || 'N/A'}\nEstimated delivery: ${orderInfo.delivery || '24-48 hours'}`,
            preparing: `👨‍🍳 *ORDER PREPARING*\n\nYour order is being prepared.\nAlmost ready for delivery!`,
            dispatched: `🚚 *ORDER DISPATCHED*\n\nYour order is on the way!\nExpected arrival: ${orderInfo.eta || 'Soon'}`,
            delivered: `🎉 *ORDER DELIVERED*\n\nEnjoy your purchase!\nRate your experience: ${orderInfo.ratingUrl || 'Reply with 1-5 stars'}`
        };
        
        return statusMessages[status] || statusMessages.pending;
    }

    // Discount promotion messages
    generatePromotionMessage(promotion = {}) {
        let msg = `🎉 *SPECIAL OFFER!* 🎉\n\n`;
        
        if (promotion.type === 'discount') {
            msg += `💰 Save ${promotion.amount || '10%'} on your order!\n`;
            msg += `🏷️ Code: *${promotion.code || 'SAVE10'}*\n\n`;
        } else if (promotion.type === 'free_shipping') {
            msg += `🚚 FREE delivery on orders over N${promotion.minimum || '50'}!\n\n`;
        } else {
            msg += `🎁 Limited time offer available!\n\n`;
        }
        
        msg += `⏰ Valid until: ${promotion.expires || 'Limited time'}\n`;
        msg += `💡 Type *catalog* to start shopping!`;
        
        return msg;
    }
}

module.exports = new MessageGenerators();