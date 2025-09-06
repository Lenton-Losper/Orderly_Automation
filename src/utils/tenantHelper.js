// File: src/utils/tenantHelper.js
// Tenant helper utilities for multi-tenant WhatsApp bot

const tenantValidator = require('../middleware/tenantValidator');

class TenantHelper {
    constructor() {
        this.tenantValidator = tenantValidator;
    }

    /**
     * Get tenantId with fallback for single-tenant users
     * @param {string} vendorId - The vendor/phone ID
     * @param {string} providedTenantId - Tenant ID provided in request (optional)
     * @returns {Promise<{tenantId: string, isFallback: boolean, warning?: string}>}
     */
    async getTenantIdWithFallback(vendorId, providedTenantId = null) {
        try {
            // If tenantId is provided, validate it
            if (providedTenantId && providedTenantId !== 'default') {
                const validation = await this.tenantValidator.validateTenantAccess(vendorId, providedTenantId);
                
                if (validation.isValid) {
                    return {
                        tenantId: providedTenantId,
                        isFallback: false
                    };
                } else {
                    console.warn(`⚠️ Invalid tenantId ${providedTenantId} for vendor ${vendorId}: ${validation.error}`);
                }
            }

            // Get primary tenant as fallback
            const primaryTenant = await this.tenantValidator.getPrimaryTenant(vendorId);
            
            if (primaryTenant.isValid) {
                const isFallback = !providedTenantId || providedTenantId === 'default';
                
                return {
                    tenantId: primaryTenant.tenantData.tenantId,
                    isFallback,
                    warning: isFallback ? `Using fallback tenant for vendor ${vendorId}` : null
                };
            } else {
                // Ultimate fallback to 'default'
                console.warn(`⚠️ No valid tenant found for vendor ${vendorId}, using 'default'`);
                return {
                    tenantId: 'default',
                    isFallback: true,
                    warning: `No valid tenant found for vendor ${vendorId}, using 'default'`
                };
            }

        } catch (error) {
            console.error(`❌ Error getting tenantId for vendor ${vendorId}:`, error.message);
            return {
                tenantId: 'default',
                isFallback: true,
                warning: `Error getting tenantId: ${error.message}`
            };
        }
    }

    /**
     * Get tenant-scoped Firestore path
     * @param {string} vendorId - The vendor/phone ID
     * @param {string} tenantId - The tenant ID
     * @param {string} collection - The collection name
     * @param {string} docId - The document ID (optional)
     * @returns {string} - The Firestore path
     */
    getTenantScopedPath(vendorId, tenantId, collection, docId = null) {
        const basePath = `vendors/${vendorId}/tenants/${tenantId}/${collection}`;
        return docId ? `${basePath}/${docId}` : basePath;
    }

    /**
     * Get legacy path for backward compatibility
     * @param {string} vendorId - The vendor/phone ID
     * @param {string} collection - The collection name
     * @param {string} docId - The document ID (optional)
     * @returns {string} - The legacy Firestore path
     */
    getLegacyPath(vendorId, collection, docId = null) {
        const basePath = `vendors/${vendorId}/${collection}`;
        return docId ? `${basePath}/${docId}` : basePath;
    }

    /**
     * Migrate data from legacy path to tenant-scoped path
     * @param {object} db - Firestore database instance
     * @param {string} vendorId - The vendor/phone ID
     * @param {string} tenantId - The tenant ID
     * @param {string} collection - The collection name
     * @returns {Promise<boolean>} - Success status
     */
    async migrateDataToTenantScope(db, vendorId, tenantId, collection) {
        try {
            console.log(`🔄 Migrating ${collection} data for vendor ${vendorId} to tenant ${tenantId}`);
            
            const legacyRef = db.collection(this.getLegacyPath(vendorId, collection));
            const tenantRef = db.collection(this.getTenantScopedPath(vendorId, tenantId, collection));
            
            const snapshot = await legacyRef.get();
            
            if (snapshot.empty) {
                console.log(`📭 No data to migrate for ${collection}`);
                return true;
            }

            const batch = db.batch();
            let migratedCount = 0;

            snapshot.forEach(doc => {
                const data = doc.data();
                
                // Add tenantId to the data
                const tenantData = {
                    ...data,
                    tenantId,
                    migratedAt: new Date().toISOString(),
                    originalId: doc.id
                };

                // Create new document in tenant-scoped collection
                const newDocRef = tenantRef.doc(doc.id);
                batch.set(newDocRef, tenantData);
                migratedCount++;
            });

            await batch.commit();
            console.log(`✅ Migrated ${migratedCount} documents for ${collection}`);
            return true;

        } catch (error) {
            console.error(`❌ Error migrating ${collection} data:`, error.message);
            return false;
        }
    }

    /**
     * Check if tenant has data in legacy format
     * @param {object} db - Firestore database instance
     * @param {string} vendorId - The vendor/phone ID
     * @param {string} collection - The collection name
     * @returns {Promise<boolean>} - Whether legacy data exists
     */
    async hasLegacyData(db, vendorId, collection) {
        try {
            const legacyRef = db.collection(this.getLegacyPath(vendorId, collection));
            const snapshot = await legacyRef.limit(1).get();
            return !snapshot.empty;
        } catch (error) {
            console.error(`❌ Error checking legacy data for ${collection}:`, error.message);
            return false;
        }
    }

    /**
     * Log tenant access for monitoring
     * @param {string} vendorId - The vendor/phone ID
     * @param {string} tenantId - The tenant ID
     * @param {string} action - The action being performed
     * @param {boolean} isFallback - Whether this was a fallback tenant
     */
    logTenantAccess(vendorId, tenantId, action, isFallback = false) {
        const logLevel = isFallback ? 'warn' : 'info';
        const message = `🏢 Tenant access: ${action} for vendor ${vendorId}, tenant ${tenantId}${isFallback ? ' (fallback)' : ''}`;
        
        if (logLevel === 'warn') {
            console.warn(`⚠️ ${message}`);
        } else {
            console.log(`✅ ${message}`);
        }
    }

    /**
     * Get tenant configuration with fallbacks
     * @param {string} tenantId - The tenant ID
     * @returns {object} - Tenant configuration
     */
    getTenantConfig(tenantId) {
        const defaultConfig = {
            tenantId,
            name: `Tenant ${tenantId}`,
            isActive: true,
            settings: {},
            branding: {},
            features: {
                whatsapp: true,
                websocket: true,
                invoices: true
            }
        };

        // Try to get from environment variables
        const envConfig = {
            name: process.env[`TENANT_${tenantId}_NAME`] || defaultConfig.name,
            isActive: process.env[`TENANT_${tenantId}_ACTIVE`] !== 'false',
            settings: JSON.parse(process.env[`TENANT_${tenantId}_SETTINGS`] || '{}'),
            branding: JSON.parse(process.env[`TENANT_${tenantId}_BRANDING`] || '{}')
        };

        return {
            ...defaultConfig,
            ...envConfig
        };
    }
}

// Export singleton instance
module.exports = new TenantHelper();
