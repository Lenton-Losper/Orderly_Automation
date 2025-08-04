// Import Baileys functions directly (not as default)
const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const { getSocketConfig, getHealthCheckQuery } = require('../config/socket');
const { CONNECTION_CONFIG, CACHE_CONFIG } = require('../config/constants');

class WhatsAppService {
    constructor() {
        this.socket = null;
        this.connectionRetries = 0;
        this.maxRetries = CONNECTION_CONFIG.MAX_RETRIES;
        this.reconnectTimeout = null;
        this.connectionCheckInterval = null;
        this.botStartTime = null;
        this.eventHandlers = new Map();
        
        // Validate imports are available
        if (!makeWASocket || typeof makeWASocket !== 'function') {
            throw new Error('makeWASocket function not available from Baileys');
        }
        if (!useMultiFileAuthState || typeof useMultiFileAuthState !== 'function') {
            throw new Error('useMultiFileAuthState function not available from Baileys');
        }
        if (!DisconnectReason || typeof DisconnectReason !== 'object') {
            throw new Error('DisconnectReason object not available from Baileys');
        }
        
        console.log('✅ All Baileys imports validated successfully');
    }

    async initialize() {
        try {
            console.log('🚀 Initializing WhatsApp connection...');
            
            // Initialize auth state with better error handling
            let state, saveCreds;
            try {
                // Ensure auth directory exists
                const fs = require('fs');
                const path = require('path');
                const authDir = path.join(process.cwd(), 'auth');
                
                if (!fs.existsSync(authDir)) {
                    fs.mkdirSync(authDir, { recursive: true });
                    console.log('📁 Created auth directory');
                }
                
                const authResult = await useMultiFileAuthState('auth');
                state = authResult.state;
                saveCreds = authResult.saveCreds;
                
                console.log('✅ Auth state initialized successfully');
            } catch (authError) {
                console.error('❌ Auth state error:', authError.message);
                console.log('🗑️ Clearing corrupted auth and retrying...');
                
                // Try to clear and recreate auth
                await this.clearCorruptedAuth();
                
                // Retry auth state creation
                const authResult = await useMultiFileAuthState('auth');
                state = authResult.state;
                saveCreds = authResult.saveCreds;
                
                console.log('✅ Auth state recreated successfully');
            }

            // Create socket with minimal configuration first
            console.log('🧪 Testing minimal socket configuration...');
            
            try {
                // Try minimal config first (removed deprecated printQRInTerminal)
                const minimalConfig = {
                    auth: state,
                    browser: ['LLL Farm Bot', 'Chrome', '120.0.0'],
                    syncFullHistory: false
                };
                
                console.log('🔧 Creating WhatsApp socket with minimal config...');
                this.socket = makeWASocket(minimalConfig);
                console.log('✅ Minimal socket created successfully');
                
            } catch (minimalError) {
                console.error('❌ Minimal socket failed, trying with full config...');
                console.error('Minimal error:', minimalError.message);
                
                // Fall back to full config
                const socketConfig = {
                    auth: state,
                    ...getSocketConfig()
                };
                
                console.log('🔧 Creating WhatsApp socket with full config...');
                console.log('📝 Full config keys:', Object.keys(socketConfig));
                
                this.socket = makeWASocket(socketConfig);
            }
            
            if (!this.socket) {
                throw new Error('makeWASocket returned null/undefined');
            }
            
            console.log('✅ WhatsApp socket created successfully');
            console.log('📊 Socket properties:', Object.keys(this.socket));
            this.botStartTime = Date.now();

            // Setup event handlers
            this.setupEventHandlers(saveCreds);

            console.log(`⏰ WhatsApp service initialized at: ${new Date(this.botStartTime).toLocaleString()}`);
            
            return this.socket;
        } catch (error) {
            console.error('❌ Failed to initialize WhatsApp service:', error.message);
            throw error;
        }
    }

