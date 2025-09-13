const { TenantConfigManager } = require('./src/utils/tenantConfig');

async function updateTenant() {
    const tenantId = process.argv[2];
    const field = process.argv[3];
    const value = process.argv[4];

    if (!tenantId || !field || value === undefined) {
        console.log('❌ Missing required parameters');
        console.log('Usage: node update-tenant.js <tenantId> <field> <value>');
        console.log('Fields: businessPhone, businessName, businessEmail, businessAddress, isActive');
        console.log('Examples:');
        console.log('  node update-tenant.js tenant_123 businessPhone 264817375744');
        console.log('  node update-tenant.js tenant_123 businessName "New Business Name"');
        console.log('  node update-tenant.js tenant_123 isActive false');
        process.exit(1);
    }

    const allowedFields = ['businessPhone', 'businessName', 'businessEmail', 'businessAddress', 'isActive'];
    if (!allowedFields.includes(field)) {
        console.log(`❌ Invalid field: ${field}`);
        console.log(`Allowed fields: ${allowedFields.join(', ')}`);
        process.exit(1);
    }

    try {
        const configManager = new TenantConfigManager();
        
        // Check if tenant exists
        if (!configManager.tenantExists(tenantId)) {
            console.log(`❌ Tenant ${tenantId} does not exist. Create it first with create-tenant.js`);
            process.exit(1);
        }

        // Parse boolean values
        let parsedValue = value;
        if (field === 'isActive') {
            parsedValue = value.toLowerCase() === 'true';
        }

        // Update tenant configuration
        const updatedConfig = await configManager.updateTenantConfig(tenantId, {
            [field]: parsedValue
        });

        console.log(`✅ Tenant ${tenantId} updated successfully:`);
        console.log(`   ${field}: ${parsedValue}`);
        console.log(`   Updated: ${updatedConfig.updatedAt}`);

    } catch (error) {
        console.error('❌ Failed to update tenant:', error.message);
        process.exit(1);
    }
}

updateTenant();
