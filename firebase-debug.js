// Debug script to test Firebase vendor access
// Run this: node firebase-debug.js

require('dotenv').config();

async function debugFirebaseAccess() {
    try {
        console.log('🔍 Testing Firebase Admin SDK access...');
        
        // Initialize Firebase
        const { initializeFirebase } = require('./src/config/database');
        await initializeFirebase();
        
        const firebaseService = require('./src/services/firebase');
        await firebaseService.initialize();
        
        console.log('✅ Firebase service initialized successfully');
        console.log('🔍 Testing direct database access...');
        
        // Test direct access to vendors collection
        const { getDatabase } = require('./src/config/database');
        const db = getDatabase();
        
        console.log('📊 Attempting to read vendors collection...');
        const vendorsRef = db.collection('vendors');
        const snapshot = await vendorsRef.get();
        
        console.log(`📊 Total vendors found: ${snapshot.size}`);
        
        if (snapshot.empty) {
            console.log('❌ No vendors found - this confirms the permissions issue');
            console.log('');
            console.log('🔧 Debugging steps:');
            console.log('1. Check if Firebase rules were properly published');
            console.log('2. Check if Firebase Admin SDK has proper permissions');
            console.log('3. Verify the service account key is properly configured');
            console.log('');
            console.log('🔍 Let\'s check your Firebase Admin SDK configuration...');
            
            // Check Firebase Admin configuration
            const { getFirebaseAdmin } = require('./src/config/database');
            const admin = getFirebaseAdmin();
            
            if (admin && admin.app) {
                console.log('✅ Firebase Admin app exists');
                console.log(`📱 Project ID: ${admin.app().options.projectId || 'Not found'}`);
                console.log(`🔑 Service Account: ${admin.app().options.credential ? 'Present' : 'Missing'}`);
            } else {
                console.log('❌ Firebase Admin app not properly initialized');
            }
            
        } else {
            console.log('✅ Vendors found! Processing...');
            
            snapshot.forEach(doc => {
                console.log(`🏢 Vendor ID: ${doc.id}`);
                const data = doc.data();
                console.log(`📋 Vendor data:`, JSON.stringify(data, null, 2));
            });
            
            // Test specific vendor access
            const targetVendorId = '0DaDpfPeYasbD4uJIZtHL0Av2';
            console.log(`\n🔍 Testing access to specific vendor: ${targetVendorId}`);
            
            const vendorRef = db.collection('vendors').doc(targetVendorId);
            const vendorDoc = await vendorRef.get();
            
            if (vendorDoc.exists) {
                console.log('✅ Can access vendor document');
                
                // Test profile access
                const profileRef = vendorRef.collection('profile').doc('main');
                const profileDoc = await profileRef.get();
                
                if (profileDoc.exists) {
                    const profile = profileDoc.data();
                    console.log('✅ Can access vendor profile');
                    console.log(`📱 Profile phone: ${profile.phone}`);
                    console.log(`📧 Profile email: ${profile.email}`);
                    console.log(`👤 Profile name: ${profile.name}`);
                } else {
                    console.log('❌ Cannot access vendor profile');
                }
                
                // Test products access
                const productsRef = vendorRef.collection('products');
                const productsSnapshot = await productsRef.get();
                console.log(`📦 Products found: ${productsSnapshot.size}`);
                
            } else {
                console.log('❌ Cannot access specific vendor document');
            }
        }
        
    } catch (error) {
        console.error('❌ Error testing Firebase access:', error);
        console.error('Stack trace:', error.stack);
        
        if (error.code) {
            console.log(`\n🔍 Error code: ${error.code}`);
            
            switch (error.code) {
                case 'permission-denied':
                    console.log('💡 This is a permissions issue - check Firebase rules');
                    break;
                case 'unauthenticated':
                    console.log('💡 This is an authentication issue - check service account');
                    break;
                default:
                    console.log('💡 Unknown Firebase error');
            }
        }
    }
    
    process.exit(0);
}

// Run the debug test
debugFirebaseAccess();