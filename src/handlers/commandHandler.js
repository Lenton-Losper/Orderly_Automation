const messageGenerators = require('../utils/messageGenerators');
const validators = require('../utils/validators');
const sessionManager = require('../utils/sessionManager');

class CommandHandler {
    // Main command routing
    async handleCommand(text, session, businessManager, messageData) {
        const command = text.toLowerCase().trim();

        try {
            // Welcome and menu commands
            if (['hi', 'hello', 'start', 'menu', 'main'].includes(command)) {
                return await this.handleWelcome(session, businessManager, messageData.userId);
            }

            // Registration command
            if (command === 'register') {
                return await this.handleRegister(session, businessManager, messageData.userId);
            }

            // Main menu options
            if (['1', 'quick'].includes(command) && session.step === 'menu') {
                return this.handleQuickOrder(session);
            }

            if (['2', 'catalog', 'catalogue'].includes(command)) {
                return this.handleCatalog(session);
            }

            if (['3', 'cart'].includes(command) || command === 'cart') {
                return this.handleViewCart(session);
            }

            if (['4', 'help'].includes(command) || command === 'help') {
                return this.handleHelp();
            }

            // Shopping and checkout commands
            if (command === 'checkout') {
                return this.handleCheckout(session);
            }

            if (command === 'confirm') {
                return await this.handleConfirmOrder(session, businessManager, messageData);
            }

            if (command.startsWith('discount ')) {
                return this.handleDiscount(session, command);
            }

            // Step-specific handlers
            if (session.step === 'registration') {
                return await this.handleRegistrationInput(session, businessManager, text, messageData.userId);
            }

            if (session.step === 'checkout') {
                return this.handleCheckoutInput(session, text);
            }

            if (session.step === 'quick_order' && /^[1-9]$/.test(command)) {
                return this.handleProductSelection(session, command);
            }

            if (session.step === 'menu' && /^[1-9]$/.test(command)) {
                return this.handleMenuSelection(session, command);
            }

            // Default fallback
            return this.handleUnknownCommand();

        } catch (error) {
            console.error('❌ Error in command handler:', error.message);
            return "⚠️ Sorry, there was an error processing your command. Please try again.";
        }
    }

    // Welcome and menu handlers
    async handleWelcome(session, businessManager, userId) {
        const existingCustomer = await businessManager.getExistingCustomer(session.businessId, userId);
        
        if (existingCustomer) {
            session.setExistingCustomer(existingCustomer);
            session.setStep('menu');
            return `🎉 Welcome back, *${existingCustomer.name}*!\n\nYour account: *${existingCustomer.id}*\n\n` + 
                   messageGenerators.generateMainMenu(session.businessData.profile);
        } else {
            session.setStep('menu');
            return `👋 Welcome to ${session.businessData.profile.businessName}!\n\nType *register* to create your account or choose from the menu below:\n\n` + 
                   messageGenerators.generateMainMenu(session.businessData.profile);
        }
    }

    async handleRegister(session, businessManager, userId) {
        const existingCustomer = await businessManager.getExistingCustomer(session.businessId, userId);
        
        if (existingCustomer) {
            return `❌ You already have an account: *${existingCustomer.id}*\n\nOne account per WhatsApp number is allowed.\n\nChoose an option:\n\n` + 
                   messageGenerators.generateMainMenu(session.businessData.profile);
        } else {
            session.setStep('registration');
            return messageGenerators.generateRegistrationMessage();
        }
    }

    // Menu navigation handlers
    handleQuickOrder(session) {
        session.setStep('quick_order');
        return messageGenerators.generateProductMenu(session.businessData);
    }

    handleCatalog(session) {
        return messageGenerators.generateCatalogMessage(session.businessData.profile);
    }

    handleViewCart(session) {
        return messageGenerators.generateCartSummary(session);
    }

    handleHelp() {
        return messageGenerators.generateHelpMessage();
    }

    // Menu selection handler
    handleMenuSelection(session, command) {
        const num = parseInt(command);
        
        switch (num) {
            case 1:
                session.setStep('quick_order');
                return messageGenerators.generateProductMenu(session.businessData);
            case 2:
                return messageGenerators.generateCatalogMessage(session.businessData.profile);
            case 3:
                return messageGenerators.generateCartSummary(session);
            case 4:
                return messageGenerators.generateHelpMessage();
            default:
                return "❌ Invalid menu option. Choose 1-4.";
        }
    }

    // Product selection handler
    handleProductSelection(session, command) {
        const idx = parseInt(command) - 1;
        
        if (idx >= 0 && idx < session.businessData.productOrder.length) {
            const productKey = session.businessData.productOrder[idx];
            const success = session.addToCart(productKey);
            
            if (success) {
                const product = session.businessData.products[productKey];
                return `✅ Added *${product.name}* to cart.\n\n` + 
                       messageGenerators.generateCartSummary(session);
            } else {
                return "❌ Product not available.";
            }
        } else {
            return "❌ Invalid product number.";
        }
    }

