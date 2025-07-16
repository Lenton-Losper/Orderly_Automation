const admin = require('firebase-admin');
const path = require('path');

// Load Firebase credentials
const serviceAccount = require(path.join(__dirname, 'lllfarming-firebase-adminsdk-fbsvc-c9ce466038.json'));

// Initialize Firebase app
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

// Exported function to log orders
async function logOrderToFirebase(name, order, msgId) {
    try {
        const ordersCollection = db.collection('orders');
        const existing = await ordersCollection.doc(msgId).get();

        if (existing.exists) {
            console.log('📌 Skipping duplicate message:', msgId);
            return false;
        }

        await ordersCollection.doc(msgId).set({
            name,
            order,
            timestamp: new Date().toISOString()
        });

        console.log('✅ Order logged to Firebase');
        return true;
    } catch (err) {
        console.error('❌ Error logging order:', err);
        return false;
    }
}

module.exports = { logOrderToFirebase };
