const { OWNER_NUMBER, RATE_LIMIT_CONFIG } = require('../config/constants');
const OrderSession = require('../models/OrderSession');
const sessionManager = require('../utils/sessionManager');
const messageGenerators = require('../utils/messageGenerators');
const commandHandler = require('./commandHandler');
const businessManager = require('../services/businessManager');

class MessageHandler {
    constructor(whatsappService, middleware) {
        this.whatsappService = whatsappService;
        this.rateLimiter = middleware.rateLimiter;
        this.duplicateChecker = middleware.duplicateChecker;
        this.securityMonitor = middleware.securityMonitor;
        this.logger = middleware.logger;
        
        // Simple in-memory session storage to fix persistence issue
        this.sessions = new Map();
        
        // Business data cache for products
        this.businessDataCache = new Map();
    }

    // Get or create session with persistence
    getOrCreateSession(userId, businessId, businessData) {
        const sessionKey = `${userId}_${businessId}`;
        console.log('🔍 SESSION DEBUG - Looking for session:', sessionKey);
        
        let session = this.sessions.get(sessionKey);
        console.log('🔍 SESSION DEBUG - Existing session found:', !!session);
        console.log('🔍 SESSION DEBUG - Session step before:', session?.step);
        
        if (!session) {
            console.log('🔍 SESSION DEBUG - Creating new session');
            session = { 
                userId, 
                businessId, 
                businessData: businessData,  
                step: 'start', 
                data: {},
                cart: [],
                customerInfo: {},
                customerAccount: null,
                discountCode: null,
                discountAmount: 0,
                
                // Required methods with debug logging
                setStep: function(step) { 
                    console.log('🔍 SESSION DEBUG - Setting step from', this.step, 'to', step);
                    this.step = step; 
                    console.log('🔍 SESSION DEBUG - Step now set to:', this.step);
                },
                getData: function(key) { return this.data[key]; },
                setData: function(key, value) { this.data[key] = value; },
                clearData: function() { this.data = {}; },
                
                // Customer methods
                setCustomerInfo: function(info) { this.customerInfo = info; },
                setExistingCustomer: function(customer) { 
                    this.customerAccount = customer.id;
                    this.customerInfo = {
                        name: customer.name,
                        email: customer.email,
                        phone: customer.phone,
                        address: customer.address
                    };
                },
                
                // Cart methods
                addToCart: function(productKey) {
                    if (this.businessData.products[productKey]) {
                        this.cart.push({
                            key: productKey,
                            product: this.businessData.products[productKey],
                            quantity: 1
                        });
                        return true;
                    }
                    return false;
                },
                
                clearCart: function() { this.cart = []; },
                
                // Discount methods
                applyDiscount: function(code) {
                    const discounts = {
                        'WELCOME10': 0.10,
                        'SAVE20': 0.20,
                        'FIRSTORDER': 0.15
                    };
                    if (discounts[code]) {
                        this.discountCode = code;
                        this.discountAmount = discounts[code];
                        return true;
                    }
                    return false;
                },
                
                removeDiscount: function() {
                    this.discountCode = null;
                    this.discountAmount = 0;
                },
                
                // Total calculation
                getTotal: function() {
                    let total = this.cart.reduce((sum, item) => {
                        return sum + (item.product.price * item.quantity);
                    }, 0);
                    
                    if (this.discountAmount > 0) {
                        total = total * (1 - this.discountAmount);
                    }
                    
                    return total;
                },
                
                // Order generation
                generateOrder: function() {
                    return {
                        items: this.cart,
                        customerInfo: this.customerInfo,
                        total: this.getTotal(),
                        discountCode: this.discountCode,
                        discountAmount: this.discountAmount,
                        timestamp: Date.now()
                    };
                }
            };
            
            // Store the session
            this.sessions.set(sessionKey, session);
            console.log(`✅ NEW Session created and stored: ${sessionKey}`);
        } else {
            console.log(`✅ EXISTING Session retrieved: ${sessionKey}`);
            console.log('🔍 SESSION DEBUG - Existing session step:', session.step);
        }
        
        // Ensure session has business data
        if (!session.businessData) {
            session.businessData = businessData;
            console.log(`🔧 Added business data to session`);
        }
        
        console.log('🔍 SESSION DEBUG - Final session step:', session.step);
        return session;
    }

