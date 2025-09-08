const axios = require('axios');

// Test the signup endpoint
async function testSignup() {
    try {
        console.log('🧪 Testing vendor signup endpoint...');
        
        const signupData = {
            email: 'test@example.com',
            password: 'testpassword123',
            businessName: 'Test Business'
        };

        const response = await axios.post('http://localhost:3001/auth/signup', signupData, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Signup successful!');
        console.log('Response:', JSON.stringify(response.data, null, 2));
        
        if (response.data.qrCodeUrl) {
            console.log('📱 QR Code URL received:', response.data.qrCodeUrl);
        }

    } catch (error) {
        console.error('❌ Signup test failed:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
}

// Test getting tenant info
async function testGetTenant(tenantId) {
    try {
        console.log(`🧪 Testing get tenant info for: ${tenantId}`);
        
        const response = await axios.get(`http://localhost:3001/tenant/${tenantId}`);
        
        console.log('✅ Get tenant successful!');
        console.log('Response:', JSON.stringify(response.data, null, 2));

    } catch (error) {
        console.error('❌ Get tenant test failed:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
}

// Test getting QR code
async function testGetQR(tenantId) {
    try {
        console.log(`🧪 Testing get QR code for tenant: ${tenantId}`);
        
        const response = await axios.get(`http://localhost:3001/tenant/${tenantId}/qr`);
        
        console.log('✅ Get QR code successful!');
        console.log('Response:', JSON.stringify(response.data, null, 2));

    } catch (error) {
        console.error('❌ Get QR code test failed:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
}

// Run tests
async function runTests() {
    console.log('🚀 Starting API tests...\n');
    
    // Test 1: Signup
    await testSignup();
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Test 2: Get tenant info (replace with actual tenant ID from signup)
    // await testGetTenant('tenant_1234567890_abcdef');
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Test 3: Get QR code (replace with actual tenant ID from signup)
    // await testGetQR('tenant_1234567890_abcdef');
    
    console.log('\n✅ All tests completed!');
}

// Check if axios is available
try {
    require('axios');
    runTests();
} catch (error) {
    console.log('❌ axios not found. Installing...');
    console.log('Please run: npm install axios');
    console.log('Then run this test again.');
}
