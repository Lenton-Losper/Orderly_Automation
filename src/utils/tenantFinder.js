const admin = require('firebase-admin');

class TenantFinder {
    constructor() {
        this.db = admin.firestore();
    }

    /**
     * Find existing tenants by phone number
     * @param {string} phoneNumber - The phone number to search for
     * @returns {Array} Array of tenant documents that match the phone number
     */
    async findTenantsByPhone(phoneNumber) {
        try {
            console.log(`🔍 Searching for tenants with phone number: ${phoneNumber}`);
            
            // Clean the phone number for consistent searching
            const cleanPhone = this.cleanPhoneNumber(phoneNumber);
            console.log(`🔍 Cleaned phone number: ${cleanPhone}`);
            
            // Search in tenants collection where phoneId matches
            const tenantsQuery = await this.db.collection('tenants')
                .where('phoneId', '==', cleanPhone)
                .get();
            
            const tenants = [];
            tenantsQuery.forEach(doc => {
                const data = doc.data();
                tenants.push({
                    id: doc.id,
                    ...data
                });
            });
            
            console.log(`🔍 Found ${tenants.length} tenant(s) with phone number ${cleanPhone}`);
            return tenants;
            
        } catch (error) {
            console.error('❌ Error searching for tenants by phone:', error);
            return [];
        }
    }

    /**
     * Find the most appropriate tenant for a phone number
     * Priority: 1) isDefault: true, 2) Most recent createdAt, 3) First found
     * @param {string} phoneNumber - The phone number to search for
     * @returns {Object|null} The best matching tenant or null
     */
    async findBestTenantForPhone(phoneNumber) {
        try {
            const tenants = await this.findTenantsByPhone(phoneNumber);
            
            if (tenants.length === 0) {
                console.log(`🔍 No tenants found for phone number: ${phoneNumber}`);
                return null;
            }
            
            if (tenants.length === 1) {
                console.log(`🔍 Found single tenant: ${tenants[0].id}`);
                return tenants[0];
            }
            
            // Multiple tenants found - apply priority logic
            console.log(`🔍 Found ${tenants.length} tenants, applying priority logic...`);
            
            // Priority 1: Find tenant with isDefault: true
            const defaultTenant = tenants.find(tenant => tenant.isDefault === true);
            if (defaultTenant) {
                console.log(`🔍 Using default tenant: ${defaultTenant.id}`);
                return defaultTenant;
            }
            
            // Priority 2: Find tenant with most recent createdAt
            const sortedTenants = tenants.sort((a, b) => {
                const aTime = a.createdAt || 0;
                const bTime = b.createdAt || 0;
                return bTime - aTime; // Most recent first
            });
            
            console.log(`🔍 Using most recent tenant: ${sortedTenants[0].id}`);
            return sortedTenants[0];
            
        } catch (error) {
            console.error('❌ Error finding best tenant for phone:', error);
            return null;
        }
    }

    /**
     * Clean phone number for consistent searching
     * @param {string} phoneNumber - Raw phone number
     * @returns {string} Cleaned phone number
     */
    cleanPhoneNumber(phoneNumber) {
        if (!phoneNumber) return '';
        
        // Remove any non-digit characters except +
        let cleaned = phoneNumber.toString().replace(/[^\d+]/g, '');
        
        // Remove + if present
        cleaned = cleaned.replace('+', '');
        
        // Ensure it's a string
        return cleaned.toString();
    }

    /**
     * Check if a tenant exists by ID
     * @param {string} tenantId - The tenant ID to check
     * @returns {boolean} True if tenant exists
     */
    async tenantExists(tenantId) {
        try {
            const doc = await this.db.collection('tenants').doc(tenantId).get();
            return doc.exists;
        } catch (error) {
            console.error('❌ Error checking if tenant exists:', error);
            return false;
        }
    }

    /**
     * Get tenant details by ID
     * @param {string} tenantId - The tenant ID
     * @returns {Object|null} Tenant data or null
     */
    async getTenantById(tenantId) {
        try {
            const doc = await this.db.collection('tenants').doc(tenantId).get();
            if (doc.exists) {
                return {
                    id: doc.id,
                    ...doc.data()
                };
            }
            return null;
        } catch (error) {
            console.error('❌ Error getting tenant by ID:', error);
            return null;
        }
    }
}

module.exports = { TenantFinder };


