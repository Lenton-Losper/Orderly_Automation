// File: src/services/firebase.js
// Enhanced Firebase Service with Dynamic Vendor Discovery & Diagnostics
// Handles WhatsApp bot to vendor mapping, customer management, and product data
// Uses dynamic Firebase queries instead of hardcoded vendor IDs
// Added comprehensive diagnostics and structure detection

const { COLLECTIONS, DEFAULT_BUSINESS } = require('../config/constants');

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

// Enhanced phone number matching for Namibian numbers with comprehensive debugging
function normalizePhoneNumber(phone) {
    if (!phone) return '';
    
    console.log(`🔍 NORMALIZE DEBUG - Input phone: "${phone}" (type: ${typeof phone})`);
    
    // Convert to string and remove all non-digit characters including invisible Unicode
    const phoneStr = String(phone).trim();
    const digitsOnly = phoneStr.replace(/\D/g, '');
    
    console.log(`🔍 NORMALIZE DEBUG - Digits only: "${digitsOnly}"`);
    
    const normalized = {
        full: digitsOnly,
        withoutCountryCode: digitsOnly.startsWith('264') ? digitsOnly.slice(3) : digitsOnly,
        withLeadingZero: digitsOnly.startsWith('264') ? '0' + digitsOnly.slice(3) : (digitsOnly.startsWith('0') ? digitsOnly : '0' + digitsOnly),
        withoutLeadingZero: digitsOnly.startsWith('0') ? digitsOnly.slice(1) : digitsOnly,
        last9: digitsOnly.slice(-9),
        last8: digitsOnly.slice(-8),
        last7: digitsOnly.slice(-7)
    };
    
    console.log(`🔍 NORMALIZE DEBUG - Normalized variants:`, normalized);
    return normalized;
}

function phoneNumbersMatch(phone1, phone2) {
    console.log(`🔍 PHONE MATCH DEBUG - Comparing: "${phone1}" vs "${phone2}"`);
    
    const normalized1 = normalizePhoneNumber(phone1);
    const normalized2 = normalizePhoneNumber(phone2);
    
    const matches = {
        full: normalized1.full === normalized2.full,
        withoutCountryCode: normalized1.withoutCountryCode === normalized2.withoutCountryCode,
        withLeadingZero: normalized1.withLeadingZero === normalized2.withLeadingZero,
        withoutLeadingZero: normalized1.withoutLeadingZero === normalized2.withoutLeadingZero,
        last9: normalized1.last9 === normalized2.last9,
        last8: normalized1.last8 === normalized2.last8,
        last7: (normalized1.last7 === normalized2.last7 && normalized1.last7.length >= 7)
    };
    
    console.log(`🔍 PHONE MATCH DEBUG - Match results:`, matches);
    
    const isMatch = matches.full || matches.withoutCountryCode || matches.withLeadingZero || 
                   matches.withoutLeadingZero || matches.last9 || matches.last8 || matches.last7;
    
    console.log(`🔍 PHONE MATCH DEBUG - Final result: ${isMatch}`);
    return isMatch;
}

class FirebaseService {
    constructor() {
        this.db = null;
        this.admin = null;
        this.isInitialized = false;
        this.knownVendors = new Map(); // Cache vendor data to avoid repeated queries
        this.vendorPhoneCache = new Map(); // Cache vendor phone numbers for quick lookup
        this.lastVendorCacheUpdate = 0; // Timestamp of last cache update
        this.CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache TTL
    }

    async initialize() {
        try {
            if (this.isInitialized) {
                console.log('✅ Firebase service already initialized');
                return true;
            }

            console.log('🔥 Initializing Firebase service...');
            
            const { getDatabase, getFirebaseAdmin } = require('../config/database');
            
            this.admin = getFirebaseAdmin();
            this.db = getDatabase();
            
            if (!this.db || !this.admin) {
                throw new Error('Failed to get Firebase instances');
            }

            this.isInitialized = true;
            console.log('✅ Firebase service initialized successfully');
            
            // Pre-load vendor cache on initialization
            await this.refreshVendorCache();
            
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize Firebase service:', error);
            this.isInitialized = false;
            return false;
        }
    }

