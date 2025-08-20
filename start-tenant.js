// start-tenant.js
// Multi-tenant WhatsApp bot startup script
const { startBot } = require('./src/index');
const { getTenantConfig, createTenantDirectories } = require('./src/config/tenant');

async function startTenantBot() {
    try {
        // Get tenant ID and bot phone from command line arguments
        const tenantId = process.argv[2] || '1';
        const botPhone = process.argv[3];
        
        if (!botPhone) {
            console.error('Usage: node start-tenant.js <tenantId> <botPhoneNumber>');
            console.error('Example: node start-tenant.js 1 264813141453');
            process.exit(1);
        }
        
        console.log(`Starting multi-tenant bot for tenant: ${tenantId}`);
        console.log(`Bot phone number: ${botPhone}`);
        
        // Set environment variables for this tenant
        process.env.TENANT_ID = tenantId;
        process.env[`PHONE_${tenantId}`] = botPhone;
        
        // Get tenant configuration
        const tenantConfig = getTenantConfig(tenantId);
        
        // Create tenant directories
        createTenantDirectories(tenantConfig);
        
        console.log(`Tenant configuration:`);
        console.log(`  - Auth Directory: ${tenantConfig.authDir}`);
        console.log(`  - Logs Directory: ${tenantConfig.logsDir}`);
        console.log(`  - Invoices Directory: ${tenantConfig.invoicesDir}`);
        console.log(`  - WebSocket Port: ${tenantConfig.websocketPort}`);
        console.log(`  - Business Phone: ${tenantConfig.businessPhone}`);
        
        // Start the bot with tenant-specific configuration
        console.log(`\nStarting WhatsApp bot for tenant ${tenantId}...`);
        await startBot();
        
    } catch (error) {
        console.error(`Failed to start tenant bot:`, error);
        process.exit(1);
    }
}

// Help function
function showHelp() {
    console.log('Multi-Tenant WhatsApp Bot Startup');
    console.log('=================================');
    console.log('');
    console.log('Usage:');
    console.log('  node start-tenant.js <tenantId> <botPhoneNumber>');
    console.log('');
    console.log('Examples:');
    console.log('  node start-tenant.js 1 264813141453');
    console.log('  node start-tenant.js 2 264813141454');
    console.log('  node start-tenant.js business1 264817375744');
    console.log('');
    console.log('Parameters:');
    console.log('  tenantId        - Unique identifier for this tenant (alphanumeric)');
    console.log('  botPhoneNumber  - WhatsApp bot phone number (with country code)');
    console.log('');
    console.log('Each tenant will get:');
    console.log('  - Separate authentication folder');
    console.log('  - Separate logs directory');
    console.log('  - Separate invoices directory');
    console.log('  - Unique WebSocket port');
    console.log('  - Independent business configuration');
}

// Run the startup script
if (require.main === module) {
    // Check if help is requested
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
        showHelp();
        process.exit(0);
    }
    
    startTenantBot();
}

module.exports = { startTenantBot, showHelp };