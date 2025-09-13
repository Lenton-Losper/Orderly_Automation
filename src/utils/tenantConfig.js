const fs = require('fs');
const path = require('path');

class TenantConfigManager {
    constructor() {
        this.configDir = path.join(__dirname, '../../tenants');
    }

    /**
     * Save tenant configuration when creating a tenant
     * @param {string} tenantId - Unique tenant identifier
     * @param {Object} config - Tenant configuration object
     * @returns {Object} Complete tenant configuration
     */
    async saveTenantConfig(tenantId, config) {
        const tenantDir = path.join(this.configDir, tenantId);
        const configPath = path.join(tenantDir, 'tenant-config.json');
        
        // Ensure tenant directory exists
        if (!fs.existsSync(tenantDir)) {
            fs.mkdirSync(tenantDir, { recursive: true });
        }

        const tenantConfig = {
            tenantId,
            businessPhone: config.businessPhone,
            businessName: config.businessName || '',
            businessEmail: config.businessEmail || '',
            businessAddress: config.businessAddress || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isActive: true,
            ...config
        };

        fs.writeFileSync(configPath, JSON.stringify(tenantConfig, null, 2));
        console.log(`✅ Tenant configuration saved: ${configPath}`);
        return tenantConfig;
    }

    /**
     * Load tenant configuration from file
     * @param {string} tenantId - Tenant identifier
     * @returns {Object} Tenant configuration
     */
    async loadTenantConfig(tenantId) {
        const configPath = path.join(this.configDir, tenantId, 'tenant-config.json');
        
        if (!fs.existsSync(configPath)) {
            throw new Error(`❌ Tenant configuration not found for: ${tenantId}. Please create tenant first using create-tenant.js`);
        }

        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        console.log(`✅ Loaded tenant config for: ${tenantId}`);
        return config;
    }

    /**
     * Update tenant configuration
     * @param {string} tenantId - Tenant identifier
     * @param {Object} updates - Configuration updates
     * @returns {Object} Updated configuration
     */
    async updateTenantConfig(tenantId, updates) {
        const config = await this.loadTenantConfig(tenantId);
        const updatedConfig = {
            ...config,
            ...updates,
            updatedAt: new Date().toISOString()
        };
        
        return await this.saveTenantConfig(tenantId, updatedConfig);
    }

    /**
     * Check if tenant configuration exists
     * @param {string} tenantId - Tenant identifier
     * @returns {boolean} True if tenant exists
     */
    tenantExists(tenantId) {
        const configPath = path.join(this.configDir, tenantId, 'tenant-config.json');
        return fs.existsSync(configPath);
    }

    /**
     * List all configured tenants
     * @returns {Array} Array of tenant configurations
     */
    async listTenants() {
        if (!fs.existsSync(this.configDir)) {
            return [];
        }

        const tenants = [];
        const tenantDirs = fs.readdirSync(this.configDir);

        for (const tenantDir of tenantDirs) {
            try {
                const config = await this.loadTenantConfig(tenantDir);
                tenants.push(config);
            } catch (error) {
                console.warn(`⚠️ Could not load config for tenant: ${tenantDir}`);
            }
        }

        return tenants;
    }

    /**
     * Delete tenant configuration and directories
     * @param {string} tenantId - Tenant identifier
     */
    async deleteTenant(tenantId) {
        const tenantDir = path.join(this.configDir, tenantId);
        if (fs.existsSync(tenantDir)) {
            fs.rmSync(tenantDir, { recursive: true, force: true });
            console.log(`✅ Tenant deleted: ${tenantId}`);
        }
    }
}

module.exports = { TenantConfigManager };
