/**
 * Test Dynamic Product Responses
 * Tests the new dynamic product inquiry system
 */

const IntentClassificationService = require('./src/services/intentClassificationService');

async function testDynamicResponses() {
    console.log('🧪 Testing Dynamic Product Responses');
    console.log('=====================================\n');

    const classifier = new IntentClassificationService();
    const tenantId = '7dx8fLr4OdAPsSDAoTRl';

    const testMessages = [
        {
            message: "What products do you have?",
            expectedIntent: "product_inquiry",
            description: "General product inquiry"
        },
        {
            message: "Do you sell meat?",
            expectedIntent: "product_inquiry", 
            description: "Meat inquiry"
        },
        {
            message: "What's the price of chicken breast?",
            expectedIntent: "pricing",
            description: "Specific product pricing"
        },
        {
            message: "Is beef brisket available?",
            expectedIntent: "availability",
            description: "Product availability check"
        },
        {
            message: "I want to order something",
            expectedIntent: "order",
            description: "Order intent"
        },
        {
            message: "Hi there",
            expectedIntent: "greet",
            description: "Greeting"
        },
        {
            message: "Bye",
            expectedIntent: "bye",
            description: "Goodbye"
        }
    ];

    for (const test of testMessages) {
        console.log(`📝 Testing: "${test.message}"`);
        console.log(`   Expected: ${test.expectedIntent} - ${test.description}`);
        
        try {
            const response = await classifier.processMessage(test.message, tenantId);
            console.log(`   Response: ${response}`);
            console.log(`   ✅ Success\n`);
        } catch (error) {
            console.log(`   ❌ Error: ${error.message}\n`);
        }
    }

    console.log('🎯 Test completed!');
    console.log('\n📱 Now test these messages in WhatsApp:');
    console.log('   - "What products do you have?"');
    console.log('   - "Do you sell meat?"');
    console.log('   - "What\'s the price of chicken breast?"');
    console.log('   - "Is beef brisket available?"');
}

// Run the test
testDynamicResponses()
    .then(() => {
        console.log('\n✅ Dynamic response testing completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Test failed:', error);
        process.exit(1);
    });










