#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('🧪 Testing the fixed server...\n');

try {
    // Test 1: Check if server is running
    console.log('1️⃣ Checking server status...');
    execSync('pm2 status', { stdio: 'inherit' });
    
    // Test 2: Test health endpoint
    console.log('\n2️⃣ Testing health endpoint...');
    const healthResponse = execSync('curl -s http://localhost:3001/health', { encoding: 'utf8' });
    console.log('Health response:', healthResponse);
    
    // Test 3: Test signup endpoint
    console.log('\n3️⃣ Testing signup endpoint...');
    const signupResponse = execSync(`curl -s -X POST http://localhost:3001/auth/signup \
        -H "Content-Type: application/json" \
        -d '{
            "email": "test@example.com",
            "password": "password123",
            "businessName": "Test Business"
        }'`, { encoding: 'utf8' });
    console.log('Signup response:', signupResponse);
    
    // Test 4: Check for errors in logs
    console.log('\n4️⃣ Checking for errors in logs...');
    try {
        execSync('pm2 logs api-server --lines 5', { stdio: 'inherit' });
    } catch (error) {
        console.log('Could not retrieve logs');
    }
    
    console.log('\n✅ All tests completed!');
    
} catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
}
