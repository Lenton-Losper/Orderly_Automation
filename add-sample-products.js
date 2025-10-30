/**
 * Sample Product Data Generator
 * Adds sample products to Firebase for testing dynamic responses
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
const serviceAccount = require('./lllfarming-firebase-adminsdk-fbsvc-c9ce466038.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'lllfarming'
    });
}

const db = admin.firestore();

const sampleProducts = [
    // Beef products
    {
        tenantId: 'tenant_1757833139935_2h9n7r7ed',
        name: 'T-Bone Steak',
        category: 'Beef',
        price: 150,
        unit: 'per kg',
        inStock: true,
        description: 'Premium quality beef steak',
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        tenantId: 'tenant_1757833139935_2h9n7r7ed',
        name: 'Ribeye Steak',
        category: 'Beef',
        price: 180,
        unit: 'per kg',
        inStock: true,
        description: 'Tender ribeye steak',
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        tenantId: 'tenant_1757833139935_2h9n7r7ed',
        name: 'Mince Meat',
        category: 'Beef',
        price: 85,
        unit: 'per kg',
        inStock: true,
        description: 'Fresh ground beef',
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        tenantId: 'tenant_1757833139935_2h9n7r7ed',
        name: 'Beef Brisket',
        category: 'Beef',
        price: 120,
        unit: 'per kg',
        inStock: false,
        description: 'Slow-cooked beef brisket',
        createdAt: new Date(),
        updatedAt: new Date()
    },
    
    // Chicken products
    {
        tenantId: 'tenant_1757833139935_2h9n7r7ed',
        name: 'Chicken Breast',
        category: 'Chicken',
        price: 65,
        unit: 'per kg',
        inStock: true,
        description: 'Fresh chicken breast',
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        tenantId: 'tenant_1757833139935_2h9n7r7ed',
        name: 'Chicken Drumsticks',
        category: 'Chicken',
        price: 45,
        unit: 'per kg',
        inStock: true,
        description: 'Fresh chicken drumsticks',
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        tenantId: 'tenant_1757833139935_2h9n7r7ed',
        name: 'Whole Chicken',
        category: 'Chicken',
        price: 120,
        unit: 'per kg',
        inStock: false,
        description: 'Fresh whole chicken',
        createdAt: new Date(),
        updatedAt: new Date()
    },
    
    // Pork products
    {
        tenantId: 'tenant_1757833139935_2h9n7r7ed',
        name: 'Pork Chops',
        category: 'Pork',
        price: 95,
        unit: 'per kg',
        inStock: true,
        description: 'Fresh pork chops',
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        tenantId: 'tenant_1757833139935_2h9n7r7ed',
        name: 'Bacon',
        category: 'Pork',
        price: 110,
        unit: 'per kg',
        inStock: true,
        description: 'Premium bacon',
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        tenantId: 'tenant_1757833139935_2h9n7r7ed',
        name: 'Pork Sausages',
        category: 'Pork',
        price: 75,
        unit: 'per kg',
        inStock: true,
        description: 'Fresh pork sausages',
        createdAt: new Date(),
        updatedAt: new Date()
    }
];

async function addSampleProducts() {
    try {
        console.log('🚀 Adding sample products to Firebase...');
        
        const batch = db.batch();
        
        for (const product of sampleProducts) {
            const docRef = db.collection('products').doc();
            batch.set(docRef, product);
        }
        
        await batch.commit();
        
        console.log(`✅ Successfully added ${sampleProducts.length} sample products`);
        console.log('📦 Products added:');
        
        // Group by category for display
        const grouped = sampleProducts.reduce((acc, product) => {
            if (!acc[product.category]) acc[product.category] = [];
            acc[product.category].push(product);
            return acc;
        }, {});
        
        for (const [category, products] of Object.entries(grouped)) {
            console.log(`\n*${category}*`);
            products.forEach(product => {
                const stockStatus = product.inStock ? '✅' : '❌';
                console.log(`  ${stockStatus} ${product.name} - N$${product.price} ${product.unit}`);
            });
        }
        
        console.log('\n🎯 Test the dynamic responses by sending these messages to WhatsApp:');
        console.log('  - "What products do you have?"');
        console.log('  - "Do you sell meat?"');
        console.log('  - "What\'s the price of chicken breast?"');
        console.log('  - "Is beef brisket available?"');
        
    } catch (error) {
        console.error('❌ Error adding sample products:', error);
    }
}

// Run the script
addSampleProducts()
    .then(() => {
        console.log('\n✅ Sample products script completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Script failed:', error);
        process.exit(1);
    });
