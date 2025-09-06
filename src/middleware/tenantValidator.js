// File: src/middleware/tenantValidator.js
// Tenant validation middleware for multi-tenant WhatsApp bot

const { getDatabase } = require('../config/database');

class TenantValidator {
    constructor() {
        this.db = null;
        this.tenantCache = new Map();
        this.cacheTTL = 5 * 60 * 1000; // 5 minutes
        this.lastCacheUpdate = 0;
    }

    async initialize() {
        try {
            this.db = getDatabase();
            console.log('✅ Tenant Validator initialized');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize Tenant Validator:', error.message);
            return false;
        }
    }

    /**
     * Validate tenant access for a given vendorId and tenantId
     * @param {string} vendorId - The vendor/phone ID
     * @param {string} tenantId - The tenant ID to validate
     * @returns {Promise<{isValid: boolean, tenantData?: object, error?: string}>}
     */
    async validateTenantAccess(vendorId, tenantId) {
        try {
            if (!this.db) {
                throw new Error('Database not initialized');
            }

            if (!vendorId || !tenantId) {
                return {
                    isValid: false,
                    error: 'Missing vendorId or tenantId'
                };
            }

            // Check cache first
            const cacheKey = `${vendorId}:${tenantId}`;
            const cached = this.getCachedTenant(cacheKey);
            if (cached) {
                console.log(`✅ Tenant validation (cached): ${vendorId}:${tenantId}`);
                return cached;
            }

            // Query Firestore for tenant validation
            const tenantRef = this.db
                .collection('vendors')
                .doc(vendorId)
                .collection('tenants')
                .doc(tenantId);

            const tenantDoc = await tenantRef.get();

            if (!tenantDoc.exists) {
                console.log(`❌ Tenant not found: ${vendorId}:${tenantId}`);
                return {
                    isValid: false,
                    error: 'Tenant not found or access denied'
                };
            }

            const tenantData = tenantDoc.data();

            // Check if tenant is active
            if (tenantData.isActive === false) {
                console.log(`❌ Tenant inactive: ${vendorId}:${tenantId}`);
                return {
                    isValid: false,
                    error: 'Tenant is inactive'
                };
            }

            const result = {
                isValid: true,
                tenantData: {
                    tenantId,
                    vendorId,
                    name: tenantData.name || `Tenant ${tenantId}`,
                    isActive: tenantData.isActive !== false,
                    settings: tenantData.settings || {},
                    branding: tenantData.branding || {},
                    createdAt: tenantData.createdAt,
                    ...tenantData
                }
            };

            // Cache the result
            this.setCachedTenant(cacheKey, result);

            console.log(`✅ Tenant validation successful: ${vendorId}:${tenantId}`);
            return result;

        } catch (error) {
            console.error(`❌ Tenant validation error for ${vendorId}:${tenantId}:`, error.message);
            return {
                isValid: false,
                error: 'Validation error: ' + error.message
            };
        }
    }

    /**
     * Get primary tenant for a vendor (fallback for single-tenant users)
     * @param {string} vendorId - The vendor/phone ID
     * @returns {Promise<{isValid: boolean, tenantData?: object, error?: string}>}
     */
    async getPrimaryTenant(vendorId) {
        try {
            if (!this.db) {
                throw new Error('Database not initialized');
            }

            // Check if vendor has a primary tenant set
            const vendorRef = this.db.collection('vendors').doc(vendorId);
            const vendorDoc = await vendorRef.get();

            if (vendorDoc.exists) {
                const vendorData = vendorDoc.data();
                const primaryTenantId = vendorData.primaryTenant || 'default';

                // Validate the primary tenant
                const validation = await this.validateTenantAccess(vendorId, primaryTenantId);
                
                if (validation.isValid) {
                    console.log(`✅ Primary tenant found: ${vendorId}:${primaryTenantId}`);
                    return validation;
                }
            }

            // If no primary tenant found, create a default one
            console.log(`⚠️ No primary tenant found for ${vendorId}, creating default tenant`);
            return await this.createDefaultTenant(vendorId);

        } catch (error) {
            console.error(`❌ Error getting primary tenant for ${vendorId}:`, error.message);
            return {
                isValid: false,
                error: 'Failed to get primary tenant: ' + error.message
            };
        }
    }

