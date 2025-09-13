const { TenantConfigManager } = require('./src/utils/tenantConfig');

async function manageTenants() {
    const action = process.argv[2];
    const configManager = new TenantConfigManager();

    switch (action) {
        case 'list':
            const tenants = await configManager.listTenants();
            console.log('\n📋 Configured Tenants:');
            console.log('='.repeat(60));
            
            if (tenants.length === 0) {
                console.log('No tenants configured.');
            } else {
                tenants.forEach(tenant => {
                    console.log(`Tenant ID: ${tenant.tenantId}`);
                    console.log(`  Phone: ${tenant.businessPhone}`);
                    console.log(`  Name: ${tenant.businessName}`);
                    console.log(`  Active: ${tenant.isActive}`);
                    console.log(`  Created: ${tenant.createdAt}`);
                    if (tenant.allocatedPorts) {
                        console.log(`  API Port: ${tenant.allocatedPorts.apiPort}`);
                        console.log(`  WebSocket Port: ${tenant.allocatedPorts.websocketPort}`);
                    }
                    console.log('---');
                });
            }
            break;

        case 'delete':
            const tenantId = process.argv[3];
            if (!tenantId) {
                console.log('Usage: node manage-tenants.js delete <tenantId>');
                process.exit(1);
            }
            
            await configManager.deleteTenant(tenantId);
            console.log(`✅ Tenant ${tenantId} deleted successfully`);
            break;

        case 'show':
            const showTenantId = process.argv[3];
            if (!showTenantId) {
                console.log('Usage: node manage-tenants.js show <tenantId>');
                process.exit(1);
            }
            
            try {
                const config = await configManager.loadTenantConfig(showTenantId);
                console.log('\n📋 Tenant Configuration:');
                console.log('='.repeat(50));
                console.log(`Tenant ID: ${config.tenantId}`);
                console.log(`Business Phone: ${config.businessPhone}`);
                console.log(`Business Name: ${config.businessName}`);
                console.log(`Business Email: ${config.businessEmail}`);
                console.log(`Business Address: ${config.businessAddress}`);
                console.log(`Active: ${config.isActive}`);
                console.log(`Created: ${config.createdAt}`);
                console.log(`Updated: ${config.updatedAt}`);
                if (config.allocatedPorts) {
                    console.log(`API Port: ${config.allocatedPorts.apiPort}`);
                    console.log(`WebSocket Port: ${config.allocatedPorts.websocketPort}`);
                }
                console.log('='.repeat(50));
            } catch (error) {
                console.error(`❌ ${error.message}`);
                process.exit(1);
            }
            break;

        default:
            console.log('Tenant Management Commands:');
            console.log('  list    - List all configured tenants');
            console.log('  show    - Show detailed configuration for a tenant');
            console.log('  delete  - Delete a tenant configuration');
            console.log('\nUsage:');
            console.log('  node manage-tenants.js list');
            console.log('  node manage-tenants.js show <tenantId>');
            console.log('  node manage-tenants.js delete <tenantId>');
    }
}

manageTenants().catch(error => {
    console.error('Error:', error.message);
    process.exit(1);
});
