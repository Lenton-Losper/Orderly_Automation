const messageGenerators = require('../utils/messageGenerators');
const validators = require('../utils/validators');
const sessionManager = require('../utils/sessionManager');
const pdfInvoiceGenerator = require('../utils/pdfInvoiceGenerator'); // Adjust path as needed

class CommandHandler {
    // Main command routing
    async handleCommand(text, session, businessManager, messageData) {
        console.log('COMMAND DEBUG - Input text:', text);
        console.log('COMMAND DEBUG - Current session step:', session.step);
        console.log('COMMAND DEBUG - Session user ID:', session.userId);
        
        if (typeof text !== 'string') {
            console.error('Invalid text parameter type:', typeof text);
            return;
        }

        // Convert to lowercase safely
        const command = text.toLowerCase().trim();
        console.log('COMMAND DEBUG - Processed command:', command);
        
        if (!command) {
            console.log('Empty command after processing');
            return;
        }

        try {
            // CRITICAL: Check if session step is 'registration' BEFORE other commands
            if (session.step === 'registration') {
                console.log('COMMAND DEBUG - Session in registration step, processing registration input');
                return await this.handleRegistrationInput(session, businessManager, text, messageData.userId);
            }

            // CRITICAL: Check if session step is 'checkout' BEFORE other commands
            if (session.step === 'checkout') {
                console.log('COMMAND DEBUG - Processing checkout input');
                return this.handleCheckoutInput(session, text);
            }

            // CRITICAL: Step-specific handlers MUST come before global commands
            if (session.step === 'quick_order' && /^[1-9]$/.test(command)) {
                console.log('COMMAND DEBUG - Processing product selection');
                return this.handleProductSelection(session, command);
            }

            if (session.step === 'menu' && /^[1-9]$/.test(command)) {
                console.log('COMMAND DEBUG - Processing menu selection');
                return this.handleMenuSelection(session, command);
            }

            // Welcome and menu commands
            if (['hi', 'hello', 'start', 'menu', 'main'].includes(command)) {
                console.log('COMMAND DEBUG - Processing welcome/menu command');
                return await this.handleWelcome(session, businessManager, messageData.userId);
            }

            // Registration command
            if (command === 'register') {
                console.log('COMMAND DEBUG - Processing register command');
                return await this.handleRegister(session, businessManager, messageData.userId);
            }

            // PDF testing commands
            if (command === 'test pdf' || command === 'pdf test') {
                console.log('COMMAND DEBUG - Processing PDF test');
                return await this.handlePDFTest(session);
            }

            if (command === 'pdf status' || command === 'pdf check') {
                console.log('COMMAND DEBUG - Processing PDF status check');
                return await this.handlePDFStatus();
            }

            if (command === 'pdf stats' || command === 'invoice stats') {
                console.log('COMMAND DEBUG - Processing PDF statistics');
                return await this.handlePDFStats();
            }

            if (command === 'pdf help') {
                console.log('COMMAND DEBUG - Processing PDF help');
                return this.handlePDFHelp();
            }

            // Main menu options - ONLY when in menu step or global context
            if (['1', 'quick'].includes(command) && (session.step === 'menu' || session.step === 'start')) {
                console.log('COMMAND DEBUG - Processing quick order');
                return this.handleQuickOrder(session);
            }

            // FIXED: Only trigger catalog for non-quick_order steps or when explicitly requested
            if (['catalog', 'catalogue'].includes(command) || (command === '2' && session.step === 'menu')) {
                console.log('COMMAND DEBUG - Processing catalog');
                return this.handleCatalog(session);
            }

            if (['3', 'cart'].includes(command) || command === 'cart') {
                console.log('COMMAND DEBUG - Processing cart');
                return this.handleViewCart(session);
            }

            if (['4', 'help'].includes(command) || command === 'help') {
                console.log('COMMAND DEBUG - Processing help');
                return this.handleHelp();
            }

            // Shopping and checkout commands
            if (command === 'checkout') {
                console.log('COMMAND DEBUG - Processing checkout');
                return this.handleCheckout(session);
            }

            if (command === 'confirm') {
                console.log('COMMAND DEBUG - Processing confirm');
                return await this.handleConfirmOrder(session, businessManager, messageData);
            }

            if (command.startsWith('discount ')) {
                console.log('COMMAND DEBUG - Processing discount');
                return this.handleDiscount(session, command);
            }

            // Default fallback
            console.log('COMMAND DEBUG - No matching command found, using fallback');
            console.log('COMMAND DEBUG - Session step at fallback:', session.step);
            return this.handleUnknownCommand();

        } catch (error) {
            console.error('Error in command handler:', error.message);
            console.error('Error stack:', error.stack);
            return "Sorry, there was an error processing your command. Please try again.";
        }
    }

