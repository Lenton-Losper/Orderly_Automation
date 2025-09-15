// File: src/services/businessManager.js
// Enhanced Business Manager with Scalable Auto-Mapping Integration + Missing Methods
// ADDED: debugAvailableVendors method that was causing the error

const firebaseService = require('./firebase');
const { CACHE_CONFIG, DEFAULT_BUSINESS } = require('../config/constants');

// Enhanced phone number cleaning that handles WhatsApp device identifiers
function cleanPhoneNumberForMapping(phoneNumber) {
    if (!phoneNumber) return '';
    
    console.log(`CLEAN DEBUG - Input: "${phoneNumber}"`);
    
    // Step 1: Remove @s.whatsapp.net suffix
    let cleaned = String(phoneNumber).split('@')[0];
    console.log(`CLEAN DEBUG - After removing @domain: "${cleaned}"`);
    
    // Step 2: Remove WhatsApp device identifier (:1, :2, :3, etc.)
    cleaned = cleaned.split(':')[0];
    console.log(`CLEAN DEBUG - After removing device ID: "${cleaned}"`);
    
    // Step 3: Remove any remaining non-digit characters
    cleaned = cleaned.replace(/\D/g, '');
    console.log(`CLEAN DEBUG - Final cleaned number: "${cleaned}"`);
    
    return cleaned;
}

class BusinessManager {
    constructor() {
        this.businessData = new Map(); // Cache business data
        this.phoneToBusinessMap = new Map(); // Phone to business mapping (legacy)
        this.botToBusinessMap = new Map(); // Bot phone to business mapping
        this.cacheTimestamps = new Map(); // Cache timestamps for invalidation
        this.isInitialized = false;
        this.scalableMappingEnabled = true; // Enable scalable auto-mapping
    }

    async initialize() {
        try {
            console.log('Initializing Business Manager with scalable auto-mapping...');
            await this.loadBusinessMappings();
            this.isInitialized = true;
            console.log('Business Manager initialized successfully');
        } catch (error) {
            console.error('Failed to initialize Business Manager:', error);
            throw error;
        }
    }

    async loadBusinessMappings() {
        try {
            const mappings = await firebaseService.getBusinessMappings();
            console.log(`Loaded ${mappings.length} business mappings`);
            
            if (mappings.length === 0) {
                console.log('No business mappings found. Scalable auto-mapping will be used when bots connect.');
                return;
            }

            // Load both customer mappings and bot mappings
            mappings.forEach(mapping => {
                // Customer phone to business mapping (legacy)
                this.phoneToBusinessMap.set(mapping.phoneNumber, mapping.businessId);
                
                // Bot phone to business mapping
                if (mapping.isBotNumber || mapping.type === 'bot') {
                    this.botToBusinessMap.set(mapping.phoneNumber, mapping.businessId);
                    console.log(`Bot ${mapping.phoneNumber} mapped to business: ${mapping.businessId}`);
                    
                    if (mapping.autoCreated || mapping.scalableMapping) {
                        console.log(`   Auto-created via: ${mapping.discoveryMethod || 'scalable_auto_discovery'}`);
                    }
                }
            });

            console.log(`Loaded ${this.phoneToBusinessMap.size} customer mappings`);
            console.log(`Loaded ${this.botToBusinessMap.size} bot mappings`);
            
        } catch (error) {
            console.error('Failed to load business mappings:', error);
            throw error;
        }
    }

