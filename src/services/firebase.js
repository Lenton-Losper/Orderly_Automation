// File: src/services/firebase.js
// FIXED: Vendor discovery to properly handle root-level vendor documents
// The issue was the discovery logic was only checking profile subcollections

const { COLLECTIONS, DEFAULT_BUSINESS } = require('../config/constants');

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

class ScalableFirebaseService {
    constructor() {
        this.db = null;
        this.admin = null;
        this.isInitialized = false;
        this.vendorCache = new Map();
        this.phoneToVendorCache = new Map();
        this.lastCacheUpdate = 0;
        this.CACHE_TTL = 2 * 60 * 1000; // 2 minutes for faster updates
    }

    async initialize() {
        try {
            if (this.isInitialized) {
                console.log('Scalable Firebase service already initialized');
                return true;
            }

            console.log('Initializing Scalable Firebase service...');
            
            const { getDatabase, getFirebaseAdmin } = require('../config/database');
            
            this.admin = getFirebaseAdmin();
            this.db = getDatabase();
            
            if (!this.db || !this.admin) {
                throw new Error('Failed to get Firebase instances');
            }

            console.log('FIREBASE DEBUG - Connected to project:', this.admin.app().options.projectId);
            console.log('FIREBASE DEBUG - Service account:', this.admin.app().options.credential?.clientEmail);
            
            // CRITICAL: Run comprehensive Firebase verification
            await this.runFirebaseVerification();
            
            // Test direct query to vendors collection with detailed debugging
            console.log('FIREBASE DEBUG - Testing vendors collection access...');
            
            try {
                const vendorsTest = await this.db.collection('vendors').limit(5).get();
                console.log('FIREBASE DEBUG - Vendors found:', vendorsTest.size);
                
                if (vendorsTest.size > 0) {
                    vendorsTest.forEach(doc => {
                        const data = doc.data();
                        console.log(`FIREBASE DEBUG - Vendor ${doc.id}:`, Object.keys(data));
                        console.log(`FIREBASE DEBUG - Document exists: ${doc.exists}`);
                        console.log(`FIREBASE DEBUG - Has data: ${Object.keys(data).length > 0}`);
                    });
                } else {
                    console.log('FIREBASE DEBUG - No vendors found in query - investigating...');
                    
                    // Check if collection exists
                    const collections = await this.db.listCollections();
                    console.log('FIREBASE DEBUG - Available collections:', collections.map(c => c.id));
                    
                    // Try direct document access
                    console.log('FIREBASE DEBUG - Testing direct document access...');
                    // Test direct access to any vendor document (dynamic)
                    const vendorQuery = await this.db.collection('vendors').limit(1).get();
                    if (!vendorQuery.empty) {
                        const firstVendor = vendorQuery.docs[0];
                        const directTest = await this.db.collection('vendors').doc(firstVendor.id).get();
                        console.log(`FIREBASE DEBUG - Direct access to ${firstVendor.id} exists: ${directTest.exists}`);
                    }
                    
                    if (directTest.exists) {
                        const directData = directTest.data();
                        console.log(`FIREBASE DEBUG - Direct document has data: ${Object.keys(directData).length > 0}`);
                        console.log(`FIREBASE DEBUG - Direct document fields:`, Object.keys(directData));
                        
                        // Check subcollections
                        try {
                            const subcollections = await directTest.ref.listCollections();
                            console.log('FIREBASE DEBUG - Subcollections:', subcollections.map(c => c.id));
                        } catch (subError) {
                            console.log('FIREBASE DEBUG - Error checking subcollections:', subError.message);
                        }
                    } else {
                        console.log('FIREBASE DEBUG - No vendor documents found in collection');
                    }
                    
                    // Test with different query approaches
                    console.log('FIREBASE DEBUG - Testing alternative query methods...');
                    
                    // Try getting all documents without limit
                    const allDocsTest = await this.db.collection('vendors').get();
                    console.log(`FIREBASE DEBUG - All documents query returned: ${allDocsTest.size}`);
                    
                    // Try a specific where clause
                    const whereTest = await this.db.collection('vendors').where('__name__', '>=', '').get();
                    console.log(`FIREBASE DEBUG - Where query returned: ${whereTest.size}`);
                }
            } catch (queryError) {
                console.error('FIREBASE DEBUG - Query error:', queryError.message);
                console.error('FIREBASE DEBUG - Error code:', queryError.code);
                console.error('FIREBASE DEBUG - Error details:', queryError.details);
            }

            this.isInitialized = true;
            console.log('Scalable Firebase service initialized');
            
            // Pre-load vendor discovery cache
            await this.buildVendorDiscoveryCache();
            
            return true;
        } catch (error) {
            console.error('Failed to initialize Scalable Firebase service:', error);
            return false;
        }
    }

