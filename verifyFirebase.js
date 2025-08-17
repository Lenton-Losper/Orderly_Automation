// Firebase Connection Verification Script
// This will tell us exactly what's happening with your Firebase connection

const admin = require('firebase-admin');

// Use existing connection or initialize
let db;
try {
  db = admin.firestore();
  console.log('Using existing Firebase connection');
} catch (e) {
  console.log('No existing connection, need to initialize');
  process.exit(1);
}

async function verifyConnection() {
  try {
    console.log('='.repeat(60));
    console.log('FIREBASE CONNECTION VERIFICATION');
    console.log('='.repeat(60));
    
    // 1. Check what project we're actually connected to
    const app = admin.app();
    console.log('\n1. PROJECT VERIFICATION:');
    console.log('   Project ID:', app.options.projectId);
    console.log('   Service Account:', app.options.credential?.clientEmail || 'Unknown');
    
    // 2. Test basic Firestore connection
    console.log('\n2. FIRESTORE CONNECTION TEST:');
    try {
      const testWrite = await db.collection('_test').add({ timestamp: new Date() });
      console.log('   ✅ Can write to Firestore');
      await testWrite.delete();
      console.log('   ✅ Can delete from Firestore');
    } catch (writeError) {
      console.log('   ❌ Cannot write to Firestore:', writeError.message);
    }
    
    // 3. List all collections
    console.log('\n3. COLLECTION ENUMERATION:');
    try {
      const collections = await db.listCollections();
      console.log('   Total collections:', collections.length);
      collections.forEach(c => console.log(`     - ${c.id}`));
    } catch (listError) {
      console.log('   ❌ Cannot list collections:', listError.message);
    }
    
    // 4. Direct vendor document test
    console.log('\n4. VENDOR DOCUMENT TESTS:');
    
    // Test document creation
    console.log('   Testing document creation...');
    try {
      await db.collection('vendors').doc('test-vendor').set({
        name: 'Test Vendor',
        phone: '1234567890',
        created: new Date()
      });
      console.log('   ✅ Can create vendor documents');
      
      // Test reading what we just created
      const createdDoc = await db.collection('vendors').doc('test-vendor').get();
      if (createdDoc.exists) {
        console.log('   ✅ Can read created vendor document');
        console.log('   Data:', createdDoc.data());
      } else {
        console.log('   ❌ Cannot read created vendor document');
      }
      
      // Clean up
      await db.collection('vendors').doc('test-vendor').delete();
      console.log('   ✅ Can delete vendor documents');
      
    } catch (vendorError) {
      console.log('   ❌ Cannot create vendor documents:', vendorError.message);
      console.log('   Error code:', vendorError.code);
    }
    
    // 5. Query test
    console.log('\n5. QUERY TESTS:');
    try {
      const queryResult = await db.collection('vendors').limit(1).get();
      console.log('   Query result size:', queryResult.size);
      console.log('   Query metadata:', {
        fromCache: queryResult.metadata.fromCache,
        hasPendingWrites: queryResult.metadata.hasPendingWrites
      });
    } catch (queryError) {
      console.log('   ❌ Query failed:', queryError.message);
      console.log('   Error code:', queryError.code);
    }
    
    // 6. Admin SDK privileges test
    console.log('\n6. ADMIN SDK PRIVILEGES TEST:');
    try {
      // Try to access a protected operation
      const users = await admin.auth().listUsers(1);
      console.log('   ✅ Has Admin SDK privileges (can access Auth)');
    } catch (authError) {
      console.log('   ⚠️ Limited Admin SDK privileges:', authError.message);
    }
    
    // 7. Service account info
    console.log('\n7. SERVICE ACCOUNT ANALYSIS:');
    const cred = app.options.credential;
    if (cred && cred.clientEmail) {
      console.log('   Email:', cred.clientEmail);
      console.log('   Type:', cred.clientEmail.includes('.iam.gserviceaccount.com') ? 'Service Account' : 'Other');
      console.log('   Project in email:', cred.clientEmail.split('@')[1]?.split('.')[0] || 'Unknown');
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('DIAGNOSIS:');
    console.log('='.repeat(60));
    
    // Try one more direct test
    console.log('\n8. FINAL DIRECT TEST:');
    try {
      // Create a document with a known ID
      const testId = Date.now().toString();
      await db.collection('vendors').doc(testId).set({
        test: true,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // Immediately try to query for it
      const immediate = await db.collection('vendors').doc(testId).get();
      console.log('   Immediate read after write:', immediate.exists);
      
      // Try to find it in a query
      const queryTest = await db.collection('vendors').where('test', '==', true).get();
      console.log('   Found in query:', queryTest.size > 0);
      
      // Clean up
      await db.collection('vendors').doc(testId).delete();
      
      if (immediate.exists && queryTest.size > 0) {
        console.log('\n✅ FIREBASE IS WORKING CORRECTLY');
        console.log('The issue is likely that no vendor documents actually exist.');
        console.log('The Firebase Console may be showing phantom/virtual documents.');
      } else {
        console.log('\n❌ FIREBASE HAS SERIOUS ISSUES');
        console.log('Documents are not being persisted or queried correctly.');
      }
      
    } catch (finalError) {
      console.log('\n❌ FINAL TEST FAILED:', finalError.message);
    }
    
  } catch (error) {
    console.error('Verification failed:', error);
  }
}

verifyConnection().then(() => {
  console.log('\nVerification complete.');
}).catch(err => {
  console.error('Script error:', err);
});