    // NEW: Firebase Structure Diagnostics
    async diagnoseFirebaseStructure() {
        try {
            console.log('🔍 FIREBASE STRUCTURE DIAGNOSIS');
            console.log('═══════════════════════════════════════');
            
            // Check vendors collection structure
            console.log('📋 Checking vendors collection...');
            const vendorsRef = this.db.collection('vendors');
            const vendorsSnapshot = await vendorsRef.get();
            
            console.log(`📊 Found ${vendorsSnapshot.size} documents in vendors collection`);
            
            if (vendorsSnapshot.size === 0) {
                console.log('❌ No documents found in vendors collection!');
                
                // Check if it's a subcollection issue
                console.log('🔍 Checking for subcollections...');
                
                // Try to list all collections at root level
                const collections = await this.db.listCollections();
                console.log('📁 Available collections at root:');
                collections.forEach(collection => {
                    console.log(`   - ${collection.id}`);
                });
                
                return { vendorCount: 0, structure: 'unknown' };
            }
            
            // Analyze existing vendors
            console.log('🔍 Analyzing vendor documents...');
            
            for (const vendorDoc of vendorsSnapshot.docs) {
                const vendorId = vendorDoc.id;
                const vendorData = vendorDoc.data();
                
                console.log(`\n📋 Vendor: ${vendorId}`);
                console.log(`   Direct data:`, Object.keys(vendorData));
                
                // Check for profile subcollection
                try {
                    const profileRef = vendorDoc.ref.collection('profile').doc('main');
                    const profileDoc = await profileRef.get();
                    
                    if (profileDoc.exists) {
                        const profileData = profileDoc.data();
                        console.log(`   ✅ Profile found:`, {
                            name: profileData.name || profileData.displayName,
                            phone: profileData.phone,
                            email: profileData.email
                        });
                    } else {
                        console.log(`   ❌ No profile/main document found`);
                    }
                } catch (error) {
                    console.log(`   ❌ Error accessing profile: ${error.message}`);
                }
            }
            
            return { 
                vendorCount: vendorsSnapshot.size, 
                structure: 'standard',
                vendors: vendorsSnapshot.docs.map(doc => ({ id: doc.id, data: doc.data() }))
            };
            
        } catch (error) {
            console.error('❌ Diagnosis failed:', error);
            return { vendorCount: 0, structure: 'error', error: error.message };
        }
    }

