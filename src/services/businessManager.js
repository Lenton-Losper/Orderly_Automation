// File: src/services/businessManager.js
// Enhanced Business Manager with Dynamic Vendor Discovery Integration
// Manages business-to-bot mappings using dynamic Firebase vendor discovery
// Handles customer registration, orders, and business data management

const firebaseService = require('./firebase');
const { CACHE_CONFIG, DEFAULT_BUSINESS } = require('../config/constants');

// Enhanced phone number cleaning that handles WhatsApp device identifiers
// This fixes the issue where bot numbers have :3, :2, etc. appended
function cleanPhoneNumberForMapping(phoneNumber) {
    if (!phoneNumber) return '';
    
    console.log(`🔍 CLEAN DEBUG - Input: "${phoneNumber}"`);
    
    // Step 1: Remove @s.whatsapp.net suffix
    let cleaned = phoneNumber.split('@')[0];
    console.log(`🔍 CLEAN DEBUG - After removing @domain: "${cleaned}"`);
    
    // Step 2: Remove WhatsApp device identifier (:1, :2, :3, etc.)
    cleaned = cleaned.split(':')[0];
    console.log(`🔍 CLEAN DEBUG - After removing device ID: "${cleaned}"`);
    
    // Step 3: Remove any remaining non-digit characters
    cleaned = cleaned.replace(/\D/g, '');
    console.log(`🔍 CLEAN DEBUG - Final cleaned number: "${cleaned}"`);
    
    return cleaned;
}

class BusinessManager {
    constructor() {
        this.businessData = new Map(); // Cache business data
        this.phoneToBusinessMap = new Map(); // Phone to business mapping (legacy)
        this.botToBusinessMap = new Map(); // Bot phone to business mapping (new dynamic approach)
        this.cacheTimestamps = new Map(); // Cache timestamps for invalidation
        this.isInitialized = false;
        this.dynamicMappingEnabled = true; // Enable dynamic vendor discovery
    }

