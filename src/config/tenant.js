const path = require('path');
const fs = require('fs');

const getTenantConfig = (tenantId) => {
    if (!tenantId) {
        throw new Error('Tenant ID is required');
    }

    const basePort = 3000;
    const tenantDir = path.join(process.cwd(), 'tenants', tenantId);
    
    return {
        tenantId,
        authDir: path.join(tenantDir, 'auth'),
        logsDir: path.join(tenantDir, 'logs'),
        invoicesDir: path.join(tenantDir, 'invoices'),
        websocketPort: basePort + parseInt(tenantId),
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