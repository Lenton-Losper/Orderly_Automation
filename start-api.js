#!/usr/bin/env node

// Simple script to start just the API server for testing
const APIServer = require('./src/server');

async function startAPI() {
    try {
        console.log('🚀 Starting API Server for testing...');
        const server = new APIServer();
        await server.start();
        
        console.log('\n📋 Available endpoints:');
        console.log('   POST http://localhost:3001/auth/signup');
        console.log('   GET  http://localhost:3001/tenant/:tenantId');
        console.log('   GET  http://localhost:3001/tenant/:tenantId/qr');
        console.log('   GET  http://localhost:3001/health');
        
        console.log('\n🧪 Test with:');
        console.log('   node test-signup.js');
        
        console.log('\n🛑 Press Ctrl+C to stop');
        
    } catch (error) {
        console.error('❌ Failed to start API server:', error.message);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down API server...');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down API server...');
    process.exit(0);
});

startAPI();
