/**
 * Test script for Intent Classification Service
 */

const IntentClassificationService = require('./src/services/intentClassificationService');

async function testClassification() {
    console.log('🧪 Testing Intent Classification Service...\n');
    
    const classifier = new IntentClassificationService();
    const tenantId = '7dx8fLr4OdAPsSDAoTRl';
    
    const testMessages = [
        'Hi there',
        'Hello',
        'What products do you have?',
        'Do you sell meat?',
        'Bye',
        'See you later',
        'Goodbye',
        'Random gibberish message'
    ];

    for (const message of testMessages) {
        console.log(`📨 Testing: "${message}"`);
        try {
            const response = await classifier.processMessage(message, tenantId);
            console.log(`🤖 Response: ${response}\n`);
        } catch (error) {
            console.error(`❌ Error: ${error.message}\n`);
        }
    }
    
    console.log('✅ Test completed!');
}

testClassification().catch(console.error);