    setupEventHandlers(saveCreds) {
        // Credentials update handler
        this.socket.ev.on('creds.update', saveCreds);
        
        // Connection update handler
        this.socket.ev.on('connection.update', async ({ connection, lastDisconnect, qr, isNewLogin }) => {
            console.log('📡 Connection update:', { connection, isNewLogin });
            
            if (connection === 'close') {
                await this.handleConnectionClose(lastDisconnect);
            } else if (connection === 'open') {
                await this.handleConnectionOpen();
            } else if (connection === 'connecting') {
                console.log('🔄 Connecting to WhatsApp...');
            }
            
            // FIXED: Properly display QR code
            if (qr) {
                console.log('\n📱 ═══════════════════════════════════════');
                console.log('📱 QR CODE TO SCAN:');
                console.log('📱 ═══════════════════════════════════════');
                console.log(qr);
                console.log('📱 ═══════════════════════════════════════');
                console.log('📱 OPTION 1: Copy the text above and paste into WhatsApp Web');
                console.log('📱 OPTION 2: Visit this URL to see QR code:');
                console.log(`📱 https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`);
                console.log('📱 OPTION 3: Open WhatsApp > Settings > Linked Devices > Link a Device');
                console.log('📱 ═══════════════════════════════════════\n');
            }
        });

        // Call handler
        this.socket.ev.on('CB:call', (node) => {
            console.log('📞 Incoming call detected, rejecting...');
            this.socket.rejectCall(node.content[0].attrs['call-id'], node.attrs.from);
        });

        // Credentials handler
        this.socket.ev.on('creds.update', ({ creds }) => {
            if (creds) {
                console.log('🔐 Credentials updated');
            }
        });
    }

    async handleConnectionClose(lastDisconnect) {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        
        console.log('🔌 Connection closed:', {
            statusCode,
            shouldReconnect,
            error: lastDisconnect?.error?.message
        });
        
        // Clear health check
        if (this.connectionCheckInterval) {
            clearInterval(this.connectionCheckInterval);
            this.connectionCheckInterval = null;
        }
        
        if (shouldReconnect) {
            this.connectionRetries++;
            
            if (this.connectionRetries < this.maxRetries) {
                const baseDelay = Math.min(
                    CONNECTION_CONFIG.RECONNECT_BASE_DELAY * Math.pow(2, this.connectionRetries), 
                    CONNECTION_CONFIG.MAX_RECONNECT_DELAY
                );
                const jitter = Math.random() * 2000;
                const delay = baseDelay + jitter;
                
                console.log(`⏳ Reconnecting in ${Math.round(delay/1000)} seconds... (Attempt ${this.connectionRetries}/${this.maxRetries})`);
                
                clearTimeout(this.reconnectTimeout);
                this.reconnectTimeout = setTimeout(() => {
                    this.initialize();
                }, delay);
            } else {
                console.error('❌ Max reconnection attempts reached. Waiting 5 minutes before retry...');
                
                setTimeout(() => {
                    this.connectionRetries = 0;
                    this.initialize();
                }, CONNECTION_CONFIG.FATAL_ERROR_RETRY_DELAY);
            }
        } else {
            console.log('🛑 Bot logged out. Manual intervention required.');
        }
    }

    async handleConnectionOpen() {
        console.log('✅ Bot connected to WhatsApp successfully!');
        this.connectionRetries = 0;
        
        try {
            await this.socket.sendPresenceUpdate('available');
            console.log('👋 Presence set to available');
        } catch (err) {
            console.log('⚠️ Could not set presence:', err.message);
        }

        // Start connection health check
        this.startHealthCheck();
    }

    startHealthCheck() {
        this.connectionCheckInterval = setInterval(async () => {
            try {
                const query = getHealthCheckQuery(this.socket);
                await this.socket.query(query);
            } catch (err) {
                console.log('💓 Connection ping failed:', err.message);
            }
        }, CACHE_CONFIG.CONNECTION_HEALTH_CHECK_INTERVAL);
    }