    // FIXED: Build vendor discovery cache that properly handles documents with only subcollections
    async buildVendorDiscoveryCache() {
        try {
            console.log('SCALABLE: Building comprehensive vendor discovery cache...');
            
            const vendorsRef = this.db.collection('vendors');
            const vendorsSnapshot = await vendorsRef.get();
            
            console.log(`Found ${vendorsSnapshot.size} vendor documents`);
            
            // Clear existing cache
            this.vendorCache.clear();
            this.phoneToVendorCache.clear();
            
            let processedVendors = 0;
            let vendorsWithPhones = 0;
            
            for (const vendorDoc of vendorsSnapshot.docs) {
                const vendorId = vendorDoc.id;
                
                try {
                    console.log(`SCALABLE: Processing vendor ${vendorId}...`);
                    
                    // Check if this vendor has valid structure (data or subcollections)
                    const hasValidStructure = await this.hasValidVendorStructure(vendorDoc);
                    
                    if (!hasValidStructure) {
                        console.log(`SCALABLE: Skipping ${vendorId} - no valid vendor structure`);
                        continue;
                    }
                    
                    let vendorProfile = null;
                    const directData = vendorDoc.data();
                    const isPhoneBasedId = /^\d{8,15}$/.test(vendorId);
                    
                    // Strategy 1: Try direct document data if it exists and is valid
                    if (directData && Object.keys(directData).length > 0 && this.hasValidVendorData(directData)) {
                        vendorProfile = this.normalizeVendorProfile(directData, vendorId);
                        // Use the vendorId as the phone number if it's phone-based
                        if (isPhoneBasedId) {
                            vendorProfile.phone = vendorId;
                        }
                        console.log(`SCALABLE: Using direct data for vendor: ${vendorId}`);
                    } 
                    // Strategy 2: Check profile subcollection
                    else {
                        console.log(`SCALABLE: Checking profile subcollection for ${vendorId}`);
                        const profileSnapshot = await vendorDoc.ref.collection('profile').get();
                        
                        if (!profileSnapshot.empty) {
                            const mainProfileDoc = profileSnapshot.docs.find(doc => doc.id === 'main');
                            const profileDoc = mainProfileDoc || profileSnapshot.docs[0];
                            
                            if (profileDoc && profileDoc.exists) {
                                const profileData = profileDoc.data();
                                if (this.hasValidVendorData(profileData)) {
                                    vendorProfile = this.normalizeVendorProfile(profileData, vendorId);
                                    console.log(`SCALABLE: Using profile subcollection for vendor: ${vendorId}`);
                                }
                            }
                        }
                        
                        // Strategy 3: For phone-based IDs with empty root data, create basic profile
                        if (!vendorProfile && isPhoneBasedId) {
                            console.log(`SCALABLE: Creating basic profile for phone-based vendor: ${vendorId}`);
                            vendorProfile = this.normalizeVendorProfile({
                                phone: vendorId,
                                name: `Vendor ${vendorId}`,
                                isActive: true
                            }, vendorId);
                        }
                    }
                    
                    if (vendorProfile) {
                        processedVendors++;
                        
                        // Cache vendor profile
                        this.vendorCache.set(vendorId, vendorProfile);
                        
                        // Create phone number mappings with multiple formats
                        if (vendorProfile.phone) {
                            const phoneVariants = this.generatePhoneVariants(vendorProfile.phone);
                            phoneVariants.forEach(phoneVariant => {
                                this.phoneToVendorCache.set(phoneVariant, vendorId);
                            });
                            
                            vendorsWithPhones++;
                            console.log(`SCALABLE: Phone mapping created: ${vendorProfile.phone} → ${vendorId}`);
                        }
                        
                        // Also map the vendorId directly if it's phone-based
                        if (isPhoneBasedId) {
                            const phoneVariants = this.generatePhoneVariants(vendorId);
                            phoneVariants.forEach(phoneVariant => {
                                this.phoneToVendorCache.set(phoneVariant, vendorId);
                            });
                            console.log(`SCALABLE: Direct vendor ID mapping: ${vendorId} → ${vendorId}`);
                        }
                    }
                } catch (vendorError) {
                    console.log(`Error processing vendor ${vendorId}: ${vendorError.message}`);
                }
            }
            
            this.lastCacheUpdate = Date.now();
            
            console.log(`SCALABLE: Vendor discovery cache built:`);
            console.log(`   Total vendors: ${vendorsSnapshot.size}`);
            console.log(`   Processed: ${processedVendors}`);
            console.log(`   With phones: ${vendorsWithPhones}`);
            console.log(`   Phone variants cached: ${this.phoneToVendorCache.size}`);
            
            // Debug: Show actual mappings
            console.log(`SCALABLE: Current phone mappings:`);
            this.phoneToVendorCache.forEach((vendorId, phone) => {
                console.log(`   ${phone} → ${vendorId}`);
            });
            
            return true;
        } catch (error) {
            console.error('Failed to build vendor discovery cache:', error);
            return false;
        }
    }

