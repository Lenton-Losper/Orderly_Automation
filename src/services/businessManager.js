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

    async getBusinessProducts(businessId) {
        try {
            return await firebaseService.getBusinessProducts(businessId);
        } catch (error) {
            console.error(`❌ Failed to get products for business ${businessId}:`, error);
            return [];
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

    // Add these methods to your BusinessManager class

    // Customer management methods
    async getExistingCustomer(userId, businessId) {
        try {
            // Clean the userId (remove @s.whatsapp.net if present)
            const cleanUserId = userId.split('@')[0];
            return await firebaseService.getCustomer(cleanUserId, businessId);
        } catch (error) {
            console.error(`❌ Failed to get customer ${userId} for business ${businessId}:`, error);
            return null;
        }
    }

    async createCustomer(customerData, businessId) {
        try {
            return await firebaseService.createCustomer(customerData, businessId);
        } catch (error) {
            console.error(`❌ Failed to create customer for business ${businessId}:`, error);
            throw error;
        }
    }

    async updateCustomer(userId, customerData, businessId) {
        try {
            const cleanUserId = userId.split('@')[0];
            return await firebaseService.updateCustomer(cleanUserId, customerData, businessId);
        } catch (error) {
            console.error(`❌ Failed to update customer ${userId} for business ${businessId}:`, error);
            throw error;
        }
    }

    async getCustomerOrders(userId, businessId) {
        try {
            const cleanUserId = userId.split('@')[0];
            return await firebaseService.getCustomerOrders(cleanUserId, businessId);
        } catch (error) {
            console.error(`❌ Failed to get orders for customer ${userId} in business ${businessId}:`, error);
            return [];
        }
    }

    // Order management methods
    async createOrder(orderData, businessId) {
        try {
            return await firebaseService.createOrder(orderData, businessId);
        } catch (error) {
            console.error(`❌ Failed to create order for business ${businessId}:`, error);
            throw error;
        }
    }

    async getOrder(orderId, businessId) {
        try {
            return await firebaseService.getOrder(orderId, businessId);
        } catch (error) {
            console.error(`❌ Failed to get order ${orderId} for business ${businessId}:`, error);
            return null;
        }
    }

    async updateOrder(orderId, orderData, businessId) {
        try {
            return await firebaseService.updateOrder(orderId, orderData, businessId);
        } catch (error) {
            console.error(`❌ Failed to update order ${orderId} for business ${businessId}:`, error);
            throw error;
        }
    }

    // Add these methods to your BusinessManager class (replace the ones I suggested earlier)

    // Customer management methods - using your existing Firebase methods
    async getExistingCustomer(userId, businessId) {
        try {
            // Clean the userId (remove @s.whatsapp.net if present)
            const cleanUserId = userId.split('@')[0];
            // Use your existing Firebase method
            return await firebaseService.getCustomer(cleanUserId, businessId);
        } catch (error) {
            console.error(`❌ Failed to get customer ${userId} for business ${businessId}:`, error);
            return null;
        }
    }

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