const { OWNER_NUMBER, RATE_LIMIT_CONFIG } = require('../config/constants');
const OrderSession = require('../models/OrderSession');
const sessionManager = require('../utils/sessionManager');
const messageGenerators = require('../utils/messageGenerators');
const commandHandler = require('./commandHandler');
const businessManager = require('../services/businessManager');

class MessageHandler {
    constructor(whatsappService, middleware) {
        this.whatsappService = whatsappService;
        this.rateLimiter = middleware.rateLimiter;
        this.duplicateChecker = middleware.duplicateChecker;
        this.securityMonitor = middleware.securityMonitor;
        this.logger = middleware.logger;
    }

    async handleMessage({ messages, type }) {
        // Only process new messages
        if (type !== 'notify') {
            console.log(`🚫 Ignoring message type: ${type}`);
            return;
        }
        
        const msg = messages[0];
        if (!msg || !msg.message) {
            console.log('🚫 Ignoring message: no content');
            return;
        }

        // Extract message details with better handling
        let messageContent = '';
        
        // Try different message types
        if (msg.message.conversation) {
            messageContent = msg.message.conversation;
        } else if (msg.message.extendedTextMessage?.text) {
            messageContent = msg.message.extendedTextMessage.text;
        } else if (msg.message.text) {
            messageContent = msg.message.text;
        } else {
            // Handle other message types
            console.log('🚫 Unsupported message type:', Object.keys(msg.message));
            return;
        }

        // Ensure messageContent is a string
        if (typeof messageContent !== 'string') {
            console.log('🚫 Message content is not a string:', typeof messageContent);
            return;
        }

        // Trim and validate the message content
        messageContent = messageContent.trim();
        if (!messageContent) {
            console.log('🚫 Empty message content after trim');
            return;
        }

        const sender = msg.pushName || 'Customer';
        const userId = msg.key.remoteJid;
        const msgId = msg.key.id;
        const phoneNumber = userId.split('@')[0];
        
        // Get bot's phone number to determine which business this is
        const botPhoneNumber = this.whatsappService.getBotPhoneNumber ? 
                             this.whatsappService.getBotPhoneNumber() : 
                             this.whatsappService.user?.id;
        
        console.log(`📩 Raw message received: {
  hasMessage: ${!!msg.message},
  fromMe: ${msg.key.fromMe},
  remoteJid: '${userId}',
  pushName: '${sender}',
  messageKeys: ${JSON.stringify(Object.keys(msg.message))},
  botNumber: '${botPhoneNumber}',
  messageContent: '${messageContent}'
}`);

        // Skip messages from owner
        if (userId === OWNER_NUMBER) {
            console.log('👑 Ignoring message from owner');
            return;
        }

        // Skip messages from bot itself
        if (msg.key.fromMe) {
            console.log('🤖 Ignoring message from bot itself');
            return;
        }

        try {
            // FIXED: Properly await the business ID determination
            let businessId;
            if (businessManager.getBusinessIdFromBot) {
                businessId = await businessManager.getBusinessIdFromBot(botPhoneNumber);
            } else {
                businessId = businessManager.getBusinessId(phoneNumber);
            }
            
            console.log(`🏢 Bot ${botPhoneNumber} determined business: ${businessId} for customer ${phoneNumber}`);

            // Security check (with safety check)
            if (this.securityMonitor && typeof this.securityMonitor.checkMessage === 'function') {
                const securityCheck = await this.securityMonitor.checkMessage(userId, messageContent);
                if (!securityCheck.allowed) {
                    console.log(`🛡️ Message blocked by security: ${securityCheck.reason}`);
                    return;
                }
            }

            // Rate limiting (with safety check)
            if (this.rateLimiter && typeof this.rateLimiter.checkLimit === 'function') {
                const rateLimitCheck = await this.rateLimiter.checkLimit(userId, businessId);
                if (!rateLimitCheck.allowed) {
                    console.log(`⏰ Message rate limited: ${rateLimitCheck.reason}`);
                    
                    if (rateLimitCheck.shouldNotify) {
                        await this.sendMessage(userId, 
                            '⏰ Please slow down! You\'re sending messages too quickly. Wait a moment and try again.');
                    }
                    return;
                }
            }

            // TEMPORARY: Duplicate checker disabled to fix message blocking issue
            /*
            if (this.duplicateChecker && typeof this.duplicateChecker.checkDuplicate === 'function') {
                const duplicateCheck = await this.duplicateChecker.checkDuplicate(
                    userId, 
                    businessId, 
                    messageContent, 
                    msgId
                );
                
                if (!duplicateCheck.allowed) {
                    console.log(`🔄 Duplicate message detected: ${duplicateCheck.reason}`);
                    return;
                }
            }
            */

            // Log the message (with safety check)
            if (this.logger && typeof this.logger.logMessage === 'function') {
                await this.logger.logMessage({
                    userId,
                    businessId,
                    content: messageContent,
                    sender,
                    timestamp: Date.now(),
                    messageId: msgId
                });
            }

            console.log(`📨 Message from ${sender} (${phoneNumber}) to business ${businessId}: "${messageContent}"`);

            // Get or create session with the determined business
            let session = sessionManager.getSession ? sessionManager.getSession(userId, businessId) : null;
            if (!session) {
                session = sessionManager.createSession ? 
                         sessionManager.createSession(userId, businessId) :
                         { userId, businessId, step: 'start', data: {} }; // Create simple session object
                console.log(`✅ Session created: ${userId}_${businessId} (Total: ${sessionManager.getActiveSessionCount ? sessionManager.getActiveSessionCount() : 1})`);
            }

            // Process the message through command handler
            // FIXED: Match the correct parameter order for commandHandler
            const response = await commandHandler.handleCommand(
                messageContent, // 1st parameter: text
                session,        // 2nd parameter: session
                businessManager, // 3rd parameter: businessManager
                {               // 4th parameter: messageData
                    userId,
                    businessId,
                    sender,
                    phoneNumber,
                    botPhoneNumber,
                    whatsappService: this.whatsappService
                }
            );

            // Send the response if there is one
            if (response && typeof response === 'string') {
                await this.sendMessage(userId, response);
            }

        } catch (error) {
            console.error('❌ Error processing message:', error);
            
            // Log the error (with safety check)
            if (this.logger && typeof this.logger.logError === 'function') {
                await this.logger.logError({
                    userId,
                    error: error.message,
                    stack: error.stack,
                    messageContent,
                    timestamp: Date.now()
                });
            }

            // Send error message to user
            try {
                await this.sendMessage(userId, 
                    '❌ Sorry, something went wrong. Please try again in a moment or contact support if this persists.');
            } catch (sendError) {
                console.error('❌ Failed to send error message:', sendError);
            }
        }
    }

    // Helper method to send messages safely
    async sendMessage(userId, message) {
        try {
            if (this.whatsappService && typeof this.whatsappService.sendMessage === 'function') {
                // Ensure message is in correct format
                const messagePayload = typeof message === 'string' ? { text: message } : message;
                await this.whatsappService.sendMessage(userId, messagePayload);
            } else if (this.whatsappService && typeof this.whatsappService.sendTextMessage === 'function') {
                await this.whatsappService.sendTextMessage(userId, message);
            } else {
                console.error('❌ WhatsApp service sendMessage method not available');
            }
        } catch (error) {
            console.error('❌ Failed to send message:', error);
            throw error;
        }
    }
}

module.exports = MessageHandler;