    // Enhanced phone variant generation for flexible matching
    generatePhoneVariants(phoneNumber) {
        if (!phoneNumber) return [];
        
        const cleaned = String(phoneNumber).replace(/\D/g, '');
        const variants = new Set();
        
        // Add original cleaned number
        variants.add(cleaned);
        
        // Namibian number patterns (264 country code)
        if (cleaned.startsWith('264')) {
            variants.add(cleaned.slice(3)); // Remove country code
            variants.add('0' + cleaned.slice(3)); // Add leading zero
        }
        
        // If starts with 0, add without 0 and with country code
        if (cleaned.startsWith('0')) {
            const withoutZero = cleaned.slice(1);
            variants.add(withoutZero);
            variants.add('264' + withoutZero);
        }
        
        // Add common international formats
        if (!cleaned.startsWith('264') && !cleaned.startsWith('0')) {
            variants.add('264' + cleaned);
            variants.add('0' + cleaned);
        }
        
        // Add last 8-9 digits for partial matching
        if (cleaned.length >= 8) {
            variants.add(cleaned.slice(-8));
            variants.add(cleaned.slice(-9));
        }
        
        return Array.from(variants).filter(v => v.length >= 7);
    }

    // FIXED: More lenient vendor data validation that handles empty root documents
    hasValidVendorData(data) {
        if (!data || typeof data !== 'object') return false;
        
        // Accept if it has any meaningful data
        const hasName = data.name || data.displayName || data.businessName;
        const hasPhone = data.phone || data.businessPhone;
        const hasEmail = data.email || data.businessEmail;
        const hasAnyIdentifier = hasName || hasPhone || hasEmail;
        
        return hasAnyIdentifier;
    }

    // NEW: Check if a document exists (even if empty) and has subcollections
    async hasValidVendorStructure(vendorDoc) {
        try {
            // If document has root-level data, check it
            const data = vendorDoc.data();
            if (data && Object.keys(data).length > 0) {
                return this.hasValidVendorData(data);
            }
            
            // If document exists but has no root data, check for subcollections
            if (vendorDoc.exists) {
                const subcollections = await vendorDoc.ref.listCollections();
                // If it has profile or products subcollections, it's likely a valid vendor
                const hasValidSubcollections = subcollections.some(c => 
                    ['profile', 'products', 'customers'].includes(c.id)
                );
                return hasValidSubcollections;
            }
            
            return false;
        } catch (error) {
            console.log(`Error checking vendor structure: ${error.message}`);
            return false;
        }
    }

    // FIXED: Enhanced vendor profile normalization
    normalizeVendorProfile(data, vendorId) {
        return {
            id: vendorId,
            name: data.name || data.displayName || data.businessName || `Vendor ${vendorId}`,
            phone: this.cleanPhoneNumber(data.phone || data.businessPhone || ''),
            email: data.email || data.businessEmail || '',
            username: data.username || '',
            address: data.address || data.businessAddress || '',
            description: data.description || data.businessDescription || '',
            isActive: data.isActive !== false,
            createdAt: data.createdAt || new Date().toISOString(),
            rawData: data
        };
    }

