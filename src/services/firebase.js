const { COLLECTIONS, DEFAULT_BUSINESS } = require('../config/constants');

class FirebaseService {
    constructor() {
        this.db = null;
        this.admin = null;
        this.isInitialized = false;
        
        // DO NOT auto-initialize in constructor
        // Wait for explicit initialization from the main bot
    }

    async initialize() {
        try {
            if (this.isInitialized) {
                return true; // Already initialized
            }

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
            throw error;
        }
    }

    // Ensure Firebase is initialized before any operation
    ensureInitialized() {
        if (!this.isInitialized || !this.db || !this.admin) {
            throw new Error('Firebase service not properly initialized');
        }
    }

    // Business Mappings - Map phone numbers to business IDs
    async getBusinessMappings() {
        try {
            this.ensureInitialized();

            const mappingsRef = this.db.collection(COLLECTIONS.BUSINESS_MAPPINGS);
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
                    ...data
                });
            });

            console.log(`📱 Loaded ${mappings.length} business mappings from Firebase`);
            return mappings;
        } catch (error) {
            console.error('❌ Failed to get business mappings:', error);
            return []; // Return empty array on error to prevent crashes
        }
    }

    // Business Profile - Get business information
    async getBusinessProfile(businessId) {
        try {
            this.ensureInitialized();

            const profileRef = this.db.collection(COLLECTIONS.VENDORS)
                                     .doc(businessId)
                                     .collection('profile')
                                     .doc('info');
            
            const profileDoc = await profileRef.get();
            
            if (profileDoc.exists) {
                const data = profileDoc.data();
                console.log(`✅ Loaded business profile for: ${businessId}`);
                return {
                    businessName: data.businessName || 'LLL Farm',
                    businessDescription: data.businessDescription || 'Fresh meat and agricultural products',
                    businessPhone: data.businessPhone || '',
                    businessEmail: data.businessEmail || '',
                    businessAddress: data.businessAddress || '',
                    isActive: data.isActive !== false,
                    logo: data.logo || '🥩',
                    established: data.established,
                    category: data.category || 'agriculture',
                    ...data
                };
            } else {
                console.log(`⚠️ No profile found for business: ${businessId}, using defaults`);
                return {
                    businessName: 'LLL Farm',
                    businessDescription: 'Fresh meat and agricultural products',
                    businessPhone: '',
                    businessEmail: '',
                    businessAddress: '',
                    isActive: true,
                    logo: '🥩',
                    category: 'agriculture'
                };
            }
        } catch (error) {
            console.error(`❌ Failed to get business profile for ${businessId}:`, error);
            return {
                businessName: 'LLL Farm',
                businessDescription: 'Fresh meat and agricultural products',
                isActive: true,
                logo: '🥩',
                category: 'agriculture'
            };
        }
    }

    // Business Products - Get all products for a business
    async getBusinessProducts(businessId) {
        try {
            this.ensureInitialized();

            console.log(`🔄 Loading products for business: ${businessId}`);
            
            const productsRef = this.db.collection(COLLECTIONS.VENDORS)
                                      .doc(businessId)
                                      .collection('products');
            
            const snapshot = await productsRef.where('isAvailable', '==', true).get();
            
            if (snapshot.empty) {
                console.log(`⚠️ No products found for business: ${businessId}`);
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
                    imageUrl: data.imageUrl || '📦',
                    stockQuantity: parseInt(data.stockQuantity) || 0,
                    isAvailable: data.isAvailable !== false,
                    unit: data.unit || 'piece',
                    weight: data.weight,
                    nutritionInfo: data.nutritionInfo,
                    createdAt: data.createdAt,
                    updatedAt: data.updatedAt,
                    ...data
                });
            });

            console.log(`✅ Loaded ${products.length} products for business: ${businessId}`);
            return products;
        } catch (error) {
            console.error(`❌ Failed to load products for business ${businessId}:`, error);
            throw error;
        }
    }

    // Customer Management
    async getCustomer(phoneNumber, businessId) {
        try {
            this.ensureInitialized();

            const customerRef = this.db.collection(COLLECTIONS.VENDORS)
                                      .doc(businessId)
                                      .collection('customers')
                                      .doc(phoneNumber);
            
            const customerDoc = await customerRef.get();
            
            if (customerDoc.exists) {
                const data = customerDoc.data();
                console.log(`👤 Found existing customer: ${data.name || phoneNumber} for business ${businessId}`);
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
                    preferences: data.preferences || {},
                    notes: data.notes || '',
                    ...data
                };
            } else {
                console.log(`👤 No existing customer found: ${phoneNumber} for business ${businessId}`);
                return null;
            }
        } catch (error) {
            console.error(`❌ Failed to get customer ${phoneNumber}:`, error);
            return null;
        }
    }

    async saveCustomer(phoneNumber, businessId, customerData) {
        try {
            this.ensureInitialized();

            const customerRef = this.db.collection(COLLECTIONS.VENDORS)
                                      .doc(businessId)
                                      .collection('customers')
                                      .doc(phoneNumber);
            
            const dataToSave = {
                ...customerData,
                phone: phoneNumber,
                lastUpdated: this.admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: new Date().toISOString()
            };

            // If this is a new customer, add registration date
            const existingDoc = await customerRef.get();
            if (!existingDoc.exists) {
                dataToSave.registrationDate = this.admin.firestore.FieldValue.serverTimestamp();
                dataToSave.createdAt = new Date().toISOString();
            }

            await customerRef.set(dataToSave, { merge: true });
            console.log(`✅ Customer saved: ${customerData.name || phoneNumber} for business ${businessId}`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to save customer ${phoneNumber}:`, error);
            throw error;
        }
    }

    // Order Management
    async saveOrder(businessId, orderData) {
        try {
            this.ensureInitialized();

            const ordersRef = this.db.collection(COLLECTIONS.VENDORS)
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
            console.log(`✅ Order saved with ID: ${docRef.id} for business ${businessId}`);
            
            // Update customer stats
            if (orderData.customerInfo && orderData.customerInfo.phone) {
                await this.updateCustomerStats(orderData.customerInfo.phone, businessId, orderData.total);
            }

            return docRef.id;
        } catch (error) {
            console.error(`❌ Failed to save order for business ${businessId}:`, error);
            throw error;
        }
    }

    async updateCustomerStats(customerPhone, businessId, orderTotal) {
        try {
            const customerRef = this.db.collection(COLLECTIONS.VENDORS)
                                      .doc(businessId)
                                      .collection('customers')
                                      .doc(customerPhone);
            
            await customerRef.update({
                totalOrders: this.admin.firestore.FieldValue.increment(1),
                totalSpent: this.admin.firestore.FieldValue.increment(orderTotal),
                lastOrderDate: this.admin.firestore.FieldValue.serverTimestamp(),
                loyaltyPoints: this.admin.firestore.FieldValue.increment(Math.floor(orderTotal / 10)) // 1 point per N$10
            });
        } catch (error) {
            console.error(`❌ Failed to update customer stats for ${customerPhone}:`, error);
        }
    }

    async getOrderHistory(customerPhone, businessId, limit = 10) {
        try {
            this.ensureInitialized();

            const ordersRef = this.db.collection(COLLECTIONS.VENDORS)
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

    // Analytics and Stats
    async getBusinessStats(businessId) {
        try {
            this.ensureInitialized();

            const [customersSnapshot, ordersSnapshot, productsSnapshot] = await Promise.all([
                this.db.collection(COLLECTIONS.VENDORS).doc(businessId).collection('customers').get(),
                this.db.collection(COLLECTIONS.VENDORS).doc(businessId).collection('orders').get(),
                this.db.collection(COLLECTIONS.VENDORS).doc(businessId).collection('products').get()
            ]);

            return {
                totalCustomers: customersSnapshot.size,
                totalOrders: ordersSnapshot.size,
                totalProducts: productsSnapshot.size,
                businessId,
                lastUpdated: new Date().toISOString()
            };
        } catch (error) {
            console.error(`❌ Failed to get business stats for ${businessId}:`, error);
            return {
                totalCustomers: 0,
                totalOrders: 0,
                totalProducts: 0,
                businessId,
                lastUpdated: new Date().toISOString()
            };
        }
    }

    // Sample data creation
    async createSampleData(businessId) {
        try {
            this.ensureInitialized();
            console.log(`🎯 Creating sample data for business: ${businessId}`);

            // Create sample products
            const productsRef = this.db.collection(COLLECTIONS.VENDORS)
                                      .doc(businessId)
                                      .collection('products');

            const sampleProducts = [
                {
                    name: 'Fresh Beef Steak',
                    price: 85.50,
                    description: 'Premium quality beef steak, perfect for grilling',
                    category: 'beef',
                    imageUrl: '🥩',
                    stockQuantity: 25,
                    isAvailable: true,
                    unit: 'kg',
                    weight: '1kg per piece'
                },
                {
                    name: 'Chicken Breast',
                    price: 45.00,
                    description: 'Fresh chicken breast fillets, boneless',
                    category: 'poultry',
                    imageUrl: '🍗',
                    stockQuantity: 30,
                    isAvailable: true,
                    unit: 'kg',
                    weight: '500g per piece'
                },
                {
                    name: 'Pork Chops',
                    price: 65.00,
                    description: 'Tender pork chops, bone-in',
                    category: 'pork',
                    imageUrl: '🥓',
                    stockQuantity: 20,
                    isAvailable: true,
                    unit: 'kg',
                    weight: '300g per piece'
                },
                {
                    name: 'Ground Beef',
                    price: 55.00,
                    description: 'Lean ground beef, 80/20 mix',
                    category: 'beef',
                    imageUrl: '🍖',
                    stockQuantity: 15,
                    isAvailable: true,
                    unit: 'kg',
                    weight: '500g per package'
                },
                {
                    name: 'Lamb Chops',
                    price: 95.00,
                    description: 'Premium lamb chops, grass-fed',
                    category: 'lamb',
                    imageUrl: '🐑',
                    stockQuantity: 10,
                    isAvailable: true,
                    unit: 'kg',
                    weight: '400g per piece'
                }
            ];

            for (const product of sampleProducts) {
                await productsRef.add({
                    ...product,
                    createdAt: this.admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: this.admin.firestore.FieldValue.serverTimestamp()
                });
            }

            // Create business profile
            const profileRef = this.db.collection(COLLECTIONS.VENDORS)
                                     .doc(businessId)
                                     .collection('profile')
                                     .doc('info');

            await profileRef.set({
                businessName: 'LLL Farm',
                businessDescription: 'Fresh meat and agricultural products delivered to your door',
                businessPhone: '+264817375744',
                businessEmail: 'orders@lllfarm.na',
                businessAddress: 'Windhoek, Namibia',
                isActive: true,
                logo: '🥩',
                category: 'agriculture',
                established: '2024',
                deliveryAreas: ['Windhoek', 'Swakopmund', 'Walvis Bay'],
                paymentMethods: ['Cash', 'Bank Transfer', 'Mobile Money'],
                businessHours: {
                    monday: '08:00-17:00',
                    tuesday: '08:00-17:00',
                    wednesday: '08:00-17:00',
                    thursday: '08:00-17:00',
                    friday: '08:00-17:00',
                    saturday: '08:00-14:00',
                    sunday: 'Closed'
                },
                createdAt: this.admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: this.admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`✅ Sample data created for business: ${businessId}`);
            console.log(`📦 Created ${sampleProducts.length} sample products`);
            console.log(`🏢 Created business profile`);
            
            return true;
        } catch (error) {
            console.error(`❌ Failed to create sample data for ${businessId}:`, error);
            return false;
        }
    }

    // Utility methods
    isServiceReady() {
        return this.isInitialized && this.db !== null && this.admin !== null;
    }

    async testConnection() {
        try {
            this.ensureInitialized();

            // Try to read from a collection to test connection
            const testRef = this.db.collection('_connection_test');
            await testRef.limit(1).get();
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
                // Firebase admin doesn't need explicit shutdown in most cases
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