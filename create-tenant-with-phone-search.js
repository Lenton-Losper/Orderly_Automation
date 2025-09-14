const { TenantConfigManager } = require('./src/utils/tenantConfig');
const { getAvailableTenantPorts } = require('./src/utils/portAllocator');
const { TenantFinder } = require('./src/utils/tenantFinder');

async function createTenantWithPhoneSearch() {
    const businessPhone = process.argv[2];
    const businessName = process.argv[3] || '';
    const businessEmail = process.argv[4] || '';

    if (!businessPhone) {
        console.log('❌ Missing required parameter: businessPhone');
        console.log('Usage: node create-tenant-with-phone-search.js <businessPhone> [businessName] [businessEmail]');
        console.log('Example: node create-tenant-with-phone-search.js 264817375744 "Bob\'s Farm" "bob@farm.com"');
        process.exit(1);
    }

    try {
        const tenantFinder = new TenantFinder();
        const configManager = new TenantConfigManager();
        
        console.log(`🔍 Searching for existing tenants with phone number: ${businessPhone}`);
        
        // First, search for existing tenants with this phone number
        const existingTenants = await tenantFinder.findTenantsByPhone(businessPhone);
        
        if (existingTenants.length > 0) {
            console.log(`\n✅ Found ${existingTenants.length} existing tenant(s) with phone number ${businessPhone}:`);
            console.log('=====================================');
            
            existingTenants.forEach((tenant, index) => {
                console.log(`${index + 1}. Tenant ID: ${tenant.id}`);
                console.log(`   Business Name: ${tenant.name || 'N/A'}`);
                console.log(`   Phone ID: ${tenant.phoneId}`);
                console.log(`   Owner ID: ${tenant.ownerId || 'N/A'}`);
                console.log(`   Is Default: ${tenant.isDefault || false}`);
                console.log(`   Created: ${tenant.createdAt ? new Date(tenant.createdAt).toISOString() : 'N/A'}`);
                console.log('   ---');
            });
            
            // Find the best tenant to use
            const bestTenant = await tenantFinder.findBestTenantForPhone(businessPhone);
            
            if (bestTenant) {
                console.log(`\n🎯 Recommended tenant to use: ${bestTenant.id}`);
                console.log(`   Reason: ${bestTenant.isDefault ? 'Default tenant' : 'Most recent'}`);
                
                // Check if this tenant already has a local configuration
                if (configManager.tenantExists(bestTenant.id)) {
                    console.log(`\n✅ Local configuration already exists for tenant: ${bestTenant.id}`);
                    console.log('\n📋 Next steps:');
                    console.log(`1. Start tenant: pm2 start start-tenant.js --name "${bestTenant.id}" -- ${bestTenant.id}`);
                    console.log(`2. View logs: pm2 logs ${bestTenant.id}`);
                    console.log(`3. Stop tenant: pm2 stop ${bestTenant.id}`);
                    return;
                } else {
                    console.log(`\n⚠️  No local configuration found for tenant: ${bestTenant.id}`);
                    console.log('Creating local configuration...');
                    
                    // Create local configuration for the existing tenant
                    const ports = await getAvailableTenantPorts(bestTenant.id);
                    const config = await configManager.saveTenantConfig(bestTenant.id, {
                        businessPhone: bestTenant.phoneId,
                        businessName: bestTenant.name || businessName,
                        businessEmail: businessEmail,
                        allocatedPorts: ports
                    });
                    
                    console.log('\n✅ Local configuration created successfully:');
                    console.log('=====================================');
                    console.log(`Tenant ID: ${config.tenantId}`);
                    console.log(`Business Phone: ${config.businessPhone}`);
                    console.log(`Business Name: ${config.businessName}`);
                    console.log(`API Port: ${ports.apiPort}`);
                    console.log(`WebSocket Port: ${ports.websocketPort}`);
                    console.log(`Created: ${config.createdAt}`);
                    console.log('=====================================');
                    
                    console.log('\n📋 Next steps:');
                    console.log(`1. Start tenant: pm2 start start-tenant.js --name "${bestTenant.id}" -- ${bestTenant.id}`);
                    console.log(`2. View logs: pm2 logs ${bestTenant.id}`);
                    console.log(`3. Stop tenant: pm2 stop ${bestTenant.id}`);
                    return;
                }
            }
        }
        
        // No existing tenants found, create a new one
        console.log(`\n❌ No existing tenants found with phone number: ${businessPhone}`);
        console.log('Creating new tenant...');
        
        // Generate a new tenant ID
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 15);
        const newTenantId = `tenant_${timestamp}_${randomSuffix}`;
        
        // Get allocated ports for this tenant
        const ports = await getAvailableTenantPorts(newTenantId);
        
        // Create tenant configuration
        const config = await configManager.saveTenantConfig(newTenantId, {
            businessPhone,
            businessName,
            businessEmail,
            allocatedPorts: ports
        });

        console.log('\n✅ New tenant created successfully:');
        console.log('=====================================');
        console.log(`Tenant ID: ${config.tenantId}`);
        console.log(`Business Phone: ${config.businessPhone}`);
        console.log(`Business Name: ${config.businessName}`);
        console.log(`API Port: ${ports.apiPort}`);
        console.log(`WebSocket Port: ${ports.websocketPort}`);
        console.log(`Created: ${config.createdAt}`);
        console.log('=====================================');
        
        console.log('\n📋 Next steps:');
        console.log(`1. Start tenant: pm2 start start-tenant.js --name "${newTenantId}" -- ${newTenantId}`);
        console.log(`2. View logs: pm2 logs ${newTenantId}`);
        console.log(`3. Stop tenant: pm2 stop ${newTenantId}`);
        
        console.log('\n⚠️  Note: This tenant will need to be registered in Firebase Firestore');
        console.log('   The tenant document should be created in the /tenants collection');

    } catch (error) {
        console.error('❌ Failed to create tenant:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

createTenantWithPhoneSearch();


