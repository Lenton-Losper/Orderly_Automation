/**
 * MVP: Intent Classification Service for WhatsApp Bot
 * Fast implementation using Python microservice
 */

const { spawn } = require('child_process');
const path = require('path');
const ProductService = require('./productService');
const ExplicitResponseService = require('./explicitResponseService');
const ExplicitOrderHandlers = require('./explicitOrderHandlers');

class IntentClassificationService {
    constructor() {
        this.classifyScriptPath = path.join(process.cwd(), 'classify.py');
        this.cache = new Map(); // Simple in-memory cache
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
        this.productService = new ProductService();
        this.explicitService = new ExplicitResponseService();
        this.orderHandlers = new ExplicitOrderHandlers();
        this.whatsappService = null; // Will be set by the message handler
    }

    /**
     * Classify a message using the trained sklearn model
     * @param {string} message - The message to classify
     * @param {string} tenantId - The tenant ID
     * @returns {Promise<Object>} Classification result
     */
    async classifyMessage(message, tenantId) {
        try {
            // Check cache first
            const cacheKey = `${tenantId}:${message.toLowerCase()}`;
            const cached = this.cache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
                console.log(`🎯 Using cached classification for: "${message}"`);
                return cached.result;
            }

            console.log(`🤖 Classifying message: "${message}" for tenant: ${tenantId}`);
            
            // Call Python script
            const result = await this.callPythonClassifier(message, tenantId);
            
            // Cache the result
            this.cache.set(cacheKey, {
                result,
                timestamp: Date.now()
            });

            return result;
        } catch (error) {
            console.error('❌ Classification error:', error);
            return {
                success: false,
                error: error.message,
                intent: 'fallback',
                confidence: 0.0
            };
        }
    }

    /**
     * Call Python classification script
     * @param {string} message - Message to classify
     * @param {string} tenantId - Tenant ID
     * @returns {Promise<Object>} Classification result
     */
    callPythonClassifier(message, tenantId) {
        return new Promise((resolve, reject) => {
            const python = spawn('python', [
                this.classifyScriptPath,
                tenantId,
                message
            ]);

            let stdout = '';
            let stderr = '';

            python.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            python.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            python.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Python script failed with code ${code}: ${stderr}`));
                    return;
                }

                try {
                    const result = JSON.parse(stdout);
                    console.log(`✅ Classification result:`, result);
                    resolve(result);
                } catch (parseError) {
                    reject(new Error(`Failed to parse Python output: ${stdout}`));
                }
            });

            python.on('error', (error) => {
                reject(new Error(`Failed to start Python process: ${error.message}`));
            });
        });
    }

    /**
     * Get business name for tenant
     * @param {string} tenantId - Tenant ID
     * @returns {Promise<string>} Business name
     */
    async getBusinessName(tenantId) {
        try {
            // Get business data from businessManager
            const businessManager = require('./businessManager');
            const businessData = await businessManager.getBusinessData('264813141453'); // Bot's business ID
            return businessData?.businessName || businessData?.name || 'LLL Farming';
        } catch (error) {
            console.error('❌ Error fetching business name:', error);
            return 'LLL Farming'; // Fallback to default
        }
    }

    /**
     * Get response for classified intent (now dynamic for product inquiries)
     * @param {string} intent - The classified intent
     * @param {number} confidence - Confidence score
     * @param {string} tenantId - Tenant ID (for business name)
     * @param {string} originalMessage - Original user message (for context)
     * @returns {Promise<string>} Response message
     */
    async getResponseForIntent(intent, confidence, tenantId = '7dx8fLr4OdAPsSDAoTRl', originalMessage = '') {
        // Use fallback if confidence is too low (lowered threshold for MVP)
        if (confidence < 0.2) {
            console.log(`⚠️ Low confidence (${confidence}), using fallback response`);
            return "I'm not sure I understood. Could you rephrase that?";
        }

        // Handle dynamic responses
        switch (intent) {
            case 'greet':
                const businessName = await this.getBusinessName(tenantId);
                return `Hello! 👋 Welcome to ${businessName}. How can I help you today?`;
            
            case 'bye':
                const goodbyeBusinessName = await this.getBusinessName(tenantId);
                return `Thank you for contacting ${goodbyeBusinessName}! Have a great day! 🙏`;
            
            case 'product_inquiry':
                return await this.handleProductInquiry(tenantId, originalMessage);
            
            case 'order':
                return await this.handleOrderIntent(tenantId, originalMessage);
            
            case 'pricing':
                return await this.handlePricingIntent(tenantId, originalMessage);
            
            case 'availability':
                return await this.handleAvailabilityIntent(tenantId, originalMessage);
            
            default:
                return "I'm not sure I understood. Could you rephrase that?";
        }
    }

    /**
     * Handle product inquiry with dynamic product data
     * @param {string} tenantId - The tenant ID
     * @param {string} originalMessage - Original user message
     * @returns {Promise<string>} Dynamic product response
     */
    async handleProductInquiry(tenantId, originalMessage) {
        try {
            console.log(`🛒 Handling product inquiry for tenant: ${tenantId}`);
            
            const products = await this.productService.getProductsForTenant(tenantId, true);
            return this.productService.formatProductsForWhatsApp(products);
            
        } catch (error) {
            console.error('❌ Error handling product inquiry:', error);
            return "We're updating our product list. Please check back soon or contact us directly!";
        }
    }

    /**
     * Handle order intent
     * @param {string} tenantId - The tenant ID
     * @param {string} originalMessage - Original user message
     * @returns {Promise<string>} Order response
     */
    async handleOrderIntent(tenantId, originalMessage) {
        try {
            console.log(`🛍️ Handling order intent for tenant: ${tenantId}`);
            
            // If they just said "yes", guide them to specify what they want
            const lowerMessage = originalMessage.toLowerCase();
            if (lowerMessage === 'yes' || lowerMessage === 'y' || lowerMessage === 'yeah') {
                return "Great! I'd be happy to help you place an order. Please let me know which specific product you'd like to order. You can say something like:\n\n• \"I want test product 1\"\n• \"I'd like to order yes\"\n• \"I want to buy test product 2\"\n\nWhat would you like to order?";
            }
            
            // For other order requests, show products and guide them
            return "I can help you place an order! Here's what we have available:\n\n" + 
                   await this.handleProductInquiry(tenantId, originalMessage) +
                   "\n\nPlease let me know which specific product you'd like to order!";
            
        } catch (error) {
            console.error('❌ Error handling order intent:', error);
            return "I can help you place an order! What would you like to order?";
        }
    }

    /**
     * Handle pricing intent
     * @param {string} tenantId - The tenant ID
     * @param {string} originalMessage - Original user message
     * @returns {Promise<string>} Pricing response
     */
    async handlePricingIntent(tenantId, originalMessage) {
        try {
            console.log(`💰 Handling pricing intent for tenant: ${tenantId}`);
            
            // Extract product name from message
            const productName = this.extractProductName(originalMessage);
            
            if (productName) {
                return await this.productService.getProductPrice(tenantId, productName);
            } else {
                return "Which product would you like to know the price for?";
            }
            
        } catch (error) {
            console.error('❌ Error handling pricing intent:', error);
            return "I can help you with pricing! Which product are you interested in?";
        }
    }

    /**
     * Handle availability intent
     * @param {string} tenantId - The tenant ID
     * @param {string} originalMessage - Original user message
     * @returns {Promise<string>} Availability response
     */
    async handleAvailabilityIntent(tenantId, originalMessage) {
        try {
            console.log(`📦 Handling availability intent for tenant: ${tenantId}`);
            
            // Extract product name from message
            const productName = this.extractProductName(originalMessage);
            
            if (productName) {
                return await this.productService.getProductAvailability(tenantId, productName);
            } else {
                return "Which product's availability would you like to check?";
            }
            
        } catch (error) {
            console.error('❌ Error handling availability intent:', error);
            return "I can check product availability for you! Which product are you looking for?";
        }
    }

    /**
     * Extract product name from user message
     * @param {string} message - User message
     * @returns {string|null} Extracted product name
     */
    extractProductName(message) {
        // Simple extraction - look for words after common patterns
        const patterns = [
            /price of (.+)/i,
            /cost of (.+)/i,
            /how much is (.+)/i,
            /is (.+) available/i,
            /do you have (.+)/i,
            /(.+) price/i,
            /(.+) cost/i
        ];

        for (const pattern of patterns) {
            const match = message.match(pattern);
            if (match && match[1]) {
                return match[1].trim();
            }
        }

        return null;
    }

    /**
     * Process a WhatsApp message and return appropriate response
     * @param {string} message - Incoming message
     * @param {string} tenantId - Tenant ID
     * @param {string} userId - User ID (phone number)
     * @returns {Promise<string>} Response message
     */
    async processMessage(message, tenantId, userId = null) {
        try {
            console.log(`🤖 Processing message: "${message}" for tenant: ${tenantId}, user: ${userId}`);
            
            // Check if user has an active expectation
            const expectation = this.explicitService.getUserExpectation(userId);
            
            if (expectation) {
                console.log(`📊 User has active expectation: ${expectation.expecting}`);
                
                // Handle based on expectation
                switch(expectation.expecting) {
                    case 'order_confirmation':
                        return await this.orderHandlers.handleOrderConfirmation(message, tenantId, userId, this.explicitService);
                    
                    case 'product_selection':
                        return await this.orderHandlers.handleProductSelection(message, tenantId, userId, this.explicitService);
                    
                    case 'quantity_input':
                        return await this.orderHandlers.handleQuantityInput(message, tenantId, userId, this.explicitService);
                    
                    case 'continue_shopping':
                        return await this.orderHandlers.handleContinueShopping(message, userId, tenantId, this.explicitService);
                    
                    case 'delivery_method':
                        return await this.orderHandlers.handleDeliveryMethod(message, userId, tenantId, this.explicitService);
                    
                    case 'delivery_address':
                        return await this.orderHandlers.handleDeliveryAddress(message, userId, tenantId, this.explicitService);
                    
                    case 'final_confirmation':
                        return await this.orderHandlers.processFinalConfirmation(message, tenantId, userId, this.explicitService, this.whatsappService);
                    
                    default:
                        console.log(`⚠️ Unknown expectation: ${expectation.expecting}, clearing`);
                        this.explicitService.clearUserExpectation(userId);
                        break;
                }
            }
            
            // No active expectation - handle as normal intent
            const lowerMessage = message.toLowerCase();
            
            // Handle greetings
            if (lowerMessage.includes('hi') || lowerMessage.includes('hello') || 
                lowerMessage.includes('hey') || lowerMessage.includes('good morning') ||
                lowerMessage.includes('good afternoon') || lowerMessage.includes('good evening')) {
                const businessName = await this.getBusinessName(tenantId);
                return `Hello! 👋 Welcome to ${businessName}. How can I help you today?`;
            }
            
            // Handle goodbyes
            if (lowerMessage.includes('bye') || lowerMessage.includes('goodbye') || 
                lowerMessage.includes('see you') || lowerMessage.includes('talk to you later') ||
                lowerMessage.includes('take care')) {
                const businessName = await this.getBusinessName(tenantId);
                return `Thank you for contacting ${businessName}! Have a great day! 🙏`;
            }
            
            // Handle product inquiries
            if (lowerMessage.includes('product') || lowerMessage.includes('sell') || 
                lowerMessage.includes('what do you') || lowerMessage.includes('menu') ||
                lowerMessage.includes('price') || lowerMessage.includes('meat') ||
                lowerMessage.includes('available') || lowerMessage.includes('whats available')) {
                
                // Set expectation for order confirmation
                this.explicitService.setUserExpectation(userId, 'order_confirmation');
                
                return await this.orderHandlers.handleProductInquiry(tenantId);
            }
            
            // Handle explicit "products" command
            if (lowerMessage === 'products' || lowerMessage === 'catalog' || lowerMessage === 'menu') {
                this.explicitService.setUserExpectation(userId, 'order_confirmation');
                return await this.orderHandlers.handleProductInquiry(tenantId);
            }
            
            // Handle cart commands
            if (lowerMessage === 'cart') {
                return this.explicitService.getCartSummary(userId);
            }
            
            if (lowerMessage === 'clear cart' || lowerMessage === 'empty cart') {
                this.explicitService.clearUserCart(userId);
                this.explicitService.clearUserExpectation(userId);
                return "Your cart has been cleared! 🗑️\n\nType *PRODUCTS* to start fresh.";
            }
            
            // Default fallback
            return "I'm not sure I understood. Could you rephrase that?\n\n" +
                   "You can ask about our *PRODUCTS* or say *HI* to start over! 😊";
            
        } catch (error) {
            console.error('❌ Message processing error:', error);
            return "I'm having trouble processing your message. Please try again.";
        }
    }

    /**
     * Set the WhatsApp service for PDF sending
     */
    setWhatsAppService(whatsappService) {
        this.whatsappService = whatsappService;
    }

    /**
     * Clear cache (useful for testing)
     */
    clearCache() {
        this.cache.clear();
        console.log('🧹 Classification cache cleared');
    }
}

module.exports = IntentClassificationService;