    // CRITICAL: Comprehensive Firebase verification method
    async runFirebaseVerification() {
        console.log('FIREBASE VERIFICATION - Starting comprehensive Firebase verification...');
        
        try {
            // 1. Project verification
            const app = this.admin.app();
            console.log('VERIFICATION - Project ID:', app.options.projectId);
            console.log('VERIFICATION - Service Account:', app.options.credential?.clientEmail || 'Unknown');
            
            // 2. Basic write/read test
            console.log('VERIFICATION - Testing basic Firestore operations...');
            try {
                const testDoc = await this.db.collection('_test').add({ 
                    timestamp: new Date(),
                    test: 'verification'
                });
                console.log('VERIFICATION - ✅ Can write to Firestore');
                
                const readBack = await testDoc.get();
                if (readBack.exists) {
                    console.log('VERIFICATION - ✅ Can read from Firestore');
                } else {
                    console.log('VERIFICATION - ❌ Cannot read what was written');
                }
                
                await testDoc.delete();
                console.log('VERIFICATION - ✅ Can delete from Firestore');
            } catch (basicError) {
                console.log('VERIFICATION - ❌ Basic operations failed:', basicError.message);
                console.log('VERIFICATION - Error code:', basicError.code);
            }
            
            // 3. Vendor collection specific test
            console.log('VERIFICATION - Testing vendor collection operations...');
            try {
                const testVendorId = 'test-' + Date.now();
                await this.db.collection('vendors').doc(testVendorId).set({
                    name: 'Test Vendor',
                    phone: process.env.DEFAULT_PHONE || 'Phone not configured',
                    testDocument: true,
                    created: new Date()
                });
                console.log('VERIFICATION - ✅ Can create vendor documents');
                
                // Test immediate read
                const createdVendor = await this.db.collection('vendors').doc(testVendorId).get();
                if (createdVendor.exists) {
                    console.log('VERIFICATION - ✅ Can read created vendor document');
                } else {
                    console.log('VERIFICATION - ❌ Cannot read created vendor document');
                }
                
                // Test query
                const vendorQuery = await this.db.collection('vendors').where('testDocument', '==', true).get();
                console.log('VERIFICATION - Query for test vendor returned:', vendorQuery.size, 'documents');
                
                // Clean up
                await this.db.collection('vendors').doc(testVendorId).delete();
                console.log('VERIFICATION - ✅ Test vendor document cleaned up');
                
                // Final verification - check if vendor collection now has documents
                const finalVendorCheck = await this.db.collection('vendors').limit(5).get();
                console.log('VERIFICATION - Final vendor collection size:', finalVendorCheck.size);
                
                if (finalVendorCheck.size === 0) {
                    console.log('VERIFICATION - ❌ CRITICAL: Vendor collection is completely empty after successful write test');
                    console.log('VERIFICATION - This confirms the vendor collection has NO documents');
                    console.log('VERIFICATION - Firebase Console may be showing phantom/virtual documents');
                } else {
                    console.log('VERIFICATION - ✅ Vendor collection has real documents');
                    finalVendorCheck.forEach(doc => {
                        console.log(`VERIFICATION - Found vendor: ${doc.id} with ${Object.keys(doc.data()).length} fields`);
                    });
                }
                
            } catch (vendorError) {
                console.log('VERIFICATION - ❌ Vendor operations failed:', vendorError.message);
                console.log('VERIFICATION - Error code:', vendorError.code);
                
                if (vendorError.code === 'permission-denied') {
                    console.log('VERIFICATION - PERMISSION ISSUE: Service account cannot access vendor collection');
                } else if (vendorError.code === 'unavailable') {
                    console.log('VERIFICATION - CONNECTION ISSUE: Firebase is unavailable');
                }
            }
            
        } catch (verificationError) {
            console.log('VERIFICATION - ❌ Verification failed:', verificationError.message);
        }
        
        console.log('FIREBASE VERIFICATION - Verification complete');
    }

    // Clean phone number for consistent matching
    cleanPhoneNumber(phone) {
        if (!phone) return '';
        
        console.log(`CLEAN PHONE DEBUG - Input: "${phone}"`);
        
        // Remove @s.whatsapp.net suffix first
        let cleaned = String(phone).split('@')[0];
        console.log(`CLEAN PHONE DEBUG - After removing @domain: "${cleaned}"`);
        
        // Remove WhatsApp device identifier (:1, :2, :3, etc.)
        cleaned = cleaned.split(':')[0];
        console.log(`CLEAN PHONE DEBUG - After removing device ID: "${cleaned}"`);
        
        // Remove only non-digit characters (but keep the digits intact)
        cleaned = cleaned.replace(/\D/g, '');
        console.log(`CLEAN PHONE DEBUG - Final cleaned: "${cleaned}"`);
        
        return cleaned;
    }