    // ENHANCED: Dynamic vendor cache management with diagnostics
    async refreshVendorCache() {
        try {
            console.log('🔄 ENHANCED: Refreshing vendor cache from Firebase...');
            
            // First, run diagnosis
            const diagnosis = await this.diagnoseFirebaseStructure();
            
            if (diagnosis.vendorCount === 0) {
                console.log('❌ No vendors found - check Firebase structure');
                return false;
            }
            
            const vendorsRef = this.db.collection('vendors');
            const vendorsSnapshot = await vendorsRef.get();
            
            console.log(`📋 Found ${vendorsSnapshot.size} vendor documents in Firebase`);
            
            let validVendors = 0;
            let vendorsWithPhones = 0;
            
            // Clear existing cache
            this.knownVendors.clear();
            this.vendorPhoneCache.clear();
            
            // Process each vendor with enhanced detection
            for (const vendorDoc of vendorsSnapshot.docs) {
                const vendorId = vendorDoc.id;
                
                try {
                    // Try multiple approaches to get vendor data
                    let profile = null;
                    
                    // Approach 1: Check if data is directly in vendor doc
                    const directData = vendorDoc.data();
                    if (directData && (directData.phone || directData.name || directData.email)) {
                        profile = directData;
                        console.log(`📱 Found direct vendor data for ${vendorId}:`, {
                            name: profile.name || profile.displayName,
                            phone: profile.phone,
                            email: profile.email
                        });
                    } else {
                        // Approach 2: Check profile subcollection
                        const profileRef = this.db.collection('vendors')
                                                 .doc(vendorId)
                                                 .collection('profile')
                                                 .doc('main');
                        
                        const profileDoc = await profileRef.get();
                        
                        if (profileDoc.exists) {
                            profile = profileDoc.data();
                            console.log(`📱 Found profile subcollection for ${vendorId}:`, {
                                name: profile.name || profile.displayName,
                                phone: profile.phone,
                                email: profile.email
                            });
                        }
                    }
                    
                    if (profile) {
                        validVendors++;
                        
                        // Cache vendor profile
                        this.knownVendors.set(vendorId, profile);
                        
                        // Cache phone number mapping if exists
                        if (profile.phone) {
                            const cleanPhone = cleanPhoneNumberForMapping(profile.phone);
                            this.vendorPhoneCache.set(cleanPhone, vendorId);
                            vendorsWithPhones++;
                            
                            console.log(`📱 Cached vendor: ${vendorId} → ${cleanPhone} (${profile.name || profile.displayName || 'Unknown'})`);
                            
                            // Special check for common bot numbers
                            if (cleanPhone === '264813141453') {
                                console.log(`🎯 FOUND MATCHING VENDOR! ${vendorId} matches bot number 264813141453`);
                            }
                        } else {
                            console.log(`⚠️ Vendor ${vendorId} has no phone number`);
                        }
                    } else {
                        console.log(`⚠️ Vendor ${vendorId} has no usable profile data`);
                    }
                } catch (vendorError) {
                    console.log(`❌ Error processing vendor ${vendorId}: ${vendorError.message}`);
                }
            }
            
            this.lastVendorCacheUpdate = Date.now();
            
            console.log(`✅ ENHANCED Vendor cache refreshed:`);
            console.log(`   📊 Total vendors: ${vendorsSnapshot.size}`);
            console.log(`   ✅ Valid profiles: ${validVendors}`);
            console.log(`   📱 With phone numbers: ${vendorsWithPhones}`);
            console.log(`   🕒 Cache updated at: ${new Date().toLocaleTimeString()}`);
            
            // Debug: Show all phone mappings
            console.log(`📱 Phone cache contents:`);
            this.vendorPhoneCache.forEach((vendorId, phone) => {
                console.log(`   ${phone} → ${vendorId}`);
            });
            
            return true;
            
        } catch (error) {
            console.error('❌ Failed to refresh vendor cache:', error);
            return false;
        }
    }

    // NEW: Manual vendor profile creation
    async createVendorProfile(phoneNumber, vendorData) {
        try {
            console.log(`🔧 Creating vendor profile for phone: ${phoneNumber}`);
            
            const vendorId = vendorData.vendorId || `vendor_${Date.now()}`;
            
            // Create vendor document with profile subcollection
            const vendorRef = this.db.collection('vendors').doc(vendorId);
            const profileRef = vendorRef.collection('profile').doc('main');
            
            const profileData = {
                name: vendorData.name || 'LLL Farm',
                displayName: vendorData.displayName || vendorData.name || 'LLL Farm',
                phone: phoneNumber,
                email: vendorData.email || 'info@lllfarm.com',
                address: vendorData.address || '',
                description: vendorData.description || 'Agricultural products and fresh meat',
                avatarUrl: vendorData.avatarUrl || '🥩',
                username: vendorData.username || 'lllfarm',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                isActive: true
            };
            
            // Save profile
            await profileRef.set(profileData);
            
            // Also create a basic vendor document
            await vendorRef.set({
                hasProfile: true,
                createdAt: new Date().toISOString()
            });
            
            console.log(`✅ Created vendor profile: ${vendorId}`);
            console.log(`📱 Phone: ${phoneNumber}`);
            console.log(`👤 Name: ${profileData.name}`);
            
            return vendorId;
            
        } catch (error) {
            console.error('❌ Failed to create vendor profile:', error);
            return null;
        }
    }

