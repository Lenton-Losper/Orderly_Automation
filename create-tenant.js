const { TenantConfigManager } = require('./src/utils/tenantConfig');
const { getAvailableTenantPorts } = require('./src/utils/portAllocator');

async function createTenant() {
    const tenantId = process.argv[2];
    const businessPhone = process.argv[3];
    const businessName = process.argv[4] || '';
    const businessEmail = process.argv[5] || '';

    if (!tenantId || !businessPhone) {
        console.log('❌ Missing required parameters');
        console.log('Usage: node create-tenant.js <tenantId> <businessPhone> [businessName] [businessEmail]');
        console.log('Example: node create-tenant.js tenant_1757499607349_xul4pq02s 264817375744 "Bob\'s Farm" "bob@farm.com"');
        process.exit(1);
    }

    try {
        const configManager = new TenantConfigManager();
        
        // Check if tenant already exists
        if (configManager.tenantExists(tenantId)) {
            console.log(`⚠️ Tenant ${tenantId} already exists. Use update-tenant.js to modify.`);
            process.exit(1);
        }

        // Get allocated ports for this tenant
        const ports = await getAvailableTenantPorts(tenantId);
        
        // Create tenant configuration
        const config = await configManager.saveTenantConfig(tenantId, {
            businessPhone,
            businessName,
            businessEmail,
            allocatedPorts: ports
        });

        console.log('\n✅ Tenant created successfully:');
        console.log('=====================================');
        console.log(`Tenant ID: ${config.tenantId}`);
        console.log(`Business Phone: ${config.businessPhone}`);
        console.log(`Business Name: ${config.businessName}`);
        console.log(`API Port: ${ports.apiPort}`);
        console.log(`WebSocket Port: ${ports.websocketPort}`);
        console.log(`Created: ${config.createdAt}`);
        console.log('=====================================');
        
        console.log('\n📋 Next steps:');
        console.log(`1. Start tenant: pm2 start start-tenant.js --name "${tenantId}" -- ${tenantId}`);
        console.log(`2. View logs: pm2 logs ${tenantId}`);
        console.log(`3. Stop tenant: pm2 stop ${tenantId}`);

    } catch (error) {
        console.error('❌ Failed to create tenant:', error.message);
        process.exit(1);
    }
}

createTenant();
