/**
 * Product Database Service
 * Handles fetching and managing product data for tenants
 */

const admin = require('firebase-admin');

class ProductService {
    constructor() {
        this.db = null;
        this.productCache = new Map(); // Cache products by tenant
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }

    async initialize() {
        if (!this.db) {
            this.db = admin.firestore();
            console.log('✅ Product Service initialized');
        }
    }

    /**
     * Get all products for a tenant
     * @param {string} tenantId - The tenant ID
     * @param {boolean} inStockOnly - Only return in-stock products
     * @returns {Promise<Array>} Array of products
     */
    async getProductsForTenant(tenantId, inStockOnly = true) {
        try {
            await this.initialize();
            
            // Check cache first
            const cacheKey = `${tenantId}_${inStockOnly}`;
            const cached = this.productCache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
                console.log(`📦 Using cached products for tenant: ${tenantId}`);
                return cached.products;
            }

            console.log('═══════════════════════════════════════');
            console.log(`🔍 FETCHING PRODUCTS FOR TENANT`);
            console.log(`Tenant ID: ${tenantId}`);
            
            // Use the correct Firebase path structure: vendors/{businessId}/tenants/{tenantId}/products
            const businessId = '264813141453';
            const queryPath = `vendors/${businessId}/tenants/${tenantId}/products`;
            
            console.log(`📂 Query Path: ${queryPath}`);
            
            // First, let's check what's actually in the database without filters
            const allProductsRef = this.db
                .collection('vendors')
                .doc(businessId)
                .collection('tenants')
                .doc(tenantId)
                .collection('products');
            
            const allSnapshot = await allProductsRef.get();
            console.log(`📊 Total products found (no filter): ${allSnapshot.size}`);
            
            if (allSnapshot.size > 0) {
                allSnapshot.forEach(doc => {
                    const data = doc.data();
                    console.log(`  - ${doc.id}: ${data.name || 'unnamed'}, isActive: ${data.isActive}, isAvailable: ${data.isAvailable}`);
                });
            } else {
                console.log('⚠️ No products found at this path');
                
                // Debug: List all documents in tenants collection
                const tenantsRef = this.db
                    .collection('vendors')
                    .doc(businessId)
                    .collection('tenants');
                
                const tenantsSnapshot = await tenantsRef.get();
                console.log(`📋 Available tenants for business ${businessId}: ${tenantsSnapshot.size}`);
                tenantsSnapshot.forEach(doc => {
                    console.log(`  - Tenant: ${doc.id}`);
                });
            }
            
            // Get all active products first, then filter in memory for better control
            let query = this.db
                .collection('vendors')
                .doc(businessId)
                .collection('tenants')
                .doc(tenantId)
                .collection('products')
                .where('isActive', '==', true);

            const snapshot = await query.get();
            console.log(`📊 Active products found: ${snapshot.size}`);
            
            let products = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            console.log(`📦 Raw products from Firebase: ${products.length}`);
            products.forEach((product, index) => {
                console.log(`📦 Product ${index + 1}: ${product.name}, isActive: ${product.isActive}, isAvailable: ${product.isAvailable}`);
            });

            // Filter for availability in memory (handle undefined values)
            if (inStockOnly) {
                const beforeFilter = products.length;
                products = products.filter(product => {
                    // If isAvailable is undefined, consider it available (default behavior)
                    return product.isAvailable !== false;
                });
                console.log(`📦 Filtered products: ${beforeFilter} -> ${products.length} (inStockOnly: ${inStockOnly})`);
            }

            // Cache the results
            this.productCache.set(cacheKey, {
                products,
                timestamp: Date.now()
            });

            console.log(`✅ Found ${products.length} products for tenant: ${tenantId}`);
            console.log('═══════════════════════════════════════\n');
            return products;
            
        } catch (error) {
            console.error('❌ Error fetching products:', error);
            console.error('Error details:', error.message);
            console.error('Stack:', error.stack);
            console.log('═══════════════════════════════════════\n');
            return [];
        }
    }

    /**
     * Find a specific product by name (fuzzy search)
     * @param {string} tenantId - The tenant ID
     * @param {string} searchTerm - Product name to search for
     * @returns {Promise<Object|null>} Found product or null
     */
    async findProduct(tenantId, searchTerm) {
        try {
            const products = await this.getProductsForTenant(tenantId, false);
            
            if (!products || products.length === 0) {
                return null;
            }

            const searchLower = searchTerm.toLowerCase();
            
            // First try exact match
            let product = products.find(p => 
                p.name.toLowerCase() === searchLower
            );
            
            // Then try partial match
            if (!product) {
                product = products.find(p => 
                    p.name.toLowerCase().includes(searchLower)
                );
            }
            
            // Then try category match
            if (!product) {
                product = products.find(p => 
                    p.category && p.category.toLowerCase().includes(searchLower)
                );
            }

            if (product) {
                console.log(`🔍 Found product: ${product.name} for search: ${searchTerm}`);
            } else {
                console.log(`🔍 No product found for search: ${searchTerm}`);
            }

            return product;
            
        } catch (error) {
            console.error('❌ Error finding product:', error);
            return null;
        }
    }

    /**
     * Group products by category
     * @param {Array} products - Array of products
     * @returns {Object} Products grouped by category
     */
    groupByCategory(products) {
        return products.reduce((grouped, product) => {
            const category = product.category || 'Other';
            if (!grouped[category]) {
                grouped[category] = [];
            }
            grouped[category].push(product);
            return grouped;
        }, {});
    }

    /**
     * Format products for WhatsApp display
     * @param {Array} products - Array of products
     * @returns {string} Formatted product list
     */
    formatProductsForWhatsApp(products) {
        if (!products || products.length === 0) {
            return "We're updating our product list. Please check back soon or contact us directly!";
        }

        const grouped = this.groupByCategory(products);
        let response = "🛒 *Our Products*\n\n";

        for (const [category, items] of Object.entries(grouped)) {
            response += `*${category}*\n`;
            items.forEach(product => {
                const stockStatus = product.isAvailable !== false ? "✅" : "❌";
                const price = product.price ? `N$${product.price}` : 'Price on request';
                const unit = product.unit ? ` ${product.unit}` : '';
                const stockText = product.isAvailable === false ? ' (Out of stock)' : '';
                
                response += `${stockStatus} ${product.name} - ${price}${unit}${stockText}\n`;
            });
            response += "\n";
        }

        response += "What would you like to order? 😊";
        return response;
    }

    /**
     * Get product availability message
     * @param {string} tenantId - The tenant ID
     * @param {string} productName - Product name to check
     * @returns {Promise<string>} Availability message
     */
    async getProductAvailability(tenantId, productName) {
        try {
            const product = await this.findProduct(tenantId, productName);
            
            if (!product) {
                return "Which product's availability would you like to check?";
            }

            if (product.isAvailable !== false) {
                return `✅ Yes, ${product.name} is available!`;
            } else {
                return `❌ Sorry, ${product.name} is currently out of stock.`;
            }
            
        } catch (error) {
            console.error('❌ Error checking availability:', error);
            return "Sorry, I couldn't check the availability right now. Please try again.";
        }
    }

    /**
     * Get product price message
     * @param {string} tenantId - The tenant ID
     * @param {string} productName - Product name to check
     * @returns {Promise<string>} Price message
     */
    async getProductPrice(tenantId, productName) {
        try {
            const product = await this.findProduct(tenantId, productName);
            
            if (!product) {
                return "Which product would you like to know the price for?";
            }

            if (product.price) {
                const unit = product.unit ? ` ${product.unit}` : '';
                return `${product.name} costs N$${product.price}${unit}`;
            } else {
                return `${product.name} - Price on request. Please contact us for current pricing.`;
            }
            
        } catch (error) {
            console.error('❌ Error getting price:', error);
            return "Sorry, I couldn't get the price right now. Please try again.";
        }
    }

    /**
     * Clear cache for a tenant (useful when products are updated)
     * @param {string} tenantId - The tenant ID
     */
    clearCache(tenantId) {
        const keysToDelete = [];
        for (const key of this.productCache.keys()) {
            if (key.startsWith(tenantId)) {
                keysToDelete.push(key);
            }
        }
        
        keysToDelete.forEach(key => this.productCache.delete(key));
        console.log(`🧹 Cleared product cache for tenant: ${tenantId}`);
    }

    /**
     * Clear all cache
     */
    clearAllCache() {
        this.productCache.clear();
        console.log('🧹 Cleared all product cache');
    }
}

module.exports = ProductService;