    // NEW: Immediate vendor fix function
    async immediateVendorFix() {
        console.log('🚀 IMMEDIATE VENDOR FIX');
        console.log('═══════════════════════════════════════');
        
        // 1. Run diagnosis
        await this.diagnoseFirebaseStructure();
        
        // 2. Try the enhanced cache refresh
        await this.refreshVendorCache();
        
        // 3. If still no vendors, create one manually for the bot
        if (this.vendorPhoneCache.size === 0) {
            console.log('🔧 No vendors found, creating vendor profile for bot...');
            
            const vendorId = await this.createVendorProfile('264813141453', {
                name: 'LLL Farm',
                email: 'info@lllfarm.com',
                description: 'Fresh meat and agricultural products',
                vendorId: 'r8DS3ktegrYoj3AIKvRWUByOKay1' // Use existing vendor ID if available
            });
            
            if (vendorId) {
                console.log(`✅ Created vendor profile: ${vendorId}`);
                
                // Refresh cache after creating
                await this.refreshVendorCache();
            }
        }
        
        console.log('🎯 Fix complete! Bot should now map correctly.');
        return this.vendorPhoneCache.size > 0;
    }

    // NEW: Check if vendor cache needs refresh
    async ensureVendorCacheIsFresh() {
        const now = Date.now();
        const cacheAge = now - this.lastVendorCacheUpdate;
        
        if (cacheAge > this.CACHE_TTL) {
            console.log(`🔄 Vendor cache is ${Math.round(cacheAge / 1000)}s old, refreshing...`);
            await this.refreshVendorCache();
        }
    }

