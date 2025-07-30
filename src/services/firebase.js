const { COLLECTIONS, DEFAULT_BUSINESS } = require('../config/constants');

class FirebaseService {
    constructor() {
        this.db = null;
        this.admin = null;
        this.isInitialized = false;
    }

    async initialize() {
        try {
            if (this.isInitialized) {
                console.log('✅ Firebase service already initialized');
                return true;
            }

            console.log('🔥 Initializing Firebase service...');
            
            // Import these functions only when we need them
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

    // Auto-detect and map bot number to vendor account
    async autoMapBotToVendor(botPhoneNumber) {
        if (!this.isInitialized || !botPhoneNumber) {
            return null;
        }

        try {
            console.log(`🔍 Auto-detecting vendor account for bot: ${botPhoneNumber}`);
            
            // Clean the phone number (remove @s.whatsapp.net and any extra characters)
            const cleanBotNumber = botPhoneNumber.split('@')[0].split(':')[0];
            
            // Check if mapping already exists
            const existingMappingRef = this.db.collection('whatsapp_business_mapping').doc(cleanBotNumber);
            const existingMapping = await existingMappingRef.get();
            
            if (existingMapping.exists) {
                const mappingData = existingMapping.data();
                console.log(`✅ Found existing mapping: ${cleanBotNumber} → ${mappingData.businessId}`);
                return mappingData.businessId;
            }

            // Look for vendor account with matching phone number
            console.log(`🔍 Searching for vendor account with phone: ${cleanBotNumber}`);
            
            // Search in vendors collection for profile with matching phone
            const vendorsRef = this.db.collection('vendors');
            const vendorsSnapshot = await vendorsRef.get();
            
            let matchedVendorId = null;
            let vendorProfile = null;

            for (const vendorDoc of vendorsSnapshot.docs) {
                const vendorId = vendorDoc.id;
                
                // Check profile/main document
                const profileRef = vendorDoc.ref.collection('profile').doc('main');
                const profileDoc = await profileRef.get();
                
                if (profileDoc.exists) {
                    const profile = profileDoc.data();
                    
                    // Check if phone matches (with different formats)
                    const profilePhone = profile.phone || '';
                    const cleanProfilePhone = profilePhone.replace(/\D/g, ''); // Remove non-digits
                    const cleanBotNumberDigits = cleanBotNumber.replace(/\D/g, '');
                    
                    if (cleanProfilePhone === cleanBotNumberDigits || 
                        profilePhone === cleanBotNumber ||
                        profilePhone === `+${cleanBotNumber}` ||
                        cleanProfilePhone.endsWith(cleanBotNumberDigits.slice(-9))) { // Last 9 digits match
                        
                        matchedVendorId = vendorId;
                        vendorProfile = profile;
                        console.log(`🎯 Found matching vendor: ${vendorId} for phone ${cleanBotNumber}`);
                        break;
                    }
                }
            }

            if (matchedVendorId) {
                // Create the mapping
                const mappingData = {
                    phoneNumber: cleanBotNumber,
                    businessId: matchedVendorId,
                    isBotNumber: true,
                    type: 'bot',
                    createdAt: new Date().toISOString(),
                    isActive: true,
                    autoMapped: true,
                    description: 'Auto-mapped WhatsApp Bot',
                    vendorName: vendorProfile.name || vendorProfile.displayName || 'Unknown',
                    email: vendorProfile.email || '',
                    username: vendorProfile.username || ''
                };
                
                await existingMappingRef.set(mappingData);
                console.log(`✅ Auto-created mapping: ${cleanBotNumber} → ${matchedVendorId}`);
                console.log(`🏢 Vendor: ${mappingData.vendorName}`);
                
                return matchedVendorId;
            } else {
                console.log(`⚠️ No vendor account found for phone: ${cleanBotNumber}`);
                console.log(`💡 Make sure your vendor profile has the correct phone number`);
                return null;
            }
            
        } catch (error) {
            console.error('❌ Error in auto-mapping:', error);
            return null;
        }
    }

    // Business Mappings - Map phone numbers to business IDs
    async getBusinessMappings() {
        if (!this.isInitialized) {
            console.log('⚠️ Firebase service not initialized, returning empty mappings');
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

    // Business Profile - Get business information from vendor structure
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
            console.log(`⚠️ Firebase service not initialized, using default profile for: ${businessId}`);
            return defaultProfile;
        }

        try {
            // Try vendor structure: vendors/{businessId}/profile/main
            const vendorProfileRef = this.db.collection('vendors')
                                           .doc(businessId)
                                           .collection('profile')
                                           .doc('main');
            
            const profileDoc = await vendorProfileRef.get();
            
            if (profileDoc.exists) {
                const data = profileDoc.data();
                console.log(`✅ Loaded vendor profile for: ${businessId}`);
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

    // Business Products - Get all products from vendor structure
    async getBusinessProducts(businessId) {
        if (!this.isInitialized) {
            console.log(`⚠️ Firebase service not initialized, no products for: ${businessId}`);
            return [];
        }

        try {
            console.log(`🔄 Loading products for vendor: ${businessId}`);
            
            // Use vendor structure: vendors/{businessId}/products
            const productsRef = this.db.collection('vendors')
                                      .doc(businessId)
                                      .collection('products');
            
            // Get all products (assuming they're all available)
            const snapshot = await productsRef.get();
            
            if (snapshot.empty) {
                console.log(`⚠️ No products found for vendor: ${businessId}`);
                console.log(`💡 Add products through your front-end interface`);
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
            throw error;
        }
    }

    // Customer Management - Use vendor structure
    async getCustomer(phoneNumber, businessId) {
        if (!this.isInitialized) {
            console.log(`⚠️ Firebase service not initialized, no customer data for: ${phoneNumber}`);
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
            console.log(`⚠️ Firebase service not initialized, cannot save customer: ${phoneNumber}`);
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

    // Order Management - Use vendor structure
    async saveOrder(businessId, orderData) {
        if (!this.isInitialized) {
            console.log(`⚠️ Firebase service not initialized, cannot save order for vendor: ${businessId}`);
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

    // Utility methods
    isServiceReady() {
        return this.isInitialized && this.db !== null && this.admin !== null;
    }

    async testConnection() {
        if (!this.isInitialized) {
            return false;
        }

        try {
            const testRef = this.db.collection('vendors').limit(1);
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
        } catch (error) {
            console.error('❌ Error during Firebase shutdown:', error);
        }
    }
}

module.exports = new FirebaseService();