class MessageGenerators {
    // Enhanced helper method to safely convert price to number with comprehensive debugging
    safePrice(price, itemName = 'Unknown Item') {
        console.log(`🔍 SAFE_PRICE DEBUG for "${itemName}":`, {
            input: price,
            type: typeof price,
            isNull: price === null,
            isUndefined: price === undefined,
            isEmpty: price === ''
        });
        
        // Handle null, undefined, or empty values
        if (price === null || price === undefined || price === '') {
            console.log(`❌ Empty/null price for ${itemName}, returning 0`);
            return 0;
        }
        
        // If it's already a number
        if (typeof price === 'number') {
            const result = isNaN(price) ? 0 : price;
            console.log(`✅ Number price for ${itemName}: ${result}`);
            return result;
        }
        
        // If it's a string, clean and convert it
        if (typeof price === 'string') {
            // Remove currency symbols (N, $), spaces, commas
            const cleaned = price
                .replace(/N\$/g, '')     // Remove N$
                .replace(/\$/g, '')      // Remove $
                .replace(/N/g, '')       // Remove standalone N
                .replace(/[,\s]/g, '')   // Remove commas and spaces
                .replace(/[^\d.-]/g, ''); // Keep only digits, dots, and minus
            
            console.log(`🔧 Cleaned price string for ${itemName}: "${price}" → "${cleaned}"`);
            
            const numPrice = parseFloat(cleaned);
            const result = isNaN(numPrice) ? 0 : numPrice;
            console.log(`✅ Final converted price for ${itemName}: ${result}`);
            return result;
        }
        
        // Handle objects with price property (in case product is passed instead of price)
        if (typeof price === 'object' && price !== null) {
            if (price.price !== undefined) {
                console.log(`🔧 Object has price property for ${itemName}, recursing...`);
                return this.safePrice(price.price, itemName);
            }
            if (price.cost !== undefined) {
                console.log(`🔧 Object has cost property for ${itemName}, using cost...`);
                return this.safePrice(price.cost, itemName);
            }
            if (price.amount !== undefined) {
                console.log(`🔧 Object has amount property for ${itemName}, using amount...`);
                return this.safePrice(price.amount, itemName);
            }
        }
        
        console.log(`❌ Unexpected price type for ${itemName}: ${typeof price}, returning 0`);
        return 0;
    }

    // Debug method to analyze business data structure
    debugBusinessData(businessData, context = 'Unknown') {
        console.log(`\n🔍 BUSINESS_DATA DEBUG (${context}):`);
        console.log('🔍 Business data keys:', Object.keys(businessData || {}));
        
        if (businessData.profile) {
            console.log('🔍 Profile:', businessData.profile);
        }
        
        if (businessData.products) {
            console.log('🔍 Products count:', Object.keys(businessData.products).length);
            console.log('🔍 Products keys:', Object.keys(businessData.products));
            
            // Analyze first few products
            const productKeys = Object.keys(businessData.products).slice(0, 3);
            productKeys.forEach(key => {
                const product = businessData.products[key];
                console.log(`🔍 Sample Product ${key}:`, {
                    name: product?.name,
                    price: product?.price,
                    priceType: typeof product?.price,
                    image: product?.image,
                    allKeys: Object.keys(product || {})
                });
            });
        } else {
            console.log('❌ No products found in business data');
        }
        
        if (businessData.productOrder) {
            console.log('🔍 Product order:', businessData.productOrder);
        } else {
            console.log('❌ No productOrder found in business data');
        }
        
        return businessData;
    }

    // Debug method to analyze cart items
    debugCartItems(cart, context = 'Unknown') {
        console.log(`\n🔍 CART_DEBUG (${context}):`);
        if (!cart || cart.length === 0) {
            console.log('🔍 Cart is empty');
            return;
        }
        
        console.log('🔍 Cart items count:', cart.length);
        cart.forEach((item, index) => {
            console.log(`🔍 Cart Item ${index + 1}:`, {
                name: item?.name,
                price: item?.price,
                priceType: typeof item?.price,
                quantity: item?.quantity,
                allKeys: Object.keys(item || {})
            });
        });
    }

