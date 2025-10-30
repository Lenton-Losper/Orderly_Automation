const rasaClient = require('./rasaClient');
const IntentClassificationService = require('./intentClassificationService');

class IntelligentResponseGenerator {
    constructor() {
        this.rasaClient = rasaClient;
        this.intentClassifier = new IntentClassificationService();
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
            console.log('INTELLIGENT RESPONSE: Starting message processing with sklearn model...');
            
            // Use our sklearn-based intent classification
            const tenantId = context.tenantId || '7dx8fLr4OdAPsSDAoTRl';
            
            console.log(`INTELLIGENT RESPONSE: Classifying message for tenant: ${tenantId}`);
            
            // Classify the message using our trained sklearn model
            const response = await this.intentClassifier.processMessage(messageContent, tenantId, context.userId);
            
            if (response) {
                console.log(`INTELLIGENT RESPONSE: Generated response: "${response}"`);
                return response;
            } else {
                console.log('INTELLIGENT RESPONSE: No response generated');
                return null;
            }
            
        } catch (error) {
            console.error('INTELLIGENT RESPONSE: Error processing message:', error);
            return null;
        }
    }


    /**
     * Set the WhatsApp service for PDF sending
     */
    setWhatsAppService(whatsappService) {
        this.intentClassifier.setWhatsAppService(whatsappService);
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
