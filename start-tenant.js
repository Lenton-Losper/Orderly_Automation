const { TenantConfigManager } = require('./src/utils/tenantConfig');
const { getAvailableTenantPorts } = require('./src/utils/portAllocator');

async function startTenant() {
    try {
        const tenantId = process.argv[2];
        
        if (!tenantId) {
            console.log('❌ Missing tenant ID');
            console.log('Usage: node start-tenant.js <tenantId>');
            console.log('Example: node start-tenant.js tenant_1757499607349_xul4pq02s');
            console.log('\n💡 Create a tenant first: node create-tenant.js <tenantId> <phone>');
            process.exit(1);
        }

        console.log(`🚀 Starting tenant: ${tenantId}`);
        
        const configManager = new TenantConfigManager();
        
        // Load tenant configuration from persistent storage
        let tenantConfig;
        try {
            tenantConfig = await configManager.loadTenantConfig(tenantId);
        } catch (error) {
            console.error(`❌ ${error.message}`);
            console.log('\n💡 Create the tenant first:');
            console.log(`node create-tenant.js ${tenantId} <businessPhone> [businessName]`);
            process.exit(1);
        }

        // Verify tenant is active
        if (!tenantConfig.isActive) {
            console.log(`⚠️ Tenant ${tenantId} is marked as inactive`);
            process.exit(1);
        }

        // Get or assign ports
        let ports = tenantConfig.allocatedPorts;
        if (!ports) {
            console.log('📊 Allocating new ports for tenant...');
            ports = await getAvailableTenantPorts(tenantId);
            
            // Update tenant config with allocated ports
            await configManager.updateTenantConfig(tenantId, {
                allocatedPorts: ports
            });
        }

        console.log('📋 Tenant Configuration:');
        console.log(`   Tenant ID: ${tenantConfig.tenantId}`);
        console.log(`   Business Phone: ${tenantConfig.businessPhone}`);
        console.log(`   Business Name: ${tenantConfig.businessName}`);
        console.log(`   API Port: ${ports.apiPort}`);
        console.log(`   WebSocket Port: ${ports.websocketPort}`);

        // Set environment variables for the tenant process
        process.env.API_PORT = ports.apiPort.toString();
        process.env.WEBSOCKET_PORT = ports.websocketPort.toString();
        process.env.TENANT_ID = tenantId;
        process.env.BUSINESS_PHONE = tenantConfig.businessPhone;
        process.env.BUSINESS_NAME = tenantConfig.businessName || '';

        console.log('🔧 Environment configured successfully');
        console.log(`   API_PORT=${ports.apiPort}`);
        console.log(`   WEBSOCKET_PORT=${ports.websocketPort}`);
        console.log(`   BUSINESS_PHONE=${tenantConfig.businessPhone}`);

        // Start the bot with loaded configuration
        console.log('🎯 Initializing WhatsApp bot...');
        const { startBot } = require('./src/index');
        await startBot();

    } catch (error) {
        console.error('💥 Failed to start tenant:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('🛑 Received SIGINT, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('🛑 Received SIGTERM, shutting down gracefully...');
    process.exit(0);
});

startTenant();