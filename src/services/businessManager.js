const firebaseService = require('./firebase');
const { CACHE_CONFIG, DEFAULT_BUSINESS } = require('../config/constants');

class BusinessManager {
    constructor() {
        this.businessData = new Map(); // Cache business data
        this.phoneToBusinessMap = new Map(); // Phone to business mapping
        this.botToBusinessMap = new Map(); // Bot phone to business mapping
        this.cacheTimestamps = new Map(); // Cache timestamps for invalidation
        this.isInitialized = false;
    }

    async initialize() {
        try {
            console.log('🏢 Initializing Business Manager...');
            await this.loadBusinessMappings();
            this.isInitialized = true;
            console.log('✅ Business Manager initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize Business Manager:', error);
            throw error;
        }
    }

    async loadBusinessMappings() {
        try {
            const mappings = await firebaseService.getBusinessMappings();
            console.log(`✅ Loaded ${mappings.length} business mappings`);
            
            if (mappings.length === 0) {
                console.log('⚠️  No business mappings found. Auto-mapping will be used when bot connects.');
                return;
            }

            // Load both customer mappings and bot mappings
            mappings.forEach(mapping => {
                // Customer phone to business mapping (legacy)
                this.phoneToBusinessMap.set(mapping.phoneNumber, mapping.businessId);
                
                // Bot phone to business mapping (new approach)
                if (mapping.isBotNumber || mapping.type === 'bot') {
                    this.botToBusinessMap.set(mapping.phoneNumber, mapping.businessId);
                    console.log(`🤖 Bot ${mapping.phoneNumber} mapped to business: ${mapping.businessId}`);
                    if (mapping.autoMapped) {
                        console.log(`   ✨ Auto-mapped vendor: ${mapping.vendorName}`);
                    }
                }
            });

            console.log(`📱 Loaded ${this.phoneToBusinessMap.size} customer mappings`);
            console.log(`🤖 Loaded ${this.botToBusinessMap.size} bot mappings`);
        } catch (error) {
            console.error('❌ Failed to load business mappings:', error);
            throw error;
        }
    }

    // FIXED: Properly await the Promise and return the actual business ID
    async getBusinessIdFromBot(botPhoneNumber) {
        if (!botPhoneNumber) {
            console.log('⚠️  No bot phone number provided, using default business');
            return DEFAULT_BUSINESS;
        }

        // Clean the phone number (remove @s.whatsapp.net and any extra characters)
        const cleanBotNumber = botPhoneNumber.split('@')[0].split(':')[0];
        
        // Check if this bot number is already mapped to a specific business
        if (this.botToBusinessMap.has(cleanBotNumber)) {
            const businessId = this.botToBusinessMap.get(cleanBotNumber);
            console.log(`🎯 Bot ${cleanBotNumber} mapped to business: ${businessId}`);
            return businessId;
        }

        // Try auto-mapping
        console.log(`🔍 No mapping found for bot ${cleanBotNumber}, attempting auto-mapping...`);
        
        try {
            // FIXED: Properly await the Promise
            const autoMappedBusinessId = await firebaseService.autoMapBotToVendor(botPhoneNumber);
            
            if (autoMappedBusinessId) {
                // Update our cache
                this.botToBusinessMap.set(cleanBotNumber, autoMappedBusinessId);
                console.log(`✨ Auto-mapped bot ${cleanBotNumber} to business: ${autoMappedBusinessId}`);
                return autoMappedBusinessId;
            }
        } catch (error) {
            console.error(`❌ Error in auto-mapping for bot ${cleanBotNumber}:`, error);
        }

        // Fallback: Check if bot number has business mapping (legacy)
        if (this.phoneToBusinessMap.has(cleanBotNumber)) {
            const businessId = this.phoneToBusinessMap.get(cleanBotNumber);
            console.log(`🎯 Bot ${cleanBotNumber} found in legacy mapping: ${businessId}`);
            return businessId;
        }

        console.log(`⚠️  Bot ${cleanBotNumber} not mapped and auto-mapping failed, using default business`);
        console.log(`💡 Make sure your vendor profile has phone number: ${cleanBotNumber}`);
        return DEFAULT_BUSINESS;
    }

    // LEGACY: Get business ID from customer phone (keep for backward compatibility)
    getBusinessId(customerPhoneNumber) {
        if (!customerPhoneNumber) {
            return DEFAULT_BUSINESS;
        }

        const cleanNumber = customerPhoneNumber.split('@')[0];
        return this.phoneToBusinessMap.get(cleanNumber) || DEFAULT_BUSINESS;
    }