    // SCALABLE: Auto-discover and create mapping for any bot number
    async getOrCreateBusinessMapping(botPhoneNumber) {
        if (!this.isInitialized || !botPhoneNumber) {
            console.log('SCALABLE: Service not initialized or invalid bot number');
            return null;
        }

        try {
            console.log(`SCALABLE: Auto-mapping bot number: ${botPhoneNumber}`);
            
            const cleanBotNumber = this.cleanPhoneNumber(botPhoneNumber);
            console.log(`SCALABLE: Cleaned bot number: ${cleanBotNumber}`);
            
            // Step 1: Check if mapping already exists
            const existingMapping = await this.getExistingMapping(cleanBotNumber);
            if (existingMapping) {
                console.log(`SCALABLE: Found existing mapping: ${cleanBotNumber} → ${existingMapping.businessId}`);
                return existingMapping.businessId;
            }
            
            // Step 2: Refresh cache if needed
            await this.ensureCacheIsFresh();
            
            // Step 3: Search for matching vendor by phone
            const matchingVendorId = this.findVendorByPhone(cleanBotNumber);
            
            if (matchingVendorId) {
                console.log(`SCALABLE: Found matching vendor: ${cleanBotNumber} → ${matchingVendorId}`);
                
                // Step 4: Auto-create the mapping
                const mappingCreated = await this.createBusinessMapping(cleanBotNumber, matchingVendorId);
                
                if (mappingCreated) {
                    console.log(`SCALABLE: Auto-created mapping successfully`);
                    return matchingVendorId;
                } else {
                    console.log(`SCALABLE: Failed to create mapping`);
                }
            } else {
                console.log(`SCALABLE: No matching vendor found for: ${cleanBotNumber}`);
                console.log(`SCALABLE: Available phone mappings:`, Array.from(this.phoneToVendorCache.keys()));
                
                // NEW: Auto-create vendor document if none exists
                if (/^\d{8,15}$/.test(cleanBotNumber)) {
                    console.log(`SCALABLE: Auto-creating vendor document for phone-based bot: ${cleanBotNumber}`);
                    const createdVendorId = await this.autoCreateVendorDocument(cleanBotNumber);
                    
                    if (createdVendorId) {
                        console.log(`SCALABLE: Successfully auto-created vendor: ${createdVendorId}`);
                        
                        // Refresh cache to include new vendor
                        await this.buildVendorDiscoveryCache();
                        
                        // Create mapping
                        const mappingCreated = await this.createBusinessMapping(cleanBotNumber, createdVendorId);
                        if (mappingCreated) {
                            return createdVendorId;
                        }
                    }
                }
            }
            
            return null;
            
        } catch (error) {
            console.error('SCALABLE: Error in auto-mapping:', error);
            return null;
        }
    }

    // NEW: Auto-create vendor document for phone-based bot numbers
    async autoCreateVendorDocument(phoneNumber) {
        try {
            console.log(`AUTO-CREATE: Creating vendor document for phone: ${phoneNumber}`);
            
            const vendorData = {
                businessName: `Business ${phoneNumber}`,
                businessDescription: 'Auto-generated business profile',
                businessPhone: phoneNumber,
                businessEmail: '',
                businessAddress: '',
                isActive: true,
                category: 'business',
                // Fields for code compatibility
                name: `Business ${phoneNumber}`,
                phone: phoneNumber,
                email: '',
                description: 'Auto-generated business profile',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                autoCreated: true,
                source: 'whatsapp_bot_discovery'
            };
            
            // Create the vendor document
            await this.db.collection('vendors').doc(phoneNumber).set(vendorData);
            console.log(`AUTO-CREATE: Vendor document created: ${phoneNumber}`);
            
            // Verify creation
            const verifyDoc = await this.db.collection('vendors').doc(phoneNumber).get();
            if (verifyDoc.exists) {
                console.log(`AUTO-CREATE: Verification successful`);
                return phoneNumber;
            } else {
                console.log(`AUTO-CREATE: Verification failed`);
                return null;
            }
            
        } catch (error) {
            console.error(`AUTO-CREATE: Error creating vendor document:`, error);
            return null;
        }
    }

    // Check for existing mapping
    async getExistingMapping(phoneNumber) {
        try {
            const mappingRef = this.db.collection('whatsapp_business_mapping').doc(phoneNumber);
            const mappingDoc = await mappingRef.get();
            
            if (mappingDoc.exists) {
                return mappingDoc.data();
            }
            return null;
        } catch (error) {
            console.error('Error checking existing mapping:', error);
            return null;
        }
    }

    // Find vendor by phone number using cache
    findVendorByPhone(phoneNumber) {
        const phoneVariants = this.generatePhoneVariants(phoneNumber);
        
        for (const variant of phoneVariants) {
            if (this.phoneToVendorCache.has(variant)) {
                const vendorId = this.phoneToVendorCache.get(variant);
                console.log(`SCALABLE: Phone match found: ${variant} → ${vendorId}`);
                return vendorId;
            }
        }
        
        return null;
    }

    // Create business mapping document
    async createBusinessMapping(phoneNumber, vendorId) {
        try {
            const vendorProfile = this.vendorCache.get(vendorId);
            
            const mappingData = {
                phoneNumber: phoneNumber,
                businessId: vendorId,
                isBotNumber: true,
                type: 'bot',
                isActive: true,
                createdAt: this.admin.firestore.FieldValue.serverTimestamp(),
                autoCreated: true,
                scalableMapping: true,
                vendorName: vendorProfile?.name || 'Unknown',
                vendorEmail: vendorProfile?.email || '',
                discoveryMethod: 'scalable_auto_discovery',
                timestamp: new Date().toISOString()
            };
            
            const mappingRef = this.db.collection('whatsapp_business_mapping').doc(phoneNumber);
            await mappingRef.set(mappingData);
            
            console.log(`SCALABLE: Created mapping document: whatsapp_business_mapping/${phoneNumber}`);
            console.log(`SCALABLE: Mapping data:`, {
                phoneNumber,
                businessId: vendorId,
                vendorName: mappingData.vendorName
            });
            
            return true;
        } catch (error) {
            console.error('SCALABLE: Failed to create business mapping:', error);
            return false;
        }
    }

