require('dotenv').config();
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const admin = require('firebase-admin');

// Temporary inline Firebase initialization until you create the config file
const serviceAccount = require('./config/lllfarming-firebase-adminsdk-fbsvc-c9ce466038.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

// Import other modules when they're created
// const { initializeWhatsApp } = require('./services/whatsapp');
// const { initializeFirebase } = require('./config/firebase');
// const { handleMessage } = require('./handlers/messageHandler');
// const { filterMessage } = require('./middleware/messageFilter');

// Global session storage
const userSessions = new Map();

// Temporary inline functions until you create the separate modules
const OWNER_NUMBER = process.env.OWNER_NUMBER || '264812345678@s.whatsapp.net';

/**
 * Temporary message filter function
 */
async function filterMessage(msg, botStartTime) {
    // Basic message filtering logic
    if (!msg.message || msg.key.fromMe || msg.key.remoteJid.endsWith('@g.us')) {
        return false;
    }
    
    // Don't respond to owner's messages
    if (msg.key.remoteJid === OWNER_NUMBER) {
        console.log('🚫 Ignoring message from owner:', msg.pushName);
        return false;
    }
    
    // Get message timestamp
    const msgTimestamp = msg.messageTimestamp?.low || msg.messageTimestamp;
    const msgTime = msgTimestamp * 1000;
    
    // Ignore messages sent before bot started
    if (msgTime < botStartTime) {
        console.log('🚫 Ignoring old message from:', msg.pushName);
        return false;
    }
    
    // Ignore messages older than 1 day
    const msgDate = new Date(msgTime).toDateString();
    const today = new Date().toDateString();
    if (msgDate !== today) return false;
    
    return true;
}

/**
 * Temporary message handler function
 */
async function handleMessage(msg, sock, userSessions) {
    const sender = msg.pushName || 'Customer';
    const userId = msg.key.remoteJid;
    const text = (
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        ''
    ).trim().toLowerCase();
    
    console.log(`📝 Message from ${sender}: ${text}`);
    
    // Simple response for now
    const response = `👋 Hello ${sender}! Your message "${text}" was received. The bot is running successfully!`;
    
    await sock.sendMessage(userId, { text: response });
}

/**
 * Initialize WhatsApp connection
 */
async function initializeWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        markOnlineOnConnect: false
    });

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('🔌 Disconnected. Reconnecting:', shouldReconnect);
            if (shouldReconnect) setTimeout(startBot, 3000);
        } else if (connection === 'open') {
            console.log('✅ Bot connected to WhatsApp');
        }
    });

    return sock;
}

/**
 * Main bot initialization function
 */
async function startBot() {
    try {
        // Initialize Firebase (already done above)
        console.log('🔧 Firebase initialized');
        
        // Initialize WhatsApp connection
        console.log('🔧 Initializing WhatsApp...');
        const sock = await initializeWhatsApp();
        
        // Track bot start time to ignore old messages
        const botStartTime = Date.now();
        
        // Set up message event listener
        sock.ev.on('messages.upsert', async ({ messages }) => {
            const msg = messages[0];
            
            // Apply message filters
            const shouldProcess = await filterMessage(msg, botStartTime);
            if (!shouldProcess) return;
            
            // Process the message
            try {
                await handleMessage(msg, sock, userSessions);
            } catch (error) {
                console.error('❌ Error handling message:', error);
                
                // Send error message to user if possible
                try {
                    await sock.sendMessage(msg.key.remoteJid, {
                        text: '⚠️ Sorry, something went wrong. Please try again or contact support.'
                    });
                } catch (sendError) {
                    console.error('❌ Failed to send error message:', sendError);
                }
            }
        });
        
        console.log('✅ Bot started successfully');
        
    } catch (error) {
        console.error('❌ Failed to start bot:', error);
        
        // Retry connection after 5 seconds
        console.log('🔄 Retrying in 5 seconds...');
        setTimeout(startBot, 5000);
    }
}

/**
 * Graceful shutdown handler
 */
function setupGracefulShutdown() {
    const shutdown = (signal) => {
        console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
        
        // Clear user sessions
        userSessions.clear();
        
        // Exit process
        process.exit(0);
    };
    
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
}

/**
 * Global error handlers
 */
function setupErrorHandlers() {
    process.on('uncaughtException', (error) => {
        console.error('❌ Uncaught Exception:', error);
        process.exit(1);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
        console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
        // Don't exit on unhandled rejection, just log it
    });
}

/**
 * Application entry point
 */
async function main() {
    console.log('🚀 Starting LLL Farm WhatsApp Bot...');
    
    // Setup error handlers
    setupErrorHandlers();
    
    // Setup graceful shutdown
    setupGracefulShutdown();
    
    // Start the bot
    await startBot();
}

// Export for testing purposes
module.exports = {
    startBot,
    userSessions
};

// Start the application if this file is run directly
if (require.main === module) {
    main().catch((error) => {
        console.error('❌ Fatal error starting application:', error);
        process.exit(1);
    });
}