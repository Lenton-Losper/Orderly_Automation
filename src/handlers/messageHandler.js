const { generateMainMenu, generateCatalogMessage, generateProductMenu, generateCartSummary, generateHelpMessage, generateOrderSummary, generateRegistrationForm } = require('../utils/messageGenerators');
const { processCustomerInfo, processRegistrationInfo } = require('../utils/helpers');
const { checkExistingCustomer, saveCustomerToFirebase, incrementCustomerScore, logOrderToFirebase } = require('../services/firebase');
const { handlePDFGeneration } = require('../services/pdf');
const { PRODUCT_ORDER, PRODUCTS } = require('../config/products');
const OrderSession = require('../models/OrderSession');

class MessageHandler {
    constructor() {
        this.userSessions = new Map();
    }

    async handleMessage(msg, sock) {
        const sender = msg.pushName || 'Customer';
        const userId = msg.key.remoteJid;
        const msgId = msg.key.id;
        const text = (
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            ''
        ).trim().toLowerCase();

        if (!text) return;

        // Check if message was already processed
        const existing = await logOrderToFirebase.checkExisting(msgId);
        if (existing) return;

        let session = this.userSessions.get(userId);
        if (!session) {
            session = new OrderSession(userId);
            this.userSessions.set(userId, session);
        }

        const response = await this.processMessage(text, session, sender, msgId, userId, sock);
        
        if (response) {
            await sock.sendMessage(userId, { text: response });
        }
    }

    async processMessage(text, session, sender, msgId, userId, sock) {
        // Greeting messages
        if (['hi', 'hello', 'start'].includes(text)) {
            return await this.handleGreeting(session, userId);
        }

        // Registration
        if (text === 'register') {
            return await this.handleRegistration(session, userId);
        }

        // Order confirmation
        if (text === 'confirm') {
            return await this.handleOrderConfirmation(session, sender, msgId, userId, sock);
        }

        // Registration step
        if (session.step === 'registration') {
            return await this.handleRegistrationStep(session, text, userId);
        }

        // Checkout process
        if (session.step === 'checkout' || text === 'checkout') {
            return this.handleCheckout(session);
        }

        // Discount codes
        if (text.startsWith('discount ')) {
            return this.handleDiscountCode(session, text);
        }

        // Product selection in quick order
        if (/^[1-9]$/.test(text) && session.step === 'quick_order') {
            return this.handleProductSelection(session, text);
        }

        // Main menu navigation
        if (/^[1-9]$/.test(text) && session.step === 'menu') {
            return this.handleMenuNavigation(session, text);
        }

        // Direct commands
        return this.handleDirectCommands(session, text);
    }

    async handleGreeting(session, userId) {
        const existingCustomer = await checkExistingCustomer(userId);
        if (existingCustomer) {
            session.existingCustomer = existingCustomer;
            session.customerAccount = existingCustomer.id;
            session.customerInfo = {
                name: existingCustomer.name,
                email: existingCustomer.email,
                phone: existingCustomer.phone,
                address: existingCustomer.address
            };
            session.step = 'menu';
            return `🎉 Welcome back, *${existingCustomer.name}*!\n\nYour account: *${existingCustomer.id}*\n\n` + generateMainMenu();
        } else {
            return `👋 Welcome to LLL Farm!\n\nType *register* to create your account or choose from the menu below:\n\n` + generateMainMenu();
        }
    }

    async handleRegistration(session, userId) {
        const existingCustomer = await checkExistingCustomer(userId);
        if (existingCustomer) {
            return `❌ You already have an account: *${existingCustomer.id}*\n\nOne account per WhatsApp number is allowed.\n\nChoose an option:\n\n` + generateMainMenu();
        } else {
            session.step = 'registration';
            return `📝 Please enter your details in the **Registration Form**:\n\n` + generateRegistrationForm();
        }
    }

    async handleOrderConfirmation(session, sender, msgId, userId, sock) {
        if (!session.customerInfo.name) {
            return "❌ Please provide your info first (name|email|phone|address).";
        }

        const order = {
            customerInfo: session.customerInfo,
            items: session.cart,
            discountCode: session.discountCode,
            total: session.getTotal(),
            status: 'pending',
            accountName: session.customerAccount
        };

        const logged = await logOrderToFirebase(sender, order, msgId);
        if (logged) {
            if (session.customerAccount) {
                await incrementCustomerScore(session.customerAccount);
            }

            // Generate PDF receipt
            const pdfSent = await handlePDFGeneration(session, userId, sock);

            const response = `✅ Order confirmed for *${session.customerInfo.name}*!\n\nOrder Total: *N${session.getTotal().toFixed(2)}*\n\n` +
                           `${pdfSent ? '📄 PDF receipt sent above - you can print it for your records!\n\n' : ''}` +
                           `We'll be in touch soon. Thank you for your order! 🙏\n\nType *start* to place another order.`;

            this.userSessions.delete(userId);
            return response;
        } else {
            return "⚠️ This message was already processed.";
        }
    }

