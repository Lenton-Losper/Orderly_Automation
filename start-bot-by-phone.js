const { TenantFinder } = require('./src/utils/tenantFinder');
const { TenantConfigManager } = require('./src/utils/tenantConfig');
const { getAvailableTenantPorts } = require('./src/utils/portAllocator');

async function startBotByPhone() {
    const businessPhone = process.argv[2];
    const botName = process.argv[3] || `bot-${businessPhone}`;

    if (!businessPhone) {
        console.log('❌ Missing required parameter: businessPhone');
        console.log('Usage: node start-bot-by-phone.js <businessPhone> [botName]');
        console.log('Example: node start-bot-by-phone.js 264817375744 my-bot');
        process.exit(1);
    }

    try {
        const tenantFinder = new TenantFinder();
        const configManager = new TenantConfigManager();
        
        console.log(`🔍 Searching for tenant with phone number: ${businessPhone}`);
        
        // Find the best tenant for this phone number
        const tenant = await tenantFinder.findBestTenantForPhone(businessPhone);
        
        if (!tenant) {
            console.log(`❌ No tenant found with phone number: ${businessPhone}`);
            console.log('Please create a tenant first using create-tenant-with-phone-search.js');
            process.exit(1);
        }
        
        console.log(`✅ Found tenant: ${tenant.id}`);
        console.log(`   Business Name: ${tenant.name || 'N/A'}`);
        console.log(`   Phone ID: ${tenant.phoneId}`);
        console.log(`   Is Default: ${tenant.isDefault || false}`);
        
        // Check if local configuration exists
        if (!configManager.tenantExists(tenant.id)) {
            console.log(`⚠️  No local configuration found for tenant: ${tenant.id}`);
            console.log('Creating local configuration...');
            
            // Create local configuration
            const ports = await getAvailableTenantPorts(tenant.id);
            await configManager.saveTenantConfig(tenant.id, {
                businessPhone: tenant.phoneId,
                businessName: tenant.name || '',
                businessEmail: '',
                allocatedPorts: ports
            });
            
            console.log(`✅ Local configuration created for tenant: ${tenant.id}`);
        }
        
        console.log(`\n🚀 Starting bot for tenant: ${tenant.id}`);
        console.log(`   Bot name: ${botName}`);
        
        // Start the bot using PM2
        const { spawn } = require('child_process');
        
        const pm2Process = spawn('pm2', [
            'start', 
            'start-tenant.js', 
            '--name', 
            botName, 
            '--', 
            tenant.id
        ], {
            stdio: 'inherit',
            shell: true
        });
        
        pm2Process.on('close', (code) => {
            if (code === 0) {
                console.log(`\n✅ Bot started successfully!`);
                console.log(`   Tenant ID: ${tenant.id}`);
                console.log(`   Bot name: ${botName}`);
                console.log(`   Phone: ${businessPhone}`);
                console.log('\n📋 Useful commands:');
                console.log(`   View logs: pm2 logs ${botName}`);
                console.log(`   Stop bot: pm2 stop ${botName}`);
                console.log(`   Restart bot: pm2 restart ${botName}`);
                console.log(`   Status: pm2 status`);
            } else {
                console.error(`❌ Failed to start bot. Exit code: ${code}`);
                process.exit(1);
            }
        });
        
        pm2Process.on('error', (error) => {
            console.error(`❌ Error starting bot: ${error.message}`);
            process.exit(1);
        });

    } catch (error) {
        console.error('❌ Failed to start bot by phone:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

startBotByPhone();


