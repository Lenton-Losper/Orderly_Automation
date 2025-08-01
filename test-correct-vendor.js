// Test with the correct vendor ID
// Run this: node test-correct-vendor.js

require('dotenv').config();

async function testCorrectVendor() {
    try {
        console.log('🔍 Testing with the correct vendor ID...');
        
        // Initialize Firebase
        const { initializeFirebase } = require('./src/config/database');
        await initializeFirebase();
        
        const { getDatabase } = require('./src/config/database');
        const db = getDatabase();
        
        // Use the CORRECT vendor ID from the test results
        const correctVendorId = '0D0aDbfiPsYasbD4duJiZlHL0Av2';
        
        console.log(`🔍 Testing vendor: ${correctVendorId}`);
        
        // Test vendor document access
        const vendorRef = db.collection('vendors').doc(correctVendorId);
        const vendorDoc = await vendorRef.get();
        
        if (vendorDoc.exists) {
            console.log('✅ SUCCESS! Vendor document exists and is accessible!');
            const vendorData = vendorDoc.data();
            console.log('📋 Vendor data:', JSON.stringify(vendorData, null, 2));
            
            // Test profile access
            console.log('\n🔍 Testing profile access...');
            const profileRef = vendorRef.collection('profile').doc('main');
            const profileDoc = await profileRef.get();
            
            if (profileDoc.exists) {
                console.log('✅ SUCCESS! Profile document exists!');
                const profileData = profileDoc.data();
                console.log('📋 Profile data:', JSON.stringify(profileData, null, 2));
                console.log(`📱 Phone in profile: ${profileData.phone}`);
                
                // Test products access
                console.log('\n🔍 Testing products access...');
                const productsRef = vendorRef.collection('products');
                const productsSnapshot = await productsRef.get();
                console.log(`📦 Products found: ${productsSnapshot.size}`);
                
                if (!productsSnapshot.empty) {
                    console.log('✅ SUCCESS! Products found:');
                    productsSnapshot.forEach(doc => {
                        const product = doc.data();
                        console.log(`   📦 ${product.name} - N$${product.price}`);
                    });
                } else {
                    console.log('⚠️ No products found - add some through your frontend');
                }
                
                // Now test the auto-mapping logic
                console.log('\n🔍 Testing phone number matching...');
                const botNumber = '264817375744';
                const profilePhone = profileData.phone;
                
                console.log(`Bot number: ${botNumber}`);
                console.log(`Profile phone: ${profilePhone}`);
                
                if (botNumber === profilePhone) {
                    console.log('✅ PERFECT MATCH! Auto-mapping will work!');
                } else {
                    console.log('❌ Numbers don\'t match exactly');
                    console.log('This explains why auto-mapping failed');
                }
                
            } else {
                console.log('❌ Profile document does not exist');
            }
            
        } else {
            console.log('❌ Vendor document still does not exist with correct ID');
        }
        
    } catch (error) {
        console.error('❌ Error in test:', error);
    }
    
    process.exit(0);
}

// Run the test
testCorrectVendor();