    // UPDATED: Scalable business ID resolution with guaranteed auto-mapping
    async getBusinessIdFromBot(botPhoneNumber) {
        if (!botPhoneNumber) {
            console.log('No bot phone number provided, using default business');
            return DEFAULT_BUSINESS.id;
        }

        const cleanBotNumber = cleanPhoneNumberForMapping(botPhoneNumber);
        console.log(`SCALABLE MAPPING - Processing bot number: ${botPhoneNumber} → ${cleanBotNumber}`);
        
        // Step 1: Check existing cached mappings
        if (this.botToBusinessMap.has(cleanBotNumber)) {
            const businessId = this.botToBusinessMap.get(cleanBotNumber);
            console.log(`CACHE HIT - Bot ${cleanBotNumber} mapped to business: ${businessId}`);
            return businessId;
        }

        // Step 2: Use scalable Firebase service for auto-mapping
        if (this.scalableMappingEnabled) {
            console.log(`SCALABLE DISCOVERY - Attempting automatic vendor discovery and mapping...`);
            
            try {
                // UPDATED: Use the new scalable auto-mapping method
                const autoMappedBusinessId = await firebaseService.getOrCreateBusinessMapping(botPhoneNumber);
                
                if (autoMappedBusinessId) {
                    // Update our cache with the newly discovered mapping
                    this.botToBusinessMap.set(cleanBotNumber, autoMappedBusinessId);
                    console.log(`SCALABLE SUCCESS - Auto-mapped bot ${cleanBotNumber} to business: ${autoMappedBusinessId}`);
                    console.log(`Cache updated with new mapping`);
                    return autoMappedBusinessId;
                } else {
                    console.log(`SCALABLE DISCOVERY FAILED - No matching vendor found`);
                }
            } catch (error) {
                console.error(`Error in scalable vendor discovery for bot ${cleanBotNumber}:`, error);
            }
        } else {
            console.log(`Scalable mapping is disabled, skipping auto-discovery`);
        }

        // Step 3: Fallback to legacy customer mapping
        if (this.phoneToBusinessMap.has(cleanBotNumber)) {
            const businessId = this.phoneToBusinessMap.get(cleanBotNumber);
            console.log(`LEGACY FALLBACK - Bot ${cleanBotNumber} found in customer mapping: ${businessId}`);
            return businessId;
        }

        // Step 4: Final fallback with troubleshooting info
        console.log(`FALLBACK TO DEFAULT - Bot ${cleanBotNumber} not mapped, using default business`);
        console.log(`TROUBLESHOOTING STEPS:`);
        console.log(`   Original: ${botPhoneNumber}`);
        console.log(`   Cleaned: ${cleanBotNumber}`);
        console.log(`   1. Ensure vendor profile exists in Firebase with phone: ${cleanBotNumber}`);
        console.log(`   2. Check vendor profile has all required fields (name, phone, email)`);
        console.log(`   3. Verify Firebase permissions allow reading vendor profiles`);
        console.log(`   4. Run debugVendorDiscovery() to see all available vendors`);
        console.log(`   5. Consider manual mapping if needed`);
        
        return DEFAULT_BUSINESS.id;
    }

    // Legacy method - kept for backward compatibility
    getBusinessId(customerPhoneNumber) {
        if (!customerPhoneNumber) {
            return DEFAULT_BUSINESS.id;
        }

        const cleanNumber = customerPhoneNumber.split('@')[0];
        return this.phoneToBusinessMap.get(cleanNumber) || DEFAULT_BUSINESS.id;
    }

    // UPDATED: Refresh mappings with scalable discovery
    async refreshMappings() {
        try {
            console.log('Refreshing business mappings with scalable discovery...');
            
            // Clear existing mappings
            this.phoneToBusinessMap.clear();
            this.botToBusinessMap.clear();
            
            // Refresh Firebase vendor cache if the service supports it
            if (typeof firebaseService.buildVendorDiscoveryCache === 'function') {
                await firebaseService.buildVendorDiscoveryCache();
            }
            
            // Reload mappings from Firebase
            await this.loadBusinessMappings();
            
            console.log('Business mappings refreshed with latest vendor data');
        } catch (error) {
            console.error('Failed to refresh business mappings:', error);
        }
    }

    // UPDATED: Force auto-mapping with scalable discovery
    async forceAutoMapping(botPhoneNumber) {
        try {
            console.log(`FORCE MAPPING - Initiating scalable discovery for bot: ${botPhoneNumber}`);
            
            // Clear any existing cache for this bot
            const cleanBotNumber = cleanPhoneNumberForMapping(botPhoneNumber);
            this.botToBusinessMap.delete(cleanBotNumber);
            
            // Force refresh vendor cache if available
            if (typeof firebaseService.buildVendorDiscoveryCache === 'function') {
                await firebaseService.buildVendorDiscoveryCache();
            }
            
            // Attempt scalable mapping
            const businessId = await firebaseService.getOrCreateBusinessMapping(botPhoneNumber);
            
            if (businessId) {
                this.botToBusinessMap.set(cleanBotNumber, businessId);
                console.log(`FORCE MAPPING SUCCESS - Bot ${cleanBotNumber} mapped to business: ${businessId}`);
                return businessId;
            } else {
                console.log(`FORCE MAPPING FAILED - No vendor found for bot: ${botPhoneNumber}`);
                
                // Show debug info if available
                if (typeof firebaseService.debugVendorDiscovery === 'function') {
                    await firebaseService.debugVendorDiscovery();
                }
                return null;
            }
        } catch (error) {
            console.error('Error in force auto-mapping:', error);
            return null;
        }
    }

    // ADDED: Missing debugAvailableVendors method that was causing the error
    async debugAvailableVendors() {
        try {
            console.log(`DEBUG - Discovering all available vendors...`);
            
            // Use Firebase service's discovery method if available
            if (typeof firebaseService.discoverAllVendors === 'function') {
                const vendors = await firebaseService.discoverAllVendors();
                return vendors;
            } else {
                console.log(`Firebase service discovery method not available`);
                return [];
            }
        } catch (error) {
            console.error('Error debugging available vendors:', error);
            return [];
        }
    }

