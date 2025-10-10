const rasaClient = require('./rasaClient');

class IntelligentResponseGenerator {
    constructor() {
        this.rasaClient = rasaClient;
    }

    /**
     * Process a message using intelligent response generation
     * @param {string} messageContent - The message content to process
     * @param {Object} session - Current user session
     * @param {Object} businessManager - Business manager instance
     * @param {Object} context - Additional context including user info
     * @returns {Promise<string|null>} - Generated response or null if no response
     */
    async processMessage(messageContent, session, businessManager, context) {
        try {
            console.log('INTELLIGENT RESPONSE: Starting message processing...');
            
            // Check if Rasa client is available
            if (!this.rasaClient) {
                console.log('INTELLIGENT RESPONSE: Rasa client not available');
                return null;
            }

            // Prepare the message for Rasa
            const rasaMessage = {
                text: messageContent,
                sender_id: context.userId || 'default_user',
                metadata: {
                    businessId: context.businessId,
                    phoneNumber: context.phoneNumber,
                    sessionId: session.id
                }
            };

            console.log('INTELLIGENT RESPONSE: Sending message to Rasa...');
            
            // Send message to Rasa for processing
            const rasaResponse = await this.rasaClient.parseMessage(context.userId, messageContent, rasaMessage);
            
            if (!rasaResponse || !rasaResponse.messages || rasaResponse.messages.length === 0) {
                console.log('INTELLIGENT RESPONSE: No response from Rasa');
                return null;
            }

            // Get the first message from Rasa
            const firstMessage = rasaResponse.messages[0];
            console.log(`INTELLIGENT RESPONSE: Rasa response: "${firstMessage.text}"`);
            
            // Check if Rasa provided a meaningful response
            if (firstMessage.text && firstMessage.text.trim().length > 0) {
                // Handle any custom actions that might be needed
                if (firstMessage.custom && firstMessage.custom.action) {
                    await this.handleCustomAction(firstMessage.custom.action, context, businessManager);
                }
                
                return firstMessage.text;
            }

            return null;
            
        } catch (error) {
            console.error('INTELLIGENT RESPONSE: Error processing message:', error);
            return null;
        }
    }

    /**
     * Handle custom actions from Rasa
     * @param {string} action - Action name
     * @param {Object} context - Context information
     * @param {Object} businessManager - Business manager instance
     */
    async handleCustomAction(action, context, businessManager) {
        try {
            console.log(`INTELLIGENT RESPONSE: Handling custom action: ${action}`);
            
            switch (action) {
                case 'action_create_order':
                    // Handle order creation
                    console.log('INTELLIGENT RESPONSE: Order creation action triggered');
                    break;
                    
                case 'action_get_menu':
                    // Handle menu request
                    console.log('INTELLIGENT RESPONSE: Menu request action triggered');
                    break;
                    
                case 'action_get_prices':
                    // Handle price request
                    console.log('INTELLIGENT RESPONSE: Price request action triggered');
                    break;
                    
                default:
                    console.log(`INTELLIGENT RESPONSE: Unknown action: ${action}`);
            }
        } catch (error) {
            console.error('INTELLIGENT RESPONSE: Error handling custom action:', error);
        }
    }

    /**
     * Check if the intelligent response generator is available
     * @returns {boolean} - True if available, false otherwise
     */
    isAvailable() {
        return this.rasaClient && this.rasaClient.isConnected();
    }
}

module.exports = IntelligentResponseGenerator;