    // Ensure cache is fresh
    async ensureCacheIsFresh() {
        const cacheAge = Date.now() - this.lastCacheUpdate;
        
        if (cacheAge > this.CACHE_TTL) {
            console.log(`SCALABLE: Cache is ${Math.round(cacheAge / 1000)}s old, refreshing...`);
            await this.buildVendorDiscoveryCache();
        }
    }

    // FIXED: Get vendor business data that handles your structure
    async getBusinessData(businessId) {
        try {
            // Handle undefined businessId
            if (!businessId || businessId === 'undefined') {
                console.log('SCALABLE: Invalid business ID, returning default');
                return this.getDefaultBusinessData();
            }
            
            // Check cache first
            if (this.vendorCache.has(businessId)) {
                const cached = this.vendorCache.get(businessId);
                return this.formatBusinessData(cached);
            }
            
            // Fallback to direct Firebase query
            const vendorDoc = await this.db.collection('vendors').doc(businessId).get();
            
            if (vendorDoc.exists) {
                const directData = vendorDoc.data();
                
                // FIXED: Accept any vendor document with data
                if (directData && Object.keys(directData).length > 0) {
                    const profile = this.normalizeVendorProfile(directData, businessId);
                    // If it's a phone-based ID, use it as phone
                    if (/^\d{8,15}$/.test(businessId) && !profile.phone) {
                        profile.phone = businessId;
                    }
                    this.vendorCache.set(businessId, profile);
                    return this.formatBusinessData(profile);
                }
            }
            
            // Try profile subcollection as fallback
            const profileRef = this.db.collection('vendors').doc(businessId).collection('profile').doc('main');
            const profileDoc = await profileRef.get();
            
            if (profileDoc.exists) {
                const profileData = profileDoc.data();
                const profile = this.normalizeVendorProfile(profileData, businessId);
                this.vendorCache.set(businessId, profile);
                return this.formatBusinessData(profile);
            }
            
            // Return default if nothing found
            return this.getDefaultBusinessData();
            
        } catch (error) {
            console.error(`SCALABLE: Error getting business data for ${businessId}:`, error);
            return this.getDefaultBusinessData();
        }
    }

    // Format business data for existing code compatibility
    formatBusinessData(profile) {
        return {
            businessName: profile.name,
            businessDescription: profile.description || 'Fresh products and services',
            businessPhone: profile.phone || '',
            businessEmail: profile.email || '',
            businessAddress: profile.address || '',
            isActive: profile.isActive,
            logo: profile.avatarUrl || '',
            category: 'business',
            username: profile.username,
            ...profile.rawData
        };
    }

    // Default business data fallback
    getDefaultBusinessData() {
        return {
            businessName: 'Business Profile Required',
            businessDescription: 'Please complete your business profile',
            businessPhone: 'Phone not configured',
            businessEmail: 'Email not configured',
            businessAddress: 'Address not configured',
            isActive: true,
            logo: '',
            category: 'general'
        };
    }