    // Calculate cart totals directly from cart data with enhanced debugging
    calculateCartTotals(cart) {
        console.log('\n🔍 CALCULATE_CART_TOTALS DEBUG:');
        this.debugCartItems(cart, 'calculateCartTotals');
        
        if (!cart || !Array.isArray(cart)) {
            console.log('❌ Cart is not an array or is null');
            return {
                subtotal: 0,
                tax: 0,
                shipping: 0,
                total: 0,
                itemCount: 0
            };
        }
        
        const subtotal = cart.reduce((sum, item, index) => {
            const price = this.safePrice(item.price, `Cart Item ${index + 1}: ${item.name}`);
            const quantity = parseInt(item.quantity) || 1;
            const itemTotal = price * quantity;
            
            console.log(`🔍 Cart calculation - Item ${index + 1}: ${price} × ${quantity} = ${itemTotal}`);
            return sum + itemTotal;
        }, 0);

        const tax = subtotal * 0.1; // 10% tax
        const shipping = subtotal >= 50 ? 0 : 5; // Free shipping over N$50
        const total = subtotal + tax + shipping;

        const result = {
            subtotal,
            tax,
            shipping,
            total,
            itemCount: cart.length
        };
        
        console.log('🔍 Cart totals calculated:', result);
        return result;
    }