    // Checkout handlers
    handleCheckout(session) {
        if (session.cart.length === 0) {
            return "❌ Cart is empty.\n\nType *catalog* to browse all products or *quick* for popular items.";
        }

        if (session.customerInfo.name) {
            return messageGenerators.generateCheckoutConfirmation(session);
        } else {
            session.setStep('checkout');
            return messageGenerators.generateCheckoutMessage();
        }
    }

    handleCheckoutInput(session, text) {
        const customerInfo = validators.parseCustomerInfo(text);
        
        if (customerInfo) {
            session.setCustomerInfo(customerInfo);
            return messageGenerators.generateCheckoutConfirmation(session);
        } else {
            return "❌ Invalid format. Use: name|email|phone|address";
        }
    }

    async handleConfirmOrder(session, businessManager, messageData) {
        if (!session.customerInfo.name) {
            return "❌ Please provide your info first (name|email|phone|address).";
        }

        if (session.cart.length === 0) {
            return "❌ Cart is empty. Add items before confirming.";
        }

        try {
            const order = session.generateOrder();
            const saved = await businessManager.saveOrder(
                session.businessId, 
                messageData.sender, 
                order, 
                messageData.msgId
            );

            if (saved) {
                // Increment customer score if they have an account
                if (session.customerAccount) {
                    await businessManager.incrementCustomerScore(session.businessId, session.customerAccount);
                }
                
                const response = messageGenerators.generateOrderConfirmation(session);
                
                // Clear the session after successful order
                const sessionKey = `${messageData.userId}_${session.businessId}`;
                sessionManager.deleteSession(sessionKey);
                
                return response;
            } else {
                return "⚠️ This message was already processed.";
            }
        } catch (error) {
            console.error('❌ Error confirming order:', error.message);
            return "❌ Failed to process your order. Please try again.";
        }
    }

    // Registration input handler
    async handleRegistrationInput(session, businessManager, text, userId) {
        const registrationData = validators.parseRegistrationInfo(text);
        
        if (registrationData) {
            try {
                const result = await businessManager.saveCustomer(session.businessId, registrationData, userId);
                
                if (result.success) {
                    session.customerAccount = result.accountName;
                    session.setCustomerInfo({
                        name: registrationData.name,
                        email: registrationData.email,
                        phone: registrationData.phone,
                        address: registrationData.address
                    });
                    session.setStep('menu');
                    
                    return `✅ Account *${result.accountName}* created successfully!\n\nWelcome, *${registrationData.name}*!\n\n` + 
                           messageGenerators.generateMainMenu(session.businessData.profile);
                } else {
                    return `❌ Registration failed: ${result.message}\n\nPlease try again with a different account name.`;
                }
            } catch (error) {
                console.error('❌ Error during registration:', error.message);
                return "❌ Registration failed. Please try again.";
            }
        } else {
            return messageGenerators.generateRegistrationMessage();
        }
    }

    // Discount handler
    handleDiscount(session, command) {
        const code = command.split(' ')[1]?.toUpperCase();
        
        if (!code) {
            return "❌ Please provide a discount code. Example: discount WELCOME10";
        }

        if (session.applyDiscount(code)) {
            return `🎉 Discount applied: ${code}\nNew total: N$${session.getTotal().toFixed(2)}\n\nType *cart* to view updated cart.`;
        } else {
            return "❌ Invalid discount code. Try: WELCOME10, SAVE20, or FIRSTORDER";
        }
    }

    // Fallback handler
    handleUnknownCommand() {
        return messageGenerators.generateHelpMessage() + 
               "\n\n💡 *Quick tip:* Type what you're looking for and I'll help you find it!";
    }

    // Additional utility commands
    handleClearCart(session) {
        session.clearCart();
        return "🗑️ Cart cleared successfully!\n\nType *catalog* to browse products or *quick* for popular items.";
    }

    handleRemoveDiscount(session) {
        session.removeDiscount();
        return `✅ Discount removed.\nNew total: N$${session.getTotal().toFixed(2)}\n\nType *cart* to view updated cart.`;
    }

    // Command validation
    isValidCommand(command) {
        const validCommands = [
            'hi', 'hello', 'start', 'menu', 'main',
            'register', 'quick', 'catalog', 'catalogue',
            'cart', 'help', 'checkout', 'confirm'
        ];
        return validCommands.includes(command.toLowerCase());
    }

    // Get available commands for current step
    getAvailableCommands(session) {
        const commands = {
            menu: ['quick', 'catalog', 'cart', 'help', 'register'],
            quick_order: ['cart', 'checkout', 'catalog', 'menu'],
            checkout: ['cart', 'menu', 'confirm'],
            registration: ['menu']
        };
        
        return commands[session.step] || commands.menu;
    }
}

module.exports = new CommandHandler();