    // ENHANCED: Dynamic vendor auto-mapping using Firebase queries with enhanced cleaning
    async autoMapBotToVendor(botPhoneNumber) {
        if (!this.isInitialized || !botPhoneNumber) {
            return null;
        }

        try {
            console.log(`🔍 AUTO-MAP DEBUG - Starting dynamic vendor discovery for bot: ${botPhoneNumber}`);
            
            // FIXED: Enhanced cleaning to remove device identifiers
            const cleanBotNumber = cleanPhoneNumberForMapping(botPhoneNumber);
            console.log(`🔍 AUTO-MAP DEBUG - Cleaned bot number: ${cleanBotNumber}`);
            
            // Check if mapping already exists in Firebase
            const existingMappingRef = this.db.collection('whatsapp_business_mapping').doc(cleanBotNumber);
            const existingMapping = await existingMappingRef.get();
            
            if (existingMapping.exists) {
                const mappingData = existingMapping.data();
                console.log(`✅ Found existing mapping: ${cleanBotNumber} → ${mappingData.businessId}`);
                return mappingData.businessId;
            }

            console.log(`🔍 AUTO-MAP DEBUG - No existing mapping found, searching all vendors dynamically...`);
            
            // Ensure vendor cache is fresh
            await this.ensureVendorCacheIsFresh();
            
            // First try: Quick lookup in phone cache
            console.log(`🔍 AUTO-MAP DEBUG - Checking phone cache for: ${cleanBotNumber}`);
            
            for (const [cachedPhone, vendorId] of this.vendorPhoneCache.entries()) {
                console.log(`🔍 AUTO-MAP DEBUG - Comparing "${cleanBotNumber}" with cached "${cachedPhone}"`);
                
                if (phoneNumbersMatch(cleanBotNumber, cachedPhone)) {
                    console.log(`🎯 CACHE HIT! Bot ${cleanBotNumber} matches cached vendor ${vendorId}`);
                    
                    const profile = this.knownVendors.get(vendorId);
                    await this.createVendorMapping(cleanBotNumber, vendorId, profile);
                    return vendorId;
                }
            }
            
            console.log(`📋 No cache hit, performing comprehensive vendor search...`);
            
            // Second try: Comprehensive search through all cached vendors
            for (const [vendorId, profile] of this.knownVendors.entries()) {
                console.log(`🔍 AUTO-MAP DEBUG - Checking vendor ${vendorId} with phone: ${profile.phone}`);
                
                if (profile.phone && phoneNumbersMatch(cleanBotNumber, profile.phone)) {
                    console.log(`🎯 COMPREHENSIVE MATCH! Bot ${cleanBotNumber} matches vendor ${vendorId}`);
                    
                    await this.createVendorMapping(cleanBotNumber, vendorId, profile);
                    return vendorId;
                }
            }
            
            // Third try: Real-time Firebase query (fallback for new vendors)
            console.log(`🔍 Performing real-time Firebase vendor search...`);
            
            const vendorsRef = this.db.collection('vendors');
            const vendorsSnapshot = await vendorsRef.get();
            
            console.log(`📋 Real-time query found ${vendorsSnapshot.size} vendors`);
            
            for (const vendorDoc of vendorsSnapshot.docs) {
                const vendorId = vendorDoc.id;
                
                // Skip if already checked in cache
                if (this.knownVendors.has(vendorId)) {
                    continue;
                }
                
                try {
                    // Try both direct data and profile subcollection
                    let profile = null;
                    
                    // Check direct data first
                    const directData = vendorDoc.data();
                    if (directData && directData.phone) {
                        profile = directData;
                    } else {
                        // Check profile subcollection
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
                        console.log(`🔍 NEW VENDOR FOUND - ${vendorId} with phone: ${profile.phone}`);
                        
                        // Update cache with newly found vendor
                        this.knownVendors.set(vendorId, profile);
                        if (profile.phone) {
                            const cleanPhone = cleanPhoneNumberForMapping(profile.phone);
                            this.vendorPhoneCache.set(cleanPhone, vendorId);
                        }
                        
                        if (profile.phone && phoneNumbersMatch(cleanBotNumber, profile.phone)) {
                            console.log(`🎯 REAL-TIME MATCH! Bot ${cleanBotNumber} matches new vendor ${vendorId}`);
                            
                            await this.createVendorMapping(cleanBotNumber, vendorId, profile);
                            return vendorId;
                        }
                    }
                } catch (vendorError) {
                    console.log(`❌ Error checking vendor ${vendorId}: ${vendorError.message}`);
                }
            }
            
            console.log(`⚠️ No matching vendor found for phone: ${cleanBotNumber}`);
            console.log(`📋 DETAILED TROUBLESHOOTING INFO:`);
            console.log(`   Original bot number: ${botPhoneNumber}`);
            console.log(`   Cleaned bot number: ${cleanBotNumber}`);
            console.log(`   Total vendors checked: ${this.knownVendors.size}`);
            console.log(`   Vendors with phones: ${this.vendorPhoneCache.size}`);
            console.log(`   Phone cache contents:`, Array.from(this.vendorPhoneCache.entries()));
            
            // Try immediate fix if no vendors found
            if (this.vendorPhoneCache.size === 0) {
                console.log(`🔧 Attempting immediate vendor fix...`);
                const fixResult = await this.immediateVendorFix();
                
                if (fixResult) {
                    // Retry mapping after fix
                    console.log(`🔄 Retrying mapping after vendor fix...`);
                    return await this.autoMapBotToVendor(botPhoneNumber);
                }
            }
            
            return null;
            
        } catch (error) {
            console.error('❌ Error in dynamic auto-mapping:', error);
            return null;
        }
    }

    // NEW: Helper function to create vendor mapping
    async createVendorMapping(cleanBotNumber, vendorId, profile) {
        try {
            const mappingData = {
                phoneNumber: cleanBotNumber,
                businessId: vendorId,
                isBotNumber: true,
                type: 'bot',
                createdAt: new Date().toISOString(),
                isActive: true,
                autoMapped: true,
                description: 'Auto-mapped WhatsApp Bot via dynamic discovery',
                vendorName: profile.name || profile.displayName || 'Unknown',
                email: profile.email || '',
                username: profile.username || '',
                discoveryMethod: 'dynamic_firebase_query'
            };
            
            const mappingRef = this.db.collection('whatsapp_business_mapping').doc(cleanBotNumber);
            await mappingRef.set(mappingData);
            
            console.log(`✅ SUCCESS! Auto-created mapping: ${cleanBotNumber} → ${vendorId}`);
            console.log(`🏢 Vendor: ${mappingData.vendorName} (${mappingData.email})`);
            
            return true;
        } catch (error) {
            console.error('❌ Failed to create vendor mapping:', error);
            return false;
        }
    }