    // UPDATED: Enhanced business data retrieval
    async getBusinessData(businessId) {
        try {
            // Handle undefined businessId
            if (!businessId || businessId === 'undefined') {
                console.log('Invalid business ID, using default');
                businessId = DEFAULT_BUSINESS.id;
            }
            
            // Check cache first
            if (this.businessData.has(businessId)) {
                const cacheTime = this.cacheTimestamps.get(businessId);
                const now = Date.now();
                
                if (now - cacheTime < CACHE_CONFIG.BUSINESS_DATA_TTL) {
                    return this.businessData.get(businessId);
                }
            }

            // Load from Firebase using the updated service
            const businessData = await firebaseService.getBusinessData(businessId);
            
            // Cache the data
            this.businessData.set(businessId, businessData);
            this.cacheTimestamps.set(businessId, Date.now());
            
            return businessData;
        } catch (error) {
            console.error(`Failed to get business data for ${businessId}:`, error);
            return {
                businessName: 'Our Business',
                businessDescription: 'Welcome to our business',
                isActive: true
            };
        }
    }

    async getBusinessProducts(businessId) {
        try {
            // Handle undefined businessId
            if (!businessId || businessId === 'undefined') {
                console.log('Invalid business ID for products, returning empty array');
                return [];
            }
            
            return await firebaseService.getBusinessProducts(businessId);
        } catch (error) {
            console.error(`Failed to get products for business ${businessId}:`, error);
            return [];
        }
    }