    // Main menu message
    generateMainMenu(businessProfile) {
        const businessName = businessProfile?.businessName || 'Our Business';
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
        const businessName = businessProfile?.businessName || 'Our Business';
        let msg = `📖 *${businessName.toUpperCase()} PRODUCT CATALOG* 📖\n\n`;
        msg += "Browse our full range of premium products with detailed descriptions, images, and pricing:\n\n";
        
        if (businessProfile?.catalogUrl) {
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

    // Enhanced product menu for quick ordering with comprehensive debugging
    generateProductMenu(businessData) {
        console.log('\n🔍 GENERATE_PRODUCT_MENU DEBUG:');
        this.debugBusinessData(businessData, 'generateProductMenu');
        
        const businessName = businessData?.profile?.businessName || 'Our Business';
        let msg = `🛒 *${businessName.toUpperCase()} QUICK ORDER* 🛒\n\n`;
        
        // Check if we have products
        if (!businessData?.products || Object.keys(businessData.products).length === 0) {
            console.log('❌ No products found in business data');
            msg += "⏳ Loading products...\n\nPlease try again in a moment or contact support if this persists.";
            return msg;
        }
        
        // Check if we have product order
        if (!businessData?.productOrder || businessData.productOrder.length === 0) {
            console.log('❌ No productOrder found, creating default order');
            // Create default order from available products
            businessData.productOrder = Object.keys(businessData.products).slice(0, 10);
        }
        
        msg += "Popular items - Order directly:\n\n";
        
        let validProductCount = 0;
        businessData.productOrder.forEach((key, i) => {
            const product = businessData.products[key];
            console.log(`🔍 Processing product ${i + 1} (key: "${key}"):`, product);
            
            if (product && product.name) {
                const price = this.safePrice(product.price, product.name);
                console.log(`🔍 Product "${product.name}" final price: ${price}`);
                
                validProductCount++;
                const productImage = product.image || '🛍️';
                msg += `${validProductCount}. ${productImage} *${product.name}* - N$${price.toFixed(2)}\n`;
                
                if (product.description) {
                    const truncatedDesc = product.description.substring(0, 60);
                    msg += `   ${truncatedDesc}${product.description.length > 60 ? '...' : ''}\n`;
                }
                msg += '\n';
            } else {
                console.log(`❌ Product not found or invalid for key: "${key}"`);
            }
        });
        
        if (validProductCount === 0) {
            console.log('❌ No valid products found');
            msg += "⚠️ No products available at the moment.\nPlease try again later or contact support.";
            return msg;
        }
        
        msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        msg += `💡 *How to order:*\n`;
        msg += `• Type the number to add to cart\n`;
        msg += `• Type *catalog* for full product range\n`;
        msg += `• Type *cart* to view cart\n`;
        msg += `• Type *checkout* to finish\n`;
        
        console.log(`✅ Generated product menu with ${validProductCount} products`);
        return msg;
    }

    // Enhanced cart summary with better debugging
    generateCartSummary(session) {
        console.log('\n🔍 GENERATE_CART_SUMMARY DEBUG:');
        this.debugCartItems(session?.cart, 'generateCartSummary');
        
        if (!session?.cart || session.cart.length === 0) {
            return "🛒 *YOUR CART IS EMPTY*\n\n" +
                   "Ready to start shopping?\n\n" +
                   "• Type *catalog* to browse all products\n" +
                   "• Type *quick* for popular items\n" +
                   "• Type *menu* to return to main menu";
        }
        
        let msg = "🛒 *YOUR CART*\n\n";
        
        session.cart.forEach((item, i) => {
            const price = this.safePrice(item.price, `Cart item: ${item.name}`);
            const quantity = parseInt(item.quantity) || 1;
            const itemTotal = price * quantity;
            
            msg += `${i + 1}. ${item.image || '🛍️'} *${item.name}*\n`;
            msg += `   Qty: ${quantity} × N$${price.toFixed(2)} = N$${itemTotal.toFixed(2)}\n\n`;
        });
        
        // Calculate totals with debugging
        const totals = this.calculateCartTotals(session.cart);
        const discount = session.discountAmount || 0;
        const finalTotal = totals.total - discount;
        
        msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        msg += `📊 *SUMMARY*\n`;
        msg += `Subtotal: N$${totals.subtotal.toFixed(2)}\n`;
        
        if (totals.shipping > 0) {
            msg += `Delivery: N$${totals.shipping.toFixed(2)}\n`;
        } else {
            msg += `Delivery: FREE (orders over N$50)\n`;
        }
        
        msg += `Tax (10%): N$${totals.tax.toFixed(2)}\n`;
        
        if (discount > 0) {
            msg += `Discount (${session.discountCode || 'Applied'}): -N$${discount.toFixed(2)}\n`;
        }
        
        msg += `*Total: N$${finalTotal.toFixed(2)}*\n`;
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
        msg += "*Your Name|your.email@example.com|+264000000000|Your Address|YourAccount*\n\n";
        msg += "⚠️ *Important:*\n";
        msg += "• Use your real information\n";
        msg += "• Account name must be unique\n";
        msg += "• One account per WhatsApp number\n";
        msg += "• Type *menu* to go back";
        return msg;
    }

    // Enhanced checkout message
    generateCheckoutMessage(session) {
        console.log('\n🔍 GENERATE_CHECKOUT_MESSAGE DEBUG:');
        this.debugCartItems(session?.cart, 'generateCheckoutMessage');
        
        // If cart is empty, redirect to shopping
        if (!session?.cart || session.cart.length === 0) {
            return "🛒 *YOUR CART IS EMPTY*\n\n" +
                   "Please add items to your cart before checkout:\n\n" +
                   "• Type *catalog* to browse all products\n" +
                   "• Type *quick* for popular items\n" +
                   "• Type *menu* to return to main menu";
        }

        let msg = "📝 *CHECKOUT - CUSTOMER DETAILS* 📝\n\n";
        
        // Show cart summary first
        const totals = this.calculateCartTotals(session.cart);
        msg += `🛒 *Your Order: ${session.cart.length} items - N$${totals.total.toFixed(2)}*\n\n`;
        
        msg += "Please provide your information for delivery:\n\n";
        msg += "Format: *name|email|phone|address*\n\n";
        msg += "📋 *Example:*\n";
        msg += "*Your Name|your.email@example.com|+264000000000|Your Address*\n\n";
        msg += "💡 *Tip:* Register an account for faster future checkouts!";
        return msg;
    }

    // Enhanced checkout confirmation
    generateCheckoutConfirmation(session) {
        console.log('\n🔍 GENERATE_CHECKOUT_CONFIRMATION DEBUG:');
        this.debugCartItems(session?.cart, 'generateCheckoutConfirmation');
        
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

    // Enhanced order confirmation
    generateOrderConfirmation(session) {
        console.log('\n🔍 GENERATE_ORDER_CONFIRMATION DEBUG:');
        const totals = this.calculateCartTotals(session?.cart || []);
        const customerName = session?.customerInfo?.name || 'Customer';
        
        let msg = "🎉 *ORDER CONFIRMED!* 🎉\n\n";
        msg += `Thank you, *${customerName}*!\n\n`;
        msg += `📋 Order Total: *N$${totals.total.toFixed(2)}*\n`;
        msg += `📦 Items: ${totals.itemCount} products\n\n`;
        
        if (session.customerAccount) {
            msg += `👤 Account: ${session.customerAccount}\n`;
            msg += `🏆 You earned 1 loyalty point!\n\n`;
        }
        
        msg += "📱 *WHAT'S NEXT?*\n";
        msg += "• We'll contact you soon to confirm delivery\n";
        msg += "• Expect delivery with by Friday";
        msg += "• You'll receive updates via WhatsApp\n\n";
        msg += "🛍️ *WANT TO ORDER AGAIN?*\n";
        msg += "Type *start* to place another order\n\n";
        msg += "Thank you for choosing us! 🙏";
        return msg;
    }

    // Enhanced detailed order summary for checkout
    generateOrderSummary(session) {
        console.log('\n🔍 GENERATE_ORDER_SUMMARY DEBUG:');
        if (!session?.cart || session.cart.length === 0) {
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
            const price = this.safePrice(item.price, `Order summary: ${item.name}`);
            const quantity = parseInt(item.quantity) || 1;
            const itemTotal = price * quantity;
            
            msg += `${i + 1}. ${item.name || 'Product'}\n`;
            msg += `   Qty: ${quantity} × N$${price.toFixed(2)} = N$${itemTotal.toFixed(2)}\n\n`;
        });
        
        msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
        
        // Pricing breakdown
        msg += `📊 *PRICING BREAKDOWN*\n\n`;
        msg += `Subtotal • ${session.cart.length} items${' '.repeat(Math.max(0, 20 - session.cart.length.toString().length))}N$${totals.subtotal.toFixed(2)}\n`;
        
        if (totals.shipping > 0) {
            msg += `Delivery${' '.repeat(31)}N$${totals.shipping.toFixed(2)}\n`;
        } else {
            msg += `Delivery${' '.repeat(20)}~~N$5.00~~ FREE\n`;
        }
        
        msg += `Tax (10%)${' '.repeat(29)}N$${totals.tax.toFixed(2)}\n`;
        
        if (discount > 0) {
            msg += `Discount (${session.discountCode || 'Applied'})${' '.repeat(20)}-N$${discount.toFixed(2)}\n`;
        }
        
        msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
        msg += `💰 *TOTAL*${' '.repeat(28)}N$${finalTotal.toFixed(2)}\n`;
        
        if (discount > 0) {
            msg += `💎 *TOTAL SAVINGS*${' '.repeat(19)}N$${discount.toFixed(2)}\n`;
        }
        
        msg += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
        
        return msg;
    }

    // Error messages with better context
    generateErrorMessage(type = 'general', context = '') {
        const errorMessages = {
            general: "⚠️ Something went wrong. Please try again or type *help* for assistance.",
            network: "📶 Connection issue detected. Please check your internet and try again.",
            validation: "❌ Invalid input format. Please check the example and try again.",
            cart_empty: "🛒 Your cart is empty! Type *catalog* to browse products or *quick* for popular items.",
            session_expired: "⏰ Your session has expired. Type *start* to begin a new shopping session.",
            product_unavailable: "❌ Sorry, this product is currently unavailable. Please choose another item.",
            duplicate_order: "⚠️ This order was already processed. Type *start* to place a new order.",
            registration_failed: "❌ Registration failed. Please check your information and try again.",
            business_error: "🏢 Business data is temporarily unavailable. Please try again in a moment.",
            price_error: "💰 There was an issue with product pricing. Please contact support."
        };
        
        const message = errorMessages[type] || errorMessages.general;
        return context ? `${message}\n\nContext: ${context}` : message;
    }

    // Enhanced welcome back message for returning customers
    generateWelcomeBackMessage(customer, businessProfile) {
        const businessName = businessProfile?.businessName || 'Our Business';
        let msg = `🎉 *WELCOME BACK TO ${businessName.toUpperCase()}!* 🎉\n\n`;
        
        // Customer level badge
        const score = customer?.score || 0;
        if (score >= 50) {
            msg += `💎 VIP Customer • ${customer.name}\n`;
        } else if (score >= 20) {
            msg += `🥇 Gold Customer • ${customer.name}\n`;
        } else if (score >= 10) {
            msg += `🥈 Silver Customer • ${customer.name}\n`;
        } else {
            msg += `🥉 Bronze Customer • ${customer.name}\n`;
        }
        
        msg += `📊 Account: ${customer.id}\n`;
        msg += `⭐ Loyalty Points: ${score}\n\n`;
        
        // Special offers for VIP customers
        if (score >= 50) {
            msg += `🎁 *VIP BONUS:* Use code *VIP20* for 20% off!\n\n`;
        } else if (score >= 20) {
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
            msg += `🚚 FREE delivery on orders over N$${promotion.minimum || '50'}!\n\n`;
        } else {
            msg += `🎁 Limited time offer available!\n\n`;
        }
        
        msg += `⏰ Valid until: ${promotion.expires || 'Limited time'}\n`;
        msg += `💡 Type *catalog* to start shopping!`;
        
        return msg;
    }

    // Helper method to create cart item with proper price formatting
    createCartItem(product, quantity = 1) {
        console.log(`🔍 CREATING_CART_ITEM for: ${product?.name}`);
        
        const cartItem = {
            name: product?.name || 'Unknown Product',
            price: this.safePrice(product?.price, product?.name || 'Unknown Product'),
            quantity: parseInt(quantity) || 1,
            image: product?.image || '🛍️',
            description: product?.description || ''
        };
        
        console.log('🔍 Created cart item:', cartItem);
        return cartItem;
    }

    // Helper method to validate cart before operations
    validateCart(cart) {
        if (!cart || !Array.isArray(cart)) {
            console.log('❌ Cart validation failed: not an array or null');
            return false;
        }
        
        if (cart.length === 0) {
            console.log('❌ Cart validation failed: empty cart');
            return false;
        }
        
        // Check if all cart items have required properties
        const isValid = cart.every((item, index) => {
            const hasName = item && item.name;
            const hasValidPrice = item && (typeof item.price === 'number' || typeof item.price === 'string');
            const hasValidQuantity = item && (parseInt(item.quantity) > 0 || !item.quantity);
            
            if (!hasName || !hasValidPrice) {
                console.log(`❌ Cart item ${index + 1} validation failed:`, {
                    hasName,
                    hasValidPrice,
                    hasValidQuantity,
                    item
                });
                return false;
            }
            
            return true;
        });
        
        console.log(`🔍 Cart validation result: ${isValid}`);
        return isValid;
    }

    // Helper method to format currency consistently
    formatCurrency(amount) {
        const num = parseFloat(amount) || 0;
        return `N${num.toFixed(2)}`;
    }

    // Helper method to get product by index from business data
    getProductByIndex(businessData, index) {
        console.log(`🔍 GET_PRODUCT_BY_INDEX: index=${index}`);
        
        if (!businessData?.products || !businessData?.productOrder) {
            console.log('❌ No products or productOrder found');
            return null;
        }
        
        if (index < 0 || index >= businessData.productOrder.length) {
            console.log(`❌ Index ${index} out of range (0-${businessData.productOrder.length - 1})`);
            return null;
        }
        
        const productKey = businessData.productOrder[index];
        const product = businessData.products[productKey];
        
        console.log(`🔍 Product key: ${productKey}, Product:`, product);
        return product;
    }

    // Helper method to calculate item subtotal
    calculateItemSubtotal(item) {
        const price = this.safePrice(item.price, item.name);
        const quantity = parseInt(item.quantity) || 1;
        return price * quantity;
    }

    // Helper method to generate quick action buttons text
    generateQuickActions() {
        return "\n💡 *Quick Actions:*\n" +
               "• Type *menu* - Main menu\n" +
               "• Type *cart* - View cart\n" +
               "• Type *help* - Get help";
    }

    // Helper method to generate cart empty message with context
    generateEmptyCartMessage(context = 'general') {
        let msg = "🛒 *YOUR CART IS EMPTY*\n\n";
        
        switch (context) {
            case 'checkout':
                msg += "Please add items to your cart before checkout:\n\n";
                break;
            case 'view':
                msg += "Ready to start shopping?\n\n";
                break;
            default:
                msg += "Your cart is currently empty.\n\n";
        }
        
        msg += "• Type *catalog* to browse all products\n";
        msg += "• Type *quick* for popular items\n";
        msg += "• Type *menu* to return to main menu";
        
        return msg;
    }
}

module.exports = new MessageGenerators();