    // Refresh mappings (useful when new vendors are added)
    async refreshMappings() {
        try {
            console.log('🔄 Refreshing business mappings...');
            this.phoneToBusinessMap.clear();
            this.botToBusinessMap.clear();
            await this.loadBusinessMappings();
            console.log('✅ Business mappings refreshed');
        } catch (error) {
            console.error('❌ Failed to refresh business mappings:', error);
        }
    }

    // Force auto-mapping for a specific bot number
    async forceAutoMapping(botPhoneNumber) {
        try {
            console.log(`🔧 Force auto-mapping for bot: ${botPhoneNumber}`);
            const businessId = await firebaseService.autoMapBotToVendor(botPhoneNumber);
            
            if (businessId) {
                const cleanBotNumber = botPhoneNumber.split('@')[0].split(':')[0];
                this.botToBusinessMap.set(cleanBotNumber, businessId);
                console.log(`✅ Force-mapped bot ${cleanBotNumber} to business: ${businessId}`);
                return businessId;
            } else {
                console.log(`❌ Force auto-mapping failed for bot: ${botPhoneNumber}`);
                return null;
            }
        } catch (error) {
            console.error('❌ Error in force auto-mapping:', error);
            return null;
        }
    }

    async getBusinessData(businessId) {
        try {
            // Check cache first
            if (this.businessData.has(businessId)) {
                const cacheTime = this.cacheTimestamps.get(businessId);
                const now = Date.now();
                
                if (now - cacheTime < CACHE_CONFIG.BUSINESS_DATA_TTL) {
                    return this.businessData.get(businessId);
                }
            }

            // Load from Firebase
            const businessData = await firebaseService.getBusinessProfile(businessId);
            
            // Cache the data
            this.businessData.set(businessId, businessData);
            this.cacheTimestamps.set(businessId, Date.now());
            
            return businessData;
        } catch (error) {
            console.error(`❌ Failed to get business data for ${businessId}:`, error);
            return {
                businessName: 'Our Business',
                businessDescription: 'Welcome to our business',
                isActive: true
            };
        }
    }

    // ADD: Get vendor profile (for business data normalization)
    async getVendorProfile(businessId) {
        try {
            console.log(`✅ Loaded vendor profile for: ${businessId}`);
            // Use your existing Firebase method for getting vendor profile
            return await firebaseService.getVendorProfile(businessId);
        } catch (error) {
            console.error(`❌ Failed to get vendor profile for ${businessId}:`, error);
            return null;
        }
    }

    async getBusinessProducts(businessId) {
        try {
            return await firebaseService.getBusinessProducts(businessId);
        } catch (error) {
            console.error(`❌ Failed to get products for business ${businessId}:`, error);
            return [];
        }
    }