    // CUSTOMER MANAGEMENT METHODS - Enhanced for vendor subcollections with multi-tenant support
    async saveCustomer(businessId, customerData, whatsappId, tenantId = null) {
        console.log('BUSINESS MANAGER DEBUG - saveCustomer called');
        console.log('BUSINESS MANAGER DEBUG - Business ID:', businessId);
        console.log('BUSINESS MANAGER DEBUG - Customer Data:', JSON.stringify(customerData, null, 2));
        console.log('BUSINESS MANAGER DEBUG - WhatsApp ID:', whatsappId);
        console.log('BUSINESS MANAGER DEBUG - Tenant ID:', tenantId);
        
        try {
            // Validate inputs
            if (!businessId || businessId === 'undefined') {
                console.error('BUSINESS MANAGER DEBUG - Missing or invalid businessId');
                return { success: false, message: 'Missing business ID' };
            }
            
            if (!customerData || !customerData.accountName) {
                console.error('BUSINESS MANAGER DEBUG - Missing customer data or account name');
                return { success: false, message: 'Missing customer data' };
            }
            
            if (!whatsappId) {
                console.error('BUSINESS MANAGER DEBUG - Missing whatsappId');
                return { success: false, message: 'Missing WhatsApp ID' };
            }

            // Get tenantId from environment if not provided
            const effectiveTenantId = tenantId || process.env.TENANT_ID || 'default';

            // Clean WhatsApp ID
            const cleanWhatsAppId = cleanPhoneNumberForMapping(whatsappId);
            console.log('BUSINESS MANAGER DEBUG - Clean WhatsApp ID:', cleanWhatsAppId);
            
            // Check if business ID is default (might indicate mapping issue)
            if (businessId === DEFAULT_BUSINESS.id) {
                console.log('BUSINESS MANAGER DEBUG - Using default business, might indicate bot mapping issue');
            }
            
            // Import Firebase Admin directly
            const admin = require('firebase-admin');
            const db = admin.firestore();
            
            // Verify the vendor document exists before proceeding
            console.log('BUSINESS MANAGER DEBUG - Verifying vendor document exists...');
            const vendorDoc = await db.collection('vendors').doc(businessId).get();
            
            if (!vendorDoc.exists) {
                console.error('BUSINESS MANAGER DEBUG - Vendor document does not exist:', businessId);
                return { success: false, message: 'Vendor not found. Please contact support.' };
            }
            
            console.log('BUSINESS MANAGER DEBUG - Vendor document exists and verified');
            
            // Check if account name already exists in the tenant subcollection
            console.log('BUSINESS MANAGER DEBUG - Checking for existing account name in tenant subcollection...');
            const existingCustomer = await db.collection('vendors')
                .doc(businessId)
                .collection('tenants')
                .doc(effectiveTenantId)
                .collection('customers')
                .where('accountName', '==', customerData.accountName)
                .get();
                
            console.log('BUSINESS MANAGER DEBUG - Existing customer query result empty:', existingCustomer.empty);
            console.log('BUSINESS MANAGER DEBUG - Existing customer query size:', existingCustomer.size);
            
            if (!existingCustomer.empty) {
                console.log('BUSINESS MANAGER DEBUG - Account name already exists for this vendor/tenant');
                return { success: false, message: 'Account name already exists for this vendor/tenant' };
            }
            
            // Check if WhatsApp ID already has an account in the tenant subcollection
            console.log('BUSINESS MANAGER DEBUG - Checking for existing WhatsApp ID in tenant subcollection...');
            const existingWhatsAppCustomer = await db.collection('vendors')
                .doc(businessId)
                .collection('tenants')
                .doc(effectiveTenantId)
                .collection('customers')
                .where('whatsappId', '==', cleanWhatsAppId)
                .get();
                
            if (!existingWhatsAppCustomer.empty) {
                console.log('BUSINESS MANAGER DEBUG - WhatsApp ID already has an account for this vendor/tenant');
                return { success: false, message: 'This WhatsApp number already has an account for this vendor/tenant' };
            }
            
            // Create customer document in the tenant subcollection
            const customerDoc = {
                vendorId: businessId,
                tenantId: effectiveTenantId,
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
                registrationMethod: 'whatsapp_bot_scalable'
            };
            
            console.log('BUSINESS MANAGER DEBUG - Customer document to save:', JSON.stringify(customerDoc, null, 2));
            
            // Save to the tenant subcollection
            const tenantCustomersRef = db.collection('vendors')
                .doc(businessId)
                .collection('tenants')
                .doc(effectiveTenantId)
                .collection('customers');
            console.log('BUSINESS MANAGER DEBUG - Saving to tenant subcollection path: vendors/' + businessId + '/tenants/' + effectiveTenantId + '/customers');
            
            const docRef = await tenantCustomersRef.add(customerDoc);
            console.log('BUSINESS MANAGER DEBUG - Customer saved with ID:', docRef.id);
            console.log('BUSINESS MANAGER DEBUG - Full path: vendors/' + businessId + '/tenants/' + effectiveTenantId + '/customers/' + docRef.id);
            
            // Verify the document was created
            const savedDoc = await docRef.get();
            if (savedDoc.exists) {
                console.log('BUSINESS MANAGER DEBUG - Document verification successful in tenant subcollection');
                console.log('BUSINESS MANAGER DEBUG - Saved document data:', savedDoc.data());
            } else {
                console.error('BUSINESS MANAGER DEBUG - Document was not created properly in tenant subcollection');
            }
            
            return { 
                success: true, 
                accountName: customerData.accountName,
                customerId: docRef.id,
                vendorId: businessId,
                tenantId: effectiveTenantId,
                documentPath: `vendors/${businessId}/tenants/${effectiveTenantId}/customers/${docRef.id}`
            };
            
        } catch (error) {
            console.error('BUSINESS MANAGER DEBUG - Database error occurred');
            console.error('BUSINESS MANAGER DEBUG - Error name:', error.name);
            console.error('BUSINESS MANAGER DEBUG - Error message:', error.message);
            console.error('BUSINESS MANAGER DEBUG - Error code:', error.code);
            
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

    // Enhanced: Get existing customer from vendor subcollection with multi-tenant support
    async getExistingCustomer(businessId, whatsappId, tenantId = null) {
        console.log('BUSINESS MANAGER DEBUG - getExistingCustomer called');
        console.log('BUSINESS MANAGER DEBUG - Business ID:', businessId);
        console.log('BUSINESS MANAGER DEBUG - WhatsApp ID:', whatsappId);
        console.log('BUSINESS MANAGER DEBUG - Tenant ID:', tenantId);
        
        try {
            // Handle undefined businessId
            if (!businessId || businessId === 'undefined') {
                console.log('BUSINESS MANAGER DEBUG - Invalid business ID, cannot query customers');
                return null;
            }
            
            // Get tenantId from environment if not provided
            const effectiveTenantId = tenantId || process.env.TENANT_ID || 'default';
            
            // Clean the userId
            const cleanUserId = cleanPhoneNumberForMapping(whatsappId);
            console.log('BUSINESS MANAGER DEBUG - Clean User ID:', cleanUserId);
            
            // Query the vendor subcollection
            const admin = require('firebase-admin');
            const db = admin.firestore();
            
            // Try multi-tenant path first
            console.log('BUSINESS MANAGER DEBUG - Querying tenant subcollection: vendors/' + businessId + '/tenants/' + effectiveTenantId + '/customers');
            let customerQuery = await db.collection('vendors')
                .doc(businessId)
                .collection('tenants')
                .doc(effectiveTenantId)
                .collection('customers')
                .where('whatsappId', '==', cleanUserId)
                .where('isActive', '==', true)
                .get();
                
            console.log('BUSINESS MANAGER DEBUG - Tenant customer query size:', customerQuery.size);
            
            // If no customers found in tenant path, try legacy path for backward compatibility
            if (customerQuery.empty && effectiveTenantId !== 'default') {
                console.log('BUSINESS MANAGER DEBUG - No customers found in tenant path, trying legacy path for backward compatibility');
                console.log('BUSINESS MANAGER DEBUG - Querying legacy subcollection: vendors/' + businessId + '/customers');
                customerQuery = await db.collection('vendors')
                    .doc(businessId)
                    .collection('customers')
                    .where('whatsappId', '==', cleanUserId)
                    .where('isActive', '==', true)
                    .get();
                console.log('BUSINESS MANAGER DEBUG - Legacy customer query size:', customerQuery.size);
            }
            
            if (customerQuery.empty) {
                console.log('No existing customer found in vendor subcollection for:', businessId, 'WhatsApp:', cleanUserId, 'Tenant:', effectiveTenantId);
                return null;
            }
            
            const customerDoc = customerQuery.docs[0];
            const customerData = customerDoc.data();
            
            console.log('BUSINESS MANAGER DEBUG - Existing customer found in vendor subcollection:', customerData.accountName);
            
            return {
                id: customerData.accountName,
                name: customerData.name,
                email: customerData.email,
                phone: customerData.phone,
                address: customerData.address,
                score: customerData.score || 0,
                totalOrders: customerData.totalOrders || 0,
                totalSpent: customerData.totalSpent || 0,
                vendorId: customerData.vendorId || businessId,
                tenantId: effectiveTenantId,
                documentId: customerDoc.id,
                documentPath: `vendors/${businessId}/tenants/${effectiveTenantId}/customers/${customerDoc.id}`
            };
            
        } catch (error) {
            console.error('BUSINESS MANAGER DEBUG - Error getting existing customer from vendor subcollection:', error);
            console.log('No existing customer found for vendor:', businessId, 'WhatsApp:', whatsappId, 'Tenant:', tenantId);
            return null;
        }
    }

    // ORDER MANAGEMENT METHODS - Save orders in vendor subcollection
    async saveOrder(businessId, whatsappId, order, messageId, tenantId = 'default') {
        console.log('BUSINESS MANAGER DEBUG - saveOrder called');
        console.log('BUSINESS MANAGER DEBUG - Business ID:', businessId);
        console.log('BUSINESS MANAGER DEBUG - Tenant ID:', tenantId);
        console.log('BUSINESS MANAGER DEBUG - WhatsApp ID:', whatsappId);
        console.log('BUSINESS MANAGER DEBUG - Message ID:', messageId);
        
        try {
            // Handle undefined businessId
            if (!businessId || businessId === 'undefined') {
                console.log('BUSINESS MANAGER DEBUG - Invalid business ID, cannot save order');
                return false;
            }
            
            // Save order in tenant-scoped subcollection
            const admin = require('firebase-admin');
            const db = admin.firestore();
            
            const orderDoc = {
                vendorId: businessId,
                tenantId: tenantId, // Include tenantId in order
                whatsappId: whatsappId, // Store WhatsApp ID for customer lookup
                customerName: order.customerInfo?.name || 'Customer', // Use customer name from order info
                customerInfo: order.customerInfo,
                items: order.items,
                total: order.total,
                discountCode: order.discountCode,
                discountAmount: order.discountAmount,
                messageId: messageId,
                status: 'pending',
                createdAt: new Date().toISOString(),
                orderSource: 'whatsapp_bot_multi_tenant'
            };
            
            // Save to tenant-scoped subcollection
            const tenantOrdersRef = db
                .collection('vendors')
                .doc(businessId)
                .collection('tenants')
                .doc(tenantId)
                .collection('orders');
            
            console.log('BUSINESS MANAGER DEBUG - Saving order to tenant subcollection: vendors/' + businessId + '/tenants/' + tenantId + '/orders');
            
            const docRef = await tenantOrdersRef.add(orderDoc);
            console.log('BUSINESS MANAGER DEBUG - Order saved with ID:', docRef.id);
            console.log('BUSINESS MANAGER DEBUG - Full path: vendors/' + businessId + '/tenants/' + tenantId + '/orders/' + docRef.id);
            
            // CRITICAL FIX: Update customer statistics after successful order save
            try {
                await this.updateCustomerStatistics(businessId, whatsappId, order.total, tenantId);
                console.log('BUSINESS MANAGER DEBUG - Customer statistics updated successfully');
            } catch (statsError) {
                console.error('BUSINESS MANAGER DEBUG - Error updating customer statistics (non-fatal):', statsError);
                // Don't fail the entire order save if stats update fails
            }
            
            return true;
        } catch (error) {
            console.error('BUSINESS MANAGER DEBUG - Error saving order to tenant subcollection:', error);
            return false;
        }
    }

    // Increment customer score in vendor subcollection
    async incrementCustomerScore(businessId, accountName) {
        console.log('BUSINESS MANAGER DEBUG - incrementCustomerScore called');
        console.log('BUSINESS MANAGER DEBUG - Business ID:', businessId);
        console.log('BUSINESS MANAGER DEBUG - Account Name:', accountName);
        
        try {
            // Handle undefined businessId
            if (!businessId || businessId === 'undefined') {
                console.log('BUSINESS MANAGER DEBUG - Invalid business ID, cannot increment score');
                return;
            }
            
            const admin = require('firebase-admin');
            const db = admin.firestore();
            
            // Query vendor subcollection
            const customerQuery = await db.collection('vendors')
                .doc(businessId)
                .collection('customers')
                .where('accountName', '==', accountName)
                .get();
                
            if (!customerQuery.empty) {
                const customerDoc = customerQuery.docs[0];
                const currentScore = customerDoc.data().score || 0;
                
                await customerDoc.ref.update({
                    score: currentScore + 1,
                    updatedAt: new Date().toISOString()
                });
                
                console.log('BUSINESS MANAGER DEBUG - Customer score incremented from', currentScore, 'to', currentScore + 1);
                console.log('BUSINESS MANAGER DEBUG - Updated in vendor subcollection: vendors/' + businessId + '/customers/' + customerDoc.id);
            }
        } catch (error) {
            console.error('BUSINESS MANAGER DEBUG - Error incrementing score in vendor subcollection:', error);
        }
    }

    // NEW: Update customer statistics after order completion
    async updateCustomerStatistics(businessId, whatsappId, orderTotal, tenantId = 'default') {
        console.log('CUSTOMER STATS DEBUG - updateCustomerStatistics called');
        console.log('CUSTOMER STATS DEBUG - Business ID:', businessId);
        console.log('CUSTOMER STATS DEBUG - WhatsApp ID:', whatsappId);
        console.log('CUSTOMER STATS DEBUG - Order Total:', orderTotal);
        console.log('CUSTOMER STATS DEBUG - Tenant ID:', tenantId);
        
        try {
            // Handle undefined businessId
            if (!businessId || businessId === 'undefined') {
                console.log('CUSTOMER STATS DEBUG - Invalid business ID, cannot update statistics');
                return false;
            }
            
            const admin = require('firebase-admin');
            const db = admin.firestore();
            
            // Find customer by whatsappId in tenant-scoped collection
            const customerQuery = await db
                .collection('vendors')
                .doc(businessId)
                .collection('tenants')
                .doc(tenantId)
                .collection('customers')
                .where('whatsappId', '==', whatsappId)
                .get();
            
            if (!customerQuery.empty) {
                const customerDoc = customerQuery.docs[0];
                const customerData = customerDoc.data();
                
                // Get current statistics
                const currentTotalOrders = customerData.totalOrders || 0;
                const currentTotalSpent = customerData.totalSpent || 0;
                
                // Calculate new statistics
                const newTotalOrders = currentTotalOrders + 1;
                const newTotalSpent = currentTotalSpent + orderTotal;
                
                // Update customer statistics
                await customerDoc.ref.update({
                    totalOrders: newTotalOrders,
                    totalSpent: newTotalSpent,
                    lastOrderDate: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
                
                console.log('CUSTOMER STATS DEBUG - Customer statistics updated:');
                console.log('CUSTOMER STATS DEBUG - Total Orders:', currentTotalOrders, '→', newTotalOrders);
                console.log('CUSTOMER STATS DEBUG - Total Spent:', currentTotalSpent, '→', newTotalSpent);
                console.log('CUSTOMER STATS DEBUG - Last Order Date:', new Date().toISOString());
                console.log('CUSTOMER STATS DEBUG - Updated in: vendors/' + businessId + '/tenants/' + tenantId + '/customers/' + customerDoc.id);
                
                return true;
            } else {
                console.log('CUSTOMER STATS DEBUG - Customer not found with WhatsApp ID:', whatsappId);
                return false;
            }
        } catch (error) {
            console.error('CUSTOMER STATS DEBUG - Error updating customer statistics:', error);
            return false;
        }
    }

    // LEGACY METHODS - Updated to use vendor subcollections but keep interface
    async createCustomer(customerData, businessId) {
        try {
            const cleanUserId = cleanPhoneNumberForMapping(customerData.phone || customerData.userId);
            const result = await this.saveCustomer(businessId, customerData, cleanUserId);
            if (result.success) {
                return { ...customerData, phone: cleanUserId };
            }
            throw new Error(result.message || 'Failed to save customer');
        } catch (error) {
            console.error(`Failed to create customer for business ${businessId}:`, error);
            throw error;
        }
    }

    async updateCustomer(userId, customerData, businessId) {
        try {
            const admin = require('firebase-admin');
            const db = admin.firestore();
            const cleanUserId = cleanPhoneNumberForMapping(userId);
            
            const customerQuery = await db.collection('vendors')
                .doc(businessId)
                .collection('customers')
                .where('whatsappId', '==', cleanUserId)
                .get();
                
            if (!customerQuery.empty) {
                const customerDoc = customerQuery.docs[0];
                await customerDoc.ref.update({
                    ...customerData,
                    updatedAt: new Date().toISOString()
                });
                return { ...customerData, phone: cleanUserId };
            }
            throw new Error('Customer not found in vendor subcollection');
        } catch (error) {
            console.error(`Failed to update customer ${userId} for business ${businessId}:`, error);
            throw error;
        }
    }

    async getCustomerOrders(userId, businessId, limit = 10, tenantId = null) {
        try {
            const admin = require('firebase-admin');
            const db = admin.firestore();
            const cleanUserId = cleanPhoneNumberForMapping(userId);
            
            // Get tenantId from environment if not provided
            const effectiveTenantId = tenantId || process.env.TENANT_ID || 'default';
            
            // Try multi-tenant path first
            let ordersQuery = await db.collection('vendors')
                .doc(businessId)
                .collection('tenants')
                .doc(effectiveTenantId)
                .collection('orders')
                .where('customerInfo.whatsappId', '==', cleanUserId)
                .orderBy('createdAt', 'desc')
                .limit(limit)
                .get();
                
            // If no orders found in tenant path, try legacy path for backward compatibility
            if (ordersQuery.empty && effectiveTenantId !== 'default') {
                console.log(`BUSINESS MANAGER DEBUG - No orders found in tenant path, trying legacy path for backward compatibility`);
                ordersQuery = await db.collection('vendors')
                    .doc(businessId)
                    .collection('orders')
                    .where('customerInfo.whatsappId', '==', cleanUserId)
                    .orderBy('createdAt', 'desc')
                    .limit(limit)
                    .get();
            }
                
            const orders = [];
            ordersQuery.forEach(doc => {
                orders.push({ id: doc.id, tenantId: effectiveTenantId, ...doc.data() });
            });
            
            return orders;
        } catch (error) {
            console.error(`Failed to get orders for customer ${userId} in business ${businessId} (tenant: ${tenantId}):`, error);
            return [];
        }
    }

    async createOrder(orderData, businessId, tenantId = null) {
        try {
            const admin = require('firebase-admin');
            const db = admin.firestore();
            
            // Get tenantId from environment if not provided
            const effectiveTenantId = tenantId || process.env.TENANT_ID || 'default';
            
            const orderDoc = {
                ...orderData,
                vendorId: businessId,
                tenantId: effectiveTenantId,
                createdAt: new Date().toISOString(),
                status: orderData.status || 'pending'
            };
            
            // Use multi-tenant path
            const docRef = await db.collection('vendors')
                .doc(businessId)
                .collection('tenants')
                .doc(effectiveTenantId)
                .collection('orders')
                .add(orderDoc);
            return { ...orderData, id: docRef.id, tenantId: effectiveTenantId };
        } catch (error) {
            console.error(`Failed to create order for business ${businessId} (tenant: ${tenantId}):`, error);
            throw error;
        }
    }

    async getOrder(orderId, businessId) {
        try {
            const admin = require('firebase-admin');
            const db = admin.firestore();
            
            const orderDoc = await db.collection('vendors').doc(businessId).collection('orders').doc(orderId).get();
            if (orderDoc.exists) {
                return { id: orderDoc.id, ...orderDoc.data() };
            }
            return null;
        } catch (error) {
            console.error(`Failed to get order ${orderId} for business ${businessId}:`, error);
            return null;
        }
    }

    async updateOrder(orderId, orderData, businessId) {
        try {
            const admin = require('firebase-admin');
            const db = admin.firestore();
            
            await db.collection('vendors').doc(businessId).collection('orders').doc(orderId).update({
                ...orderData,
                updatedAt: new Date().toISOString()
            });
            return true;
        } catch (error) {
            console.error(`Failed to update order ${orderId} for business ${businessId}:`, error);
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

    // UPDATED: Statistics with scalable mapping info
    getBusinessStats() {
        const firebaseStats = typeof firebaseService.getCacheStats === 'function' 
            ? firebaseService.getCacheStats() 
            : { note: 'Stats not available' };
        
        return {
            totalBusinesses: this.phoneToBusinessMap.size,
            botMappings: this.botToBusinessMap.size,
            cachedBusinessData: this.businessData.size,
            mappings: Array.from(this.phoneToBusinessMap.entries()),
            botMappingsList: Array.from(this.botToBusinessMap.entries()),
            isInitialized: this.isInitialized,
            scalableMappingEnabled: this.scalableMappingEnabled,
            firebaseVendorCache: firebaseStats
        };
    }

    // List all mapped bots
    listMappedBots() {
        console.log('Currently mapped bots:');
        if (this.botToBusinessMap.size === 0) {
            console.log('   No bots mapped yet');
            console.log('   Bots will be auto-mapped when they connect using scalable discovery');
        } else {
            this.botToBusinessMap.forEach((businessId, botNumber) => {
                console.log(`   ${botNumber} → ${businessId}`);
            });
        }
        
        if (typeof firebaseService.getCacheStats === 'function') {
            const firebaseStats = firebaseService.getCacheStats();
            console.log(`Firebase vendor cache: ${firebaseStats.vendorsInCache} vendors, ${firebaseStats.phoneMappingsInCache} phone mappings`);
        }
    }

    // Enable/disable scalable mapping
    setScalableMapping(enabled) {
        this.scalableMappingEnabled = enabled;
        console.log(`Scalable vendor mapping ${enabled ? 'ENABLED' : 'DISABLED'}`);
    }

    // Get cache and mapping status
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            scalableMappingEnabled: this.scalableMappingEnabled,
            botMappings: this.botToBusinessMap.size,
            customerMappings: this.phoneToBusinessMap.size,
            cachedBusinessData: this.businessData.size,
            firebaseCache: typeof firebaseService.getCacheStats === 'function' 
                ? firebaseService.getCacheStats() 
                : { note: 'Stats not available' }
        };
    }

    // Debug vendor discovery
    async debugVendorDiscovery() {
        console.log('BUSINESS MANAGER DEBUG: Vendor Discovery Status');
        console.log('='.repeat(50));
        
        const stats = this.getStatus();
        console.log('Business Manager Stats:', stats);
        
        // Call Firebase service debug if available
        if (typeof firebaseService.debugVendorDiscovery === 'function') {
            await firebaseService.debugVendorDiscovery();
        } else {
            console.log('Firebase service debug not available');
        }
    }

    // Create manual mapping
    async createManualMapping(botPhoneNumber, vendorId) {
        try {
            console.log(`MANUAL MAPPING - Creating mapping: ${botPhoneNumber} → ${vendorId}`);
            
            const cleanBotNumber = cleanPhoneNumberForMapping(botPhoneNumber);
            
            // Verify vendor exists
            const vendorProfile = await firebaseService.getBusinessData(vendorId);
            if (!vendorProfile || vendorProfile.businessName === 'Business') {
                console.log(`Vendor ${vendorId} not found or has default profile`);
                return false;
            }
            
            // Create mapping in Firebase
            const admin = require('firebase-admin');
            const db = admin.firestore();
            
            const mappingData = {
                phoneNumber: cleanBotNumber,
                businessId: vendorId,
                isBotNumber: true,
                type: 'bot',
                createdAt: new Date().toISOString(),
                isActive: true,
                autoCreated: false,
                description: 'Manually created WhatsApp Bot mapping',
                manuallyCreated: true,
                createdBy: 'BusinessManager'
            };
            
            const mappingRef = db.collection('whatsapp_business_mapping').doc(cleanBotNumber);
            await mappingRef.set(mappingData);
            
            // Update local cache
            this.botToBusinessMap.set(cleanBotNumber, vendorId);
            
            console.log(`MANUAL MAPPING SUCCESS - Created mapping: ${cleanBotNumber} → ${vendorId}`);
            return vendorId;
            
        } catch (error) {
            console.error('Error creating manual mapping:', error);
            return false;
        }
    }

    async shutdown() {
        console.log('Business Manager shutting down...');
        this.clearCache();
        this.phoneToBusinessMap.clear();
        this.botToBusinessMap.clear();
        this.isInitialized = false;
        console.log('Business Manager shutdown complete');
    }

    isHealthy() {
        return this.isInitialized && 
               (typeof firebaseService.isServiceReady === 'function' ? firebaseService.isServiceReady() : true);
    }
}

module.exports = new BusinessManager();