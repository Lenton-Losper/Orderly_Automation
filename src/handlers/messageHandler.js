const { OWNER_NUMBER, ACCESS_CONFIG, RATE_LIMIT_CONFIG } = require('../config/constants');
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

    // Check if message is from a group
    isGroupMessage(remoteJid) {
        // WhatsApp group JIDs end with '@g.us'
        // Individual chat JIDs end with '@s.whatsapp.net'
        return remoteJid.endsWith('@g.us');
    }

    // Check if user has permission for a specific command
    hasPermission(userId, command, businessId) {
        // If public access is enabled and it's not an admin command, allow it
        if (ACCESS_CONFIG.PUBLIC_ACCESS && !ACCESS_CONFIG.ADMIN_COMMANDS.includes(command)) {
            return true;
        }

        // Check if user is the business owner for this tenant
        if (ACCESS_CONFIG.BUSINESS_OWNER && userId === ACCESS_CONFIG.BUSINESS_OWNER) {
            return true;
        }

        // Check if user is system admin
        if (ACCESS_CONFIG.SYSTEM_ADMIN && userId === ACCESS_CONFIG.SYSTEM_ADMIN) {
            return true;
        }

        // For admin commands, require owner permissions
        if (ACCESS_CONFIG.ADMIN_COMMANDS.includes(command)) {
            return false;
        }

        // Default to allowing public commands
        return ACCESS_CONFIG.PUBLIC_COMMANDS.includes(command) || ACCESS_CONFIG.PUBLIC_ACCESS;
    }

    // ENHANCED: Get bot phone number with comprehensive debugging
    getBotPhoneNumber() {
        console.log('🔍 BOT PHONE DETECTION - Starting bot phone number detection...');
        
        let botPhoneNumber = null;
        
        // Method 1: Try getBotPhoneNumber function
        if (this.whatsappService && typeof this.whatsappService.getBotPhoneNumber === 'function') {
            try {
                botPhoneNumber = this.whatsappService.getBotPhoneNumber();
                console.log('🔍 BOT PHONE DETECTION - Method 1 (getBotPhoneNumber):', botPhoneNumber);
            } catch (error) {
                console.log('🔍 BOT PHONE DETECTION - Method 1 failed:', error.message);
            }
        } else {
            console.log('🔍 BOT PHONE DETECTION - Method 1 not available (getBotPhoneNumber function missing)');
        }
        
        // Method 2: Try whatsappService.user.id
        if (!botPhoneNumber && this.whatsappService && this.whatsappService.user && this.whatsappService.user.id) {
            botPhoneNumber = this.whatsappService.user.id;
            console.log('🔍 BOT PHONE DETECTION - Method 2 (user.id):', botPhoneNumber);
        } else if (!botPhoneNumber) {
            console.log('🔍 BOT PHONE DETECTION - Method 2 not available (user.id missing)');
        }
        
        // Method 3: Try whatsappService.info.wid
        if (!botPhoneNumber && this.whatsappService && this.whatsappService.info && this.whatsappService.info.wid) {
            botPhoneNumber = this.whatsappService.info.wid;
            console.log('🔍 BOT PHONE DETECTION - Method 3 (info.wid):', botPhoneNumber);
        } else if (!botPhoneNumber) {
            console.log('🔍 BOT PHONE DETECTION - Method 3 not available (info.wid missing)');
        }
        
        // Method 4: Try whatsappService.authState
        if (!botPhoneNumber && this.whatsappService && this.whatsappService.authState && this.whatsappService.authState.creds && this.whatsappService.authState.creds.me) {
            botPhoneNumber = this.whatsappService.authState.creds.me.id;
            console.log('🔍 BOT PHONE DETECTION - Method 4 (authState.creds.me.id):', botPhoneNumber);
        } else if (!botPhoneNumber) {
            console.log('🔍 BOT PHONE DETECTION - Method 4 not available (authState.creds.me missing)');
        }
        
        // Debug available properties
        if (!botPhoneNumber) {
            console.log('🔍 BOT PHONE DETECTION - WhatsApp service properties:');
            console.log('🔍 BOT PHONE DETECTION - whatsappService keys:', this.whatsappService ? Object.keys(this.whatsappService) : 'null');
            console.log('🔍 BOT PHONE DETECTION - user object:', this.whatsappService ? this.whatsappService.user : 'undefined');
            console.log('🔍 BOT PHONE DETECTION - info object:', this.whatsappService ? this.whatsappService.info : 'undefined');
        }
        
        console.log('🔍 BOT PHONE DETECTION - Final bot phone number:', botPhoneNumber);
        console.log('🔍 BOT PHONE DETECTION - Bot phone type:', typeof botPhoneNumber);
        
        return botPhoneNumber;
    }

    // Get or create session with persistence
    getOrCreateSession(userId, businessId, businessData) {
        const sessionKey = `${userId}_${businessId}`;
        console.log('SESSION DEBUG - Looking for session:', sessionKey);
        
        let session = this.sessions.get(sessionKey);
        console.log('SESSION DEBUG - Existing session found:', !!session);
        console.log('SESSION DEBUG - Session step before:', session?.step);
        
        if (!session) {
            console.log('SESSION DEBUG - Creating new session');
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
                    console.log('SESSION DEBUG - Setting step from', this.step, 'to', step);
                    this.step = step; 
                    console.log('SESSION DEBUG - Step now set to:', this.step);
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
                
                // Fixed Cart methods
                addToCart: function(productKey) {
                    console.log('ADD_TO_CART DEBUG - Product key:', productKey);
                    console.log('ADD_TO_CART DEBUG - Available products:', Object.keys(this.businessData.products || {}));
                    
                    if (this.businessData.products[productKey]) {
                        const product = this.businessData.products[productKey];
                        console.log('ADD_TO_CART DEBUG - Found product:', product);
                        
                        // Create cart item with the structure that MessageGenerators expects
                        const cartItem = {
                            name: product.name || 'Unknown Product',
                            price: product.price || 0,
                            quantity: 1,
                            image: product.image || '🛍️',
                            description: product.description || '',
                            productKey: productKey  // Keep reference to original product
                        };
                        
                        console.log('ADD_TO_CART DEBUG - Created cart item:', cartItem);
                        
                        this.cart.push(cartItem);
                        console.log('ADD_TO_CART DEBUG - Cart after adding:', this.cart);
                        
                        return true;
                    } else {
                        console.log('ADD_TO_CART DEBUG - Product not found for key:', productKey);
                        console.log('ADD_TO_CART DEBUG - Available product keys:', Object.keys(this.businessData.products || {}));
                        return false;
                    }
                },
                
                clearCart: function() { 
                    console.log('CLEAR_CART DEBUG - Clearing cart');
                    this.cart = []; 
                },
                
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
                        console.log(`DISCOUNT DEBUG - Applied ${code}: ${this.discountAmount * 100}%`);
                        return true;
                    }
                    console.log(`DISCOUNT DEBUG - Invalid code: ${code}`);
                    return false;
                },
                
                removeDiscount: function() {
                    console.log('DISCOUNT DEBUG - Removing discount');
                    this.discountCode = null;
                    this.discountAmount = 0;
                },
                
                // Fixed Total calculation
                getTotal: function() {
                    console.log('GET_TOTAL DEBUG - Calculating total for cart:', this.cart);
                    
                    let subtotal = this.cart.reduce((sum, item) => {
                        const price = parseFloat(item.price) || 0;
                        const quantity = parseInt(item.quantity) || 1;
                        const itemTotal = price * quantity;
                        
                        console.log(`GET_TOTAL DEBUG - Item: ${item.name}, Price: ${price}, Qty: ${quantity}, Total: ${itemTotal}`);
                        return sum + itemTotal;
                    }, 0);
                    
                    console.log('GET_TOTAL DEBUG - Subtotal:', subtotal);
                    
                    const tax = subtotal * 0.1; // 10% tax
                    const shipping = subtotal >= 50 ? 0 : 5; // Free shipping over N$50
                    let total = subtotal + tax + shipping;
                    
                    if (this.discountAmount > 0) {
                        const discountValue = total * this.discountAmount;
                        total = total - discountValue;
                        console.log('GET_TOTAL DEBUG - Discount applied:', discountValue);
                    }
                    
                    console.log('GET_TOTAL DEBUG - Final total:', total);
                    return total;
                },
                
                // Fixed Order generation
                generateOrder: function() {
                    console.log('GENERATE_ORDER DEBUG - Creating order from cart:', this.cart);
                    
                    return {
                        items: this.cart.map(item => ({
                            name: item.name,
                            price: item.price,
                            quantity: item.quantity,
                            productKey: item.productKey,
                            itemTotal: (parseFloat(item.price) || 0) * (parseInt(item.quantity) || 1)
                        })),
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
            console.log(`NEW Session created and stored: ${sessionKey}`);
        } else {
            console.log(`EXISTING Session retrieved: ${sessionKey}`);
            console.log('SESSION DEBUG - Existing session step:', session.step);
        }
        
        // Ensure session has business data
        if (!session.businessData) {
            session.businessData = businessData;
            console.log(`Added business data to session`);
        }
        
        console.log('SESSION DEBUG - Final session step:', session.step);
        return session;
    }

    // FIXED: Load products from vendor subcollection with comprehensive debugging
    async loadProductsFromVendorSubcollection(businessId) {
        try {
            console.log('PRODUCT DEBUG - Loading products from vendor subcollection for business:', businessId);
            
            // Import Firebase Admin
            const admin = require('firebase-admin');
            const db = admin.firestore();
            
            console.log(`PRODUCT DEBUG - Querying path: vendors/${businessId}/products`);
            
            // Load products from the vendors/{businessId}/products subcollection
            const productsRef = await db.collection('vendors')
                .doc(businessId)
                .collection('products')
                .get(); // Remove where clause temporarily for debugging
                
            console.log(`PRODUCT DEBUG - Query returned ${productsRef.size} documents`);
            
            if (productsRef.empty) {
                console.log(`PRODUCT DEBUG - No products found in vendors/${businessId}/products`);
                
                // Debug: Check if vendor document exists
                const vendorDoc = await db.collection('vendors').doc(businessId).get();
                console.log(`PRODUCT DEBUG - Vendor document exists: ${vendorDoc.exists}`);
                
                if (vendorDoc.exists) {
                    console.log(`PRODUCT DEBUG - Vendor data:`, vendorDoc.data());
                } else {
                    console.log(`PRODUCT DEBUG - Vendor document does not exist!`);
                }
                
                return {};
            }
            
            const products = {};
            console.log(`PRODUCT DEBUG - Processing ${productsRef.size} product documents:`);
            
            productsRef.forEach(doc => {
                const productData = doc.data();
                console.log(`PRODUCT DEBUG - Processing product ${doc.id}:`, {
                    name: productData.name,
                    price: productData.price,
                    category: productData.category,
                    isActive: productData.isActive,
                    isAvailable: productData.isAvailable
                });
                
                // Only include active/available products
                if (productData.isActive !== false && productData.isAvailable !== false) {
                    products[doc.id] = {
                        name: productData.name,
                        price: productData.price,
                        description: productData.description || 'No description',
                        category: productData.category || 'General',
                        stock: productData.stock || 0,
                        image: productData.image || '🛍️',
                        isActive: productData.isActive,
                        isAvailable: productData.isAvailable
                    };
                    console.log(`PRODUCT DEBUG - Added product to list: ${productData.name}`);
                } else {
                    console.log(`PRODUCT DEBUG - Skipped inactive product: ${productData.name}`);
                }
            });
            
            console.log('PRODUCT DEBUG - Final product count:', Object.keys(products).length);
            console.log('PRODUCT DEBUG - Product names:', Object.keys(products).map(key => products[key].name));
            
            return products;
            
        } catch (error) {
            console.error('PRODUCT DEBUG - Error loading products from vendor subcollection:', error);
            console.error('PRODUCT DEBUG - Error details:', error.message);
            console.error('PRODUCT DEBUG - Error stack:', error.stack);
            return {};
        }
    }

    // Helper method to normalize different business data structures
    async normalizeBusinessData(rawData, businessId) {
        console.log('🔍 NORMALIZE DEBUG - Starting business data normalization...');
        console.log('🔍 NORMALIZE DEBUG - Raw data type:', typeof rawData);
        console.log('🔍 NORMALIZE DEBUG - Raw data keys:', rawData ? Object.keys(rawData) : 'null');
        console.log('🔍 NORMALIZE DEBUG - Business ID:', businessId);
        
        // Handle different possible structures
        let profile = {};
        let products = {};
        let productOrder = [];
        
        // Extract profile information from various possible structures
        if (rawData.profile) {
            profile = rawData.profile;
            console.log('🔍 NORMALIZE DEBUG - Using rawData.profile');
        } else if (rawData.businessProfile) {
            profile = rawData.businessProfile;
            console.log('🔍 NORMALIZE DEBUG - Using rawData.businessProfile');
        } else if (rawData.vendor) {
            profile = rawData.vendor;
            console.log('🔍 NORMALIZE DEBUG - Using rawData.vendor');
        } else if (rawData.business) {
            profile = rawData.business;
            console.log('🔍 NORMALIZE DEBUG - Using rawData.business');
        } else {
            // Try to construct profile from top-level properties
            console.log('🔍 NORMALIZE DEBUG - Constructing profile from top-level properties');
            profile = {
                businessName: rawData.businessName || rawData.name || rawData.companyName || 'LLL Farm',
                contactInfo: rawData.contactInfo || rawData.contact || rawData.phone || 'Contact us for more information',
                catalogUrl: rawData.catalogUrl || rawData.catalog || null,
                description: rawData.description || rawData.about || null,
                address: rawData.address || null,
                email: rawData.email || null,
                phone: rawData.phone || null
            };
        }
        
        console.log('🔍 NORMALIZE DEBUG - Profile extracted:', {
            businessName: profile.businessName,
            hasContactInfo: !!profile.contactInfo,
            hasEmail: !!profile.email,
            hasPhone: !!profile.phone
        });
        
        // Ensure required profile fields exist
        if (!profile.businessName) {
            profile.businessName = 'LLL Farm';
            console.log('🔍 NORMALIZE DEBUG - Set default business name');
        }
        if (!profile.contactInfo) {
            profile.contactInfo = 'Contact us for more information';
            console.log('🔍 NORMALIZE DEBUG - Set default contact info');
        }
        
        // Extract products information with detailed debugging
        console.log('🔍 NORMALIZE DEBUG - Starting product extraction...');
        
        if (rawData.products) {
            products = rawData.products;
            console.log('🔍 NORMALIZE DEBUG - Found products in rawData.products:', Object.keys(products).length);
            console.log('🔍 NORMALIZE DEBUG - Product keys from rawData:', Object.keys(products));
        } else if (rawData.inventory) {
            products = rawData.inventory;
            console.log('🔍 NORMALIZE DEBUG - Found products in rawData.inventory:', Object.keys(products).length);
        } else if (rawData.items) {
            products = rawData.items;
            console.log('🔍 NORMALIZE DEBUG - Found products in rawData.items:', Object.keys(products).length);
        } else {
            // Load products from vendor subcollection with enhanced debugging
            console.log('🔍 NORMALIZE DEBUG - No products in raw data, loading from vendor subcollection...');
            console.log('🔍 NORMALIZE DEBUG - Loading products for business ID:', businessId);
            
            try {
                products = await this.loadProductsFromVendorSubcollection(businessId);
                console.log('🔍 NORMALIZE DEBUG - Loaded products from subcollection:', Object.keys(products).length);
                console.log('🔍 NORMALIZE DEBUG - Product keys from subcollection:', Object.keys(products));
                console.log('🔍 NORMALIZE DEBUG - Product names from subcollection:', Object.keys(products).map(key => products[key]?.name));
                
                if (Object.keys(products).length === 0) {
                    console.log('❌ NORMALIZE DEBUG - No products loaded from subcollection!');
                    console.log('💡 NORMALIZE DEBUG - This is likely the root cause of the issue');
                } else {
                    console.log('✅ NORMALIZE DEBUG - Successfully loaded products from subcollection');
                }
            } catch (error) {
                console.error('❌ NORMALIZE DEBUG - Error loading products from subcollection:', error);
                products = {};
            }
        }
        
        // Extract product order with debugging
        console.log('🔍 NORMALIZE DEBUG - Extracting product order...');
        
        if (rawData.productOrder) {
            productOrder = rawData.productOrder;
            console.log('🔍 NORMALIZE DEBUG - Using rawData.productOrder:', productOrder.length);
        } else if (rawData.menuOrder) {
            productOrder = rawData.menuOrder;
            console.log('🔍 NORMALIZE DEBUG - Using rawData.menuOrder:', productOrder.length);
        } else if (products && Object.keys(products).length > 0) {
            // Generate product order from products
            productOrder = Object.keys(products);
            console.log('🔍 NORMALIZE DEBUG - Generated product order from products:', productOrder.length);
            console.log('🔍 NORMALIZE DEBUG - Product order keys:', productOrder);
        } else {
            console.log('🔍 NORMALIZE DEBUG - No products available to create order');
            productOrder = [];
        }
        
        // Create normalized data with comprehensive debugging
        const normalizedData = {
            profile,
            products,
            productOrder,
            businessId
        };
        
        console.log('🔍 NORMALIZE DEBUG - Final normalized data summary:');
        console.log('🔍 NORMALIZE DEBUG - Business name:', profile.businessName);
        console.log('🔍 NORMALIZE DEBUG - Products count:', Object.keys(products).length);
        console.log('🔍 NORMALIZE DEBUG - Product order count:', productOrder.length);
        console.log('🔍 NORMALIZE DEBUG - Product keys in final data:', Object.keys(products));
        console.log('🔍 NORMALIZE DEBUG - Product names in final data:', Object.keys(products).map(key => products[key]?.name));
        
        if (Object.keys(products).length === 0) {
            console.log('❌ NORMALIZE DEBUG - WARNING: No products in final normalized data!');
            console.log('🔍 NORMALIZE DEBUG - This will cause the "Loading products..." issue');
        } else {
            console.log('✅ NORMALIZE DEBUG - Products successfully included in normalized data');
        }
        
        console.log('🔍 NORMALIZE DEBUG - Normalization complete');
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
                    category: 'General',
                    image: '🛍️'
                }
            },
            productOrder: ['sample1'],
            businessId: 'default'
        };
    }

    async handleMessage({ messages, type }) {
        // Only process new messages
        if (type !== 'notify') {
            console.log(`Ignoring message type: ${type}`);
            return;
        }
        
        const msg = messages[0];
        if (!msg || !msg.message) {
            console.log('Ignoring message: no content');
            return;
        }

        // Robust text extraction supporting wrapped messages
        const extractText = (messageNode) => {
            if (!messageNode) return '';
            const m = messageNode.message || messageNode;
            // Plain text
            if (m.conversation) return m.conversation;
            if (m.extendedTextMessage && m.extendedTextMessage.text) return m.extendedTextMessage.text;
            // Ephemeral wrapper
            if (m.ephemeralMessage && m.ephemeralMessage.message) {
                return extractText(m.ephemeralMessage);
            }
            // Device-sent wrapper
            if (m.deviceSentMessage && m.deviceSentMessage.message) {
                return extractText(m.deviceSentMessage);
            }
            // View once wrapper
            if (m.viewOnceMessage && m.viewOnceMessage.message) {
                return extractText(m.viewOnceMessage);
            }
            // Media captions
            if (m.imageMessage && m.imageMessage.caption) return m.imageMessage.caption;
            if (m.videoMessage && m.videoMessage.caption) return m.videoMessage.caption;
            return '';
        };

        // Extract message details
        const messageContent = extractText(msg);
        const sender = msg.pushName || 'Customer';
        const userId = msg.key.remoteJid;
        const msgId = msg.key.id;
        const phoneNumber = userId.split('@')[0];
        
        // Ignore group messages
        if (this.isGroupMessage(userId)) {
            console.log(`Ignoring group message from: ${userId}`);
            return;
        }
        
        // ENHANCED: Get bot's phone number with comprehensive debugging
        const botPhoneNumber = this.getBotPhoneNumber();
        
        console.log(`Raw message received: {
  hasMessage: ${!!msg.message},
  fromMe: ${msg.key.fromMe},
  remoteJid: '${userId}',
  pushName: '${sender}',
  messageKeys: ${JSON.stringify(Object.keys(msg.message))},
  botNumber: '${botPhoneNumber}',
  text: ${JSON.stringify(messageContent)}
}`);

        // Skip messages from bot itself
        if (msg.key.fromMe) {
            console.log('Ignoring message from bot itself');
            return;
        }

        // Extract command for permission checking
        const command = (messageContent || '').toLowerCase().split(' ')[0];
        
        // Check permissions using new access control system
        if (!this.hasPermission(userId, command, null)) {
            console.log(`Access denied for user ${userId} command ${command}`);
            if (ACCESS_CONFIG.ADMIN_COMMANDS.includes(command)) {
                await this.sendMessage(userId, "This command requires owner privileges.");
                return;
            }
            // For non-admin commands, don't send error message, just ignore
            return;
        }

        try {
            // ENHANCED: Get business ID from bot phone number with comprehensive debugging
            let businessId;
            
            console.log('🔍 BUSINESS ID DEBUG - Starting business ID determination...');
            console.log('🔍 BUSINESS ID DEBUG - Bot phone number:', botPhoneNumber);
            console.log('🔍 BUSINESS ID DEBUG - Bot phone type:', typeof botPhoneNumber);
            console.log('🔍 BUSINESS ID DEBUG - Customer phone number:', phoneNumber);
            
            if (businessManager.getBusinessIdFromBot) {
                console.log('🔍 BUSINESS ID DEBUG - Using businessManager.getBusinessIdFromBot method');
                console.log('🔍 BUSINESS ID DEBUG - Calling getBusinessIdFromBot with:', botPhoneNumber);
                
                try {
                    businessId = await businessManager.getBusinessIdFromBot(botPhoneNumber);
                    console.log('🔍 BUSINESS ID DEBUG - getBusinessIdFromBot returned:', businessId);
                    console.log('🔍 BUSINESS ID DEBUG - Business ID type:', typeof businessId);
                } catch (businessError) {
                    console.error('🔍 BUSINESS ID DEBUG - Error in getBusinessIdFromBot:', businessError);
                    console.log('🔍 BUSINESS ID DEBUG - Falling back to legacy method...');
                    businessId = businessManager.getBusinessId(phoneNumber);
                    console.log('🔍 BUSINESS ID DEBUG - Legacy method returned:', businessId);
                }
            } else {
                console.log('🔍 BUSINESS ID DEBUG - getBusinessIdFromBot method not available, using legacy method');
                businessId = businessManager.getBusinessId(phoneNumber);
                console.log('🔍 BUSINESS ID DEBUG - Legacy method returned:', businessId);
            }
            
            console.log('🔍 BUSINESS ID DEBUG - Final business ID determination:');
            console.log('🔍 BUSINESS ID DEBUG - Bot phone:', botPhoneNumber);
            console.log('🔍 BUSINESS ID DEBUG - Customer phone:', phoneNumber);
            console.log('🔍 BUSINESS ID DEBUG - Determined business ID:', businessId);
            
            if (businessId === 'default') {
                console.log('⚠️ BUSINESS ID DEBUG - WARNING: Using default business ID - this indicates mapping failure!');
                console.log('⚠️ BUSINESS ID DEBUG - Check if Firebase service is updated and vendor mapping exists');
            }
            
            console.log(`Bot ${botPhoneNumber} determined business: ${businessId} for customer ${phoneNumber}`);

            // Get business data - ROBUST VERSION
            let businessData;
            try {
                let rawBusinessData = null;
                
                console.log('🔍 BUSINESS DATA DEBUG - Loading business data for:', businessId);
                
                // Try different methods to get business data
                if (businessManager.getBusinessData) {
                    console.log('🔍 BUSINESS DATA DEBUG - Using getBusinessData method');
                    rawBusinessData = await businessManager.getBusinessData(businessId);
                } else if (businessManager.getBusiness) {
                    console.log('🔍 BUSINESS DATA DEBUG - Using getBusiness method');
                    rawBusinessData = await businessManager.getBusiness(businessId);
                } else if (businessManager.getVendorProfile) {
                    console.log('🔍 BUSINESS DATA DEBUG - Using getVendorProfile method');
                    rawBusinessData = await businessManager.getVendorProfile(businessId);
                }
                
                console.log('Raw business data type:', typeof rawBusinessData);
                console.log('Raw business data keys:', rawBusinessData ? Object.keys(rawBusinessData) : 'null');
                
                // Transform/normalize the business data structure
                if (rawBusinessData) {
                    businessData = await this.normalizeBusinessData(rawBusinessData, businessId);
                } else {
                    console.log('🔍 BUSINESS DATA DEBUG - No raw business data found, using default');
                    businessData = this.createDefaultBusinessData();
                }
                
                console.log(`Business data normalized for: ${businessData.profile.businessName}`);
            } catch (businessError) {
                console.error('Error loading business data:', businessError.message);
                console.error('BusinessId:', businessId);
                
                // Use default business data instead of failing
                businessData = this.createDefaultBusinessData();
                console.log('Using default business data as fallback');
            }

            // Security check (with safety check)
            if (this.securityMonitor && typeof this.securityMonitor.checkMessage === 'function') {
                const securityCheck = await this.securityMonitor.checkMessage(userId, messageContent);
                if (!securityCheck.allowed) {
                    console.log(`Message blocked by security: ${securityCheck.reason}`);
                    return;
                }
            }

            // Rate limiting (with safety check)
            if (this.rateLimiter && typeof this.rateLimiter.checkLimit === 'function') {
                const rateLimitCheck = await this.rateLimiter.checkLimit(userId, businessId);
                if (!rateLimitCheck.allowed) {
                    console.log(`Message rate limited: ${rateLimitCheck.reason}`);
                    
                    if (rateLimitCheck.shouldNotify) {
                        await this.sendMessage(userId, 
                            'Please slow down! You\'re sending messages too quickly. Wait a moment and try again.');
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

            console.log(`Message from ${sender} (${phoneNumber}) to business ${businessId}: "${messageContent}"`);

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
                console.log(`Sending response to ${userId}`);
                await this.sendMessage(userId, response);
            }

        } catch (error) {
            console.error('Error processing message:', error);
            
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
                    'Sorry, something went wrong. Please try again in a moment or contact support if this persists.');
            } catch (sendError) {
                console.error('Failed to send error message:', sendError);
            }
        }
    }

    // Helper method to send messages safely
    async sendMessage(userId, message) {
        try {
            if (typeof message === 'string') {
                // For string messages, use sendTextMessage if available
                if (this.whatsappService && typeof this.whatsappService.sendTextMessage === 'function') {
                    console.log(`Sending text message to ${userId}: "${message}"`);
                    await this.whatsappService.sendTextMessage(userId, message);
                    return;
                }
                // Fallback to sendMessage with proper format
                if (this.whatsappService && typeof this.whatsappService.sendMessage === 'function') {
                    console.log(`Sending formatted message to ${userId}`);
                    await this.whatsappService.sendMessage(userId, { text: message });
                    return;
                }
            } else {
                // For object messages, use sendMessage directly
                if (this.whatsappService && typeof this.whatsappService.sendMessage === 'function') {
                    console.log(`Sending object message to ${userId}`);
                    await this.whatsappService.sendMessage(userId, message);
                    return;
                }
            }
            
            console.error('No available WhatsApp send method found');
        } catch (error) {
            console.error('Failed to send message:', error.message);
            console.error('Message type:', typeof message);
            console.error('Message content:', message);
        }
    }
}

module.exports = MessageHandler;