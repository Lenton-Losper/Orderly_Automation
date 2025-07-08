const admin = require('firebase-admin');
const serviceAccount = require('./lllfarming-firebase-adminsdk-fbsvc-c9ce466038.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const ordersCollection = db.collection('orders');

async function logOrderToFirebase(order) {
    try {
        await ordersCollection.add(order);
        console.log('✅ Order saved to Firebase!');
    } catch (error) {
        console.error('❌ Firebase error:', error);
    }
}

module.exports = { logOrderToFirebase };
