#!/usr/bin/env node

/**
 * Force product cache refresh
 * This clears the cache and forces the bot to reload products
 */

require('dotenv').config();

async function forceRefresh() {
    try {
        console.log('🔄 Forcing product cache refresh...');
        
        // Import the product service
        const ProductService = require('./src/services/productService');
        const productService = new ProductService();
        
        await productService.initialize();
        
        // Get tenant ID from environment
        const tenantId = process.env.TENANT_ID || 'tenant_1757833139935_2h9n7r7ed';
        
        console.log(`📂 Clearing cache for tenant: ${tenantId}`);
        
        // Clear cache
        productService.clearCache(tenantId);
        
        // Force fetch fresh products
        console.log('📦 Fetching fresh products...');
        const products = await productService.getProductsForTenant(tenantId, true);
        
        console.log(`✅ Found ${products.length} products:`);
        products.forEach((product, index) => {
            console.log(`   ${index + 1}. ${product.name} - N$${product.price}`);
        });
        
        // Check if test2 is there
        const test2 = products.find(p => p.name && p.name.toLowerCase().includes('test2'));
        if (test2) {
            console.log('');
            console.log(`✅ test2 found!`);
            console.log(`   Name: ${test2.name}`);
            console.log(`   Price: N$${test2.price}`);
        } else {
            console.log('');
            console.log(`❌ test2 NOT found in products`);
            console.log(`💡 The product might be in Firebase but not synced yet, or it's in the wrong path`);
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    }
    
    process.exit(0);
}

forceRefresh();