    // UPDATED: Registration-specific methods with comprehensive debugging
    async saveCustomer(businessId, customerData, whatsappId) {
        console.log('🔍 BUSINESS MANAGER DEBUG - saveCustomer called');
        console.log('🔍 BUSINESS MANAGER DEBUG - Business ID:', businessId);
        console.log('🔍 BUSINESS MANAGER DEBUG - Customer Data:', JSON.stringify(customerData, null, 2));
        console.log('🔍 BUSINESS MANAGER DEBUG - WhatsApp ID:', whatsappId);
        
        try {
            // Validate inputs
            if (!businessId) {
                console.error('❌ BUSINESS MANAGER DEBUG - Missing businessId');
                return { success: false, message: 'Missing business ID' };
            }
            
            if (!customerData || !customerData.accountName) {
                console.error('❌ BUSINESS MANAGER DEBUG - Missing customer data or account name');
                return { success: false, message: 'Missing customer data' };
            }
            
            if (!whatsappId) {
                console.error('❌ BUSINESS MANAGER DEBUG - Missing whatsappId');
                return { success: false, message: 'Missing WhatsApp ID' };
            }

            // Clean WhatsApp ID
            const cleanWhatsAppId = whatsappId.split('@')[0];
            console.log('🔍 BUSINESS MANAGER DEBUG - Clean WhatsApp ID:', cleanWhatsAppId);
            
            // Try using existing Firebase service methods first
            if (typeof firebaseService.saveCustomer === 'function') {
                console.log('🔍 BUSINESS MANAGER DEBUG - Using firebaseService.saveCustomer...');
                
                try {
                    const success = await firebaseService.saveCustomer(cleanWhatsAppId, businessId, {
                        ...customerData,
                        whatsappId: cleanWhatsAppId,
                        createdAt: new Date().toISOString(),
                        isActive: true,
                        score: 0
                    });
                    
                    if (success) {
                        console.log('✅ BUSINESS MANAGER DEBUG - Customer saved via firebaseService');
                        return { 
                            success: true, 
                            accountName: customerData.accountName 
                        };
                    } else {
                        console.log('❌ BUSINESS MANAGER DEBUG - firebaseService.saveCustomer returned false');
                        return { success: false, message: 'Failed to save customer via Firebase service' };
                    }
                } catch (firebaseError) {
                    console.error('❌ BUSINESS MANAGER DEBUG - Error with firebaseService.saveCustomer:', firebaseError);
                    // Fall through to direct Firebase approach
                }
            }
            
            // Fallback: Direct Firebase approach
            console.log('🔍 BUSINESS MANAGER DEBUG - Using direct Firebase approach...');
            
            // Import Firebase Admin directly
            const admin = require('firebase-admin');
            const db = admin.firestore();
            
            // Check if account name already exists
            console.log('🔍 BUSINESS MANAGER DEBUG - Checking for existing account name...');
            const existingCustomer = await db.collection('customers')
                .where('businessId', '==', businessId)
                .where('accountName', '==', customerData.accountName)
                .get();
                
            console.log('🔍 BUSINESS MANAGER DEBUG - Existing customer query result empty:', existingCustomer.empty);
            console.log('🔍 BUSINESS MANAGER DEBUG - Existing customer query size:', existingCustomer.size);
            
            if (!existingCustomer.empty) {
                console.log('❌ BUSINESS MANAGER DEBUG - Account name already exists');
                return { success: false, message: 'Account name already exists' };
            }
            
            // Check if WhatsApp ID already has an account for this business
            console.log('🔍 BUSINESS MANAGER DEBUG - Checking for existing WhatsApp ID...');
            const existingWhatsAppCustomer = await db.collection('customers')
                .where('businessId', '==', businessId)
                .where('whatsappId', '==', cleanWhatsAppId)
                .get();
                
            if (!existingWhatsAppCustomer.empty) {
                console.log('❌ BUSINESS MANAGER DEBUG - WhatsApp ID already has an account');
                return { success: false, message: 'This WhatsApp number already has an account' };
            }
            
            // Create customer document
            const customerDoc = {
                businessId: businessId,
                whatsappId: cleanWhatsAppId,
                name: customerData.name,
                email: customerData.email,
                phone: customerData.phone,
                address: customerData.address,
                accountName: customerData.accountName,
                score: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                isActive: true,
                totalOrders: 0,
                totalSpent: 0
            };
            
            console.log('🔍 BUSINESS MANAGER DEBUG - Customer document to save:', JSON.stringify(customerDoc, null, 2));
            
            // Save to Firestore
            console.log('🔍 BUSINESS MANAGER DEBUG - Adding document to customers collection...');
            const docRef = await db.collection('customers').add(customerDoc);
            console.log('✅ BUSINESS MANAGER DEBUG - Customer saved with ID:', docRef.id);
            
            // Verify the document was created
            const savedDoc = await docRef.get();
            if (savedDoc.exists) {
                console.log('✅ BUSINESS MANAGER DEBUG - Document verification successful');
                console.log('✅ BUSINESS MANAGER DEBUG - Saved document data:', savedDoc.data());
            } else {
                console.error('❌ BUSINESS MANAGER DEBUG - Document was not created properly');
            }
            
            return { 
                success: true, 
                accountName: customerData.accountName,
                customerId: docRef.id 
            };
            
        } catch (error) {
            console.error('❌ BUSINESS MANAGER DEBUG - Database error occurred');
            console.error('❌ BUSINESS MANAGER DEBUG - Error name:', error.name);
            console.error('❌ BUSINESS MANAGER DEBUG - Error message:', error.message);
            console.error('❌ BUSINESS MANAGER DEBUG - Error code:', error.code);
            console.error('❌ BUSINESS MANAGER DEBUG - Error stack:', error.stack);
            
            // Handle specific Firebase errors
            if (error.code === 'permission-denied') {
                return { success: false, message: 'Database permission denied. Please contact support.' };
            } else if (error.code === 'unavailable') {
                return { success: false, message: 'Database temporarily unavailable. Please try again.' };
            } else {
                return { success: false, message: `Database error: ${error.message}` };
            }
        }
    }

