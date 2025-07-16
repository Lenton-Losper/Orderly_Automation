const admin = require('firebase-admin');

class FirebaseService {
    constructor(serviceAccountPath) {
        this.db = null;
        this.ordersCollection = null;
        this.customersCollection = null;
        this.serviceAccountPath = serviceAccountPath;
    }

    initialize() {
        try {
            const serviceAccount = require(this.serviceAccountPath);

            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });

            this.db = admin.firestore();
            this.ordersCollection = this.db.collection('orders');
            this.customersCollection = this.db.collection('customers');

            console.log('✅ Firebase initialized successfully');
        } catch (error) {
            console.error('❌ Firebase initialization error:', error);
            throw error;
        }
    }

    async checkExistingCustomer(userId) {
        try {
            const snapshot = await this.customersCollection.where('whatsappId', '==', userId).get();
            if (!snapshot.empty) {
                const doc = snapshot.docs[0];
                return { id: doc.id, ...doc.data() };
            }
            return null;
        } catch (error) {
            console.error('❌ Error checking existing customer:', error);
            return null;
        }
    }

    async saveCustomer(customerData, userId) {
        try {
            const accountName = customerData.accountName;
            
            // Check if account name already exists
            const existingAccount = await this.customersCollection.doc(accountName).get();
            if (existingAccount.exists) {
                return { success: false, message: 'Account name already exists' };
            }

            await this.customersCollection.doc(accountName).set({
                name: customerData.name,
                email: customerData.email,
                phone: customerData.phone,
                address: customerData.address,
                whatsappId: userId,
                score: 0,
                createdAt: new Date().toISOString()
            });

            console.log('✅ Customer registered:', accountName);
            return { success: true, accountName };
        } catch (error) {
            console.error('❌ Error saving customer:', error);
            return { success: false, message: 'Error saving customer data' };
        }
    }

    async incrementCustomerScore(accountName) {
        try {
            await this.customersCollection.doc(accountName).update({
                score: admin.firestore.FieldValue.increment(1)
            });
            console.log('✅ Score incremented for:', accountName);
            return true;
        } catch (error) {
            console.error('❌ Error incrementing score:', error);
            return false;
        }
    }

    async logOrder(name, order, msgId) {
        try {
            const exists = await this.ordersCollection.doc(msgId).get();
            if (exists.exists) {
                return false;
            }

            await this.ordersCollection.doc(msgId).set({
                name,
                order,
                timestamp: new Date().toISOString()
            });

            console.log('✅ Order logged:', msgId);
            return true;
        } catch (error) {
            console.error('❌ Error logging order:', error);
            return false;
        }
    }

    async getCustomerById(customerId) {
        try {
            const doc = await this.customersCollection.doc(customerId).get();
            if (doc.exists) {
                return { id: doc.id, ...doc.data() };
            }
            return null;
        } catch (error) {
            console.error('❌ Error getting customer:', error);
            return null;
        }
    }

    async updateCustomer(customerId, updateData) {
        try {
            await this.customersCollection.doc(customerId).update(updateData);
            console.log('✅ Customer updated:', customerId);
            return true;
        } catch (error) {
            console.error('❌ Error updating customer:', error);
            return false;
        }
    }

    async getOrderById(orderId) {
        try {
            const doc = await this.ordersCollection.doc(orderId).get();
            if (doc.exists) {
                return { id: doc.id, ...doc.data() };
            }
            return null;
        } catch (error) {
            console.error('❌ Error getting order:', error);
            return null;
        }
    }

    getFieldValue() {
        return admin.firestore.FieldValue;
    }
}

module.exports = FirebaseService;