    // Load products asynchronously from Firebase
    async loadProductsAsync(businessId) {
        try {
            console.log('🔍 Loading products asynchronously for business:', businessId);
            
            // Import Firebase Admin
            const admin = require('firebase-admin');
            const db = admin.firestore();
            
            // Load products from the vendors/{businessId}/products subcollection
            const productsRef = await db.collection('vendors')
                .doc(businessId)
                .collection('products')
                .where('isAvailable', '==', true)
                .get();
                
            const products = {};
            productsRef.forEach(doc => {
                const productData = doc.data();
                products[doc.id] = {
                    name: productData.name,
                    price: productData.price,
                    description: productData.description || 'No description',
                    category: productData.category || 'General',
                    stock: productData.stock || 0,
                    isAvailable: productData.isAvailable
                };
            });
            
            console.log('✅ Async loaded', Object.keys(products).length, 'products from Firebase');
            return products;
            
        } catch (error) {
            console.error('❌ Error loading products async:', error);
            return {};
        }
    }

    // Helper method to normalize different business data structures
    async normalizeBusinessData(rawData, businessId) {
        console.log('🔧 Normalizing business data structure...');
        
        // Handle different possible structures
        let profile = {};
        let products = {};
        let productOrder = [];
        
        // Extract profile information from various possible structures
        if (rawData.profile) {
            profile = rawData.profile;
        } else if (rawData.businessProfile) {
            profile = rawData.businessProfile;
        } else if (rawData.vendor) {
            profile = rawData.vendor;
        } else if (rawData.business) {
            profile = rawData.business;
        } else {
            // Try to construct profile from top-level properties
            profile = {
                businessName: rawData.businessName || rawData.name || rawData.companyName || 'LLL Farm Bot',
                contactInfo: rawData.contactInfo || rawData.contact || rawData.phone || 'Contact us for more information',
                catalogUrl: rawData.catalogUrl || rawData.catalog || null,
                description: rawData.description || rawData.about || null,
                address: rawData.address || null,
                email: rawData.email || null,
                phone: rawData.phone || null
            };
        }
        
        // Ensure required profile fields exist
        if (!profile.businessName) {
            profile.businessName = 'LLL Farm Bot';
        }
        if (!profile.contactInfo) {
            profile.contactInfo = 'Contact us for more information';
        }
        
        // Extract products information
        if (rawData.products) {
            products = rawData.products;
            console.log('🔍 Found products in vendor profile:', Object.keys(products).length);
        } else if (rawData.inventory) {
            products = rawData.inventory;
            console.log('🔍 Found products in inventory:', Object.keys(products).length);
        } else if (rawData.items) {
            products = rawData.items;
            console.log('🔍 Found products in items:', Object.keys(products).length);
        } else {
            // LOAD PRODUCTS FROM FIREBASE
            console.log('🔍 Products not found in vendor profile, loading from Firebase...');
            try {
                const admin = require('firebase-admin');
                const db = admin.firestore();
                
                const productsRef = await db.collection('vendors')
                    .doc(businessId)
                    .collection('products')
                    .where('isAvailable', '==', true)
                    .get();
                    
                productsRef.forEach(doc => {
                    const productData = doc.data();
                    products[doc.id] = {
                        name: productData.name,
                        price: productData.price,
                        description: productData.description || 'No description',
                        category: productData.category || 'General',
                        stock: productData.stock || 0
                    };
                });
                
                console.log('✅ Loaded', Object.keys(products).length, 'products from Firebase');
            } catch (error) {
                console.error('❌ Error loading products:', error);
            }
        }
        
        // Extract product order
        if (rawData.productOrder) {
            productOrder = rawData.productOrder;
        } else if (rawData.menuOrder) {
            productOrder = rawData.menuOrder;
        } else if (products && Object.keys(products).length > 0) {
            // Generate product order from products
            productOrder = Object.keys(products);
        }
        
        const normalizedData = {
            profile,
            products,
            productOrder,
            businessId
        };
        
        console.log('✅ Business data normalized:', {
            businessName: profile.businessName,
            productCount: Object.keys(products).length,
            productOrderCount: productOrder.length
        });
        
        return normalizedData;
    }

