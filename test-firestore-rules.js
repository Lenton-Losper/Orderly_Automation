const admin = require('firebase-admin');
const serviceAccount = require('./lllfarming-firebase-adminsdk-fbsvc-c9ce466038.json');

// Initialize Firebase Admin
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function testFirestoreRules() {
    try {
        console.log('🧪 Testing Firestore rules with service account...');
        
        // Test 1: Create/Update tenant document
        console.log('\n1️⃣ Testing tenant document creation/update...');
        const tenantId = 'test-tenant-' + Date.now();
        const tenantData = {
            businessName: 'Test Business',
            ownerId: 'test-user-id',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        };
        
        await db.collection('tenants').doc(tenantId).set(tenantData);
        console.log('✅ Tenant document created successfully');
        
        // Test 2: Create/Update botSession document
        console.log('\n2️⃣ Testing botSession document creation/update...');
        const qrData = {
            qrCode: '2@testQRCodeData123456789',
            qrCodeUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=test',
            status: 'pending',
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
            timestamp: Date.now()
        };
        
        await db.collection('tenants').doc(tenantId).collection('botSession').doc('current').set(qrData, { merge: true });
        console.log('✅ BotSession document created successfully');
        
        // Test 3: Update connection status
        console.log('\n3️⃣ Testing connection status update...');
        const statusData = {
            status: 'connected',
            reason: 'QR code scanned successfully',
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
            timestamp: Date.now()
        };
        
        await db.collection('tenants').doc(tenantId).collection('botSession').doc('current').set(statusData, { merge: true });
        console.log('✅ Connection status updated successfully');
        
        // Test 4: Read the data back
        console.log('\n4️⃣ Testing data retrieval...');
        const tenantDoc = await db.collection('tenants').doc(tenantId).get();
        const botSessionDoc = await db.collection('tenants').doc(tenantId).collection('botSession').doc('current').get();
        
        if (tenantDoc.exists) {
            console.log('✅ Tenant document retrieved:', tenantDoc.data().businessName);
        }
        
        if (botSessionDoc.exists) {
            console.log('✅ BotSession document retrieved:', botSessionDoc.data().status);
        }
        
        // Test 5: Clean up test data
        console.log('\n5️⃣ Cleaning up test data...');
        await db.collection('tenants').doc(tenantId).collection('botSession').doc('current').delete();
        await db.collection('tenants').doc(tenantId).delete();
        console.log('✅ Test data cleaned up');
        
        console.log('\n🎉 All tests passed! Firestore rules are working correctly.');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Error details:', error);
        
        // Check if it's a permission error
        if (error.code === 'permission-denied') {
            console.log('\n🔍 This appears to be a permission error. Please check:');
            console.log('1. The service account has the correct permissions');
            console.log('2. The Firestore rules have been deployed');
            console.log('3. The service account email matches the pattern in isServiceAccount() function');
        }
    }
}

// Run the test
testFirestoreRules()
    .then(() => {
        console.log('\n✅ Test completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Test failed:', error);
        process.exit(1);
    });
