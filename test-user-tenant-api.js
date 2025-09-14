// Test script to verify the user tenant API
const axios = require('axios');

const BASE_URL = 'http://localhost:3000'; // Adjust if your server runs on different port

async function testUserTenantAPI() {
    console.log('🧪 Testing User Tenant API...\n');

    try {
        // Test 1: Get tenant by phone number (for debugging)
        console.log('1️⃣ Testing get tenant by phone number...');
        const phoneResponse = await axios.get(`${BASE_URL}/api/user/by-phone/264813141453`);
        
        if (phoneResponse.data.success) {
            console.log('✅ Phone lookup successful:');
            console.log(`   Phone: ${phoneResponse.data.phoneNumber}`);
            console.log(`   Found ${phoneResponse.data.tenants.length} tenant(s)`);
            console.log(`   Recommended: ${phoneResponse.data.recommended.tenantId}`);
            console.log(`   Name: ${phoneResponse.data.recommended.name}`);
            console.log(`   Is Default: ${phoneResponse.data.recommended.isDefault}`);
        } else {
            console.log('❌ Phone lookup failed:', phoneResponse.data.error);
        }

        console.log('\n2️⃣ Testing get tenant by phone number (264817375744)...');
        const phoneResponse2 = await axios.get(`${BASE_URL}/api/user/by-phone/264817375744`);
        
        if (phoneResponse2.data.success) {
            console.log('✅ Phone lookup successful:');
            console.log(`   Phone: ${phoneResponse2.data.phoneNumber}`);
            console.log(`   Found ${phoneResponse2.data.tenants.length} tenant(s)`);
            console.log(`   Recommended: ${phoneResponse2.data.recommended.tenantId}`);
            console.log(`   Name: ${phoneResponse2.data.recommended.name}`);
            console.log(`   Is Default: ${phoneResponse2.data.recommended.isDefault}`);
        } else {
            console.log('❌ Phone lookup failed:', phoneResponse2.data.error);
        }

        console.log('\n3️⃣ Testing get my tenant (requires authentication)...');
        try {
            const myTenantResponse = await axios.get(`${BASE_URL}/api/user/my-tenant`);
            console.log('✅ My tenant response:', myTenantResponse.data);
        } catch (error) {
            if (error.response?.status === 401) {
                console.log('⚠️ My tenant requires authentication (expected)');
            } else {
                console.log('❌ My tenant error:', error.message);
            }
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.response) {
            console.error('   Response:', error.response.data);
        }
    }
}

// Run the test
testUserTenantAPI();

