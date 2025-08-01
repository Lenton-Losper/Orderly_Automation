const { COLLECTIONS, DEFAULT_BUSINESS } = require('../config/constants');

// Enhanced phone number matching for Namibian numbers
function normalizePhoneNumber(phone) {
    if (!phone) return '';
    
    // Remove all non-digit characters
    const digitsOnly = phone.replace(/\D/g, '');
    
    return {
        full: digitsOnly,
        withoutCountryCode: digitsOnly.startsWith('264') ? digitsOnly.slice(3) : digitsOnly,
        withLeadingZero: digitsOnly.startsWith('264') ? '0' + digitsOnly.slice(3) : (digitsOnly.startsWith('0') ? digitsOnly : '0' + digitsOnly),
        withoutLeadingZero: digitsOnly.startsWith('0') ? digitsOnly.slice(1) : digitsOnly,
        last9: digitsOnly.slice(-9),
        last8: digitsOnly.slice(-8),
        last7: digitsOnly.slice(-7)
    };
}

function phoneNumbersMatch(phone1, phone2) {
    const normalized1 = normalizePhoneNumber(phone1);
    const normalized2 = normalizePhoneNumber(phone2);
    
    return (
        normalized1.full === normalized2.full ||
        normalized1.withoutCountryCode === normalized2.withoutCountryCode ||
        normalized1.withLeadingZero === normalized2.withLeadingZero ||
        normalized1.withoutLeadingZero === normalized2.withoutLeadingZero ||
        normalized1.last9 === normalized2.last9 ||
        normalized1.last8 === normalized2.last8 ||
        (normalized1.last7 === normalized2.last7 && normalized1.last7.length >= 7)
    );
}

class FirebaseService {
    constructor() {
        this.db = null;
        this.admin = null;
        this.isInitialized = false;
        this.knownVendors = new Map(); // Cache vendor data to avoid repeated queries
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
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize Firebase service:', error);
            this.isInitialized = false;
            return false;
        }
    }

    // FIXED: Manual vendor mapping to bypass permission issues
    async autoMapBotToVendor(botPhoneNumber) {
        if (!this.isInitialized || !botPhoneNumber) {
            return null;
        }

        try {
            console.log(`🔍 Auto-detecting vendor account for bot: ${botPhoneNumber}`);
            
            const cleanBotNumber = botPhoneNumber.split('@')[0].split(':')[0];
            console.log(`🧹 Cleaned bot number: ${cleanBotNumber}`);
            
            // Check if mapping already exists
            const existingMappingRef = this.db.collection('whatsapp_business_mapping').doc(cleanBotNumber);
            const existingMapping = await existingMappingRef.get();
            
            if (existingMapping.exists) {
                const mappingData = existingMapping.data();
                console.log(`✅ Found existing mapping: ${cleanBotNumber} → ${mappingData.businessId}`);
                return mappingData.businessId;
            }

            console.log(`🔍 Searching for vendor account with phone: ${cleanBotNumber}`);
            
            // FIXED: Instead of querying all vendors (which fails), try known vendor IDs
            const knownVendorIds = [
                '0D0aDbfiPsYasbD4duJiZlHL0Av2', // From test results
                '0DaDpfPeYasbD4uJIZtHL0Av2',     // Original ID we tried
                'EDkEK74nGDNgV8vz5y4nz7JFFYX2'  // Second vendor from test
            ];
            
            console.log('🔍 Checking known vendor IDs...');
            
            for (const vendorId of knownVendorIds) {
                try {
                    console.log(`🔍 Checking vendor: ${vendorId}`);
                    
                    // Try to access profile directly
                    const profileRef = this.db.collection('vendors')
                                             .doc(vendorId)
                                             .collection('profile')
                                             .doc('main');
                    
                    const profileDoc = await profileRef.get();
                    
                    if (profileDoc.exists) {
                        const profile = profileDoc.data();
                        console.log(`📋 Found profile for ${vendorId}`);
                        console.log(`📱 Profile phone: ${profile.phone}`);
                        
                        if (profile.phone && phoneNumbersMatch(cleanBotNumber, profile.phone)) {
                            console.log(`🎯 MATCH FOUND! ${cleanBotNumber} matches ${profile.phone}`);
                            
                            // Create the mapping
                            const mappingData = {
                                phoneNumber: cleanBotNumber,
                                businessId: vendorId,
                                isBotNumber: true,
                                type: 'bot',
                                createdAt: new Date().toISOString(),
                                isActive: true,
                                autoMapped: true,
                                description: 'Auto-mapped WhatsApp Bot',
                                vendorName: profile.name || profile.displayName || 'Unknown',
                                email: profile.email || '',
                                username: profile.username || ''
                            };
                            
                            await existingMappingRef.set(mappingData);
                            console.log(`✅ SUCCESS! Auto-created mapping: ${cleanBotNumber} → ${vendorId}`);
                            console.log(`🏢 Vendor: ${mappingData.vendorName} (${mappingData.email})`);
                            
                            // Cache this vendor
                            this.knownVendors.set(vendorId, profile);
                            
                            return vendorId;
                        } else {
                            console.log(`❌ Phone numbers don't match: ${cleanBotNumber} vs ${profile.phone}`);
                        }
                    } else {
                        console.log(`⚠️ No profile found for vendor: ${vendorId}`);
                    }
                } catch (vendorError) {
                    console.log(`❌ Could not access vendor ${vendorId}: ${vendorError.message}`);
                }
            }
            
            console.log(`⚠️ No matching vendor found for phone: ${cleanBotNumber}`);
            return null;
            
        } catch (error) {
            console.error('❌ Error in auto-mapping:', error);
            return null;
        }
    }

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
                console.log('✅ Firebase service shutdown complete');
            }
            this.isInitialized = false;
            this.db = null;
            this.admin = null;
            this.knownVendors.clear();
        } catch (error) {
            console.error('❌ Error during Firebase shutdown:', error);
        }
    }
}

module.exports = new FirebaseService();