    // Enhanced product loading with guaranteed structure - Updated for multi-tenant support
    async getBusinessProducts(businessId, tenantId = null) {
        try {
            // Handle undefined businessId
            if (!businessId || businessId === 'undefined') {
                console.log(`SCALABLE: Invalid business ID for products, returning empty array`);
                return [];
            }
            
            // Get tenantId from environment if not provided
            const effectiveTenantId = tenantId || process.env.TENANT_ID || 'default';
            
            console.log(`SCALABLE: Loading products for vendor: ${businessId}, tenant: ${effectiveTenantId}`);
            
            // Try multi-tenant path first
            let productsRef = this.db.collection('vendors')
                .doc(businessId)
                .collection('tenants')
                .doc(effectiveTenantId)
                .collection('products');
            
            let snapshot = await productsRef.get();
            
            // If no products found in tenant path, try legacy path for backward compatibility
            if (snapshot.empty && effectiveTenantId !== 'default') {
                console.log(`SCALABLE: No products found in tenant path, trying legacy path for backward compatibility`);
                productsRef = this.db.collection('vendors').doc(businessId).collection('products');
                snapshot = await productsRef.get();
            }
            
            console.log(`SCALABLE: Found ${snapshot.size} products for ${businessId} (tenant: ${effectiveTenantId})`);
            
            if (snapshot.empty) {
                console.log(`SCALABLE: No products found for vendor ${businessId} (tenant: ${effectiveTenantId})`);
                return [];
            }
            
            const products = [];
            
            snapshot.forEach(doc => {
                const data = doc.data();
                
                // Only include active/available products
                if (data.isActive !== false && data.isAvailable !== false) {
                    products.push({
                        id: doc.id,
                        name: data.name || 'Product',
                        price: parseFloat(data.price) || 0,
                        description: data.description || '',
                        category: data.category || 'general',
                        imageUrl: data.imageUrl || data.image || '',
                        stockQuantity: parseInt(data.stockQuantity || data.stock) || 99,
                        isAvailable: data.isAvailable !== false,
                        isActive: data.isActive !== false,
                        unit: data.unit || 'piece',
                        vendorId: businessId,
                        tenantId: effectiveTenantId,
                        ...data
                    });
                }
            });
            
            console.log(`SCALABLE: Processed ${products.length} active products for tenant ${effectiveTenantId}`);
            return products;
            
        } catch (error) {
            console.error(`SCALABLE: Error loading products for ${businessId} (tenant: ${tenantId}):`, error);
            return [];
        }
    }

    // Subscribe to real-time updates for a vendor's products
    // Returns an unsubscribe function
    subscribeToVendorProducts(businessId, onProductsChanged) {
        try {
            if (!businessId || businessId === 'undefined') {
                console.log('SCALABLE: Invalid business ID for product subscription');
                return () => {};
            }

            const productsRef = this.db
                .collection('vendors')
                .doc(businessId)
                .collection('products');

            const unsubscribe = productsRef.onSnapshot(
                (snapshot) => {
                    const products = {};

                    snapshot.forEach((doc) => {
                        const data = doc.data();

                        if (data && data.isActive !== false && data.isAvailable !== false) {
                            products[doc.id] = {
                                name: data.name || 'Product',
                                price: parseFloat(data.price) || 0,
                                description: data.description || '',
                                category: data.category || 'general',
                                stock: parseInt(data.stockQuantity || data.stock) || 99,
                                image: data.image || data.imageUrl || '🛍️',
                                isActive: data.isActive !== false,
                                isAvailable: data.isAvailable !== false
                            };
                        }
                    });

                    try {
                        if (typeof onProductsChanged === 'function') {
                            onProductsChanged(products);
                        }
                    } catch (cbErr) {
                        console.error('SCALABLE: Error in onProductsChanged callback:', cbErr);
                    }
                },
                (error) => {
                    console.error(`SCALABLE: Product subscription error for ${businessId}:`, error);
                }
            );

            console.log(`SCALABLE: Subscribed to products for vendor ${businessId}`);
            return unsubscribe;
        } catch (error) {
            console.error('SCALABLE: Failed to subscribe to vendor products:', error);
            return () => {};
        }
    }

    // Keep all your existing legacy methods unchanged...
    async getBusinessMappings() {
        if (!this.isInitialized) {
            return [];
        }

        try {
            const mappingsRef = this.db.collection('whatsapp_business_mapping');
            const snapshot = await mappingsRef.get();
            
            const mappings = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                mappings.push({
                    id: doc.id,
                    phoneNumber: data.phoneNumber,
                    businessId: data.businessId,
                    isBotNumber: data.isBotNumber || false,
                    type: data.type || 'customer',
                    createdAt: data.createdAt,
                    isActive: data.isActive !== false,
                    autoCreated: data.autoCreated || false,
                    scalableMapping: data.scalableMapping || false,
                    discoveryMethod: data.discoveryMethod || 'legacy',
                    ...data
                });
            });