    // UPDATED: Get existing customer with debugging
    async getExistingCustomer(businessId, whatsappId) {
        console.log('🔍 BUSINESS MANAGER DEBUG - getExistingCustomer called');
        console.log('🔍 BUSINESS MANAGER DEBUG - Business ID:', businessId);
        console.log('🔍 BUSINESS MANAGER DEBUG - WhatsApp ID:', whatsappId);
        
        try {
            // Clean the userId (remove @s.whatsapp.net if present)
            const cleanUserId = whatsappId.split('@')[0];
            console.log('🔍 BUSINESS MANAGER DEBUG - Clean User ID:', cleanUserId);
            
            // Try using existing Firebase service method first
            if (typeof firebaseService.getCustomer === 'function') {
                const customer = await firebaseService.getCustomer(cleanUserId, businessId);
                if (customer) {
                    console.log('✅ BUSINESS MANAGER DEBUG - Customer found via firebaseService');
                    return customer;
                }
            }
            
            // Fallback: Direct Firebase query
            const admin = require('firebase-admin');
            const db = admin.firestore();
            
            const customerQuery = await db.collection('customers')
                .where('businessId', '==', businessId)
                .where('whatsappId', '==', cleanUserId)
                .where('isActive', '==', true)
                .get();
                
            console.log('🔍 BUSINESS MANAGER DEBUG - Customer query size:', customerQuery.size);
            
            if (customerQuery.empty) {
                console.log('👤 No existing customer found:', businessId, 'for vendor', whatsappId);
                return null;
            }
            
            const customerDoc = customerQuery.docs[0];
            const customerData = customerDoc.data();
            
            console.log('✅ BUSINESS MANAGER DEBUG - Existing customer found:', customerData.accountName);
            
            return {
                id: customerData.accountName,
                name: customerData.name,
                email: customerData.email,
                phone: customerData.phone,
                address: customerData.address,
                score: customerData.score || 0,
                totalOrders: customerData.totalOrders || 0,
                totalSpent: customerData.totalSpent || 0
            };
            
        } catch (error) {
            console.error('❌ BUSINESS MANAGER DEBUG - Error getting existing customer:', error);
            console.log('👤 No existing customer found:', businessId, 'for vendor', whatsappId);
            return null;
        }
    }

    // ADD: Save order method
    async saveOrder(businessId, sender, order, messageId) {
        console.log('🔍 BUSINESS MANAGER DEBUG - saveOrder called');
        console.log('🔍 BUSINESS MANAGER DEBUG - Business ID:', businessId);
        console.log('🔍 BUSINESS MANAGER DEBUG - Sender:', sender);
        console.log('🔍 BUSINESS MANAGER DEBUG - Message ID:', messageId);
        
        try {
            // Try using existing Firebase service method first
            if (typeof firebaseService.saveOrder === 'function') {
                console.log('🔍 BUSINESS MANAGER DEBUG - Using firebaseService.saveOrder...');
                const orderId = await firebaseService.saveOrder(businessId, {
                    ...order,
                    customerName: sender,
                    messageId: messageId,
                    status: 'pending',
                    createdAt: new Date().toISOString()
                });
                
                if (orderId) {
                    console.log('✅ BUSINESS MANAGER DEBUG - Order saved via firebaseService with ID:', orderId);
                    return true;
                }
            }
            
            // Fallback: Direct Firebase approach
            const admin = require('firebase-admin');
            const db = admin.firestore();
            
            const orderDoc = {
                businessId: businessId,
                customerName: sender,
                customerInfo: order.customerInfo,
                items: order.items,
                total: order.total,
                discountCode: order.discountCode,
                discountAmount: order.discountAmount,
                messageId: messageId,
                status: 'pending',
                createdAt: new Date().toISOString()
            };
            
            const docRef = await db.collection('orders').add(orderDoc);
            console.log('✅ BUSINESS MANAGER DEBUG - Order saved with ID:', docRef.id);
            
            return true;
        } catch (error) {
            console.error('❌ BUSINESS MANAGER DEBUG - Error saving order:', error);
            return false;
        }
    }

    // ADD: Increment customer score
    async incrementCustomerScore(businessId, accountName) {
        console.log('🔍 BUSINESS MANAGER DEBUG - incrementCustomerScore called');
        console.log('🔍 BUSINESS MANAGER DEBUG - Business ID:', businessId);
        console.log('🔍 BUSINESS MANAGER DEBUG - Account Name:', accountName);
        
        try {
            const admin = require('firebase-admin');
            const db = admin.firestore();
            
            const customerQuery = await db.collection('customers')
                .where('businessId', '==', businessId)
                .where('accountName', '==', accountName)
                .get();
                
            if (!customerQuery.empty) {
                const customerDoc = customerQuery.docs[0];
                const currentScore = customerDoc.data().score || 0;
                
                await customerDoc.ref.update({
                    score: currentScore + 1,
                    updatedAt: new Date().toISOString()
                });
                
                console.log('✅ BUSINESS MANAGER DEBUG - Customer score incremented from', currentScore, 'to', currentScore + 1);
            }
        } catch (error) {
            console.error('❌ BUSINESS MANAGER DEBUG - Error incrementing score:', error);
        }
    }

