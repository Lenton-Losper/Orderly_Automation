#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');

console.log('🔧 Fixing and testing the WhatsApp bot system...\n');

try {
    // Step 1: Clean install dependencies
    console.log('📦 Cleaning and reinstalling dependencies...');
    if (fs.existsSync('node_modules')) {
        execSync('rm -rf node_modules', { stdio: 'inherit' });
    }
    if (fs.existsSync('package-lock.json')) {
        execSync('rm -f package-lock.json', { stdio: 'inherit' });
    }
    
    execSync('npm install', { stdio: 'inherit' });
    console.log('✅ Dependencies installed successfully\n');

    // Step 2: Stop any running PM2 processes
    console.log('🛑 Stopping existing PM2 processes...');
    try {
        execSync('pm2 delete all', { stdio: 'inherit' });
    } catch (error) {
        console.log('No PM2 processes to stop');
    }
    console.log('✅ PM2 processes stopped\n');

    // Step 3: Start the API server
    console.log('🚀 Starting API server...');
    execSync('pm2 start src/server.js --name api-server', { stdio: 'inherit' });
    
    // Wait for server to start
    console.log('⏳ Waiting for server to initialize...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Step 4: Check server status
    console.log('📊 Checking server status...');
    execSync('pm2 status', { stdio: 'inherit' });
    
    // Step 5: Test health endpoint
    console.log('\n🏥 Testing health endpoint...');
    try {
        const healthResponse = execSync('curl -s http://localhost:3001/health', { encoding: 'utf8' });
        console.log('Health response:', healthResponse);
    } catch (error) {
        console.log('❌ Health check failed:', error.message);
    }
    
    // Step 6: Test signup endpoint
    console.log('\n👤 Testing signup endpoint...');
    try {
        const signupResponse = execSync(`curl -s -X POST http://localhost:3001/auth/signup \
            -H "Content-Type: application/json" \
            -d '{
                "email": "test@example.com",
                "password": "password123",
                "businessName": "Test Business"
            }'`, { encoding: 'utf8' });
        console.log('Signup response:', signupResponse);
    } catch (error) {
        console.log('❌ Signup test failed:', error.message);
    }
    
    // Step 7: Show logs
    console.log('\n📋 Recent server logs:');
    try {
        execSync('pm2 logs api-server --lines 10', { stdio: 'inherit' });
    } catch (error) {
        console.log('Could not retrieve logs');
    }
    
    console.log('\n✅ Fix and test completed!');
    console.log('\nNext steps:');
    console.log('1. Check if the server is running: pm2 status');
    console.log('2. Test the signup: curl -X POST http://localhost:3001/auth/signup -H "Content-Type: application/json" -d \'{"email":"test@example.com","password":"password123","businessName":"Test Business"}\'');
    console.log('3. Check logs: pm2 logs api-server');
    
} catch (error) {
    console.error('❌ Error during fix and test:', error.message);
    process.exit(1);
}
