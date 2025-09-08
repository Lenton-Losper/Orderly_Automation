const admin = require('firebase-admin');
const serviceAccount = require('./lllfarming-firebase-adminsdk-fbsvc-c9ce466038.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function testFirestoreQRSystem() {
    try {
        console.log('🧪 Testing Firestore-based QR code system...');
        
        // Get the current tenant
        const tenants = await db.collection('tenants').get();
        if (tenants.empty) {
            console.log('❌ No tenants found in database');
            return;
        }
        
        const tenant = tenants.docs[0];
        const tenantId = tenant.id;
        console.log(`📝 Testing with tenant: ${tenantId}`);
        
        // Test 1: Store a sample QR code
        console.log('\n1️⃣ Testing QR code storage...');
        const sampleQR = '2@testQRCodeData123456789';
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(sampleQR)}`;
        
        const qrData = {
            qrCode: sampleQR,
            qrUrl: qrUrl,
            status: 'pending',
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
            timestamp: Date.now()
        };
        
        await db.collection('tenants').doc(tenantId).collection('botSession').doc('current').set(qrData);
        console.log('✅ QR code stored successfully');
        
        // Test 2: Retrieve the QR code
        console.log('\n2️⃣ Testing QR code retrieval...');
        const qrDoc = await db.collection('tenants').doc(tenantId).collection('botSession').doc('current').get();
        
        if (qrDoc.exists) {
            const data = qrDoc.data();
            console.log('📱 Retrieved QR Code Data:');
            console.log('  QR Code:', data.qrCode);
            console.log('  QR URL:', data.qrUrl);
            console.log('  Status:', data.status);
            console.log('  Last Updated:', data.lastUpdated?.toDate?.() || 'Unknown');
            console.log('  Timestamp:', new Date(data.timestamp).toISOString());
        } else {
            console.log('❌ No QR code found');
        }
        
        // Test 3: Test API endpoint
        console.log('\n3️⃣ Testing API endpoint...');
        const response = await fetch(`http://localhost:3001/tenant/${tenantId}/qr`);
        if (response.ok) {
            const apiData = await response.json();
            console.log('🌐 API Response:');
            console.log('  Success:', apiData.success);
            console.log('  QR Code:', apiData.qrCode);
            console.log('  QR URL:', apiData.qrCodeUrl);
            console.log('  Status:', apiData.status);
        } else {
            console.log('❌ API endpoint failed:', response.status);
        }
        
        console.log('\n✅ Firestore QR system test completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
testFirestoreQRSystem();