    async initialize() {
        try {
            console.log('🏢 Initializing Business Manager with dynamic vendor discovery...');
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
                console.log('⚠️  No business mappings found. Dynamic auto-mapping will be used when bot connects.');
                return;
            }

            // Load both customer mappings and bot mappings
            mappings.forEach(mapping => {
                // Customer phone to business mapping (legacy)
                this.phoneToBusinessMap.set(mapping.phoneNumber, mapping.businessId);
                
                // Bot phone to business mapping (dynamic approach)
                if (mapping.isBotNumber || mapping.type === 'bot') {
                    this.botToBusinessMap.set(mapping.phoneNumber, mapping.businessId);
                    console.log(`🤖 Bot ${mapping.phoneNumber} mapped to business: ${mapping.businessId}`);
                    
                    if (mapping.autoMapped) {
                        console.log(`   ✨ Auto-mapped vendor: ${mapping.vendorName}`);
                        if (mapping.discoveryMethod === 'dynamic_firebase_query') {
                            console.log(`   🔄 Discovered via: Dynamic Firebase Query`);
                        }
                    }
                }
            });

            console.log(`📱 Loaded ${this.phoneToBusinessMap.size} customer mappings`);
            console.log(`🤖 Loaded ${this.botToBusinessMap.size} bot mappings`);
            
            // Show mapping details for debugging
            this.logMappingDetails();
            
        } catch (error) {
            console.error('❌ Failed to load business mappings:', error);
            throw error;
        }
    }

    // NEW: Log mapping details for debugging
    logMappingDetails() {
        console.log(`📊 MAPPING DETAILS:`);
        console.log(`   Bot Mappings:`);
        if (this.botToBusinessMap.size === 0) {
            console.log(`     No bot mappings found`);
        } else {
            this.botToBusinessMap.forEach((businessId, botPhone) => {
                console.log(`     📱 ${botPhone} → 🏢 ${businessId}`);
            });
        }
    }

    // ENHANCED: Dynamic business ID resolution with comprehensive fallback strategy
    async getBusinessIdFromBot(botPhoneNumber) {
        if (!botPhoneNumber) {
            console.log('⚠️  No bot phone number provided, using default business');
            return DEFAULT_BUSINESS;
        }

        // FIXED: Enhanced cleaning to remove device identifiers
        const cleanBotNumber = cleanPhoneNumberForMapping(botPhoneNumber);
        console.log(`🔍 DYNAMIC MAPPING - Processing bot number: ${botPhoneNumber} → ${cleanBotNumber}`);
        
        // Step 1: Check existing cached mappings
        if (this.botToBusinessMap.has(cleanBotNumber)) {
            const businessId = this.botToBusinessMap.get(cleanBotNumber);
            console.log(`🎯 CACHE HIT - Bot ${cleanBotNumber} mapped to business: ${businessId}`);
            return businessId;
        }

        // Step 2: Try dynamic vendor discovery via Firebase service
        if (this.dynamicMappingEnabled) {
            console.log(`🔍 DYNAMIC DISCOVERY - No cache hit, attempting dynamic vendor discovery...`);
            
            try {
                // Use the enhanced Firebase service for dynamic discovery
                const autoMappedBusinessId = await firebaseService.autoMapBotToVendor(botPhoneNumber);
                
                if (autoMappedBusinessId) {
                    // Update our cache with the newly discovered mapping
                    this.botToBusinessMap.set(cleanBotNumber, autoMappedBusinessId);
                    console.log(`✨ DYNAMIC SUCCESS - Auto-mapped bot ${cleanBotNumber} to business: ${autoMappedBusinessId}`);
                    console.log(`🔄 Cache updated with new mapping`);
                    return autoMappedBusinessId;
                } else {
                    console.log(`❌ DYNAMIC DISCOVERY FAILED - No matching vendor found`);
                }
            } catch (error) {
                console.error(`❌ Error in dynamic vendor discovery for bot ${cleanBotNumber}:`, error);
            }
        } else {
            console.log(`⚠️ Dynamic mapping is disabled, skipping vendor discovery`);
        }

        // Step 3: Fallback to legacy customer mapping
        if (this.phoneToBusinessMap.has(cleanBotNumber)) {
            const businessId = this.phoneToBusinessMap.get(cleanBotNumber);
            console.log(`🎯 LEGACY FALLBACK - Bot ${cleanBotNumber} found in customer mapping: ${businessId}`);
            return businessId;
        }

        // Step 4: Final fallback with troubleshooting info
        console.log(`⚠️  FALLBACK TO DEFAULT - Bot ${cleanBotNumber} not mapped, using default business`);
        console.log(`💡 TROUBLESHOOTING STEPS:`);
        console.log(`   Original: ${botPhoneNumber}`);
        console.log(`   Cleaned: ${cleanBotNumber}`);
        console.log(`   1. Ensure vendor profile exists in Firebase with phone: ${cleanBotNumber}`);
        console.log(`   2. Check vendor profile has all required fields (name, phone, email)`);
        console.log(`   3. Verify Firebase permissions allow reading vendor profiles`);
        console.log(`   4. Run discoverAllVendors() to see all available vendors`);
        console.log(`   5. Consider manual mapping if needed`);
        
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

    // ENHANCED: Refresh mappings with dynamic discovery
    async refreshMappings() {
        try {
            console.log('🔄 Refreshing business mappings with dynamic discovery...');
            
            // Clear existing mappings
            this.phoneToBusinessMap.clear();
            this.botToBusinessMap.clear();
            
            // Refresh Firebase vendor cache
            await firebaseService.refreshVendorCache();
            
            // Reload mappings from Firebase
            await this.loadBusinessMappings();
            
            console.log('✅ Business mappings refreshed with latest vendor data');
        } catch (error) {
            console.error('❌ Failed to refresh business mappings:', error);
        }
    }

    // ENHANCED: Force auto-mapping with dynamic discovery
    async forceAutoMapping(botPhoneNumber) {
        try {
            console.log(`🔧 FORCE MAPPING - Initiating dynamic discovery for bot: ${botPhoneNumber}`);
            
            // Clear any existing cache for this bot
            const cleanBotNumber = cleanPhoneNumberForMapping(botPhoneNumber);
            this.botToBusinessMap.delete(cleanBotNumber);
            
            // Force refresh vendor cache
            await firebaseService.refreshVendorCache();
            
            // Attempt dynamic mapping
            const businessId = await firebaseService.autoMapBotToVendor(botPhoneNumber);
            
            if (businessId) {
                this.botToBusinessMap.set(cleanBotNumber, businessId);
                console.log(`✅ FORCE MAPPING SUCCESS - Bot ${cleanBotNumber} mapped to business: ${businessId}`);
                return businessId;
            } else {
                console.log(`❌ FORCE MAPPING FAILED - No vendor found for bot: ${botPhoneNumber}`);
                
                // Show all available vendors for debugging
                await this.debugAvailableVendors();
                return null;
            }
        } catch (error) {
            console.error('❌ Error in force auto-mapping:', error);
            return null;
        }
    }

    // NEW: Debug available vendors
    async debugAvailableVendors() {
        try {
            console.log(`🔍 DEBUG - Discovering all available vendors...`);
            const vendors = await firebaseService.discoverAllVendors();
            
            if (vendors.length === 0) {
                console.log(`⚠️ No vendors found in Firebase`);
            } else {
                console.log(`📋 Available vendors in Firebase:`);
                vendors.forEach((vendor, index) => {
                    console.log(`   ${index + 1}. ${vendor.id}`);
                    console.log(`      Name: ${vendor.name}`);
                    console.log(`      Phone: ${vendor.phone}`);
                    console.log(`      Has Profile: ${vendor.hasProfile}`);
                });
            }
            
            return vendors;
        } catch (error) {
            console.error('❌ Error debugging available vendors:', error);
            return [];
        }
    }

    // NEW: Manual mapping creation
    async createManualMapping(botPhoneNumber, vendorId) {
        try {
            console.log(`🔧 MANUAL MAPPING - Creating mapping: ${botPhoneNumber} → ${vendorId}`);
            
            const cleanBotNumber = cleanPhoneNumberForMapping(botPhoneNumber);
            
            // Verify vendor exists
            const vendorProfile = await firebaseService.getBusinessProfile(vendorId);
            if (!vendorProfile || vendorProfile.businessName === 'LLL Farm') {
                console.log(`❌ Vendor ${vendorId} not found or has default profile`);
                return false;
            }
            
            // Create mapping in Firebase
            const mappingData = {
                phoneNumber: cleanBotNumber,
                businessId: vendorId,
                isBotNumber: true,
                type: 'bot',
                createdAt: new Date().toISOString(),
                isActive: true,
                autoMapped: false,
                description: 'Manually created WhatsApp Bot mapping',
                manuallyCreated: true,
                createdBy: 'BusinessManager'
            };
            
            const db = firebaseService.db;
            const mappingRef = db.collection('whatsapp_business_mapping').doc(cleanBotNumber);
            await mappingRef.set(mappingData);
            
            // Update local cache
            this.botToBusinessMap.set(cleanBotNumber, vendorId);
            
            console.log(`✅ MANUAL MAPPING SUCCESS - Created mapping: ${cleanBotNumber} → ${vendorId}`);
            return vendorId;
            
        } catch (error) {
            console.error('❌ Error creating manual mapping:', error);
            return false;
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

    // CUSTOMER MANAGEMENT METHODS - Enhanced with comprehensive debugging
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

            // Clean WhatsApp ID using the enhanced function
            const cleanWhatsAppId = cleanPhoneNumberForMapping(whatsappId);
            console.log('🔍 BUSINESS MANAGER DEBUG - Clean WhatsApp ID:', cleanWhatsAppId);
            
            // Check if business ID is default (might indicate mapping issue)
            if (businessId === DEFAULT_BUSINESS) {
                console.log('⚠️ BUSINESS MANAGER DEBUG - Using default business, might indicate bot mapping issue');
            }
            
            // Try using existing Firebase service methods first
            if (typeof firebaseService.saveCustomer === 'function') {
                console.log('🔍 BUSINESS MANAGER DEBUG - Using firebaseService.saveCustomer...');
                
                try {
                    const success = await firebaseService.saveCustomer(cleanWhatsAppId, businessId, {
                        ...customerData,
                        whatsappId: cleanWhatsAppId,
                        createdAt: new Date().toISOString(),
                        isActive: true,
                        score: 0,
                        registrationMethod: 'whatsapp_bot'
                    });
                    
                    if (success) {
                        console.log('✅ BUSINESS MANAGER DEBUG - Customer saved via firebaseService');
                        return { 
                            success: true, 
                            accountName: customerData.accountName,
                            businessId: businessId
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
            
            // Check if account name already exists for this business
            console.log('🔍 BUSINESS MANAGER DEBUG - Checking for existing account name...');
            const existingCustomer = await db.collection('customers')
                .where('businessId', '==', businessId)
                .where('accountName', '==', customerData.accountName)
                .get();
                
            console.log('🔍 BUSINESS MANAGER DEBUG - Existing customer query result empty:', existingCustomer.empty);
            console.log('🔍 BUSINESS MANAGER DEBUG - Existing customer query size:', existingCustomer.size);
            
            if (!existingCustomer.empty) {
                console.log('❌ BUSINESS MANAGER DEBUG - Account name already exists for this business');
                return { success: false, message: 'Account name already exists for this business' };
            }
            
            // Check if WhatsApp ID already has an account for this business
            console.log('🔍 BUSINESS MANAGER DEBUG - Checking for existing WhatsApp ID...');
            const existingWhatsAppCustomer = await db.collection('customers')
                .where('businessId', '==', businessId)
                .where('whatsappId', '==', cleanWhatsAppId)
                .get();
                
            if (!existingWhatsAppCustomer.empty) {
                console.log('❌ BUSINESS MANAGER DEBUG - WhatsApp ID already has an account for this business');
                return { success: false, message: 'This WhatsApp number already has an account for this business' };
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
                totalSpent: 0,
                registrationMethod: 'whatsapp_bot_direct'
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
                customerId: docRef.id,
                businessId: businessId
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

    // ENHANCED: Get existing customer with business-specific lookup
    async getExistingCustomer(businessId, whatsappId) {
        console.log('🔍 BUSINESS MANAGER DEBUG - getExistingCustomer called');
        console.log('🔍 BUSINESS MANAGER DEBUG - Business ID:', businessId);
        console.log('🔍 BUSINESS MANAGER DEBUG - WhatsApp ID:', whatsappId);
        
        try {
            // Clean the userId using the enhanced function
            const cleanUserId = cleanPhoneNumberForMapping(whatsappId);
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
                console.log('👤 No existing customer found for business:', businessId, 'WhatsApp:', cleanUserId);
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
                totalSpent: customerData.totalSpent || 0,
                businessId: customerData.businessId
            };
            
        } catch (error) {
            console.error('❌ BUSINESS MANAGER DEBUG - Error getting existing customer:', error);
            console.log('👤 No existing customer found for business:', businessId, 'WhatsApp:', whatsappId);
            return null;
        }
    }

    // ORDER MANAGEMENT METHODS
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
                    createdAt: new Date().toISOString(),
                    businessId: businessId
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
                createdAt: new Date().toISOString(),
                orderSource: 'whatsapp_bot'
            };
            
            const docRef = await db.collection('orders').add(orderDoc);
            console.log('✅ BUSINESS MANAGER DEBUG - Order saved with ID:', docRef.id);
            
            return true;
        } catch (error) {
            console.error('❌ BUSINESS MANAGER DEBUG - Error saving order:', error);
            return false;
        }
    }

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

    // LEGACY METHODS - keeping for backward compatibility
    async createCustomer(customerData, businessId) {
        try {
            const cleanUserId = cleanPhoneNumberForMapping(customerData.phone || customerData.userId);
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
            const cleanUserId = cleanPhoneNumberForMapping(userId);
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
            const cleanUserId = cleanPhoneNumberForMapping(userId);
            return await firebaseService.getOrderHistory(cleanUserId, businessId, limit);
        } catch (error) {
            console.error(`❌ Failed to get orders for customer ${userId} in business ${businessId}:`, error);
            return [];
        }
    }

    async createOrder(orderData, businessId) {
        try {
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

    // CACHE MANAGEMENT
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

    // ENHANCED: Statistics with dynamic mapping info
    getBusinessStats() {
        const firebaseStats = firebaseService.getCacheStats();
        
        const stats = {
            totalBusinesses: this.phoneToBusinessMap.size,
            botMappings: this.botToBusinessMap.size,
            cachedBusinessData: this.businessData.size,
            mappings: Array.from(this.phoneToBusinessMap.entries()),
            botMappings: Array.from(this.botToBusinessMap.entries()),
            isInitialized: this.isInitialized,
            dynamicMappingEnabled: this.dynamicMappingEnabled,
            firebaseVendorCache: firebaseStats
        };
        return stats;
    }

    // List all mapped bots with enhanced info
    listMappedBots() {
        console.log('🤖 Currently mapped bots:');
        if (this.botToBusinessMap.size === 0) {
            console.log('   No bots mapped yet');
            console.log('   💡 Bots will be auto-mapped when they connect using dynamic discovery');
        } else {
            this.botToBusinessMap.forEach((businessId, botNumber) => {
                console.log(`   📱 ${botNumber} → 🏢 ${businessId}`);
            });
        }
        
        const firebaseStats = firebaseService.getCacheStats();
        console.log(`📊 Firebase vendor cache: ${firebaseStats.vendorsInCache} vendors, ${firebaseStats.phoneMappingsInCache} phone mappings`);
    }

    // NEW: Enable/disable dynamic mapping
    setDynamicMapping(enabled) {
        this.dynamicMappingEnabled = enabled;
        console.log(`🔄 Dynamic vendor mapping ${enabled ? 'ENABLED' : 'DISABLED'}`);
    }

    // NEW: Get cache and mapping status
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            dynamicMappingEnabled: this.dynamicMappingEnabled,
            botMappings: this.botToBusinessMap.size,
            customerMappings: this.phoneToBusinessMap.size,
            cachedBusinessData: this.businessData.size,
            firebaseCache: firebaseService.getCacheStats()
        };
    }

    async shutdown() {
        console.log('🏢 Business Manager shutting down...');
        this.clearCache();
        this.phoneToBusinessMap.clear();
        this.botToBusinessMap.clear();
        this.isInitialized = false;
        console.log('✅ Business Manager shutdown complete');
    }

    isHealthy() {
        return this.isInitialized && firebaseService.isServiceReady();
    }
}

module.exports = new BusinessManager();