    async clearCorruptedAuth() {
        try {
            const fs = require('fs');
            const path = require('path');
            const authDir = path.join(process.cwd(), 'auth');
            
            if (fs.existsSync(authDir)) {
                console.log('🗑️ Clearing corrupted auth state...');
                
                // Remove all files in auth directory
                const files = fs.readdirSync(authDir);
                for (const file of files) {
                    const filePath = path.join(authDir, file);
                    try {
                        if (fs.statSync(filePath).isDirectory()) {
                            fs.rmSync(filePath, { recursive: true, force: true });
                        } else {
                            fs.unlinkSync(filePath);
                        }
                    } catch (fileError) {
                        console.warn(`⚠️ Could not delete ${filePath}:`, fileError.message);
                    }
                }
                
                console.log('✅ Auth directory cleared');
            } else {
                console.log('📁 Auth directory does not exist, creating...');
                fs.mkdirSync(authDir, { recursive: true });
            }
        } catch (error) {
            console.error('❌ Error clearing auth directory:', error.message);
            // Don't throw error, just log it
        }
    }

    // ✅ UPDATED: Enhanced message sending methods with PDF support
    async sendMessage(to, content) {
        try {
            if (!this.socket) {
                throw new Error('WhatsApp socket not initialized');
            }
            
            // Add typing indicator for better UX
            await this.socket.sendPresenceUpdate('composing', to);
            await new Promise(resolve => setTimeout(resolve, 1000));
            await this.socket.sendPresenceUpdate('paused', to);
            
            // Send message
            await this.socket.sendMessage(to, content);
            return true;
        } catch (error) {
            console.error('❌ Failed to send message:', error.message);
            return false;
        }
    }

    async sendTextMessage(to, text) {
        return await this.sendMessage(to, { text });
    }

    // ✅ NEW: Send PDF document method
    async sendDocument(userId, filepath, filename, caption = '') {
        try {
            console.log(`📎 Sending PDF document to ${userId}: ${filename}`);
            
            const fs = require('fs');
            
            // Check if file exists
            if (!fs.existsSync(filepath)) {
                throw new Error(`File not found: ${filepath}`);
            }

            // Check socket availability
            if (!this.socket) {
                throw new Error('WhatsApp socket not initialized');
            }

            // Read file as buffer
            const fileBuffer = fs.readFileSync(filepath);
            
            // Add uploading indicator
            await this.socket.sendPresenceUpdate('composing', userId);
            
            // Send document message
            const message = {
                document: fileBuffer,
                fileName: filename,
                mimetype: 'application/pdf',
                caption: caption || `📄 ${filename}`
            };

            await this.socket.sendMessage(userId, message);
            
            // Reset presence
            await this.socket.sendPresenceUpdate('paused', userId);
            
            console.log(`✅ PDF sent successfully to ${userId}`);
            
            return true;
        } catch (error) {
            console.error('❌ Error sending PDF:', error.message);
            console.error('❌ Error details:', {
                filepath,
                filename,
                userId,
                socketExists: !!this.socket,
                errorType: error.name
            });
            return false;
        }
    }

    // ✅ NEW: Send image method (useful for QR codes, receipts, etc.)
    async sendImage(userId, imagePath, caption = '') {
        try {
            console.log(`🖼️ Sending image to ${userId}`);
            
            const fs = require('fs');
            
            if (!fs.existsSync(imagePath)) {
                throw new Error(`Image file not found: ${imagePath}`);
            }

            if (!this.socket) {
                throw new Error('WhatsApp socket not initialized');
            }

            const imageBuffer = fs.readFileSync(imagePath);
            
            await this.socket.sendPresenceUpdate('composing', userId);
            
            const message = {
                image: imageBuffer,
                caption: caption
            };

            await this.socket.sendMessage(userId, message);
            await this.socket.sendPresenceUpdate('paused', userId);
            
            console.log(`✅ Image sent successfully to ${userId}`);
            return true;
            
        } catch (error) {
            console.error('❌ Error sending image:', error.message);
            return false;
        }
    }

