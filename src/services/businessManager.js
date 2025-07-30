// Updated services/businessManager.js
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
                console.log('⚠️  No business mappings found. All customers will use default business.');
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
                }
            });

            console.log(`📱 Loaded ${this.phoneToBusinessMap.size} customer mappings`);
            console.log(`🤖 Loaded ${this.botToBusinessMap.size} bot mappings`);
        } catch (error) {
            console.error('❌ Failed to load business mappings:', error);
            throw error;
        }
    }

    // NEW: Get business ID based on bot's phone number (who they're messaging)
    getBusinessIdFromBot(botPhoneNumber) {
        if (!botPhoneNumber) {
            console.log('⚠️  No bot phone number provided, using default business');
            return DEFAULT_BUSINESS;
        }

        // Clean the phone number (remove @s.whatsapp.net)
        const cleanBotNumber = botPhoneNumber.split('@')[0];
        
        // Check if this bot number is mapped to a specific business
        if (this.botToBusinessMap.has(cleanBotNumber)) {
            const businessId = this.botToBusinessMap.get(cleanBotNumber);
            console.log(`🎯 Bot ${cleanBotNumber} mapped to business: ${businessId}`);
            return businessId;
        }

        // Fallback: Check if bot number has business mapping (legacy)
        if (this.phoneToBusinessMap.has(cleanBotNumber)) {
            const businessId = this.phoneToBusinessMap.get(cleanBotNumber);
            console.log(`🎯 Bot ${cleanBotNumber} found in legacy mapping: ${businessId}`);
            return businessId;
        }

        console.log(`⚠️  Bot ${cleanBotNumber} not mapped, using default business`);
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

    // Rest of the class remains the same...
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