    // Welcome and menu handlers
    async handleWelcome(session, businessManager, userId) {
        console.log('WELCOME DEBUG - handleWelcome called');
        console.log('WELCOME DEBUG - User ID:', userId);
        console.log('WELCOME DEBUG - Business ID:', session.businessId);
        
        const existingCustomer = await businessManager.getExistingCustomer(session.businessId, userId, session.tenantId);
        console.log('WELCOME DEBUG - Existing customer found:', !!existingCustomer);
        
        if (existingCustomer) {
            session.setExistingCustomer(existingCustomer);
            session.setStep('menu');
            console.log('WELCOME DEBUG - Set step to menu for existing customer');
            return `Welcome back, *${existingCustomer.name}*!\n\nYour account: *${existingCustomer.id}*\n\n` + 
                   messageGenerators.generateMainMenu(session.businessData.profile);
        } else {
            session.setStep('menu');
            console.log('WELCOME DEBUG - Set step to menu for new customer');
            return `Welcome to ${session.businessData.profile.businessName}!\n\nType *register* to create your account or choose from the menu below:\n\n` + 
                   messageGenerators.generateMainMenu(session.businessData.profile);
        }
    }

    async handleRegister(session, businessManager, userId) {
        console.log('REGISTER DEBUG - handleRegister called');
        console.log('REGISTER DEBUG - Current session step:', session.step);
        console.log('REGISTER DEBUG - User ID:', userId);
        console.log('REGISTER DEBUG - Business ID:', session.businessId);
        
        const existingCustomer = await businessManager.getExistingCustomer(session.businessId, userId, session.tenantId);
        console.log('REGISTER DEBUG - Existing customer check result:', !!existingCustomer);
        
        if (existingCustomer) {
            console.log('REGISTER DEBUG - Customer already exists, showing main menu');
            return `You already have an account: *${existingCustomer.id}*\n\nOne account per WhatsApp number is allowed.\n\nChoose an option:\n\n` + 
                   messageGenerators.generateMainMenu(session.businessData.profile);
        } else {
            console.log('REGISTER DEBUG - No existing customer, setting session step to registration');
            console.log('REGISTER DEBUG - Session before setStep:', session.step);
            
            // Check if setStep method exists
            if (typeof session.setStep !== 'function') {
                console.error('REGISTER DEBUG - session.setStep is not a function');
                console.error('REGISTER DEBUG - Session methods:', Object.keys(session));
                return "Session error. Please try again.";
            }
            
            session.setStep('registration');
            console.log('REGISTER DEBUG - Session after setStep:', session.step);
            
            const registrationMessage = messageGenerators.generateRegistrationMessage();
            console.log('REGISTER DEBUG - Registration message generated');
            return registrationMessage;
        }
    }

    // PDF testing and management methods
    async handlePDFTest(session) {
        try {
            console.log('Testing PDF generation...');
            
            const testResult = await pdfInvoiceGenerator.generateTestInvoice(session.businessId);
            
            if (testResult.success) {
                return `**PDF Test Successful!**\n\n` +
                       `File: ${testResult.filename}\n` +
                       `Size: ${testResult.fileSize}\n` +
                       `Invoice: ${testResult.invoiceNumber}\n\n` +
                       `PDF system is working correctly!`;
            } else {
                return `**PDF Test Failed**\n\n` +
                       `Error: ${testResult.error}\n\n` +
                       `Please check the logs for more details.`;
            }
            
        } catch (error) {
            console.error('PDF Test Error:', error);
            return `**PDF Test Error**\n\n` +
                   `${error.message}\n\n` +
                   `Make sure PDFKit is installed: \`npm install pdfkit\``;
        }
    }

    async handlePDFStatus() {
        try {
            const stats = pdfInvoiceGenerator.getInvoiceStats();
            
            return `**PDF System Status**\n\n` +
                   `Directory: invoices/\n` +
                   `Total PDFs: ${stats.totalInvoices}\n` +
                   `Total Size: ${stats.totalSize}\n` +
                   `Average Size: ${stats.averageSize}\n\n` +
                   `Status: ${stats.totalInvoices >= 0 ? 'Operational' : 'Error'}\n\n` +
                   `Type *test pdf* to generate a sample invoice.`;
            
        } catch (error) {
            console.error('PDF Status Error:', error);
            return `**PDF System Error**\n\n` +
                   `Error: ${error.message}\n\n` +
                   `The PDF system may not be properly configured.`;
        }
    }

