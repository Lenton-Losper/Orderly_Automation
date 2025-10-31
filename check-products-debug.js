#!/usr/bin/env node

/**
 * Debug script to check products in Firebase
 * Run: node check-products-debug.js <tenantId>
 */

require('dotenv').config();
const admin = require('firebase-admin');

const businessId = '264813141453';
const tenantId = process.argv[2] || process.env.TENANT_ID || 'default';

async function checkProducts() {
    try {
        // Initialize Firebase if not already done
        if (!admin.apps.length) {
            const serviceAccount = require('../lllfarming-firebase-adminsdk-fbsvc-c9ce466038.json');
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
        }

        const db = admin.firestore();

        console.log('🔍 Checking products in Firebase...');
        console.log(`📂 Business ID: ${businessId}`);
        console.log(`📂 Tenant ID: ${tenantId}`);
        console.log('');

        // Check tenant path
        const tenantPath = `vendors/${businessId}/tenants/${tenantId}/products`;
        console.log(`1️⃣ Checking tenant path: ${tenantPath}`);
        const tenantRef = db.collection('vendors')
            .doc(businessId)
            .collection('tenants')
            .doc(tenantId)
            .collection('products');

        const tenantSnapshot = await tenantRef.get();
        console.log(`   Found ${tenantSnapshot.size} products`);
        tenantSnapshot.forEach(doc => {
            const data = doc.data();
            console.log(`   ✅ ${doc.id}: ${data.name} - N$${data.price} (Active: ${data.isActive}, Available: ${data.isAvailable})`);
        });

        // Check legacy path
        console.log('');
        const legacyPath = `vendors/${businessId}/products`;
        console.log(`2️⃣ Checking legacy path: ${legacyPath}`);
        const legacyRef = db.collection('vendors')
            .doc(businessId)
            .collection('products');

        const legacySnapshot = await legacyRef.get();
        console.log(`   Found ${legacySnapshot.size} products`);
        legacySnapshot.forEach(doc => {
            const data = doc.data();
            console.log(`   ✅ ${doc.id}: ${data.name} - N$${data.price} (Active: ${data.isActive}, Available: ${data.isAvailable})`);
        });

        // Search for test2 specifically
        console.log('');
        console.log(`3️⃣ Searching for "test2"...`);
        
        const allProducts = [];
        tenantSnapshot.forEach(doc => allProducts.push({ path: 'tenant', id: doc.id, ...doc.data() }));
        legacySnapshot.forEach(doc => allProducts.push({ path: 'legacy', id: doc.id, ...doc.data() }));

        const test2Products = allProducts.filter(p => 
            p.name && p.name.toLowerCase().includes('test2')
        );

        if (test2Products.length > 0) {
            console.log(`   ✅ Found test2!`);
            test2Products.forEach(p => {
                console.log(`   📦 ${p.name} (${p.path} path)`);
                console.log(`      ID: ${p.id}`);
                console.log(`      Price: N$${p.price}`);
                console.log(`      Active: ${p.isActive}`);
                console.log(`      Available: ${p.isAvailable}`);
            });
        } else {
            console.log(`   ❌ test2 NOT found in Firebase`);
            console.log(`   💡 Make sure the product is saved to: ${tenantPath}`);
        }

        // List all available tenants
        console.log('');
        console.log(`4️⃣ Available tenants for business ${businessId}:`);
        const tenantsRef = db.collection('vendors')
            .doc(businessId)
            .collection('tenants');
        
        const tenantsSnapshot = await tenantsRef.get();
        tenantsSnapshot.forEach(doc => {
            console.log(`   - ${doc.id}`);
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    }

    process.exit(0);
}

checkProducts();