    // ✅ NEW: Send order confirmation with PDF invoice
    async sendOrderConfirmationWithPDF(userId, textMessage, pdfPath, pdfFilename) {
        try {
            console.log(`📋 Sending order confirmation with PDF to ${userId}`);
            
            // Send text confirmation first
            const textSent = await this.sendTextMessage(userId, textMessage);
            if (!textSent) {
                throw new Error('Failed to send text confirmation');
            }
            
            // Wait a moment then send PDF
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const pdfSent = await this.sendDocument(
                userId, 
                pdfPath, 
                pdfFilename, 
                '📄 Your invoice is attached above'
            );
            
            if (!pdfSent) {
                // Fallback - send error message
                await this.sendTextMessage(userId, 
                    '❌ Sorry, there was an issue generating your invoice PDF. Please contact support for a copy.');
                return false;
            }
            
            console.log(`✅ Order confirmation with PDF sent successfully to ${userId}`);
            return true;
            
        } catch (error) {
            console.error('❌ Error sending order confirmation with PDF:', error.message);
            
            // Try to send at least an error message
            try {
                await this.sendTextMessage(userId, 
                    '❌ There was an issue processing your order confirmation. Please contact support.');
            } catch (fallbackError) {
                console.error('❌ Failed to send fallback error message:', fallbackError.message);
            }
            
            return false;
        }
    }

    // ✅ NEW: Send typing indicator
    async sendTyping(userId, duration = 3000) {
        try {
            if (!this.socket) return false;
            
            await this.socket.sendPresenceUpdate('composing', userId);
            
            setTimeout(async () => {
                try {
                    await this.socket.sendPresenceUpdate('paused', userId);
                } catch (err) {
                    console.log('⚠️ Could not clear typing indicator:', err.message);
                }
            }, duration);
            
            return true;
        } catch (error) {
            console.error('❌ Error sending typing indicator:', error.message);
            return false;
        }
    }

    // Event handler registration
    onMessage(handler) {
        if (this.socket) {
            this.socket.ev.on('messages.upsert', handler);
        } else {
            throw new Error('Socket not initialized. Call initialize() first.');
        }
    }

    // Utility methods
    isConnected() {
        return this.socket && this.socket.user;
    }

    getBotStartTime() {
        return this.botStartTime;
    }

    getSocket() {
        return this.socket;
    }

    getBotPhoneNumber() {
        return this.socket?.user?.id?.split('@')[0] || null;
    }

    // ✅ NEW: Get bot info
    getBotInfo() {
        if (!this.socket || !this.socket.user) {
            return null;
        }
        
        return {
            phoneNumber: this.getBotPhoneNumber(),
            name: this.socket.user.name || 'LLL Farm Bot',
            id: this.socket.user.id,
            startTime: this.botStartTime,
            uptime: this.botStartTime ? Date.now() - this.botStartTime : 0
        };
    }

    // ✅ NEW: Health check method
    async healthCheck() {
        try {
            if (!this.socket) {
                return { status: 'disconnected', error: 'Socket not initialized' };
            }
            
            if (!this.socket.user) {
                return { status: 'disconnected', error: 'Not authenticated' };
            }
            
            // Try to send a presence update as a health check
            await this.socket.sendPresenceUpdate('available');
            
            return { 
                status: 'connected', 
                botInfo: this.getBotInfo(),
                uptime: this.botStartTime ? Date.now() - this.botStartTime : 0
            };
            
        } catch (error) {
            return { 
                status: 'error', 
                error: error.message 
            };
        }
    }

    // Cleanup method
    cleanup() {
        console.log('🧹 Cleaning up WhatsApp service...');
        
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        
        if (this.connectionCheckInterval) {
            clearInterval(this.connectionCheckInterval);
            this.connectionCheckInterval = null;
        }
        
        if (this.socket) {
            this.socket.end();
            this.socket = null;
        }
        
        console.log('✅ WhatsApp service cleanup completed');
    }
}

module.exports = new WhatsAppService();