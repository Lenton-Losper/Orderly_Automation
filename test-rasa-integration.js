#!/usr/bin/env node

/**
 * Simple test script to verify Rasa integration
 * This script tests the Rasa client without requiring the full WhatsApp bot
 */

// Load environment variables
require('dotenv').config();

const { parseMessage } = require('./src/services/rasaClient');

async function testRasaIntegration() {
    console.log('🧪 Testing Rasa Integration...\n');
    
    // Test cases
    const testCases = [
        {
            userId: 'test_user_1',
            message: 'Hello, I want to order food',
            description: 'Basic greeting and order intent'
        },
        {
            userId: 'test_user_2', 
            message: 'What is your menu?',
            description: 'Menu inquiry'
        },
        {
            userId: 'test_user_3',
            message: 'How much does pizza cost?',
            description: 'Price inquiry'
        }
    ];
    
    console.log('📋 Test Cases:');
    testCases.forEach((testCase, index) => {
        console.log(`   ${index + 1}. ${testCase.description}`);
    });
    console.log('');
    
    // Run tests
    for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        console.log(`🔍 Test ${i + 1}: ${testCase.description}`);
        console.log(`   Input: "${testCase.message}"`);
        
        try {
            const result = await parseMessage(testCase.userId, testCase.message, {
                testMode: true,
                timestamp: Date.now()
            });
            
            if (result.ok) {
                console.log(`   ✅ Success! Got ${result.messages.length} response(s)`);
                if (result.messages.length > 0) {
                    result.messages.forEach((msg, idx) => {
                        console.log(`      Response ${idx + 1}: "${msg.text || JSON.stringify(msg)}"`);
                    });
                }
                if (result.latencyMs) {
                    console.log(`   ⏱️  Latency: ${result.latencyMs}ms`);
                }
            } else {
                console.log(`   ❌ Failed: ${result.reason || 'Unknown error'}`);
            }
        } catch (error) {
            console.log(`   💥 Error: ${error.message}`);
        }
        
        console.log('');
    }
    
    console.log('🏁 Test completed!');
}

// Run the test
testRasaIntegration().catch(console.error);
