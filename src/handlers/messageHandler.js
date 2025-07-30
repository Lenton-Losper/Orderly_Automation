// Updated handlers/messageHandler.js
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

        // Extract message details
        const messageContent = msg.message.conversation || 
                             msg.message.extendedTextMessage?.text || '';
        const sender = msg.pushName || 'Customer';
        const userId = msg.key.remoteJid;
        const msgId = msg.key.id;
        const phoneNumber = userId.split('@')[0];
        
        // Get bot's phone number to determine which business this is
        const botPhoneNumber = this.whatsappService.getBotPhoneNumber();
        
        console.log(`📩 Raw message received: {
  hasMessage: ${!!msg.message},
  fromMe: ${msg.key.fromMe},
  remoteJid: '${userId}',
  pushName: '${sender}',
  messageKeys: ${JSON.stringify(Object.keys(msg.message))},
  botNumber: '${botPhoneNumber}'
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
            // Determine business based on bot's phone number (NEW LOGIC)
            const businessId = businessManager.getBusinessIdFromBot(botPhoneNumber);
            console.log(`🏢 Bot ${botPhoneNumber} determined business: ${businessId} for customer ${phoneNumber}`);

            // Security check
            const securityCheck = await this.securityMonitor.checkMessage(userId, messageContent);
            if (!securityCheck.allowed) {
                console.log(`🛡️ Message blocked by security: ${securityCheck.reason}`);
                return;
            }

            // Rate limiting
            const rateLimitCheck = await this.rateLimiter.checkLimit(userId, businessId);
            if (!rateLimitCheck.allowed) {
                console.log(`⏰ Message rate limited: ${rateLimitCheck.reason}`);
                
                if (rateLimitCheck.shouldNotify) {
                    await this.whatsappService.sendMessage(userId, 
                        '⏰ Please slow down! You\'re sending messages too quickly. Wait a moment and try again.');
                }
                return;
            }

            // Duplicate check
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

            // Log the message
            await this.logger.logMessage({
                userId,
                businessId,
                content: messageContent,
                sender,
                timestamp: Date.now(),
                messageId: msgId
            });

            // Get or create session with the determined business
            let session = sessionManager.getSession(userId, businessId);
            if (!session) {
                session = sessionManager.createSession(userId, businessId);
                console.log(`✅ Session created: ${userId}_${businessId} (Total: ${sessionManager.getActiveSessionCount()})`);
            }

            // Process the message through command handler
            await commandHandler.handleCommand(
                session,
                messageContent.trim().toLowerCase(),
                {
                    userId,
                    businessId,
                    sender,
                    phoneNumber,
                    botPhoneNumber, // Pass bot number for context
                    whatsappService: this.whatsappService
                }
            );

        } catch (error) {
            console.error('❌ Error processing message:', error);
            
            // Log the error
            await this.logger.logError({
                userId,
                error: error.message,
                stack: error.stack,
                messageContent,
                timestamp: Date.now()
            });

            // Send error message to user
            try {
                await this.whatsappService.sendMessage(userId, 
                    '❌ Sorry, something went wrong. Please try again in a moment or contact support if this persists.');
            } catch (sendError) {
                console.error('❌ Failed to send error message:', sendError);
            }
        }
    }
}

module.exports = MessageHandler;