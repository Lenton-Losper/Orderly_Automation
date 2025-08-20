const { getTenantConfig, createTenantDirectories } = require('./src/config/tenant');

// Test tenant configuration
function testTenantSetup() {
    console.log('Testing Multi-Tenant Configuration...\n');

    // Test tenant 1
    process.env.PHONE_1 = '264813141453';
    const tenant1Config = getTenantConfig('1');
    createTenantDirectories(tenant1Config);
    
    console.log('Tenant 1 Config:', {
        tenantId: tenant1Config.tenantId,
        authDir: tenant1Config.authDir,
        websocketPort: tenant1Config.websocketPort,
        businessPhone: tenant1Config.businessPhone
    });

    // Test tenant 2  
    process.env.PHONE_2 = '264813141454';
    const tenant2Config = getTenantConfig('2');
    createTenantDirectories(tenant2Config);
    
    console.log('\nTenant 2 Config:', {
        tenantId: tenant2Config.tenantId,
        authDir: tenant2Config.authDir,
        websocketPort: tenant2Config.websocketPort,
        businessPhone: tenant2Config.businessPhone
    });

    console.log('\n✅ Multi-tenant setup test completed');
    console.log('Check the "tenants" folder to see created directories');
}

// Run test
testTenantSetup();