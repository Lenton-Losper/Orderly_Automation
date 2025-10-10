/**
 * Default Intents Configuration
 * Provides default intents that all new businesses start with
 */

const defaultIntents = [
    {
        intentName: 'greet',
        displayName: 'Greeting',
        description: 'Customer says hello or greets the bot',
        responseTemplate: 'Hello! How can I help you today?',
        examples: [
            'hello',
            'hi',
            'hey',
            'good morning',
            'good afternoon',
            'hi there',
            'greetings',
            'howdy'
        ]
    },
    {
        intentName: 'view_catalog',
        displayName: 'View Products',
        description: 'Customer wants to see products or menu',
        responseTemplate: 'Here are our products:',
        examples: [
            'show me products',
            'what do you have',
            'show catalog',
            'menu please',
            'what can I buy',
            'show me your items',
            'what products do you sell',
            'display products'
        ]
    },
    {
        intentName: 'product_inquiry',
        displayName: 'Ask About Product',
        description: 'Customer asking about a specific product',
        responseTemplate: 'Let me help you with that product.',
        examples: [
            'do you have chicken',
            'how much is eggs',
            'tell me about product',
            'what is the price',
            'do you sell milk',
            'is this available',
            'product details',
            'price check'
        ]
    },
    {
        intentName: 'place_order',
        displayName: 'Place Order',
        description: 'Customer wants to make a purchase',
        responseTemplate: 'Great! Let me help you place your order.',
        examples: [
            'I want to order',
            'can I buy',
            'I need 5 chickens',
            'place order',
            'I would like to purchase',
            'buy this item',
            'add to cart',
            'make an order'
        ]
    },
    {
        intentName: 'help',
        displayName: 'Help',
        description: 'Customer needs assistance',
        responseTemplate: 'I\'m here to help! What do you need?',
        examples: [
            'help',
            'I need help',
            'how does this work',
            'what can you do',
            'assistance please',
            'support',
            'how to order',
            'guide me'
        ]
    },
    {
        intentName: 'goodbye',
        displayName: 'Goodbye',
        description: 'Customer is ending the conversation',
        responseTemplate: 'Thank you! Have a great day!',
        examples: [
            'bye',
            'goodbye',
            'see you later',
            'thanks',
            'thank you',
            'that\'s all',
            'done',
            'finished'
        ]
    },
    {
        intentName: 'check_order_status',
        displayName: 'Check Order Status',
        description: 'Customer wants to check their order status',
        responseTemplate: 'Let me check your order status.',
        examples: [
            'where is my order',
            'order status',
            'track my order',
            'when will it arrive',
            'order update',
            'delivery status',
            'check order',
            'order progress'
        ]
    },
    {
        intentName: 'contact_info',
        displayName: 'Contact Information',
        description: 'Customer wants contact details',
        responseTemplate: 'Here is our contact information:',
        examples: [
            'contact number',
            'phone number',
            'address',
            'location',
            'how to reach you',
            'contact details',
            'where are you located',
            'business hours'
        ]
    }
];

/**
 * Get default intents
 * @returns {Array} Array of default intent definitions
 */
function getDefaultIntents() {
    return defaultIntents;
}

/**
 * Get intent by name
 * @param {string} intentName - Intent name to find
 * @returns {Object|null} Intent definition or null if not found
 */
function getIntentByName(intentName) {
    return defaultIntents.find(intent => intent.intentName === intentName) || null;
}

/**
 * Get all intent names
 * @returns {Array<string>} Array of intent names
 */
function getIntentNames() {
    return defaultIntents.map(intent => intent.intentName);
}

/**
 * Validate if an intent name is a default intent
 * @param {string} intentName - Intent name to validate
 * @returns {boolean} True if it's a default intent
 */
function isDefaultIntent(intentName) {
    return defaultIntents.some(intent => intent.intentName === intentName);
}

module.exports = {
    defaultIntents,
    getDefaultIntents,
    getIntentByName,
    getIntentNames,
    isDefaultIntent
};


