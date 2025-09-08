#!/usr/bin/env node

// Test script to verify tenant-specific QR code publishing
const WebSocket = require('ws');

// Configuration
const WS_URL = 'ws://localhost:3000';
const VENDOR_ID = '264813141453'; // Replace with your actual vendor ID
const TENANT_ID = 'BOBs_B'; // Replace with your actual tenant ID

console.log('🧪 Testing tenant-specific QR code publishing...');
console.log(`📡 Connecting to: ${WS_URL}`);
console.log(`🏢 Vendor ID: ${VENDOR_ID}`);
console.log(`🏠 Tenant ID: ${TENANT_ID}`);

// Create WebSocket connection with tenant parameters
const ws = new WebSocket(`${WS_URL}?vendorId=${VENDOR_ID}&tenantId=${TENANT_ID}`);

ws.on('open', () => {
    console.log('✅ Connected to WebSocket server');
    console.log('⏳ Waiting for QR code...');
});

ws.on('message', (data) => {
    try {
        const message = JSON.parse(data);
        console.log('\n📨 Received message:', message.type);
        
        if (message.type === 'qr_code') {
            console.log('🎉 QR CODE RECEIVED!');
            console.log('📱 QR Code Data:', message.qrCode ? 'Present' : 'Missing');
            console.log('🔗 QR Code URL:', message.qrUrl);
            console.log('🏢 Vendor ID:', message.vendorId);
            console.log('🏠 Tenant ID:', message.tenantId);
            console.log('⏰ Timestamp:', message.timestamp);
            
            if (message.qrUrl) {
                console.log('\n📱 Open this URL to see the QR code:');
                console.log(message.qrUrl);
            }
        } else if (message.type === 'connection_status') {
            console.log('🔌 Connection Status:', message.status);
            console.log('🏢 Vendor ID:', message.vendorId);
            console.log('🏠 Tenant ID:', message.tenantId);
        }
    } catch (error) {
        console.error('❌ Error parsing message:', error.message);
        console.log('Raw data:', data.toString());
    }
});

ws.on('close', (code, reason) => {
    console.log(`❌ WebSocket closed: ${code} - ${reason}`);
});

ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error.message);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Closing connection...');
    ws.close();
    process.exit(0);
});

console.log('\n💡 Instructions:');
console.log('1. Make sure your bot is running and generating QR codes');
console.log('2. Check the logs to see if QR codes are being published to the correct tenant');
console.log('3. Press Ctrl+C to stop this test');
console.log('\n⏳ Waiting for messages...');
