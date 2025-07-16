const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const path = require('path');

class WhatsAppService {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.botStartTime = Date.now();
        this.eventHandlers = new Map();
    }

    /**
     * Initialize WhatsApp connection
     * @returns {Promise<Object>} - WhatsApp socket instance
     */
    async initialize() {
        try {
            const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, '../auth'));

            this.socket = makeWASocket({
                auth: state,
                printQRInTerminal: true,
                markOnlineOnConnect: false
            });

            // Handle credential updates
            this.socket.ev.on('creds.update', saveCreds);

            // Handle connection updates
            this.socket.ev.on('connection.update', this.handleConnectionUpdate.bind(this));

            // Handle message updates
            this.socket.ev.on('messages.upsert', this.handleMessageUpdate.bind(this));

            return this.socket;
        } catch (error) {
            console.error('❌ WhatsApp initialization failed:', error);
            throw error;
        }
    }

    /**
     * Handle connection status updates
     * @param {Object} update - Connection update object
     */
    handleConnectionUpdate({ connection, lastDisconnect }) {
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('🔌 Disconnected. Reconnecting:', shouldReconnect);
            
            this.isConnected = false;
            
            if (shouldReconnect) {
                setTimeout(() => this.initialize(), 3000);
            }
        } else if (connection === 'open') {
            console.log('✅ Bot connected to WhatsApp');
            this.isConnected = true;
            this.botStartTime = Date.now();
        }
    }

    /**
     * Handle incoming messages
     * @param {Object} messageUpdate - Message update object
     */
    async handleMessageUpdate({ messages }) {
        for (const message of messages) {
            try {
                if (this.shouldProcessMessage(message)) {
                    const handler = this.eventHandlers.get('message');
                    if (handler) {
                        await handler(message, this.socket);
                    }
                }
            } catch (error) {
                console.error('❌ Error processing message:', error);
            }
        }
    }

    /**
     * Check if message should be processed
     * @param {Object} message - WhatsApp message object
     * @returns {boolean} - True if message should be processed
     */
    shouldProcessMessage(message) {
        // Skip if no message content or from bot
        if (!message.message || message.key.fromMe) return false;

        // Skip group messages
        if (message.key.remoteJid.endsWith('@g.us')) return false;

        // Check message timestamp
        const msgTimestamp = message.messageTimestamp?.low || message.messageTimestamp;
        const msgTime = msgTimestamp * 1000;

        // Skip old messages
        if (msgTime < this.botStartTime) return false;

        // Skip messages older than 1 day
        const msgDate = new Date(msgTime).toDateString();
        const today = new Date().toDateString();
        if (msgDate !== today) return false;

        return true;
    }

    /**
     * Register event handler
     * @param {string} event - Event name
     * @param {Function} handler - Event handler function
     */
    on(event, handler) {
        this.eventHandlers.set(event, handler);
    }

    /**
     * Send text message
     * @param {string} jid - WhatsApp JID
     * @param {string} text - Message text
     * @returns {Promise} - Send result
     */
    async sendMessage(jid, text) {
        if (!this.isConnected || !this.socket) {
            throw new Error('WhatsApp not connected');
        }

        return await this.socket.sendMessage(jid, { text });
    }

    /**
     * Send document/file
     * @param {string} jid - WhatsApp JID
     * @param {Buffer} buffer - File buffer
     * @param {string} fileName - File name
     * @param {string} mimetype - MIME type
     * @param {string} caption - Optional caption
     * @returns {Promise} - Send result
     */
    async sendDocument(jid, buffer, fileName, mimetype, caption = '') {
        if (!this.isConnected || !this.socket) {
            throw new Error('WhatsApp not connected');
        }

        return await this.socket.sendMessage(jid, {
            document: buffer,
            fileName,
            mimetype,
            caption
        });
    }

    /**
     * Send image
     * @param {string} jid - WhatsApp JID
     * @param {Buffer} buffer - Image buffer
     * @param {string} caption - Optional caption
     * @returns {Promise} - Send result
     */
    async sendImage(jid, buffer, caption = '') {
        if (!this.isConnected || !this.socket) {
            throw new Error('WhatsApp not connected');
        }

        return await this.socket.sendMessage(jid, {
            image: buffer,
            caption
        });
    }

    /**
     * Get connection status
     * @returns {boolean} - Connection status
     */
    isReady() {
        return this.isConnected && this.socket;
    }

    /**
     * Close connection
     */
    async disconnect() {
        if (this.socket) {
            await this.socket.logout();
            this.socket = null;
            this.isConnected = false;
            console.log('🔌 WhatsApp disconnected');
        }
    }
}

module.exports = WhatsAppService;