    async handleRegistrationStep(session, text, userId) {
        const regInfo = processRegistrationInfo(text);
        if (regInfo) {
            const result = await saveCustomerToFirebase(regInfo, userId);
            if (result.success) {
                session.customerAccount = result.accountName;
                session.customerInfo = {
                    name: regInfo.name,
                    email: regInfo.email,
                    phone: regInfo.phone,
                    address: regInfo.address
                };
                session.step = 'menu';
                return `✅ Account *${result.accountName}* created successfully!\n\nWelcome, *${regInfo.name}*!\n\n` + generateMainMenu();
            } else {
                return `❌ Registration failed: ${result.message}\n\nPlease try again with a different account name.`;
            }
        } else {
            return "❌ Invalid format. Please use:\n*name|email|phone|address|accountName*";
        }
    }

    handleCheckout(session) {
        if (session.cart.length === 0) {
            return "❌ Cart is empty.\n\nType *catalog* to browse all products or *quick* for popular items.";
        }

        if (session.customerInfo.name) {
            return `📋 *CHECKOUT CONFIRMATION*\n\n` + generateOrderSummary(session) + `\n👤 *CUSTOMER DETAILS*\n` +
                   `Name: ${session.customerInfo.name}\n` +
                   `Phone: ${session.customerInfo.phone}\n` +
                   `Address: ${session.customerInfo.address}\n\n` +
                   `Type *confirm* to place your order or *cart* to modify items.`;
        } else {
            session.step = 'checkout';
            return "📝 Please provide your info:\n*name|email|phone|address*";
        }
    }

    handleDiscountCode(session, text) {
        const code = text.split(' ')[1].toUpperCase();
        if (session.applyDiscount(code)) {
            return `🎉 Discount applied: ${code}\nNew total: N${session.getTotal().toFixed(2)}`;
        } else {
            return "❌ Invalid discount code.";
        }
    }

    handleProductSelection(session, text) {
        const idx = parseInt(text) - 1;
        if (idx >= 0 && idx < PRODUCT_ORDER.length) {
            const key = PRODUCT_ORDER[idx];
            session.addToCart(key);
            return `✅ Added *${PRODUCTS[key].name}* to cart.\n\n` + generateCartSummary(session);
        } else {
            return "❌ Invalid product number.";
        }
    }

    handleMenuNavigation(session, text) {
        const num = parseInt(text);
        switch (num) {
            case 1:
                session.step = 'quick_order';
                return generateProductMenu();
            case 2:
                return generateCatalogMessage();
            case 3:
                return generateCartSummary(session);
            case 4:
                return generateHelpMessage();
            default:
                return "❌ Invalid menu option. Choose 1-4.";
        }
    }

    handleDirectCommands(session, text) {
        switch (text) {
            case 'catalog':
            case 'catalogue':
                return generateCatalogMessage();
            case 'cart':
                return generateCartSummary(session);
            case 'help':
                return generateHelpMessage();
            case 'yes':
                if (session.existingCustomer) {
                    return `You're already logged in! Choose an option:\n\n` + generateMainMenu();
                }
                break;
            case 'quick':
                session.step = 'quick_order';
                return generateProductMenu();
            case 'menu':
                session.step = 'menu';
                return generateMainMenu();
        }

        // Handle customer info input during checkout
        if (session.step === 'checkout' && text.includes('|')) {
            if (processCustomerInfo(session, text)) {
                return `📋 *CHECKOUT CONFIRMATION*\n\n` + generateOrderSummary(session) + `\n👤 *CUSTOMER DETAILS*\n` +
                       `Name: ${session.customerInfo.name}\n` +
                       `Phone: ${session.customerInfo.phone}\n` +
                       `Address: ${session.customerInfo.address}\n\n` +
                       `Type *confirm* to place your order or *cart* to modify items.`;
            } else {
                return "❌ Invalid format. Please use:\n*name|email|phone|address*";
            }
        }

        // Default response
        return "🤖 I didn't understand that.\n\nType:\n• *catalog* - View full product catalog\n• *quick* - Quick order popular items\n• *cart* - View cart\n• *help* - Get help\n• *register* - Create account\n• *start* - Main menu";
    }

    getSession(userId) {
        return this.userSessions.get(userId);
    }

    createSession(userId) {
        const session = new OrderSession(userId);
        this.userSessions.set(userId, session);
        return session;
    }

    deleteSession(userId) {
        this.userSessions.delete(userId);
    }
}

module.exports = MessageHandler;