            console.log(`Loaded ${mappings.length} business mappings from Firebase`);
            return mappings;
        } catch (error) {
            console.error('Failed to get business mappings:', error);
            return [];
        }
    }

    // Rest of your methods remain unchanged...
    async getBusinessProfile(businessId) {
        return await this.getBusinessData(businessId);
    }

    async autoMapBotToVendor(botPhoneNumber) {
        return await this.getOrCreateBusinessMapping(botPhoneNumber);
    }

    async refreshVendorCache() {
        return await this.buildVendorDiscoveryCache();
    }

    getCacheStats() {
        return {
            vendorsInCache: this.vendorCache.size,
            phoneMappingsInCache: this.phoneToVendorCache.size,
            lastCacheUpdate: new Date(this.lastCacheUpdate).toLocaleString(),
            cacheAge: Date.now() - this.lastCacheUpdate,
            isInitialized: this.isInitialized
        };
    }

    async debugVendorDiscovery() {
        console.log('SCALABLE DEBUG: Vendor Discovery Status');
        console.log('='.repeat(50));
        
        const stats = this.getCacheStats();
        console.log('Cache Stats:', stats);
        
        console.log('\nCached Vendors:');
        this.vendorCache.forEach((profile, vendorId) => {
            console.log(`   ${vendorId}: ${profile.name} (${profile.phone})`);
        });
        
        console.log('\nPhone Mappings:');
        this.phoneToVendorCache.forEach((vendorId, phone) => {
            console.log(`   ${phone} → ${vendorId}`);
        });
    }

    async discoverAllVendors() {
        console.log(`SCALABLE: Starting comprehensive vendor discovery...`);
        
        try {
            const vendorsRef = this.db.collection('vendors');
            const vendorsSnapshot = await vendorsRef.get();
            
            console.log(`SCALABLE: Found ${vendorsSnapshot.size} total vendors`);
            
            const discoveredVendors = [];
            
            for (const vendorDoc of vendorsSnapshot.docs) {
                const vendorId = vendorDoc.id;
                const isPhoneBasedId = /^\d{8,15}$/.test(vendorId);
                
                try {
                    let profile = null;
                    const directData = vendorDoc.data();
                    
                    if (directData && Object.keys(directData).length > 0) {
                        profile = directData;
                    } else {
                        const profileRef = this.db.collection('vendors')
                                                 .doc(vendorId)
                                                 .collection('profile')
                                                 .doc('main');
                        
                        const profileDoc = await profileRef.get();
                        
                        if (profileDoc.exists) {
                            profile = profileDoc.data();
                        }
                    }
                    
                    if (profile) {
                        discoveredVendors.push({
                            id: vendorId,
                            name: profile.name || profile.displayName || profile.businessName || 'Unknown',
                            phone: profile.phone || profile.businessPhone || (isPhoneBasedId ? vendorId : 'No phone'),
                            email: profile.email || profile.businessEmail || 'No email',
                            hasProfile: true,
                            isPhoneBased: isPhoneBasedId,
                            dataLocation: directData && Object.keys(directData).length > 0 ? 'direct' : 'subcollection'
                        });
                    } else {
                        discoveredVendors.push({
                            id: vendorId,
                            name: 'Unknown',
                            phone: isPhoneBasedId ? vendorId : 'No profile',
                            email: 'No profile',
                            hasProfile: false,
                            isPhoneBased: isPhoneBasedId,
                            dataLocation: 'none'
                        });
                    }
                } catch (vendorError) {
                    discoveredVendors.push({
                        id: vendorId,
                        name: 'Error',
                        phone: 'Error accessing profile',
                        email: vendorError.message,
                        hasProfile: false,
                        isPhoneBased: isPhoneBasedId,
                        dataLocation: 'error'
                    });
                }
            }
            
            console.log(`SCALABLE: Discovery Results:`);
            if (discoveredVendors.length === 0) {
                console.log('   No vendors found in Firebase');
            } else {
                discoveredVendors.forEach((vendor, index) => {
                    console.log(`   ${index + 1}. ${vendor.id} ${vendor.isPhoneBased ? '(Phone-based)' : ''}`);
                    console.log(`      Name: ${vendor.name}`);
                    console.log(`      Phone: ${vendor.phone}`);
                    console.log(`      Email: ${vendor.email}`);
                    console.log(`      Has Profile: ${vendor.hasProfile}`);
                    console.log(`      Data Location: ${vendor.dataLocation}`);
                    console.log('');
                });
            }
            
            return discoveredVendors;
            
        } catch (error) {
            console.error('Error in vendor discovery:', error);
            return [];
        }
    }

    isServiceReady() {
        return this.isInitialized && this.db !== null && this.admin !== null;
    }

    async testConnection() {
        if (!this.isInitialized) {
            return false;
        }

        try {
            const testRef = this.db.collection('whatsapp_business_mapping').limit(1);
            await testRef.get();
            console.log('Firebase connection test successful');
            return true;
        } catch (error) {
            console.error('Firebase connection test failed:', error);
            return false;
        }
    }

    async shutdown() {
        try {
            if (this.admin) {
                console.log('Clearing vendor cache...');
                this.vendorCache.clear();
                this.phoneToVendorCache.clear();
                console.log('Scalable Firebase service shutdown complete');
            }
            this.isInitialized = false;
            this.db = null;
            this.admin = null;
        } catch (error) {
            console.error('Error during Firebase shutdown:', error);
        }
    }
}

module.exports = new ScalableFirebaseService();