    // Helper method to create default business data
    createDefaultBusinessData() {
        return {
            profile: {
                businessName: 'LLL Farm Bot',
                contactInfo: 'Welcome to our service! Contact us for more information.',
                catalogUrl: null,
                description: 'Your trusted agricultural partner',
                address: null,
                email: null,
                phone: null
            },
            products: {
                'sample1': {
                    name: 'Sample Product',
                    price: 10.00,
                    description: 'Sample product for demonstration',
                    category: 'General'
                }
            },
            productOrder: ['sample1'],
            businessId: 'default'
        };
    }

    async handleMessage({ messages, type }) {
        // Only process new messages
        if (type !== 'notify') {
            console.log(`🚫 Ignoring message type: ${type}`);
            return;
        }
        
        const msg = messages[0];
        if (!msg || !msg.message) {
            console.log('🚫 Ignoring message: no content');
            return;
        }

        // Extract message details
        const messageContent = msg.message.conversation || 
                             msg.message.extendedTextMessage?.text || '';
        const sender = msg.pushName || 'Customer';
        const userId = msg.key.remoteJid;
        const msgId = msg.key.id;
        const phoneNumber = userId.split('@')[0];
        
        // Get bot's phone number to determine which business this is
        const botPhoneNumber = this.whatsappService.getBotPhoneNumber ? 
                             this.whatsappService.getBotPhoneNumber() : 
                             this.whatsappService.user?.id;
        
        console.log(`📩 Raw message received: {
  hasMessage: ${!!msg.message},
  fromMe: ${msg.key.fromMe},
  remoteJid: '${userId}',
  pushName: '${sender}',
  messageKeys: ${JSON.stringify(Object.keys(msg.message))},
  botNumber: '${botPhoneNumber}'
}`);

        // Skip messages from owner
        if (userId === OWNER_NUMBER) {
            console.log('👑 Ignoring message from owner');
            return;
        }

        // Skip messages from bot itself
        if (msg.key.fromMe) {
            console.log('🤖 Ignoring message from bot itself');
            return;
        }

        try {
            // Get business ID from bot phone number
            let businessId;
            if (businessManager.getBusinessIdFromBot) {
                businessId = await businessManager.getBusinessIdFromBot(botPhoneNumber);
            } else {
                businessId = businessManager.getBusinessId(phoneNumber);
            }
            
            console.log(`🏢 Bot ${botPhoneNumber} determined business: ${businessId} for customer ${phoneNumber}`);

            // Get business data - ROBUST VERSION
            let businessData;
            try {
                let rawBusinessData = null;
                
                // Try different methods to get business data
                if (businessManager.getBusinessData) {
                    rawBusinessData = await businessManager.getBusinessData(businessId);
                } else if (businessManager.getBusiness) {
                    rawBusinessData = await businessManager.getBusiness(businessId);
                } else if (businessManager.getVendorProfile) {
                    rawBusinessData = await businessManager.getVendorProfile(businessId);
                }
                
                console.log('🔍 Raw business data type:', typeof rawBusinessData);
                console.log('🔍 Raw business data keys:', rawBusinessData ? Object.keys(rawBusinessData) : 'null');
                
                // Transform/normalize the business data structure
                if (rawBusinessData) {
                    businessData = await this.normalizeBusinessData(rawBusinessData, businessId);
                } else {
                    businessData = this.createDefaultBusinessData();
                }
                
                console.log(`✅ Business data normalized for: ${businessData.profile.businessName}`);
            } catch (businessError) {
                console.error('❌ Error loading business data:', businessError.message);
                console.error('❌ BusinessId:', businessId);
                
                // Use default business data instead of failing
                businessData = this.createDefaultBusinessData();
                console.log('⚠️ Using default business data as fallback');
            }

            // Security check (with safety check)
            if (this.securityMonitor && typeof this.securityMonitor.checkMessage === 'function') {
                const securityCheck = await this.securityMonitor.checkMessage(userId, messageContent);
                if (!securityCheck.allowed) {
                    console.log(`🛡️ Message blocked by security: ${securityCheck.reason}`);
                    return;
                }
            }

            // Rate limiting (with safety check)
            if (this.rateLimiter && typeof this.rateLimiter.checkLimit === 'function') {
                const rateLimitCheck = await this.rateLimiter.checkLimit(userId, businessId);
                if (!rateLimitCheck.allowed) {
                    console.log(`⏰ Message rate limited: ${rateLimitCheck.reason}`);
                    
                    if (rateLimitCheck.shouldNotify) {
                        await this.sendMessage(userId, 
                            '⏰ Please slow down! You\'re sending messages too quickly. Wait a moment and try again.');
                    }
                    return;
                }
            }

            // Log the message (with safety check)
            if (this.logger && typeof this.logger.logMessage === 'function') {
                await this.logger.logMessage({
                    userId,
                    businessId,
                    content: messageContent,
                    sender,
                    timestamp: Date.now(),
                    messageId: msgId
                });
            }

            console.log(`📨 Message from ${sender} (${phoneNumber}) to business ${businessId}: "${messageContent}"`);

            // Use the new session management method that persists sessions
            let session = this.getOrCreateSession(userId, businessId, businessData);

            // Process the message through command handler
            const response = await commandHandler.handleCommand(
                messageContent,  // text - first parameter
                session,         // session - second parameter  
                businessManager, // businessManager - third parameter
                {               // messageData - fourth parameter
                    userId,
                    businessId,
                    sender,
                    phoneNumber,
                    botPhoneNumber,
                    whatsappService: this.whatsappService,
                    msgId
                }
            );

            // Send the response if we got one
            if (response && typeof response === 'string') {
                console.log(`📤 Sending response to ${userId}`);
                await this.sendMessage(userId, response);
            }

        } catch (error) {
            console.error('❌ Error processing message:', error);
            
            // Log the error (with safety check)
            if (this.logger && typeof this.logger.logError === 'function') {
                await this.logger.logError({
                    userId,
                    error: error.message,
                    stack: error.stack,
                    messageContent,
                    timestamp: Date.now()
                });
            }

            // Send error message to user
            try {
                await this.sendMessage(userId, 
                    '❌ Sorry, something went wrong. Please try again in a moment or contact support if this persists.');
            } catch (sendError) {
                console.error('❌ Failed to send error message:', sendError);
            }
        }
    }

    // Helper method to send messages safely
    async sendMessage(userId, message) {
        try {
            if (typeof message === 'string') {
                // For string messages, use sendTextMessage if available
                if (this.whatsappService && typeof this.whatsappService.sendTextMessage === 'function') {
                    console.log(`📤 Sending text message to ${userId}: "${message}"`);
                    await this.whatsappService.sendTextMessage(userId, message);
                    return;
                }
                // Fallback to sendMessage with proper format
                if (this.whatsappService && typeof this.whatsappService.sendMessage === 'function') {
                    console.log(`📤 Sending formatted message to ${userId}`);
                    await this.whatsappService.sendMessage(userId, { text: message });
                    return;
                }
            } else {
                // For object messages, use sendMessage directly
                if (this.whatsappService && typeof this.whatsappService.sendMessage === 'function') {
                    console.log(`📤 Sending object message to ${userId}`);
                    await this.whatsappService.sendMessage(userId, message);
                    return;
                }
            }
            
            console.error('❌ No available WhatsApp send method found');
        } catch (error) {
            console.error('❌ Failed to send message:', error.message);
            console.error('❌ Message type:', typeof message);
            console.error('❌ Message content:', message);
        }
    }
}

module.exports = MessageHandler;