    async handlePDFStats() {
        try {
            const stats = pdfInvoiceGenerator.getInvoiceStats();
            
            return `**Invoice Statistics**\n\n` +
                   `Total Invoices: ${stats.totalInvoices}\n` +
                   `Total Size: ${stats.totalSize}\n` +
                   `Average Size: ${stats.averageSize}\n` +
                   `Directory: ${stats.directory}\n\n` +
                   `Type *test pdf* to generate a sample invoice.`;
            
        } catch (error) {
            console.error('PDF Stats Error:', error);
            return `Error getting PDF statistics: ${error.message}`;
        }
    }

    handlePDFHelp() {
        return `**PDF Invoice Commands**\n\n` +
               `*test pdf* - Generate a sample invoice\n` +
               `*pdf status* - Check PDF system status\n` +
               `*pdf stats* - View invoice statistics\n` +
               `*pdf help* - Show this help message\n\n` +
               `**Note:** Invoices are automatically generated when you confirm an order.`;
    }

    // Menu navigation handlers
    handleQuickOrder(session) {
        console.log('QUICK ORDER DEBUG - Setting step to quick_order');
        session.setStep('quick_order');
        return messageGenerators.generateProductMenu(session.businessData);
    }

    handleCatalog(session) {
        console.log('CATALOG DEBUG - Generating catalog message');
        return messageGenerators.generateCatalogMessage(session.businessData.profile);
    }

    handleViewCart(session) {
        console.log('CART DEBUG - Generating cart summary');
        return messageGenerators.generateCartSummary(session);
    }

    handleHelp() {
        console.log('HELP DEBUG - Generating help message');
        return messageGenerators.generateHelpMessage();
    }

