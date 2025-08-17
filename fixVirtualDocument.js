// Quick fix for virtual vendor document issue
// Run this script to make your vendor document appear in queries

const admin = require('firebase-admin');
const { getDatabase } = require('./src/config/database'); // Adjust path as needed

async function fixVirtualVendorDocument() {
    try {
        console.log('🔧 Fixing virtual vendor document...');
        
        // Use your existing Firebase connection
        const db = getDatabase();
        
        const vendorId = '264813141453';
        const vendorRef = db.collection('vendors').doc(vendorId);
        
        // Check if document exists (will show false for virtual documents)
        const doc = await vendorRef.get();
        console.log('Document exists (before fix):', doc.exists);
        
        // Add basic vendor fields to make the document "real"
        const vendorData = {
            businessName: 'Lenton Losper Farm', // Adjust as needed
            phone: '264813141453',
            email: 'lllosperofficial@gmail.com', // Adjust as needed
            address: '123 Main St, Windhoek',
            isActive: true,
            description: 'Fresh agricultural products and farming services',
            category: 'agriculture',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            // Add any other fields you want
        };
        
        // Set/merge the data to make document queryable
        await vendorRef.set(vendorData, { merge: true });
        
        console.log('✅ Vendor document updated with real fields');
        
        // Verify the fix worked
        const updatedDoc = await vendorRef.get();
        console.log('Document exists (after fix):', updatedDoc.exists);
        console.log('Document data:', updatedDoc.data());
        
        // Test if it appears in queries now
        console.log('\n🔍 Testing vendor query...');
        const vendorsSnapshot = await db.collection('vendors').get();
        console.log('Vendors found in query:', vendorsSnapshot.size);
        
        vendorsSnapshot.forEach(doc => {
            console.log(`   - ${doc.id}: ${doc.data().businessName}`);
        });
        
        console.log('\n🎉 Fix complete! Your bot should now discover the vendor.');
        
    } catch (error) {
        console.error('❌ Error fixing vendor document:', error);
    }
}

// Run the fix
fixVirtualVendorDocument();