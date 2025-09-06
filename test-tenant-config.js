// test-tenant-config.js
// Test script to verify tenant configuration

const { getTenantConfig } = require('./src/config/tenant');

function testTenantConfiguration() {
    console.log('🧪 Testing Tenant Configuration');
    console.log('================================');
    
    // Test default tenant1 configuration
    try {
        const tenant1Config = getTenantConfig('tenant1');
        console.log('✅ Tenant1 Configuration:');
        console.log(`   - Tenant ID: ${tenant1Config.tenantId}`);
        console.log(`   - Auth Directory: ${tenant1Config.authDir}`);
        console.log(`   - Logs Directory: ${tenant1Config.logsDir}`);
        console.log(`   - WebSocket Port: ${tenant1Config.websocketPort}`);
        console.log(`   - Firebase Collection: ${tenant1Config.firebaseCollection}`);
        console.log('');
    } catch (error) {
        console.error('❌ Error getting tenant1 config:', error.message);
    }
    
    // Test environment variable setup
    console.log('🔧 Environment Variables:');
    console.log(`   - TENANT_ID: ${process.env.TENANT_ID || 'not set'}`);
    console.log(`   - PHONE_tenant1: ${process.env.PHONE_tenant1 || 'not set'}`);
    console.log('');
    
    // Test database path construction
    console.log('🗄️ Database Paths:');
    const phoneId = '264817375723';
    const tenantId = 'tenant1';
    
    console.log(`   - Products: vendors/${phoneId}/tenants/${tenantId}/products`);
    console.log(`   - Customers: vendors/${phoneId}/tenants/${tenantId}/customers`);
    console.log(`   - Orders: vendors/${phoneId}/tenants/${tenantId}/orders`);
    console.log('');
    
    // Test backward compatibility paths
    console.log('🔄 Backward Compatibility Paths:');
    console.log(`   - Legacy Products: vendors/${phoneId}/products`);
    console.log(`   - Legacy Customers: vendors/${phoneId}/customers`);
    console.log(`   - Legacy Orders: vendors/${phoneId}/orders`);
    console.log('');
    
    console.log('✅ Configuration test completed!');
}

// Run the test
testTenantConfiguration();
