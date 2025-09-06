const path = require('path');
const fs = require('fs');

const getTenantConfig = (tenantId) => {
    if (!tenantId) {
        throw new Error('Tenant ID is required');
    }

    const basePort = 3000;
    const tenantDir = path.join(process.cwd(), 'tenants', tenantId);
    
    // Generate a consistent port number for tenant IDs
    let portOffset = 0;
    if (tenantId === 'tenant1') {
        portOffset = 1;
    } else if (tenantId === 'tenant2') {
        portOffset = 2;
    } else if (tenantId === 'default') {
        portOffset = 0;
    } else {
        // For other tenant IDs, use a simple hash
        let hash = 0;
        for (let i = 0; i < tenantId.length; i++) {
            const char = tenantId.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        portOffset = Math.abs(hash) % 100; // Keep it reasonable
    }
    
    return {
        tenantId,
        authDir: path.join(tenantDir, 'auth'),
        logsDir: path.join(tenantDir, 'logs'),
        invoicesDir: path.join(tenantDir, 'invoices'),
        websocketPort: basePort + portOffset,
        firebaseCollection: `tenant_${tenantId}`,
        businessPhone: process.env[`PHONE_${tenantId}`] || null,
        tenantDir
    };
};

const createTenantDirectories = (tenantConfig) => {
    const directories = [
        tenantConfig.authDir,
        tenantConfig.logsDir,
        tenantConfig.invoicesDir
    ];

    directories.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`Created directory: ${dir}`);
        }
    });
};

module.exports = { 
    getTenantConfig, 
    createTenantDirectories 
};