    // Keep existing methods for backward compatibility
    async createCustomer(customerData, businessId) {
        try {
            const cleanUserId = customerData.phone?.split('@')[0] || customerData.userId?.split('@')[0];
            // Use your existing Firebase method
            const success = await firebaseService.saveCustomer(cleanUserId, businessId, customerData);
            if (success) {
                return { ...customerData, phone: cleanUserId };
            }
            throw new Error('Failed to save customer');
        } catch (error) {
            console.error(`❌ Failed to create customer for business ${businessId}:`, error);
            throw error;
        }
    }

    async updateCustomer(userId, customerData, businessId) {
        try {
            const cleanUserId = userId.split('@')[0];
            // Use your existing Firebase method (saveCustomer with merge: true)
            const success = await firebaseService.saveCustomer(cleanUserId, businessId, customerData);
            if (success) {
                return { ...customerData, phone: cleanUserId };
            }
            throw new Error('Failed to update customer');
        } catch (error) {
            console.error(`❌ Failed to update customer ${userId} for business ${businessId}:`, error);
            throw error;
        }
    }

    async getCustomerOrders(userId, businessId, limit = 10) {
        try {
            const cleanUserId = userId.split('@')[0];
            // Use your existing Firebase method
            return await firebaseService.getOrderHistory(cleanUserId, businessId, limit);
        } catch (error) {
            console.error(`❌ Failed to get orders for customer ${userId} in business ${businessId}:`, error);
            return [];
        }
    }

    // Order management methods - using your existing Firebase methods
    async createOrder(orderData, businessId) {
        try {
            // Use your existing Firebase method
            const orderId = await firebaseService.saveOrder(businessId, orderData);
            if (orderId) {
                return { ...orderData, id: orderId };
            }
            throw new Error('Failed to save order');
        } catch (error) {
            console.error(`❌ Failed to create order for business ${businessId}:`, error);
            throw error;
        }
    }

    async getOrder(orderId, businessId) {
        try {
            // You might need to add this method to Firebase service if it doesn't exist
            if (typeof firebaseService.getOrder === 'function') {
                return await firebaseService.getOrder(orderId, businessId);
            } else {
                console.log('⚠️ getOrder method not implemented in Firebase service');
                return null;
            }
        } catch (error) {
            console.error(`❌ Failed to get order ${orderId} for business ${businessId}:`, error);
            return null;
        }
    }

    async updateOrder(orderId, orderData, businessId) {
        try {
            // You might need to add this method to Firebase service if it doesn't exist
            if (typeof firebaseService.updateOrder === 'function') {
                return await firebaseService.updateOrder(orderId, orderData, businessId);
            } else {
                console.log('⚠️ updateOrder method not implemented in Firebase service');
                return false;
            }
        } catch (error) {
            console.error(`❌ Failed to update order ${orderId} for business ${businessId}:`, error);
            throw error;
        }
    }

    // Cache management
    clearCache(businessId = null) {
        if (businessId) {
            this.businessData.delete(businessId);
            this.cacheTimestamps.delete(businessId);
        } else {
            this.businessData.clear();
            this.cacheTimestamps.clear();
        }
    }

    async refreshBusinessData(businessId) {
        this.clearCache(businessId);
        return await this.getBusinessData(businessId);
    }

    // Get business statistics
    getBusinessStats() {
        const stats = {
            totalBusinesses: this.phoneToBusinessMap.size,
            botMappings: this.botToBusinessMap.size,
            cachedBusinessData: this.businessData.size,
            mappings: Array.from(this.phoneToBusinessMap.entries()),
            botMappings: Array.from(this.botToBusinessMap.entries()),
            isInitialized: this.isInitialized
        };
        return stats;
    }

    // List all mapped bots
    listMappedBots() {
        console.log('🤖 Currently mapped bots:');
        if (this.botToBusinessMap.size === 0) {
            console.log('   No bots mapped yet');
        } else {
            this.botToBusinessMap.forEach((businessId, botNumber) => {
                console.log(`   📱 ${botNumber} → 🏢 ${businessId}`);
            });
        }
    }

    async shutdown() {
        console.log('🏢 Business Manager shutting down...');
        this.clearCache();
        this.phoneToBusinessMap.clear();
        this.botToBusinessMap.clear();
        this.isInitialized = false;
        console.log('✅ Business Manager shutdown complete');
    }

    // Health check
    isHealthy() {
        return this.isInitialized;
    }
}

module.exports = new BusinessManager();