    /**
     * Create a default tenant for backward compatibility
     * @param {string} vendorId - The vendor/phone ID
     * @returns {Promise<{isValid: boolean, tenantData?: object, error?: string}>}
     */
    async createDefaultTenant(vendorId) {
        try {
            const defaultTenantId = 'default';
            const tenantData = {
                name: 'Default Tenant',
                isActive: true,
                isDefault: true,
                settings: {},
                branding: {},
                createdAt: new Date().toISOString(),
                createdBy: 'system',
                source: 'backward_compatibility'
            };

            // Create the tenant document
            const tenantRef = this.db
                .collection('vendors')
                .doc(vendorId)
                .collection('tenants')
                .doc(defaultTenantId);

            await tenantRef.set(tenantData);

            // Set as primary tenant
            await this.db.collection('vendors').doc(vendorId).update({
                primaryTenant: defaultTenantId,
                lastUpdated: new Date().toISOString()
            });

            console.log(`✅ Created default tenant for ${vendorId}:${defaultTenantId}`);

            return {
                isValid: true,
                tenantData: {
                    tenantId: defaultTenantId,
                    vendorId,
                    ...tenantData
                }
            };

        } catch (error) {
            console.error(`❌ Error creating default tenant for ${vendorId}:`, error.message);
            return {
                isValid: false,
                error: 'Failed to create default tenant: ' + error.message
            };
        }
    }

    /**
     * Middleware function for WebSocket connections
     * @param {string} vendorId - The vendor/phone ID
     * @param {string} tenantId - The tenant ID (optional, will use primary if not provided)
     * @returns {Promise<{isValid: boolean, tenantData?: object, error?: string}>}
     */
    async validateWebSocketConnection(vendorId, tenantId) {
        // If tenantId is provided, validate it
        if (tenantId && tenantId !== 'default') {
            return await this.validateTenantAccess(vendorId, tenantId);
        }

        // Otherwise, get primary tenant
        return await this.getPrimaryTenant(vendorId);
    }

    /**
     * Middleware function for API requests
     * @param {object} req - Request object with vendorId and tenantId
     * @returns {Promise<{isValid: boolean, tenantData?: object, error?: string}>}
     */
    async validateApiRequest(req) {
        const vendorId = req.vendorId || req.params?.vendorId || req.query?.vendorId;
        const tenantId = req.tenantId || req.params?.tenantId || req.query?.tenantId;

        if (!vendorId) {
            return {
                isValid: false,
                error: 'Missing vendorId in request'
            };
        }

        return await this.validateWebSocketConnection(vendorId, tenantId);
    }

    /**
     * Cache management methods
     */
    getCachedTenant(cacheKey) {
        const cached = this.tenantCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp) < this.cacheTTL) {
            return cached.data;
        }
        return null;
    }

    setCachedTenant(cacheKey, data) {
        this.tenantCache.set(cacheKey, {
            data,
            timestamp: Date.now()
        });
    }

    clearCache() {
        this.tenantCache.clear();
        console.log('🧹 Tenant validation cache cleared');
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            cacheSize: this.tenantCache.size,
            cacheTTL: this.cacheTTL,
            lastCacheUpdate: this.lastCacheUpdate
        };
    }

    /**
     * Log warning for missing tenantId (for migration tracking)
     */
    logMissingTenantId(vendorId, context = 'unknown') {
        console.warn(`⚠️ Missing tenantId for vendor ${vendorId} in context: ${context}`);
        console.warn(`⚠️ Consider migrating to multi-tenant model for better isolation`);
    }

    /**
     * Shutdown method
     */
    async shutdown() {
        try {
            this.clearCache();
            console.log('✅ Tenant Validator shutdown complete');
        } catch (error) {
            console.error('❌ Error during Tenant Validator shutdown:', error.message);
        }
    }
}

// Export singleton instance
module.exports = new TenantValidator();