    // Menu selection handler
    handleMenuSelection(session, command) {
        const num = parseInt(command);
        console.log('MENU SELECTION DEBUG - Processing menu option:', num);
        
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
                return "Invalid menu option. Choose 1-4.";
        }
    }

    // Product selection handler
    handleProductSelection(session, command) {
        const idx = parseInt(command) - 1;
        console.log('PRODUCT SELECTION DEBUG - Product index:', idx);
        
        if (idx >= 0 && idx < session.businessData.productOrder.length) {
            const productKey = session.businessData.productOrder[idx];
            const success = session.addToCart(productKey);
            
            if (success) {
                const product = session.businessData.products[productKey];
                return `Added *${product.name}* to cart.\n\n` + 
                       messageGenerators.generateCartSummary(session);
            } else {
                return "Product not available.";
            }
        } else {
            return "Invalid product number.";
        }
    }

    // Checkout handlers
    handleCheckout(session) {
        console.log('CHECKOUT DEBUG - Processing checkout');
        if (session.cart.length === 0) {
            return "Cart is empty.\n\nType *catalog* to browse all products or *quick* for popular items.";
        }

        if (session.customerInfo.name) {
            return messageGenerators.generateCheckoutConfirmation(session);
        } else {
            session.setStep('checkout');
            return messageGenerators.generateCheckoutMessage(session);
        }
    }

    handleCheckoutInput(session, text) {
        console.log('CHECKOUT INPUT DEBUG - Processing checkout input');
        const customerInfo = validators.parseCustomerInfo(text);
        
        if (customerInfo) {
            session.setCustomerInfo(customerInfo);
            return messageGenerators.generateCheckoutConfirmation(session);
        } else {
            return "Invalid format. Use: name|email|phone|address";
        }
    }

    // FIXED: Updated order confirmation with proper PDF integration
    async handleConfirmOrder(session, businessManager, messageData) {
        console.log('CONFIRM ORDER DEBUG - Processing order confirmation');
        if (!session.customerInfo.name) {
            return "Please provide your info first (name|email|phone|address).";
        }

        if (session.cart.length === 0) {
            return "Cart is empty. Add items before confirming.";
        }

        try {
            const order = session.generateOrder();
            const saved = await businessManager.saveOrder(
                session.businessId, 
                messageData.sender, 
                order, 
                messageData.msgId,
                session.tenantId || 'default' // Include tenantId in order saving
            );

            if (saved) {
                // Increment customer score if they have an account
                if (session.customerAccount) {
                    await businessManager.incrementCustomerScore(session.businessId, session.customerAccount);
                }
                
                // Generate PDF invoice - FIXED METHOD CALL
                console.log('PDF DEBUG - Generating PDF invoice for order');
                
                try {
                    // FIXED: Use the correct method parameters
                    const pdfResult = await pdfInvoiceGenerator.generateInvoice(
                        order,  // Pass the order object
                        session.businessData.profile,  // Pass business profile
                        session.businessId  // Pass business ID
                    );
                    
                    console.log('PDF DEBUG - PDF generation result:', pdfResult);
                    
                    // Generate text confirmation message
                    const textConfirmation = messageGenerators.generateOrderConfirmation(session);
                    
                    if (pdfResult && pdfResult.success) {
                        console.log('PDF generated successfully:', pdfResult.filename);
                        
                        // Send text confirmation first
                        await messageData.whatsappService.sendTextMessage(
                            messageData.userId, 
                            textConfirmation
                        );
                        
                        // Send PDF invoice after a short delay
                        setTimeout(async () => {
                            try {
                                const pdfSent = await messageData.whatsappService.sendDocument(
                                    messageData.userId,
                                    pdfResult.filepath,
                                    pdfResult.filename,
                                    `Invoice ${pdfResult.invoiceNumber}\n\nThank you for your order!`
                                );
                                
                                if (!pdfSent) {
                                    // Fallback - notify about PDF issue
                                    await messageData.whatsappService.sendTextMessage(
                                        messageData.userId,
                                        'There was an issue sending your invoice PDF. Please contact support for a copy.'
                                    );
                                }
                            } catch (sendError) {
                                console.error('Error sending PDF:', sendError);
                                await messageData.whatsappService.sendTextMessage(
                                    messageData.userId,
                                    'Invoice PDF could not be sent. Please contact support for a copy.'
                                );
                            }
                        }, 2000); // 2 second delay
                        
                    } else {
                        console.error('PDF generation failed:', pdfResult?.error || 'Unknown error');
                        
                        // Send text confirmation with PDF error note
                        const fallbackMessage = textConfirmation + 
                            '\n\nInvoice PDF could not be generated. Please contact support for a copy.';
                        
                        await messageData.whatsappService.sendTextMessage(
                            messageData.userId,
                            fallbackMessage
                        );
                    }
                    
                } catch (pdfError) {
                    console.error('PDF generation error:', pdfError);
                    
                    // Send confirmation without PDF
                    const fallbackMessage = messageGenerators.generateOrderConfirmation(session) + 
                        '\n\nInvoice PDF could not be generated. Please contact support for a copy.';
                    
                    await messageData.whatsappService.sendTextMessage(
                        messageData.userId,
                        fallbackMessage
                    );
                }
                
                // Clear the session after successful order
                const sessionKey = `${messageData.userId}_${session.businessId}`;
                sessionManager.deleteSession(sessionKey);
                
                // Return null since we're handling the response sending manually
                return null;
                
            } else {
                return "This message was already processed.";
            }
        } catch (error) {
            console.error('Error confirming order:', error.message);
            console.error('Error stack:', error.stack);
            return "Failed to process your order. Please try again.";
        }
    }

    // Registration input handler
    async handleRegistrationInput(session, businessManager, text, userId) {
        console.log('REGISTRATION DEBUG - Input received:', text);
        console.log('REGISTRATION DEBUG - Text type:', typeof text);
        console.log('REGISTRATION DEBUG - Text length:', text.length);
        console.log('REGISTRATION DEBUG - UserId:', userId);
        console.log('REGISTRATION DEBUG - BusinessId:', session.businessId);
        
        // Check if validators module exists
        if (!validators || typeof validators.parseRegistrationInfo !== 'function') {
            console.error('REGISTRATION DEBUG - validators.parseRegistrationInfo not available');
            return "Registration system error. Please contact support.";
        }
        
        const registrationData = validators.parseRegistrationInfo(text);
        console.log('REGISTRATION DEBUG - Parsed data:', registrationData);
        
        if (registrationData) {
            try {
                console.log('REGISTRATION DEBUG - Attempting to save customer...');
                console.log('REGISTRATION DEBUG - Business ID:', session.businessId);
                console.log('REGISTRATION DEBUG - User ID:', userId);
                console.log('REGISTRATION DEBUG - Registration Data:', JSON.stringify(registrationData, null, 2));
                
                // Check if businessManager.saveCustomer exists
                if (!businessManager || typeof businessManager.saveCustomer !== 'function') {
                    console.error('REGISTRATION DEBUG - businessManager.saveCustomer not available');
                    console.error('REGISTRATION DEBUG - Available methods:', Object.keys(businessManager || {}));
                    return "Registration system error. Please contact support.";
                }
                
                const result = await businessManager.saveCustomer(session.businessId, registrationData, userId, session.tenantId);
                
                console.log('REGISTRATION DEBUG - Save result:', JSON.stringify(result, null, 2));
                console.log('REGISTRATION DEBUG - Result type:', typeof result);
                console.log('REGISTRATION DEBUG - Result success:', result?.success);
                
                if (result && result.success) {
                    console.log('REGISTRATION DEBUG - Success! Account:', result.accountName);
                    
                    // Set customer account info
                    session.customerAccount = result.accountName;
                    session.setCustomerInfo({
                        name: registrationData.name,
                        email: registrationData.email,
                        phone: registrationData.phone,
                        address: registrationData.address
                    });
                    session.setStep('menu');
                    
                    const successMessage = `Account *${result.accountName}* created successfully!\n\nWelcome, *${registrationData.name}*!\n\n` + 
                           messageGenerators.generateMainMenu(session.businessData.profile);
                    
                    console.log('REGISTRATION DEBUG - Success message prepared');
                    return successMessage;
                    
                } else {
                    console.log('REGISTRATION DEBUG - Save failed:', result?.message || 'Unknown error');
                    return `Registration failed: ${result?.message || 'Unknown error'}\n\nPlease try again with a different account name.`;
                }
                
            } catch (error) {
                console.error('REGISTRATION DEBUG - Exception occurred:', error);
                console.error('REGISTRATION DEBUG - Error name:', error.name);
                console.error('REGISTRATION DEBUG - Error message:', error.message);
                console.error('REGISTRATION DEBUG - Error stack:', error.stack);
                
                // Return specific error message based on error type
                if (error.message.includes('permission')) {
                    return "Registration failed: Database permission error. Please contact support.";
                } else if (error.message.includes('network')) {
                    return "Registration failed: Network error. Please check your connection and try again.";
                } else {
                    return `Registration failed: ${error.message}. Please try again or contact support.`;
                }
            }
        } else {
            console.log('REGISTRATION DEBUG - Invalid registration data format');
            console.log('REGISTRATION DEBUG - Expected format: name|email|phone|address|accountName');
            return messageGenerators.generateRegistrationMessage();
        }
    }

    // Discount handler
    handleDiscount(session, command) {
        const code = command.split(' ')[1]?.toUpperCase();
        
        if (!code) {
            return "Please provide a discount code. Example: discount WELCOME10";
        }

        if (session.applyDiscount(code)) {
            return `Discount applied: ${code}\nNew total: N${session.getTotal().toFixed(2)}\n\nType *cart* to view updated cart.`;
        } else {
            return "Invalid discount code. Try: WELCOME10, SAVE20, or FIRSTORDER";
        }
    }

    // Fallback handler
    handleUnknownCommand() {
        console.log('UNKNOWN COMMAND DEBUG - Generating help message as fallback');
        return messageGenerators.generateHelpMessage() + 
               "\n\n*Quick tip:* Type what you're looking for and I'll help you find it!";
    }

    // Additional utility commands
    handleClearCart(session) {
        session.clearCart();
        return "Cart cleared successfully!\n\nType *catalog* to browse products or *quick* for popular items.";
    }

    handleRemoveDiscount(session) {
        session.removeDiscount();
        return `Discount removed.\nNew total: N${session.getTotal().toFixed(2)}\n\nType *cart* to view updated cart.`;
    }

    // Command validation
    isValidCommand(command) {
        const validCommands = [
            'hi', 'hello', 'start', 'menu', 'main',
            'register', 'quick', 'catalog', 'catalogue',
            'cart', 'help', 'checkout', 'confirm',
            'test pdf', 'pdf test', 'pdf status', 'pdf check',
            'pdf stats', 'invoice stats', 'pdf help'
        ];
        return validCommands.includes(command.toLowerCase());
    }

    // Get available commands for current step
    getAvailableCommands(session) {
        const commands = {
            menu: ['quick', 'catalog', 'cart', 'help', 'register', 'test pdf'],
            quick_order: ['cart', 'checkout', 'catalog', 'menu'],
            checkout: ['cart', 'menu', 'confirm'],
            registration: ['menu']
        };
        
        return commands[session.step] || commands.menu;
    }
}

module.exports = new CommandHandler();