    // NEW: Manual vendor discovery (for debugging)
    async discoverAllVendors() {
        console.log(`🔍 DISCOVERY - Starting comprehensive vendor discovery...`);
        
        try {
            const vendorsRef = this.db.collection('vendors');
            const vendorsSnapshot = await vendorsRef.get();
            
            console.log(`📋 DISCOVERY - Found ${vendorsSnapshot.size} total vendors`);
            
            const discoveredVendors = [];
            
            for (const vendorDoc of vendorsSnapshot.docs) {
                const vendorId = vendorDoc.id;
                
                try {
                    // Try multiple approaches
                    let profile = null;
                    
                    // Check direct data
                    const directData = vendorDoc.data();
                    if (directData && (directData.phone || directData.name || directData.email)) {
                        profile = directData;
                    } else {
                        // Check profile subcollection
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
                            name: profile.name || profile.displayName || 'Unknown',
                            phone: profile.phone || 'No phone',
                            email: profile.email || 'No email',
                            hasProfile: true,
                            dataLocation: directData && directData.phone ? 'direct' : 'subcollection'
                        });
                    } else {
                        discoveredVendors.push({
                            id: vendorId,
                            name: 'Unknown',
                            phone: 'No profile',
                            email: 'No profile',
                            hasProfile: false,
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
                        dataLocation: 'error'
                    });
                }
            }
            
            console.log(`📊 DISCOVERY RESULTS:`);
            discoveredVendors.forEach((vendor, index) => {
                console.log(`   ${index + 1}. ${vendor.id}`);
                console.log(`      Name: ${vendor.name}`);
                console.log(`      Phone: ${vendor.phone}`);
                console.log(`      Email: ${vendor.email}`);
                console.log(`      Has Profile: ${vendor.hasProfile}`);
                console.log(`      Data Location: ${vendor.dataLocation}`);
                console.log('');
            });
            
            return discoveredVendors;
            
        } catch (error) {
            console.error('❌ Error in vendor discovery:', error);
            return [];
        }
    }

    // EXISTING METHODS - keeping all your original functionality
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
                    autoMapped: data.autoMapped || false,
                    discoveryMethod: data.discoveryMethod || 'legacy',
                    ...data
                });
            });

            console.log(`📱 Loaded ${mappings.length} business mappings from Firebase`);
            return mappings;
        } catch (error) {
            console.error('❌ Failed to get business mappings:', error);
            return [];
        }
    }

    async getBusinessProfile(businessId) {
        const defaultProfile = {
            businessName: 'LLL Farm',
            businessDescription: 'Fresh meat and agricultural products',
            businessPhone: '',
            businessEmail: '',
            businessAddress: '',
            isActive: true,
            logo: '🥩',
            category: 'agriculture'
        };

        if (!this.isInitialized) {
            return defaultProfile;
        }

        try {
            // Check cache first
            if (this.knownVendors.has(businessId)) {
                const cached = this.knownVendors.get(businessId);
                return {
                    businessName: cached.name || cached.displayName || 'LLL Farm',
                    businessDescription: cached.description || 'Fresh meat and agricultural products',
                    businessPhone: cached.phone || '',
                    businessEmail: cached.email || '',
                    businessAddress: cached.address || '',
                    isActive: true,
                    logo: cached.avatarUrl || '🥩',
                    category: 'agriculture',
                    username: cached.username,
                    ...cached
                };
            }

            const vendorProfileRef = this.db.collection('vendors')
                                           .doc(businessId)
                                           .collection('profile')
                                           .doc('main');
            
            const profileDoc = await vendorProfileRef.get();
            
            if (profileDoc.exists) {
                const data = profileDoc.data();
                console.log(`✅ Loaded vendor profile for: ${businessId}`);
                
                // Cache it
                this.knownVendors.set(businessId, data);
                
                return {
                    businessName: data.name || data.displayName || 'LLL Farm',
                    businessDescription: data.description || 'Fresh meat and agricultural products',
                    businessPhone: data.phone || '',
                    businessEmail: data.email || '',
                    businessAddress: data.address || '',
                    isActive: true,
                    logo: data.avatarUrl || '🥩',
                    category: 'agriculture',
                    username: data.username,
                    ...data
                };
            } else {
                console.log(`⚠️ No profile found for business: ${businessId}, using defaults`);
                return defaultProfile;
            }
        } catch (error) {
            console.error(`❌ Failed to get business profile for ${businessId}:`, error);
            return defaultProfile;
        }
    }

    async getBusinessProducts(businessId) {
        if (!this.isInitialized) {
            return [];
        }

        try {
            console.log(`🔄 Loading products for vendor: ${businessId}`);
            
            const productsRef = this.db.collection('vendors')
                                      .doc(businessId)
                                      .collection('products');
            
            const snapshot = await productsRef.get();
            
            if (snapshot.empty) {
                console.log(`⚠️ No products found for vendor: ${businessId}`);
                return [];
            }

            const products = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                products.push({
                    id: doc.id,
                    name: data.name,
                    price: parseFloat(data.price) || 0,
                    description: data.description || '',
                    category: data.category || 'general',
                    imageUrl: data.imageUrl || data.image || '📦',
                    stockQuantity: parseInt(data.stockQuantity || data.stock) || 99,
                    isAvailable: data.isAvailable !== false,
                    unit: data.unit || 'piece',
                    createdAt: data.createdAt,
                    updatedAt: data.updatedAt,
                    ...data
                });
            });

            console.log(`✅ Loaded ${products.length} products for vendor: ${businessId}`);
            return products;
        } catch (error) {
            console.error(`❌ Failed to load products for vendor ${businessId}:`, error);
            return [];
        }
    }

    async getCustomer(phoneNumber, businessId) {
        if (!this.isInitialized) {
            return null;
        }

        try {
            const customerRef = this.db.collection('vendors')
                                      .doc(businessId)
                                      .collection('customers')
                                      .doc(phoneNumber);
            
            const customerDoc = await customerRef.get();
            
            if (customerDoc.exists) {
                const data = customerDoc.data();
                console.log(`👤 Found existing customer: ${data.name || phoneNumber} for vendor ${businessId}`);
                return {
                    id: customerDoc.id,
                    phone: phoneNumber,
                    name: data.name,
                    email: data.email || '',
                    address: data.address || '',
                    registrationDate: data.registrationDate,
                    lastOrderDate: data.lastOrderDate,
                    totalOrders: parseInt(data.totalOrders) || 0,
                    totalSpent: parseFloat(data.totalSpent) || 0,
                    loyaltyPoints: parseInt(data.loyaltyPoints) || 0,
                    customerLevel: data.customerLevel || 'Bronze',
                    isActive: data.isActive !== false,
                    ...data
                };
            } else {
                console.log(`👤 No existing customer found: ${phoneNumber} for vendor ${businessId}`);
                return null;
            }
        } catch (error) {
            console.error(`❌ Failed to get customer ${phoneNumber}:`, error);
            return null;
        }
    }

    async saveCustomer(phoneNumber, businessId, customerData) {
        if (!this.isInitialized) {
            return false;
        }

        try {
            const customerRef = this.db.collection('vendors')
                                      .doc(businessId)
                                      .collection('customers')
                                      .doc(phoneNumber);
            
            const dataToSave = {
                ...customerData,
                phone: phoneNumber,
                lastUpdated: this.admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: new Date().toISOString()
            };

            const existingDoc = await customerRef.get();
            if (!existingDoc.exists) {
                dataToSave.registrationDate = this.admin.firestore.FieldValue.serverTimestamp();
                dataToSave.createdAt = new Date().toISOString();
            }

            await customerRef.set(dataToSave, { merge: true });
            console.log(`✅ Customer saved: ${customerData.name || phoneNumber} for vendor ${businessId}`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to save customer ${phoneNumber}:`, error);
            return false;
        }
    }

    async saveOrder(businessId, orderData) {
        if (!this.isInitialized) {
            return null;
        }

        try {
            const ordersRef = this.db.collection('vendors')
                                    .doc(businessId)
                                    .collection('orders');
            
            const orderToSave = {
                ...orderData,
                businessId: businessId,
                status: orderData.status || 'pending',
                createdAt: this.admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: this.admin.firestore.FieldValue.serverTimestamp(),
                timestamp: new Date().toISOString()
            };

            const docRef = await ordersRef.add(orderToSave);
            console.log(`✅ Order saved with ID: ${docRef.id} for vendor ${businessId}`);
            
            if (orderData.customerInfo && orderData.customerInfo.phone) {
                await this.updateCustomerStats(orderData.customerInfo.phone, businessId, orderData.total);
            }

            return docRef.id;
        } catch (error) {
            console.error(`❌ Failed to save order for vendor ${businessId}:`, error);
            return null;
        }
    }

    async updateCustomerStats(customerPhone, businessId, orderTotal) {
        if (!this.isInitialized) {
            return;
        }

        try {
            const customerRef = this.db.collection('vendors')
                                      .doc(businessId)
                                      .collection('customers')
                                      .doc(customerPhone);
            
            await customerRef.update({
                totalOrders: this.admin.firestore.FieldValue.increment(1),
                totalSpent: this.admin.firestore.FieldValue.increment(orderTotal),
                lastOrderDate: this.admin.firestore.FieldValue.serverTimestamp(),
                loyaltyPoints: this.admin.firestore.FieldValue.increment(Math.floor(orderTotal / 10))
            });
        } catch (error) {
            console.error(`❌ Failed to update customer stats for ${customerPhone}:`, error);
        }
    }

    async getOrderHistory(customerPhone, businessId, limit = 10) {
        if (!this.isInitialized) {
            return [];
        }

        try {
            const ordersRef = this.db.collection('vendors')
                                    .doc(businessId)
                                    .collection('orders')
                                    .where('customerInfo.phone', '==', customerPhone)
                                    .orderBy('createdAt', 'desc')
                                    .limit(limit);
            
            const snapshot = await ordersRef.get();
            const orders = [];
            
            snapshot.forEach(doc => {
                orders.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            console.log(`📋 Found ${orders.length} orders for customer ${customerPhone}`);
            return orders;
        } catch (error) {
            console.error(`❌ Failed to get order history for ${customerPhone}:`, error);
            return [];
        }
    }

    // NEW: Cache management methods
    getCacheStats() {
        return {
            vendorsInCache: this.knownVendors.size,
            phoneMappingsInCache: this.vendorPhoneCache.size,
            lastCacheUpdate: new Date(this.lastVendorCacheUpdate).toLocaleString(),
            cacheAge: Date.now() - this.lastVendorCacheUpdate
        };
    }

    clearVendorCache() {
        this.knownVendors.clear();
        this.vendorPhoneCache.clear();
        this.lastVendorCacheUpdate = 0;
        console.log('🧹 Vendor cache cleared');
    }

    // Utility methods
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
            console.log('✅ Firebase connection test successful');
            return true;
        } catch (error) {
            console.error('❌ Firebase connection test failed:', error);
            return false;
        }
    }

    async shutdown() {
        try {
            if (this.admin) {
                console.log('🧹 Clearing vendor cache...');
                this.clearVendorCache();
                console.log('✅ Firebase service shutdown complete');
            }
            this.isInitialized = false;
            this.db = null;
            this.admin = null;
        } catch (error) {
            console.error('❌ Error during Firebase shutdown:', error);
        }
    }
}

module.exports = new FirebaseService();